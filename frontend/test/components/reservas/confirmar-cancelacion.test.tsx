import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ConsultaReserva } from "../../../src/components/reservas/consulta-reserva";
import { apiClient } from "../../../src/lib/api/client";

// Sub-vista "confirmar cancelación" de ConsultaReserva (design.md D3 Pantallas 8 y 9). Igual
// que consulta-reserva.test.tsx, solo se mockea `apiClient`; `toApiResult` es el real.
jest.mock("../../../src/lib/api/client", () => ({
  ...jest.requireActual("../../../src/lib/api/client"),
  apiClient: { POST: jest.fn(), GET: jest.fn() },
}));

const POST = apiClient.POST as unknown as jest.Mock;
const GET = apiClient.GET as unknown as jest.Mock;

// jsdom no implementa la semántica modal de HTMLDialogElement: los stubs reflejan el atributo
// `open` para poder consultar si el diálogo está abierto (como test/components/ui/dialog.test).
const showModal = jest.fn(function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
});
const close = jest.fn(function (this: HTMLDialogElement) {
  this.removeAttribute("open");
});

// Fecha lejana: el botón de cancelar se ofrece sin depender del día en que corre la suite.
const RESERVA = {
  codigoReserva: "K7PM3QXA",
  estado: "CONFIRMADA",
  fecha: "2099-01-01",
  comensales: 4,
  turno: { id: "t-1", horaInicio: "20:00", horaFin: "23:30" },
  zona: { id: "z-1", nombre: "VIP" },
};
const ZONA = { id: "z-1", nombre: "VIP", ventanaCancelacionHoras: 24 };
const EMAIL = "ana.perez@example.com";

function respuestaOk(data: unknown, status = 200) {
  return { data, response: { ok: true, status } };
}

function respuestaError(status: number, error?: unknown) {
  return { error, response: { ok: false, status } };
}

// La llamada a consultar responde con la reserva; la de cancelar, lo que dicte cada test.
function mockearPost(alCancelar: unknown) {
  POST.mockImplementation(async (ruta: string) =>
    ruta === "/reservas/consultar" ? respuestaOk(RESERVA) : alCancelar,
  );
}

async function verDetalle() {
  render(<ConsultaReserva />);
  fireEvent.change(screen.getByLabelText("Código de reserva"), { target: { value: "K7PM3QXA" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: ` ${EMAIL} ` } });
  fireEvent.click(screen.getByRole("button", { name: "Buscar mi reserva" }));
  await screen.findByRole("heading", { level: 1, name: "Tu reserva está confirmada" });
}

async function abrirDialogo() {
  fireEvent.click(await screen.findByRole("button", { name: "Cancelar mi reserva" }));
  return screen.getByRole("dialog", { name: "¿Cancelar tu reserva?" });
}

function confirmar() {
  fireEvent.click(screen.getByRole("button", { name: "Sí, cancelar" }));
}

const llamadasACancelar = () =>
  POST.mock.calls.filter(([ruta]) => ruta === "/reservas/{codigo}/cancelar");

beforeEach(() => {
  POST.mockReset();
  GET.mockReset();
  GET.mockResolvedValue(respuestaOk([ZONA]));
  showModal.mockClear();
  close.mockClear();
  HTMLDialogElement.prototype.showModal = showModal;
  HTMLDialogElement.prototype.close = close;
});

