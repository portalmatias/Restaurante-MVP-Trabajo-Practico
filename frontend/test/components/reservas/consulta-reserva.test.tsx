import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConsultaReserva } from "../../../src/components/reservas/consulta-reserva";
import { apiClient } from "../../../src/lib/api/client";

// Se mockea solo `apiClient`: `toApiResult` es el real, así el mapeo de errores es el de
// producción. Sin red (design.md D10: el componente se prueba con datos de prueba locales).
jest.mock("../../../src/lib/api/client", () => ({
  ...jest.requireActual("../../../src/lib/api/client"),
  apiClient: { POST: jest.fn(), GET: jest.fn() },
}));

const POST = apiClient.POST as unknown as jest.Mock;
const GET = apiClient.GET as unknown as jest.Mock;

const RESERVA = {
  codigoReserva: "K7PM3QXA",
  estado: "CONFIRMADA",
  fecha: "2026-09-19",
  comensales: 4,
  turno: { id: "t-1", horaInicio: "20:00", horaFin: "23:30" },
  zona: { id: "z-1", nombre: "VIP" },
};

// Zona de la reserva de prueba (`RESERVA.zona`) como la entrega `GET /zonas`.
const ZONA = {
  id: "z-1",
  nombre: "VIP",
  minComensales: 2,
  maxComensales: 12,
  anticipacionMinHoras: 24,
  anticipacionMaxDias: 60,
  ventanaCancelacionHoras: 24,
  requiereConfirmacionAdmin: true,
};

function respuestaOk(data: unknown) {
  return { data, response: { ok: true, status: 200 } };
}

function respuestaError(status: number, error?: unknown) {
  return { error, response: { ok: false, status } };
}

