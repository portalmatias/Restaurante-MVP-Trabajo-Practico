import { puedeCancelarSegunVentana } from "../../src/lib/ventana-cancelacion";

// El turno del 2026-09-19 a las 20:00 (hora de Argentina) empieza a las 23:00 UTC.
const FECHA = "2026-09-19";
const HORA_INICIO = "1970-01-01T20:00:00.000Z";
const INICIO_UTC_MS = Date.parse("2026-09-19T23:00:00.000Z");
const HORA_MS = 60 * 60 * 1000;

describe("puedeCancelarSegunVentana", () => {
  it("exactamente ventanaCancelacionHoras antes del inicio del turno es true (borde inclusivo)", () => {
    const ahora = new Date(INICIO_UTC_MS - 24 * HORA_MS);

    expect(puedeCancelarSegunVentana(FECHA, HORA_INICIO, 24, ahora)).toBe(true);
  });

  it("un minuto menos que la ventana es false", () => {
    const ahora = new Date(INICIO_UTC_MS - 24 * HORA_MS + 60 * 1000);

    expect(puedeCancelarSegunVentana(FECHA, HORA_INICIO, 24, ahora)).toBe(false);
  });

  it("muy por delante de la ventana es true", () => {
    const ahora = new Date(INICIO_UTC_MS - 10 * 24 * HORA_MS);

    expect(puedeCancelarSegunVentana(FECHA, HORA_INICIO, 24, ahora)).toBe(true);
  });

  it("un turno que ya empezó es false", () => {
    expect(puedeCancelarSegunVentana(FECHA, HORA_INICIO, 2, new Date(INICIO_UTC_MS + HORA_MS))).toBe(
      false,
    );
  });

  it("con ventana 0 se puede cancelar hasta el instante exacto de inicio, no después", () => {
    expect(puedeCancelarSegunVentana(FECHA, HORA_INICIO, 0, new Date(INICIO_UTC_MS))).toBe(true);
    expect(puedeCancelarSegunVentana(FECHA, HORA_INICIO, 0, new Date(INICIO_UTC_MS + 1))).toBe(
      false,
    );
  });

  // Regresión: un turno que cruza la medianoche local (ej. 22:00 a 02:00, `horaFin <
  // horaInicio`, como `finTurnoUtc` del backend). Acá solo se usa el inicio, que siempre cae
  // en la `fecha` de la reserva: 22:00 en Argentina son las 01:00 UTC del día siguiente.
  it("un turno que cruza la medianoche local se mide desde su inicio, en la fecha de la reserva", () => {
    const inicioUtcMs = Date.parse("2026-09-20T01:00:00.000Z");
    const horaInicioNocturna = "1970-01-01T22:00:00.000Z";

    expect(
      puedeCancelarSegunVentana(FECHA, horaInicioNocturna, 3, new Date(inicioUtcMs - 3 * HORA_MS)),
    ).toBe(true);
    expect(
      puedeCancelarSegunVentana(
        FECHA,
        horaInicioNocturna,
        3,
        new Date(inicioUtcMs - 3 * HORA_MS + 60 * 1000),
      ),
    ).toBe(false);
  });
});