describe("ConsultaReserva - confirmar cancelación", () => {
  it("no hay diálogo abierto hasta que se elige cancelar", async () => {
    mockearPost(respuestaOk(undefined, 204));
    await verDetalle();
    await screen.findByRole("button", { name: "Cancelar mi reserva" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(showModal).not.toHaveBeenCalled();
  });

  it("'Cancelar mi reserva' abre el diálogo con el resumen de la reserva", async () => {
    mockearPost(respuestaOk(undefined, 204));
    await verDetalle();

    const dialogo = await abrirDialogo();

    expect(showModal).toHaveBeenCalledTimes(1);
    const resumen = within(dialogo);
    expect(resumen.getByText("K7PM3QXA")).toBeInTheDocument();
    expect(resumen.getByText("jueves, 1 de enero de 2099")).toBeInTheDocument();
    expect(resumen.getByText("20:00 a 23:30")).toBeInTheDocument();
    expect(resumen.getByText("VIP")).toBeInTheDocument();
    expect(resumen.getByText("4")).toBeInTheDocument();
    expect(resumen.getByRole("button", { name: "Sí, cancelar" })).toBeEnabled();
    expect(resumen.getByRole("button", { name: "Volver" })).toBeEnabled();
    expect(llamadasACancelar()).toHaveLength(0);
  });

  it("'Volver' cierra el diálogo sin enviar nada y sin cambiar el estado mostrado", async () => {
    mockearPost(respuestaOk(undefined, 204));
    await verDetalle();
    await abrirDialogo();

    fireEvent.click(screen.getByRole("button", { name: "Volver" }));

    expect(close).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(llamadasACancelar()).toHaveLength(0);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tu reserva está confirmada");
    expect(screen.getByRole("button", { name: "Cancelar mi reserva" })).toBeInTheDocument();
  });

  it("Escape cierra el diálogo sin enviar nada", async () => {
    mockearPost(respuestaOk(undefined, 204));
    await verDetalle();
    const dialogo = await abrirDialogo();

    fireEvent(dialogo, new Event("cancel", { cancelable: true }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(llamadasACancelar()).toHaveLength(0);
  });

  it("puede abrirse de nuevo después de cerrarlo", async () => {
    mockearPost(respuestaOk(undefined, 204));
    await verDetalle();
    await abrirDialogo();
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));

    await abrirDialogo();

    expect(showModal).toHaveBeenCalledTimes(2);
  });

  it("confirmar envía el email ya verificado al código de la reserva consultada", async () => {
    mockearPost(respuestaOk(undefined, 204));
    await verDetalle();
    await abrirDialogo();

    confirmar();

    await waitFor(() => expect(llamadasACancelar()).toHaveLength(1));
    expect(POST).toHaveBeenCalledWith("/reservas/{codigo}/cancelar", {
      params: { path: { codigo: "K7PM3QXA" } },
      body: { email: EMAIL },
    });
  });

  describe("mientras la cancelación está pendiente", () => {
    async function conCancelacionPendiente() {
      mockearPost(new Promise(() => {}));
      await verDetalle();
      const dialogo = await abrirDialogo();
      confirmar();
      await screen.findByRole("button", { name: "Cancelando…" });
      return dialogo;
    }

    it("'Sí, cancelar' muestra el estado de carga y queda deshabilitado", async () => {
      await conCancelacionPendiente();

      expect(screen.getByRole("button", { name: "Cancelando…" })).toBeDisabled();
      expect(screen.queryByRole("button", { name: "Sí, cancelar" })).not.toBeInTheDocument();
    });

    it("'Volver' queda deshabilitado y no cierra el diálogo", async () => {
      await conCancelacionPendiente();

      const volver = screen.getByRole("button", { name: "Volver" });
      fireEvent.click(volver);

      expect(volver).toBeDisabled();
      expect(close).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog", { name: "¿Cancelar tu reserva?" })).toBeInTheDocument();
    });

    it("Escape no cierra el diálogo", async () => {
      const dialogo = await conCancelacionPendiente();

      const escape = new Event("cancel", { cancelable: true });
      fireEvent(dialogo, escape);

      expect(escape.defaultPrevented).toBe(true);
      expect(close).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog", { name: "¿Cancelar tu reserva?" })).toBeInTheDocument();
    });

    it("si el navegador lo cierra igual, el diálogo se vuelve a mostrar", async () => {
      const dialogo = await conCancelacionPendiente();

      act(() => {
        dialogo.removeAttribute("open");
        dialogo.dispatchEvent(new Event("close"));
      });

      expect(showModal).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("dialog", { name: "¿Cancelar tu reserva?" })).toBeInTheDocument();
    });

    it("una segunda confirmación no dispara otra solicitud", async () => {
      mockearPost(new Promise(() => {}));
      await verDetalle();
      await abrirDialogo();

      // Dos confirmaciones dentro del mismo `act`, antes de que React deshabilite el botón: así
      // se ejercita la guarda de `cancelar()` (un clic sobre el botón ya deshabilitado no llega).
      act(() => {
        confirmar();
        confirmar();
      });

      expect(llamadasACancelar()).toHaveLength(1);
    });
  });

  describe("cuando la cancelación se completa (204)", () => {
    it("cierra el diálogo, pasa a CANCELADA sin volver a consultar y oculta la acción", async () => {
      mockearPost(respuestaOk(undefined, 204));
      await verDetalle();
      await abrirDialogo();

      confirmar();

      expect(
        await screen.findByRole("heading", { level: 1, name: "Tu reserva está cancelada" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Cancelada")).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Tu reserva fue cancelada.");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(close).toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: "Cancelar mi reserva" })).not.toBeInTheDocument();
      expect(POST.mock.calls.filter(([ruta]) => ruta === "/reservas/consultar")).toHaveLength(1);
      // El resumen sigue a la vista y no se vuelven a pedir las zonas.
      expect(screen.getByText("K7PM3QXA")).toBeInTheDocument();
      expect(GET).toHaveBeenCalledTimes(1);
    });

    it("lleva el foco al título: el botón que abrió el diálogo ya no existe", async () => {
      mockearPost(respuestaOk(undefined, 204));
      await verDetalle();
      await abrirDialogo();

      confirmar();

      const titulo = await screen.findByRole("heading", { level: 1, name: "Tu reserva está cancelada" });
      expect(titulo).toHaveFocus();
    });
  });

  describe("cuando la cancelación es rechazada", () => {
    const MENSAJE_409 =
      "No se pudo cancelar la reserva: la ventana para cancelar ya venció o la reserva ya no se puede cancelar.";

    it.each([
      [
        404,
        { statusCode: 404, message: "Reserva no encontrada (texto del servidor)" },
        "No encontramos una reserva con esos datos. Revisá el código y el email.",
      ],
      [409, { statusCode: 409, message: "texto interno del servidor" }, MENSAJE_409],
      [
        429,
        undefined,
        "Hiciste demasiados intentos. Esperá unos minutos antes de volver a intentar.",
      ],
      [
        500,
        { statusCode: 500, message: "stack interno" },
        "El servicio no está disponible en este momento. Intentá de nuevo más tarde.",
      ],
    ])(
      "un %i muestra el mensaje dentro del diálogo, que sigue abierto, sin cambiar el estado",
      async (status, cuerpo, mensaje) => {
        mockearPost(respuestaError(status, cuerpo));
        await verDetalle();
        const dialogo = await abrirDialogo();

        confirmar();

        const alerta = await within(dialogo).findByRole("alert");
        expect(alerta).toHaveTextContent(mensaje);
        expect(alerta.textContent).not.toMatch(/servidor\)|texto interno|stack interno/);
        expect(close).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog", { name: "¿Cancelar tu reserva?" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
          "Tu reserva está confirmada",
        );
        expect(screen.queryByText("Tu reserva fue cancelada.")).not.toBeInTheDocument();
        // Terminó la solicitud: se puede cerrar el diálogo y volver a confirmar.
        expect(within(dialogo).getByRole("button", { name: "Sí, cancelar" })).toBeEnabled();
        expect(within(dialogo).getByRole("button", { name: "Volver" })).toBeEnabled();
      },
    );

    it("una falla de red muestra el mensaje de conexión dentro del diálogo", async () => {
      POST.mockImplementation(async (ruta: string) => {
        if (ruta === "/reservas/consultar") return respuestaOk(RESERVA);
        throw new TypeError("fetch failed");
      });
      await verDetalle();
      const dialogo = await abrirDialogo();

      confirmar();

      expect(await within(dialogo).findByRole("alert")).toHaveTextContent(
        "No se pudo conectar con el servidor.",
      );
    });

    it("un lanzamiento síncrono de la solicitud se muestra como error y no traba el diálogo", async () => {
      // Sin `async`: `POST` lanza antes de devolver una promesa, así que no pasa por `toApiResult`.
      POST.mockImplementation((ruta: string) => {
        if (ruta === "/reservas/consultar") return Promise.resolve(respuestaOk(RESERVA));
        throw new Error("falla inesperada");
      });
      await verDetalle();
      const dialogo = await abrirDialogo();

      confirmar();

      const alerta = await within(dialogo).findByRole("alert");
      expect(alerta).toHaveTextContent("Ocurrió un error inesperado.");
      expect(alerta.textContent).not.toMatch(/falla inesperada/);
      expect(within(dialogo).getByRole("button", { name: "Sí, cancelar" })).toBeEnabled();

      fireEvent.click(within(dialogo).getByRole("button", { name: "Volver" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cancelar mi reserva" })).toBeInTheDocument();
    });

    it("un 429 no ofrece un botón para reintentar", async () => {
      mockearPost(respuestaError(429));
      await verDetalle();
      const dialogo = await abrirDialogo();

      confirmar();

      await within(dialogo).findByRole("alert");
      expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    });

    it("el error se limpia al volver a confirmar y un segundo intento exitoso cancela", async () => {
      mockearPost(respuestaError(409, { statusCode: 409, message: "x" }));
      await verDetalle();
      const dialogo = await abrirDialogo();
      confirmar();
      await within(dialogo).findByRole("alert");

      mockearPost(respuestaOk(undefined, 204));
      confirmar();

      expect(
        await screen.findByRole("heading", { level: 1, name: "Tu reserva está cancelada" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("tras un 409, al cerrar el diálogo el detalle ya no ofrece cancelar y lo avisa", async () => {
      mockearPost(respuestaError(409, { statusCode: 409, message: "x" }));
      await verDetalle();
      const dialogo = await abrirDialogo();
      confirmar();
      await within(dialogo).findByRole("alert");

      fireEvent.click(screen.getByRole("button", { name: "Volver" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Cancelar mi reserva" })).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Esta reserva ya no se puede cancelar.");
      // El 409 no dice en qué estado quedó la reserva: el detalle no lo cambia.
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "Tu reserva está confirmada",
      );
      expect(llamadasACancelar()).toHaveLength(1);
    });

    it.each([[404], [429], [500]])(
      "tras un %i, al cerrar el diálogo el detalle sigue ofreciendo cancelar",
      async (status) => {
        mockearPost(respuestaError(status));
        await verDetalle();
        const dialogo = await abrirDialogo();
        confirmar();
        await within(dialogo).findByRole("alert");

        fireEvent.click(screen.getByRole("button", { name: "Volver" }));

        expect(screen.getByRole("button", { name: "Cancelar mi reserva" })).toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      },
    );

    it("el error no queda al cerrar y volver a abrir el diálogo", async () => {
      mockearPost(respuestaError(500, { statusCode: 500, message: "x" }));
      await verDetalle();
      const dialogo = await abrirDialogo();
      confirmar();
      await within(dialogo).findByRole("alert");
      fireEvent.click(screen.getByRole("button", { name: "Volver" }));

      const reabierto = await abrirDialogo();

      expect(within(reabierto).queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
