import {
  ARGENTINA_OFFSET_MS,
  combinarFechaYHoraLocalEnUtc,
  diaSemanaDeFecha,
  finTurnoUtc,
  inicioTurnoUtc,
} from './timezone';

/**
 * Estos tests deben dar el mismo resultado sin importar la zona horaria del proceso que
 * los ejecuta (config.yaml §7 exige `getUTC*`/`Date.UTC`, nunca el reloj local del proceso).
 * Correr, por ejemplo:
 *   TZ=UTC npm test -- timezone
 *   TZ=America/Argentina/Buenos_Aires npm test -- timezone
 * y confirmar que ambas corridas dan exactamente los mismos resultados.
 */
describe('timezone', () => {
  // @db.Date: fecha calendario pura, sin hora significativa.
  const fecha = new Date(Date.UTC(2026, 2, 15)); // 2026-03-15

  // @db.Time: Prisma los devuelve como Date en época 1970-01-01 con la hora en su parte UTC.
  const hora = (h: number, m = 0, s = 0) =>
    new Date(Date.UTC(1970, 0, 1, h, m, s));

  describe('combinarFechaYHoraLocalEnUtc', () => {
    it('combina una fecha calendario con una hora local de Argentina en el instante UTC correcto (turno normal, ej. 12:00)', () => {
      const resultado = combinarFechaYHoraLocalEnUtc(fecha, hora(12, 0));
      // 12:00 hora local de Argentina (UTC-3) = 15:00 UTC del mismo día calendario.
      expect(resultado.toISOString()).toBe('2026-03-15T15:00:00.000Z');
    });

    it('respeta minutos y segundos de la hora local', () => {
      const resultado = combinarFechaYHoraLocalEnUtc(fecha, hora(9, 30, 45));
      expect(resultado.toISOString()).toBe('2026-03-15T12:30:45.000Z');
    });

    it('usa el offset fijo de Argentina (UTC-3)', () => {
      const resultado = combinarFechaYHoraLocalEnUtc(fecha, hora(0, 0, 0));
      expect(resultado.getTime() - fecha.getTime()).toBe(-ARGENTINA_OFFSET_MS);
    });
  });

  describe('inicioTurnoUtc', () => {
    it('calcula el instante UTC de inicio de un turno normal (12:00)', () => {
      const resultado = inicioTurnoUtc(fecha, hora(12, 0));
      expect(resultado.toISOString()).toBe('2026-03-15T15:00:00.000Z');
    });
  });

  describe('finTurnoUtc', () => {
    it('calcula el instante UTC de fin de un turno que no cruza medianoche (ej. 12:00 a 15:00)', () => {
      const resultado = finTurnoUtc(fecha, hora(12, 0), hora(15, 0));
      // 15:00 local (UTC-3) del mismo día = 18:00 UTC del mismo día calendario.
      expect(resultado.toISOString()).toBe('2026-03-15T18:00:00.000Z');
    });

    it('hace caer el fin en el día calendario siguiente cuando el turno cruza medianoche (22:00 a 01:00)', () => {
      const resultado = finTurnoUtc(fecha, hora(22, 0), hora(1, 0));
      // 01:00 local (UTC-3) del día SIGUIENTE (2026-03-16) = 04:00 UTC del 2026-03-16.
      expect(resultado.toISOString()).toBe('2026-03-16T04:00:00.000Z');
    });

    it('el inicio de un turno que cruza medianoche sigue estando en el día calendario original', () => {
      const inicio = inicioTurnoUtc(fecha, hora(22, 0));
      // 22:00 local (UTC-3) del 2026-03-15 = 01:00 UTC del 2026-03-16, pero corresponde al
      // mismo turno cuyo `fecha` calendario es 2026-03-15 (la fecha en sí no cambia; solo
      // el instante UTC del inicio cae, incidentalmente, en el día UTC siguiente).
      expect(inicio.toISOString()).toBe('2026-03-16T01:00:00.000Z');
    });

    it('no depende de la zona horaria del proceso (no usa Date.now/reloj local)', () => {
      const resultado = finTurnoUtc(fecha, hora(22, 0), hora(1, 0));
      expect(resultado.getUTCFullYear()).toBe(2026);
      expect(resultado.getUTCMonth()).toBe(2); // marzo (0-indexado)
      expect(resultado.getUTCDate()).toBe(16);
      expect(resultado.getUTCHours()).toBe(4);
    });
  });

  describe('diaSemanaDeFecha (sin modificar, solo se re-verifica que sigue intacta)', () => {
    it('devuelve el día de la semana en UTC', () => {
      // 2026-03-15 es domingo.
      expect(diaSemanaDeFecha(fecha)).toBe(0);
    });
  });
});
