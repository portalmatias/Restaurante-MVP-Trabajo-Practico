import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConsultaReserva } from "../../../src/components/reservas/consulta-reserva";
import { apiClient } from "../../../src/lib/api/client";

// Se mockea solo `apiClient`: `toApiResult` es el real, así el mapeo de errores es el de
// producción. Sin red (design.md D10: el componente se prueba con datos de prueba locales).
jest.mock("../../../src/lib/api/client", () => ({
  ...jest.requireActual("../../../src/lib/api/client"),
  apiClient: { POST: jest.fn() },
}));

const POST = apiClient.POST as unknown as jest.Mock;

const RESERVA = {
  codigoReserva: "K7PM3QXA",
  estado: "CONFIRMADA",
  fecha: "2026-09-19",
  comensales: 4,
  turno: { id: "t-1", horaInicio: "20:00", horaFin: "23:30" },
  zona: { id: "z-1", nombre: "VIP" },
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

  it("'Reintentar' se deshabilita mientras la nueva consulta está en curso y no la duplica", async () => {
    POST.mockRejectedValueOnce(new TypeError("fetch failed"));
    render(<ConsultaReserva />);
    completarFormulario();
    enviar();
    const reintentar = await screen.findByRole("button", { name: "Reintentar" });

    POST.mockReturnValue(new Promise(() => {}));
    fireEvent.click(reintentar);
    fireEvent.click(reintentar);

    await waitFor(() => expect(POST).toHaveBeenCalledTimes(2));
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
