import {
  diaSemanaDeFechaLocal,
  fechaLocalDeHoy,
  formatearFechaLargaEs,
  formatearHoraTurno,
} from '../../src/lib/fecha-hora';

describe('fechaLocalDeHoy', () => {
  it('devuelve el día anterior cuando en UTC ya es el día siguiente pero en Argentina todavía no', () => {
    // 02:00 UTC del 15 = 23:00 del 14 en Argentina (UTC-3).
    expect(fechaLocalDeHoy(new Date('2026-09-15T02:00:00.000Z'))).toBe(
      '2026-09-14',
    );
  });

  it('devuelve el mismo día que toISOString().slice(0, 10) bien entrada la tarde en Argentina', () => {
    const ahora = new Date('2026-09-15T18:30:00.000Z'); // 15:30 en Argentina
    expect(fechaLocalDeHoy(ahora)).toBe(ahora.toISOString().slice(0, 10));
    expect(fechaLocalDeHoy(ahora)).toBe('2026-09-15');
  });

  it('cambia de día exactamente a las 03:00 UTC (medianoche de Argentina)', () => {
    expect(fechaLocalDeHoy(new Date('2026-09-15T02:59:59.999Z'))).toBe(
      '2026-09-14',
    );
    expect(fechaLocalDeHoy(new Date('2026-09-15T03:00:00.000Z'))).toBe(
      '2026-09-15',
    );
  });

  it('resuelve el cambio de mes y de año', () => {
    expect(fechaLocalDeHoy(new Date('2027-01-01T01:00:00.000Z'))).toBe(
      '2026-12-31',
    );
  });
});

describe('diaSemanaDeFechaLocal', () => {
  it('2026-09-19 es SABADO', () => {
    expect(diaSemanaDeFechaLocal('2026-09-19')).toBe('SABADO');
  });

  it('2026-09-21 es LUNES', () => {
    expect(diaSemanaDeFechaLocal('2026-09-21')).toBe('LUNES');
  });

  it('los siete días de una semana completa mapean sin desfase', () => {
    const semana = [
      ['2026-09-21', 'LUNES'],
      ['2026-09-22', 'MARTES'],
      ['2026-09-23', 'MIERCOLES'],
      ['2026-09-24', 'JUEVES'],
      ['2026-09-25', 'VIERNES'],
      ['2026-09-26', 'SABADO'],
      ['2026-09-27', 'DOMINGO'],
    ] as const;

    for (const [fecha, dia] of semana) {
      expect(diaSemanaDeFechaLocal(fecha)).toBe(dia);
    }
  });
});

describe('formatearFechaLargaEs', () => {
  it('2026-09-19 incluye el día de la semana, el día, el mes y el año en español', () => {
    const texto = formatearFechaLargaEs('2026-09-19');

    expect(texto).toMatch(/sábado/i);
    expect(texto).toContain('19');
    expect(texto).toMatch(/septiembre/i);
    expect(texto).toContain('2026');
  });

  it('no depende del huso horario del proceso', () => {
    // `jest.config.ts` fija TZ=America/Argentina/Buenos_Aires por defecto: un huso con offset
    // negativo es el único que detecta la falta de `timeZone: "UTC"` (la medianoche UTC se lee
    // como el día anterior). Con TZ=UTC o con un offset positivo como Pacific/Kiritimati el
    // resultado sería el mismo aunque faltara, así que esos husos no prueban nada acá.
    expect(formatearFechaLargaEs('2026-09-19')).toBe(
      'sábado, 19 de septiembre de 2026',
    );
  });
});

describe('formatearHoraTurno', () => {
  it("'1970-01-01T20:00:00.000Z' es '20:00', sin conversión de huso horario", () => {
    expect(formatearHoraTurno('1970-01-01T20:00:00.000Z')).toBe('20:00');
  });

  it("'1970-01-01T08:05:00.000Z' es '08:05' (cero a la izquierda)", () => {
    expect(formatearHoraTurno('1970-01-01T08:05:00.000Z')).toBe('08:05');
  });
});

describe('validación estricta de la fecha', () => {
  const malas = [
    '',
    'abc',
    '2026-9-19',
    '2026-09-19T00:00:00Z',
    '2026-13-01',
    '2026-00-10',
    '2026-02-30',
  ];

  it.each(malas)('diaSemanaDeFechaLocal lanza con %p', (fecha) => {
    expect(() => diaSemanaDeFechaLocal(fecha)).toThrow(/fecha/i);
  });

  it.each(malas)('formatearFechaLargaEs lanza con %p', (fecha) => {
    expect(() => formatearFechaLargaEs(fecha)).toThrow(/fecha/i);
  });

  it('2026-02-30 no pasa a marzo', () => {
    expect(() => diaSemanaDeFechaLocal('2026-02-30')).toThrow();
  });

  it('acepta el 29 de febrero de un año bisiesto y no el de uno común', () => {
    expect(diaSemanaDeFechaLocal('2028-02-29')).toBe('MARTES');
    expect(() => diaSemanaDeFechaLocal('2026-02-29')).toThrow(/fecha/i);
  });
});

describe('validación estricta de la hora del turno', () => {
  it.each([
    '',
    'abc',
    '25:00',
    '20:60',
    '1970-01-01T99:00:00.000Z',
    '1970-01-01T20:00:60Z',
    '2026-09-19T20:00:00.000Z',
  ])('formatearHoraTurno lanza con %p, no devuelve NaN:NaN', (hora) => {
    expect(() => formatearHoraTurno(hora)).toThrow(/hora de inicio/i);
  });

  it('también acepta HH:mm, el formato de POST /reservas/consultar', () => {
    expect(formatearHoraTurno('08:05')).toBe('08:05');
  });

  it('ignora los segundos del ISO al mostrar HH:mm', () => {
    expect(formatearHoraTurno('1970-01-01T20:00:30.500Z')).toBe('20:00');
  });
});
