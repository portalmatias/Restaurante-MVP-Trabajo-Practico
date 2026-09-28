import { mapErrorApi } from "../../../src/lib/api/errors";

// D7 de design.md: el mapeo se apoya solo en ErrorRespuesta (statusCode, message, error) y en
// MotivoNoDisponible ({ codigo, mensaje }), ya definidos en openapi/openapi.yaml en main.
describe("mapErrorApi", () => {
  it("400 con message como lista mapea a validacion, sin descartar mensajes", () => {
    const resultado = mapErrorApi(400, {
      statusCode: 400,
      error: "Bad Request",
      message: ["fecha inválida", "comensales debe ser mayor o igual a 1"],
    });

    expect(resultado).toEqual({
      tipo: "validacion",
      mensajes: ["fecha inválida", "comensales debe ser mayor o igual a 1"],
    });
  });

  it("400 con message como texto único (regla de negocio de admin) también mapea a validacion", () => {
    const resultado = mapErrorApi(400, {
      statusCode: 400,
      error: "Bad Request",
      message: "El mínimo de comensales no puede superar al máximo.",
    });

    expect(resultado).toEqual({
      tipo: "validacion",
      mensajes: ["El mínimo de comensales no puede superar al máximo."],
    });
  });

  it("400 sin cuerpo mapea a validacion con un mensaje genérico", () => {
    expect(mapErrorApi(400, undefined)).toEqual({
      tipo: "validacion",
      mensajes: ["Ocurrió un error inesperado."],
    });
  });

  it("404 con message string mapea a no-encontrado", () => {
    const resultado = mapErrorApi(404, {
      statusCode: 404,
      error: "Not Found",
      message: "El turno indicado no existe.",
    });

    expect(resultado).toEqual({
      tipo: "no-encontrado",
      mensaje: "El turno indicado no existe.",
    });
  });

  it("409 con message string y sin motivos mapea a conflicto con motivos vacío (forma actual de admin)", () => {
    const resultado = mapErrorApi(409, {
      statusCode: 409,
      error: "Conflict",
      message: "Ya existe una mesa con esa etiqueta.",
    });

    expect(resultado).toEqual({
      tipo: "conflicto",
      mensaje: "Ya existe una mesa con esa etiqueta.",
      motivos: [],
    });
  });

  it("409 con motivos los conserva con su codigo, mensaje y orden", () => {
    const resultado = mapErrorApi(409, {
      statusCode: 409,
      error: "Conflict",
      message: "No hay lugar para la reserva.",
      motivos: [
        { codigo: "ANTICIPACION_MINIMA", mensaje: "Falta anticipación mínima." },
        { codigo: "AFORO_ZONA", mensaje: "Se supera el aforo de la zona." },
      ],
    });

    expect(resultado).toEqual({
      tipo: "conflicto",
      mensaje: "No hay lugar para la reserva.",
      motivos: [
        { codigo: "ANTICIPACION_MINIMA", mensaje: "Falta anticipación mínima." },
        { codigo: "AFORO_ZONA", mensaje: "Se supera el aforo de la zona." },
      ],
    });
  });

  it("409 con un motivo de codigo desconocido lo descarta y conserva el resto", () => {
    // El codigo tiene que pertenecer al enum CodigoMotivo del contrato (schema.d.ts): un valor
    // que no está ahí no es un MotivoNoDisponible válido, aunque tenga la forma correcta.
    const resultado = mapErrorApi(409, {
      statusCode: 409,
      error: "Conflict",
      message: "No hay lugar para la reserva.",
      motivos: [
        { codigo: "ANTICIPACION_MINIMA", mensaje: "Falta anticipación mínima." },
        { codigo: "CODIGO_INVENTADO", mensaje: "Motivo que no existe en el contrato." },
      ],
    });

    expect(resultado).toEqual({
      tipo: "conflicto",
      mensaje: "No hay lugar para la reserva.",
      motivos: [{ codigo: "ANTICIPACION_MINIMA", mensaje: "Falta anticipación mínima." }],
    });
  });

  it("cualquier 500 mapea a un mensaje genérico de disponibilidad, sin exponer el del servidor", () => {
    // El mensaje del cuerpo simula uno que filtraría detalle interno (por ejemplo, del stack de
    // conexión a la base): el resultado tipado nunca debe reenviarlo tal cual.
    const resultado = mapErrorApi(500, {
      statusCode: 500,
      error: "Internal Server Error",
      message: "connect ECONNREFUSED 127.0.0.1:3001",
    });

    expect(resultado).toEqual({
      tipo: "desconocido",
      mensaje: "El servicio no está disponible en este momento. Intente de nuevo más tarde.",
    });
  });

  it("un 500 con cuerpo HTML (proxy /api cuando el backend está caído) mapea al mismo mensaje genérico", () => {
    // Next devuelve una página de error HTML, no un ErrorRespuesta JSON, cuando el rewrite de
    // /api no puede comunicarse con el backend (D7/D6 de design.md).
    const resultado = mapErrorApi(500, "<html><body>Internal Server Error</body></html>");

    expect(resultado).toEqual({
      tipo: "desconocido",
      mensaje: "El servicio no está disponible en este momento. Intente de nuevo más tarde.",
    });
  });

  it("un status mayor a 500 también mapea al mensaje genérico de disponibilidad", () => {
    const resultado = mapErrorApi(503, {
      statusCode: 503,
      error: "Service Unavailable",
      message: "Service Unavailable",
    });

    expect(resultado).toEqual({
      tipo: "desconocido",
      mensaje: "El servicio no está disponible en este momento. Intente de nuevo más tarde.",
    });
  });
});
