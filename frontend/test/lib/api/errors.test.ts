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

  it("cualquier otro caso (por ejemplo 500) mapea a desconocido", () => {
    const resultado = mapErrorApi(500, {
      statusCode: 500,
      error: "Internal Server Error",
      message: "Internal server error",
    });

    expect(resultado).toEqual({
      tipo: "desconocido",
      mensaje: "Internal server error",
    });
  });
});