function escribir(etiqueta: string | RegExp, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

function completarFormulario(codigo = "K7PM3QXA", email = "ana.perez@example.com") {
  escribir("Código de reserva", codigo);
  escribir("Email", email);
}

function enviar() {
  fireEvent.click(screen.getByRole("button", { name: "Buscar mi reserva" }));
}

beforeEach(() => {
  POST.mockReset();
  GET.mockReset();
  GET.mockResolvedValue(respuestaOk([ZONA]));
});

describe("ConsultaReserva - formulario", () => {
  it("muestra los campos de código y email y el botón de buscar", () => {
    render(<ConsultaReserva />);

    expect(screen.getByLabelText("Código de reserva")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByRole("button", { name: "Buscar mi reserva" })).toBeInTheDocument();
  });

  it("prellena el código recibido y deja el email vacío", () => {
    render(<ConsultaReserva codigoInicial="K7PM3QXA" />);

    expect(screen.getByLabelText("Código de reserva")).toHaveValue("K7PM3QXA");
    expect(screen.getByLabelText("Email")).toHaveValue("");
  });

  it("pasa a mayúsculas el código mientras se tipea", () => {
    render(<ConsultaReserva />);

    escribir("Código de reserva", "k7pm3qxa");

    expect(screen.getByLabelText("Código de reserva")).toHaveValue("K7PM3QXA");
  });

  it("limita el código a 8 caracteres", () => {
    render(<ConsultaReserva />);

    expect(screen.getByLabelText("Código de reserva")).toHaveAttribute("maxlength", "8");
  });

  it("solo con el código completo, no envía y señala que falta el email", () => {
    render(<ConsultaReserva />);

    escribir("Código de reserva", "K7PM3QXA");
    enviar();

    expect(POST).not.toHaveBeenCalled();
    expect(screen.getByText("Falta ingresar tu email.")).toBeInTheDocument();
  });

  it("sin código no envía y señala que falta el código", () => {
    render(<ConsultaReserva />);

    escribir("Email", "ana.perez@example.com");
    enviar();

    expect(POST).not.toHaveBeenCalled();
    expect(screen.getByText("Falta ingresar el código de tu reserva.")).toBeInTheDocument();
  });

  it("valida en línea al salir de cada campo: código de formato inválido y email sin arroba", () => {
    render(<ConsultaReserva />);

    escribir("Código de reserva", "ABC");
    fireEvent.blur(screen.getByLabelText("Código de reserva"));
    escribir("Email", "ana.perez");
    fireEvent.blur(screen.getByLabelText("Email"));

    expect(
      screen.getByText("El código tiene 8 caracteres, entre letras y números."),
    ).toBeInTheDocument();
    expect(screen.getByText("Ingresá un email válido.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("envía código y email al endpoint de consulta", async () => {
    POST.mockResolvedValue(respuestaOk(RESERVA));
    render(<ConsultaReserva />);

    completarFormulario("k7pm3qxa", "ana.perez@example.com");
    enviar();

    await waitFor(() => expect(POST).toHaveBeenCalledTimes(1));
    expect(POST).toHaveBeenCalledWith("/reservas/consultar", {
      body: { codigo: "K7PM3QXA", email: "ana.perez@example.com" },
    });
  });

  it("mientras la consulta está pendiente deshabilita el botón y cambia su texto", async () => {
    POST.mockReturnValue(new Promise(() => {}));
    render(<ConsultaReserva />);

    completarFormulario();
    enviar();

    const boton = await screen.findByRole("button", { name: "Buscando…" });
    expect(boton).toBeDisabled();
  });

  it("un 404 muestra el mismo mensaje genérico sin indicar cuál dato falló", async () => {
    POST.mockResolvedValue(respuestaError(404, { statusCode: 404, message: "Reserva no encontrada" }));
    render(<ConsultaReserva />);

    completarFormulario();
    enviar();

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(
      "No encontramos una reserva con esos datos. Revisá el código y el email.",
    );
    expect(alerta.textContent).not.toMatch(/Reserva no encontrada/);
    expect(screen.getByLabelText("Código de reserva")).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("un 400 muestra un mensaje fijo, nunca el cuerpo del servidor", async () => {
    POST.mockResolvedValue(
      respuestaError(400, { statusCode: 400, message: ["codigo detalle interno del validador"] }),
    );
    render(<ConsultaReserva />);

    completarFormulario();
    enviar();

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Revisá el código y el email e intentá de nuevo.");
    expect(alerta.textContent).not.toMatch(/detalle interno/);
  });

  it.each([400, 404, 429])("un %i no ofrece 'Reintentar'", async (status) => {
    POST.mockResolvedValue(respuestaError(status, { statusCode: status, message: "x" }));
    render(<ConsultaReserva />);

    completarFormulario();
    enviar();

    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });

  it("un 429 muestra el mensaje de espera", async () => {
    POST.mockResolvedValue(respuestaError(429));
    render(<ConsultaReserva />);

    completarFormulario();
    enviar();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Hiciste demasiados intentos. Esperá unos minutos antes de volver a intentar.",
    );
  });

  it("mientras consulta deshabilita el código y el email, y los rehabilita con los valores al fallar", async () => {
    let resolver: (valor: unknown) => void = () => {};
    POST.mockReturnValue(new Promise((resolve) => (resolver = resolve)));
    render(<ConsultaReserva />);

    completarFormulario("K7PM3QXA", "ana.perez@example.com");
    enviar();

    await screen.findByRole("button", { name: "Buscando…" });
    expect(screen.getByLabelText("Código de reserva")).toBeDisabled();
    expect(screen.getByLabelText("Email")).toBeDisabled();

    resolver(respuestaError(404, { statusCode: 404, message: "x" }));

    await screen.findByRole("alert");
    expect(screen.getByLabelText("Código de reserva")).toBeEnabled();
    expect(screen.getByLabelText("Código de reserva")).toHaveValue("K7PM3QXA");
    expect(screen.getByLabelText("Email")).toHaveValue("ana.perez@example.com");
  });

  it("al resolver la consulta pendiente muestra el detalle de esa consulta", async () => {
    let resolver: (valor: unknown) => void = () => {};
    POST.mockReturnValue(new Promise((resolve) => (resolver = resolve)));
    render(<ConsultaReserva />);

    completarFormulario();
    enviar();
    await screen.findByRole("button", { name: "Buscando…" });
    resolver(respuestaOk(RESERVA));

    expect(await screen.findByText("K7PM3QXA")).toBeInTheDocument();
  });

  it("un segundo envío mientras hay una consulta en curso no dispara otra solicitud", async () => {
    POST.mockReturnValue(new Promise(() => {}));
    const { container } = render(<ConsultaReserva />);

    completarFormulario();
    const formulario = container.querySelector("form") as HTMLFormElement;
    fireEvent.submit(formulario);
    fireEvent.submit(formulario);
    fireEvent.submit(formulario);

    await screen.findByRole("button", { name: "Buscando…" });
    expect(POST).toHaveBeenCalledTimes(1);
  });

  it("una doble activación inmediata de 'Reintentar' dispara una sola solicitud", async () => {
    POST.mockRejectedValueOnce(new TypeError("fetch failed"));
    render(<ConsultaReserva />);
    completarFormulario();
    enviar();
    const reintentar = await screen.findByRole("button", { name: "Reintentar" });
    expect(POST).toHaveBeenCalledTimes(1);

    POST.mockReturnValue(new Promise(() => {}));
    // Dentro de un mismo `act` React no refleja todavía el estado: el botón sigue en el DOM y
    // habilitado en la segunda activación, así que solo la guarda `enCurso` evita el duplicado.
    act(() => {
      reintentar.click();
      reintentar.click();
    });

    expect(POST).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });

  it("un error de servidor muestra el mensaje genérico y conserva código y email", async () => {
    POST.mockResolvedValue(respuestaError(500, { message: "stack interno" }));
    render(<ConsultaReserva />);

    completarFormulario("K7PM3QXA", "ana.perez@example.com");
    enviar();

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Intentá de nuevo más tarde.");
    expect(alerta.textContent).not.toMatch(/stack interno/);
    expect(screen.getByLabelText("Código de reserva")).toHaveValue("K7PM3QXA");
    expect(screen.getByLabelText("Email")).toHaveValue("ana.perez@example.com");
  });

  it("una falla de red muestra el mensaje genérico, conserva los datos y permite reintentar", async () => {
    POST.mockRejectedValueOnce(new TypeError("fetch failed"));
    render(<ConsultaReserva />);

    completarFormulario("K7PM3QXA", "ana.perez@example.com");
    enviar();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo conectar con el servidor.",
    );
    expect(screen.getByLabelText("Código de reserva")).toHaveValue("K7PM3QXA");
    expect(screen.getByLabelText("Email")).toHaveValue("ana.perez@example.com");

    POST.mockResolvedValue(respuestaOk(RESERVA));
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(POST).toHaveBeenCalledTimes(2));
    expect(POST).toHaveBeenLastCalledWith("/reservas/consultar", {
      body: { codigo: "K7PM3QXA", email: "ana.perez@example.com" },
    });
    expect(await screen.findByText("K7PM3QXA")).toBeInTheDocument();
  });

  it("un envío exitoso pasa al detalle con los datos de la respuesta", async () => {
    POST.mockResolvedValue(respuestaOk(RESERVA));
    render(<ConsultaReserva />);

    completarFormulario();
    enviar();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Tu reserva está confirmada" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Buscar mi reserva" })).not.toBeInTheDocument();
  });
});

