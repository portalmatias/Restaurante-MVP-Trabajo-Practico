import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormularioDatosContacto } from "../../../src/components/reservas/formulario-datos-contacto";
import { apiClient } from "../../../src/lib/api/client";
import { TURNO_CENA_SABADO, ZONA_STANDARD } from "../../fixtures/reservas";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

// Se mockea solo `apiClient`: `toApiResult` es el real, así el mapeo de errores es el de
// producción. Sin red (design.md D10).
jest.mock("../../../src/lib/api/client", () => ({
  ...jest.requireActual("../../../src/lib/api/client"),
  apiClient: { POST: jest.fn() },
}));

const POST = apiClient.POST as unknown as jest.Mock;

const SELECCION = {
  fecha: "2026-09-19",
  turnoId: TURNO_CENA_SABADO.id,
  zonaId: ZONA_STANDARD.id,
  comensales: 4,
};

const CREADA = {
  codigoReserva: "K7PM3QXA",
  estado: "CONFIRMADA",
  fecha: SELECCION.fecha,
  turnoId: SELECCION.turnoId,
  zonaId: SELECCION.zonaId,
  comensales: SELECCION.comensales,
};

function respuestaOk(data: unknown) {
  return { data, response: { ok: true, status: 201 } };
}

function respuestaError(status: number, error?: unknown) {
  return { error, response: { ok: false, status } };
}

function escribir(etiqueta: string, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

function completarFormulario() {
  escribir("Nombre", "Ana Pérez");
  escribir("Email", "ana.perez@example.com");
  escribir("Teléfono", "+54 9 11 5555-1234");
}

function enviar() {
  fireEvent.click(screen.getByRole("button", { name: "Confirmar reserva" }));
}

function renderizar() {
  return render(<FormularioDatosContacto seleccion={SELECCION} />);
}

beforeEach(() => {
  POST.mockReset();
  push.mockReset();
});

describe("FormularioDatosContacto - validación en línea", () => {
  it("muestra los campos de nombre, email y teléfono con el tipo de teclado apropiado", () => {
    renderizar();

    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Teléfono")).toHaveAttribute("type", "tel");
    expect(screen.getByRole("button", { name: "Confirmar reserva" })).toBeEnabled();
  });

  it("marca el nombre vacío al salir del campo, sin haber enviado", () => {
    renderizar();

    fireEvent.blur(screen.getByLabelText("Nombre"));

    expect(screen.getByText("Falta ingresar tu nombre.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveAttribute("aria-invalid", "true");
    expect(POST).not.toHaveBeenCalled();
  });

  it("marca un email sin arroba al salir del campo", () => {
    renderizar();

    escribir("Email", "ana.perez");
    fireEvent.blur(screen.getByLabelText("Email"));

    expect(screen.getByText("Ingresá un email válido.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("marca el email vacío al salir del campo", () => {
    renderizar();

    fireEvent.blur(screen.getByLabelText("Email"));

    expect(screen.getByText("Falta ingresar tu email.")).toBeInTheDocument();
  });

  it("marca el teléfono vacío al salir del campo", () => {
    renderizar();

    fireEvent.blur(screen.getByLabelText("Teléfono"));

    expect(screen.getByText("Falta ingresar tu teléfono.")).toBeInTheDocument();
  });

  it("quita el error de un campo cuando se corrige y se sale de él", () => {
    renderizar();

    fireEvent.blur(screen.getByLabelText("Nombre"));
    escribir("Nombre", "Ana Pérez");
    fireEvent.blur(screen.getByLabelText("Nombre"));

    expect(screen.queryByText("Falta ingresar tu nombre.")).not.toBeInTheDocument();
  });

  it("no envía con datos inválidos y señala cada campo que falta", () => {
    renderizar();

    enviar();

    expect(POST).not.toHaveBeenCalled();
    expect(screen.getByText("Falta ingresar tu nombre.")).toBeInTheDocument();
    expect(screen.getByText("Falta ingresar tu email.")).toBeInTheDocument();
    expect(screen.getByText("Falta ingresar tu teléfono.")).toBeInTheDocument();
  });
});

describe("FormularioDatosContacto - envío", () => {
  it("envía la selección y los datos de contacto al endpoint de creación", async () => {
    POST.mockResolvedValue(respuestaOk(CREADA));
    renderizar();

    completarFormulario();
    enviar();

    await waitFor(() => expect(POST).toHaveBeenCalledTimes(1));
    expect(POST).toHaveBeenCalledWith("/reservas", {
      body: {
        ...SELECCION,
        nombreCliente: "Ana Pérez",
        emailCliente: "ana.perez@example.com",
        telefonoCliente: "+54 9 11 5555-1234",
      },
    });
  });

  it("no envía espacios sobrantes alrededor de los datos", async () => {
    POST.mockResolvedValue(respuestaOk(CREADA));
    renderizar();

    escribir("Nombre", "  Ana Pérez ");
    escribir("Email", " ana.perez@example.com ");
    escribir("Teléfono", " 1155551234 ");
    enviar();

    await waitFor(() => expect(POST).toHaveBeenCalledTimes(1));
    expect(POST.mock.calls[0][1].body).toMatchObject({
      nombreCliente: "Ana Pérez",
      emailCliente: "ana.perez@example.com",
      telefonoCliente: "1155551234",
    });
  });

  it("mientras la promesa está pendiente deshabilita el botón y cambia su texto", async () => {
    POST.mockReturnValue(new Promise(() => {}));
    renderizar();

    completarFormulario();
    enviar();

    const boton = await screen.findByRole("button", { name: "Confirmando…" });
    expect(boton).toBeDisabled();
  });

  it("un segundo envío mientras hay uno en curso no dispara otra solicitud", async () => {
    POST.mockReturnValue(new Promise(() => {}));
    const { container } = renderizar();

    completarFormulario();
    const formulario = container.querySelector("form") as HTMLFormElement;
    fireEvent.submit(formulario);
    fireEvent.submit(formulario);

    await screen.findByRole("button", { name: "Confirmando…" });
    expect(POST).toHaveBeenCalledTimes(1);
  });

  it("un envío exitoso navega a la pantalla de éxito con los seis parámetros de la respuesta", async () => {
    POST.mockResolvedValue(respuestaOk(CREADA));
    renderizar();

    completarFormulario();
    enviar();

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    const destino = new URL(push.mock.calls[0][0], "http://localhost");
    expect(destino.pathname).toBe("/reservas/nueva/exito");
    expect(Object.fromEntries(destino.searchParams)).toEqual({
      codigo: "K7PM3QXA",
      estado: "CONFIRMADA",
      fecha: SELECCION.fecha,
      turnoId: SELECCION.turnoId,
      zonaId: SELECCION.zonaId,
      comensales: "4",
    });
  });

  it("nunca refleja el nombre, el email ni el teléfono en la URL de destino", async () => {
    POST.mockResolvedValue(respuestaOk(CREADA));
    renderizar();

    completarFormulario();
    enviar();

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push.mock.calls[0][0]).not.toMatch(/ana|example\.com|5555/i);
  });
});

describe("FormularioDatosContacto - errores de validación (400)", () => {
  it("muestra en línea, en su campo, el mensaje que empieza con el nombre del campo", async () => {
    POST.mockResolvedValue(
      respuestaError(400, {
        statusCode: 400,
        message: ["emailCliente debe ser un email válido", "telefonoCliente no debe estar vacío"],
      }),
    );
    renderizar();

    completarFormulario();
    enviar();

    expect(await screen.findByText("emailCliente debe ser un email válido")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
      "emailCliente debe ser un email válido",
    );
    expect(screen.getByLabelText("Teléfono")).toHaveAccessibleDescription(
      "telefonoCliente no debe estar vacío",
    );
    expect(screen.getByLabelText("Nombre")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("un mensaje que no es de ningún campo va al resumen de errores, con foco", async () => {
    POST.mockResolvedValue(
      respuestaError(400, { statusCode: 400, message: ["turnoId debe ser un UUID"] }),
    );
    renderizar();

    completarFormulario();
    enviar();

    const resumen = await screen.findByText("turnoId debe ser un UUID");
    const contenedor = resumen.closest('[role="alert"]') as HTMLElement;
    expect(contenedor).toHaveAttribute("tabindex", "-1");
    expect(contenedor).toHaveFocus();
  });

  it("reparte los mensajes: los de campo en línea y el resto en el resumen", async () => {
    POST.mockResolvedValue(
      respuestaError(400, {
        statusCode: 400,
        message: ["nombreCliente no debe estar vacío", "comensales debe ser un entero"],
      }),
    );
    renderizar();

    completarFormulario();
    enviar();

    await screen.findByText("comensales debe ser un entero");
    expect(screen.getByLabelText("Nombre")).toHaveAccessibleDescription(
      "nombreCliente no debe estar vacío",
    );
    const resumen = screen.getByText("comensales debe ser un entero").closest('[role="alert"]');
    expect(resumen).not.toHaveTextContent("nombreCliente");
  });

  it("conserva lo escrito y rehabilita el botón", async () => {
    POST.mockResolvedValue(
      respuestaError(400, { statusCode: 400, message: ["emailCliente debe ser un email válido"] }),
    );
    renderizar();

    completarFormulario();
    enviar();

    await screen.findByText("emailCliente debe ser un email válido");
    expect(screen.getByLabelText("Nombre")).toHaveValue("Ana Pérez");
    expect(screen.getByLabelText("Email")).toHaveValue("ana.perez@example.com");
    expect(screen.getByRole("button", { name: "Confirmar reserva" })).toBeEnabled();
  });

  it("quita el error del servidor de un campo cuando se lo edita", async () => {
    POST.mockResolvedValue(
      respuestaError(400, { statusCode: 400, message: ["emailCliente debe ser un email válido"] }),
    );
    renderizar();

    completarFormulario();
    enviar();
    await screen.findByText("emailCliente debe ser un email válido");
    escribir("Email", "otra@example.com");

    expect(screen.queryByText("emailCliente debe ser un email válido")).not.toBeInTheDocument();
  });
});

describe("FormularioDatosContacto - rechazo por reglas de negocio (409)", () => {
  const MOTIVOS = [
    { codigo: "AFORO_ZONA", mensaje: "La zona STANDARD está completa para ese turno y esa fecha." },
    { codigo: "SIN_MESA_DISPONIBLE", mensaje: "No hay una mesa libre para 4 comensales." },
  ];

  it("muestra un Alert por cada motivo, sin omitir ninguno", async () => {
    POST.mockResolvedValue(
      respuestaError(409, { statusCode: 409, message: "No se pudo crear la reserva", motivos: MOTIVOS }),
    );
    renderizar();

    completarFormulario();
    enviar();

    await screen.findByText(MOTIVOS[0].mensaje);
    expect(screen.getAllByRole("alert").map((alerta) => alerta.textContent)).toEqual(
      MOTIVOS.map((motivo) => motivo.mensaje),
    );
  });

  it("ofrece 'Volver a elegir' hacia el Paso 1 con la selección anterior", async () => {
    POST.mockResolvedValue(
      respuestaError(409, { statusCode: 409, message: "x", motivos: MOTIVOS }),
    );
    renderizar();

    completarFormulario();
    enviar();

    const enlace = await screen.findByRole("link", { name: "Volver a elegir" });
    expect(enlace).toHaveAttribute(
      "href",
      `/reservas/nueva?${new URLSearchParams({ ...SELECCION, comensales: "4" }).toString()}`,
    );
  });

  it("no vacía los campos ya escritos ni navega", async () => {
    POST.mockResolvedValue(
      respuestaError(409, { statusCode: 409, message: "x", motivos: MOTIVOS }),
    );
    renderizar();

    completarFormulario();
    enviar();

    await screen.findByRole("link", { name: "Volver a elegir" });
    expect(screen.getByLabelText("Nombre")).toHaveValue("Ana Pérez");
    expect(screen.getByLabelText("Email")).toHaveValue("ana.perez@example.com");
    expect(screen.getByLabelText("Teléfono")).toHaveValue("+54 9 11 5555-1234");
    expect(push).not.toHaveBeenCalled();
  });

  it("con motivos vacíos muestra el mensaje de reintento, sin navegar ni ofrecer volver a elegir", async () => {
    POST.mockResolvedValue(
      respuestaError(409, { statusCode: 409, message: "detalle interno del choque", motivos: [] }),
    );
    renderizar();

    completarFormulario();
    enviar();

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/Reintentá en unos segundos/);
    expect(alerta.textContent).not.toMatch(/detalle interno/);
    expect(screen.queryByRole("link", { name: "Volver a elegir" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar reserva" })).toBeEnabled();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Ana Pérez");
    expect(push).not.toHaveBeenCalled();
  });
});

describe("FormularioDatosContacto - turno o zona inexistentes (404)", () => {
  it("muestra el mensaje fijo y 'Volver a empezar' hacia el Paso 1 sin parámetros", async () => {
    POST.mockResolvedValue(respuestaError(404, { statusCode: 404, message: "Turno no encontrado" }));
    renderizar();

    completarFormulario();
    enviar();

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Esa fecha, turno o zona ya no están disponibles. Empecemos de nuevo.");
    expect(alerta.textContent).not.toMatch(/Turno no encontrado/);
    expect(screen.getByRole("link", { name: "Volver a empezar" })).toHaveAttribute(
      "href",
      "/reservas/nueva",
    );
  });
});

describe("FormularioDatosContacto - error de servidor o de red", () => {
  it("un 500 muestra el mensaje genérico, conserva lo tipeado y ofrece reintentar", async () => {
    POST.mockResolvedValue(respuestaError(500, { message: "stack interno" }));
    renderizar();

    completarFormulario();
    enviar();

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(
      "El servicio no está disponible en este momento. Intentá de nuevo más tarde.",
    );
    expect(alerta.textContent).not.toMatch(/stack interno/);
    expect(screen.getByLabelText("Nombre")).toHaveValue("Ana Pérez");
    expect(screen.getByLabelText("Email")).toHaveValue("ana.perez@example.com");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("un error de red muestra el mensaje del resultado y conserva lo tipeado", async () => {
    POST.mockRejectedValue(new TypeError("fetch failed"));
    renderizar();

    completarFormulario();
    enviar();

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo conectar con el servidor.");
    expect(screen.getByLabelText("Teléfono")).toHaveValue("+54 9 11 5555-1234");
  });

  it("'Reintentar' vuelve a enviar los mismos datos", async () => {
    POST.mockResolvedValueOnce(respuestaError(500));
    renderizar();
    completarFormulario();
    enviar();
    const reintentar = await screen.findByRole("button", { name: "Reintentar" });

    POST.mockResolvedValue(respuestaOk(CREADA));
    fireEvent.click(reintentar);

    await waitFor(() => expect(POST).toHaveBeenCalledTimes(2));
    expect(POST.mock.calls[1]).toEqual(POST.mock.calls[0]);
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
  });

  it("una doble activación inmediata de 'Reintentar' dispara una sola solicitud", async () => {
    POST.mockResolvedValueOnce(respuestaError(500));
    renderizar();
    completarFormulario();
    enviar();
    const reintentar = await screen.findByRole("button", { name: "Reintentar" });

    POST.mockReturnValue(new Promise(() => {}));
    act(() => {
      reintentar.click();
      reintentar.click();
    });

    expect(POST).toHaveBeenCalledTimes(2);
  });

  it("un 429 muestra el mensaje de espera del cliente", async () => {
    POST.mockResolvedValue(respuestaError(429));
    renderizar();

    completarFormulario();
    enviar();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Hiciste demasiados intentos. Esperá unos minutos antes de volver a intentar.",
    );
  });
});