describe("ConsultaReserva - detalle", () => {
  async function verDetalle(reserva: Record<string, unknown> = RESERVA) {
    POST.mockResolvedValue(respuestaOk(reserva));
    const resultado = render(<ConsultaReserva />);
    completarFormulario();
    enviar();
    await screen.findByRole("heading", { level: 1, name: /^Tu reserva (está|figura)/ });
    return resultado;
  }

  it("muestra el código, la fecha formateada, el turno, la zona y los comensales", async () => {
    await verDetalle();

    expect(screen.getByText("K7PM3QXA")).toBeInTheDocument();
    expect(screen.getByText("sábado, 19 de septiembre de 2026")).toBeInTheDocument();
    expect(screen.getByText("20:00 a 23:30")).toBeInTheDocument();
    expect(screen.getByText("VIP")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it.each([
    ["CONFIRMADA", "Tu reserva está confirmada"],
    ["PENDIENTE", "Tu reserva está pendiente de confirmación"],
    ["CANCELADA", "Tu reserva está cancelada"],
    ["NO_SHOW", "Tu reserva figura como no presentada"],
  ])("el estado %s se muestra como '%s'", async (estado, titulo) => {
    await verDetalle({ ...RESERVA, estado });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(titulo);
  });

  it("una fecha inválida en la respuesta no rompe el detalle y se muestra tal cual", async () => {
    await verDetalle({ ...RESERVA, fecha: "2026-02-30" });

    expect(screen.getByText("2026-02-30")).toBeInTheDocument();
    expect(screen.getByText("20:00 a 23:30")).toBeInTheDocument();
    expect(screen.getByText("VIP")).toBeInTheDocument();
  });

  it("no renderiza nombre, email ni teléfono aunque la API los devuelva", async () => {
    const { container } = await verDetalle({
      ...RESERVA,
      nombreCliente: "Ana Pérez",
      emailCliente: "otro.email@example.com",
      telefonoCliente: "+54 9 11 5555-1234",
    });

    const texto = container.textContent ?? "";
    expect(texto).not.toContain("Ana Pérez");
    expect(texto).not.toContain("+54 9 11 5555-1234");
    // Ni el email de otra reserva ni el que se tipeó para consultar.
    expect(texto).not.toContain("otro.email@example.com");
    expect(texto).not.toContain("ana.perez@example.com");
    expect(container.querySelector("input")).toBeNull();
    expect(container.innerHTML).not.toContain("ana.perez@example.com");
  });

  it("'Consultar otra reserva' vuelve al formulario y no conserva el email", async () => {
    await verDetalle();

    fireEvent.click(screen.getByRole("button", { name: "Consultar otra reserva" }));

    expect(screen.getByRole("button", { name: "Buscar mi reserva" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("");
  });
});

// La fecha de `RESERVA` ya pasó: "muy por delante" y "dentro de la ventana" se arman con fechas
// lejanas para que el resultado no dependa del día en que corre la suite.
const RESERVA_FUTURA = { ...RESERVA, fecha: "2099-01-01" };
const RESERVA_DENTRO_DE_VENTANA = { ...RESERVA, fecha: "2000-01-01" };

async function verDetalleDe(reserva: Record<string, unknown>) {
  POST.mockResolvedValue(respuestaOk(reserva));
  render(<ConsultaReserva />);
  completarFormulario();
  enviar();
  await screen.findByRole("heading", { level: 1, name: /^Tu reserva (está|figura)/ });
}

const NOMBRE_ALERTA = "No pudimos verificar si todavía podés cancelar. Probá de nuevo en unos minutos.";

describe("ConsultaReserva - detalle: gating de 'Cancelar mi reserva'", () => {
  it.each(["CANCELADA", "NO_SHOW"])("con una reserva %s no se ofrece y no pide las zonas", async (estado) => {
    await verDetalleDe({ ...RESERVA_FUTURA, estado });

    expect(screen.queryByRole("button", { name: "Cancelar mi reserva" })).not.toBeInTheDocument();
    expect(screen.queryByText(NOMBRE_ALERTA)).not.toBeInTheDocument();
    expect(GET).not.toHaveBeenCalled();
  });

  it.each(["CONFIRMADA", "PENDIENTE"])(
    "con una reserva %s muy por delante de la ventana se ofrece",
    async (estado) => {
      await verDetalleDe({ ...RESERVA_FUTURA, estado });

      expect(await screen.findByRole("button", { name: "Cancelar mi reserva" })).toBeInTheDocument();
      expect(GET).toHaveBeenCalledTimes(1);
      expect(GET).toHaveBeenCalledWith("/zonas", { cache: "no-store" });
      expect(screen.queryByText(NOMBRE_ALERTA)).not.toBeInTheDocument();
    },
  );

  it("con una reserva CONFIRMADA dentro de la ventana de su zona no se ofrece ni avisa", async () => {
    await verDetalleDe(RESERVA_DENTRO_DE_VENTANA);

    await waitFor(() => expect(GET).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: "Cancelar mi reserva" })).not.toBeInTheDocument();
    expect(screen.queryByText(NOMBRE_ALERTA)).not.toBeInTheDocument();
  });

  it("usa la ventana de la zona de la reserva y no la de otra zona", async () => {
    // Faltan unos 30 días: muy lejos de las 24 h de su zona (sin depender de la hora a la que
    // corre el test), pero mucho menos que la ventana enorme de la otra.
    const fecha = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    GET.mockResolvedValue(
      respuestaOk([{ ...ZONA, id: "z-2", ventanaCancelacionHoras: 100000 }, ZONA]),
    );
    await verDetalleDe({ ...RESERVA, fecha, turno: { ...RESERVA.turno, horaInicio: "00:00" } });

    await waitFor(() => expect(GET).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: "Cancelar mi reserva" })).toBeInTheDocument();
  });

  it("mientras verifica las zonas no ofrece la acción ni avisa", async () => {
    GET.mockReturnValue(new Promise(() => {}));
    await verDetalleDe(RESERVA_FUTURA);

    expect(screen.queryByRole("button", { name: "Cancelar mi reserva" })).not.toBeInTheDocument();
    expect(screen.queryByText(NOMBRE_ALERTA)).not.toBeInTheDocument();
  });

  describe("cuando no se puede verificar la ventana", () => {
    async function esperarAviso() {
      expect(await screen.findByText(NOMBRE_ALERTA)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Cancelar mi reserva" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    }

    function esperarDetalleIntacto() {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tu reserva está confirmada");
      expect(screen.getByText("K7PM3QXA")).toBeInTheDocument();
      expect(screen.getByText("VIP")).toBeInTheDocument();
    }

    it("un error de servidor en GET /zonas avisa, ofrece reintentar y conserva el detalle", async () => {
      GET.mockResolvedValue(respuestaError(500, { message: "stack interno" }));
      await verDetalleDe(RESERVA_FUTURA);

      await esperarAviso();
      esperarDetalleIntacto();
      expect(screen.queryByText(/stack interno/)).not.toBeInTheDocument();
    });

    it("una falla de red en GET /zonas avisa igual", async () => {
      GET.mockRejectedValue(new TypeError("fetch failed"));
      await verDetalleDe(RESERVA_FUTURA);

      await esperarAviso();
      esperarDetalleIntacto();
    });

    it("un 200 sin la zona de la reserva avisa igual", async () => {
      GET.mockResolvedValue(respuestaOk([{ ...ZONA, id: "otra" }]));
      await verDetalleDe(RESERVA_FUTURA);

      await esperarAviso();
      esperarDetalleIntacto();
    });

    it("una hora de inicio mal formada no rompe el detalle y avisa igual", async () => {
      await verDetalleDe({ ...RESERVA_FUTURA, turno: { ...RESERVA.turno, horaInicio: "xx" } });

      await esperarAviso();
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tu reserva está confirmada");
      expect(screen.getByText("VIP")).toBeInTheDocument();
    });

    it("'Reintentar' vuelve a pedir solo GET /zonas y, si responde bien, reemplaza el aviso por el botón", async () => {
      GET.mockResolvedValueOnce(respuestaError(500));
      await verDetalleDe(RESERVA_FUTURA);
      await esperarAviso();

      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

      expect(await screen.findByRole("button", { name: "Cancelar mi reserva" })).toBeInTheDocument();
      expect(screen.queryByText(NOMBRE_ALERTA)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
      expect(GET).toHaveBeenCalledTimes(2);
      expect(POST).toHaveBeenCalledTimes(1);
    });

    it("'Reintentar' con la reserva dentro de la ventana quita el aviso sin ofrecer cancelar", async () => {
      GET.mockResolvedValueOnce(respuestaError(500));
      await verDetalleDe(RESERVA_DENTRO_DE_VENTANA);
      await esperarAviso();

      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

      await waitFor(() => expect(screen.queryByText(NOMBRE_ALERTA)).not.toBeInTheDocument());
      expect(screen.queryByRole("button", { name: "Cancelar mi reserva" })).not.toBeInTheDocument();
    });

    it("si 'Reintentar' vuelve a fallar, el aviso sigue y el detalle no cambia", async () => {
      GET.mockResolvedValue(respuestaError(500));
      await verDetalleDe(RESERVA_FUTURA);
      await esperarAviso();

      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

      await waitFor(() => expect(GET).toHaveBeenCalledTimes(2));
      await esperarAviso();
      esperarDetalleIntacto();
    });

    it("mientras reintenta deshabilita 'Reintentar' y una doble activación pide una sola vez", async () => {
      GET.mockResolvedValueOnce(respuestaError(500));
      await verDetalleDe(RESERVA_FUTURA);
      const reintentar = await screen.findByRole("button", { name: "Reintentar" });

      GET.mockReturnValue(new Promise(() => {}));
      act(() => {
        reintentar.click();
        reintentar.click();
      });

      expect(GET).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("button", { name: "Reintentar" })).toBeDisabled();
      expect(screen.getByText(NOMBRE_ALERTA)).toBeInTheDocument();
    });
  });
});
