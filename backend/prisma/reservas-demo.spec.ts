import { DiaSemana } from '@prisma/client';

import { elegirTurnoEnVentana, TurnoCandidato } from './reservas-demo';

/**
 * Change `seed-datos-demo` (spec `modelo-dominio`, requisito "Reservas de demostración del
 * seed"). `elegirTurnoEnVentana` es pura, así que se prueba sin base; los casos contra la base
 * están en `test/reservas-demo-seed.integration-spec.ts`.
 */

/** Instante UTC de una fecha y hora de Argentina (offset fijo −3). */
function horaArgentina(iso: string): Date {
  return new Date(`${iso}-03:00`);
}

function hora(h: number, m = 0): Date {
  return new Date(Date.UTC(1970, 0, 1, h, m));
}

/** Los turnos del catálogo: almuerzo 12:00 y cena 20:00, activos de martes a domingo. */
const DIAS: DiaSemana[] = [
  DiaSemana.LUNES,
  DiaSemana.MARTES,
  DiaSemana.MIERCOLES,
  DiaSemana.JUEVES,
  DiaSemana.VIERNES,
  DiaSemana.SABADO,
  DiaSemana.DOMINGO,
];
const TURNOS: TurnoCandidato[] = DIAS.flatMap((dia) => [
  {
    id: `${dia}_ALMUERZO`,
    diaSemana: dia,
    horaInicio: hora(12),
    activo: dia !== DiaSemana.LUNES,
  },
  {
    id: `${dia}_CENA`,
    diaSemana: dia,
    horaInicio: hora(20),
    activo: dia !== DiaSemana.LUNES,
  },
]);

describe('elegirTurnoEnVentana', () => {
  // 2026-11-10 es martes.
  it.each([
    [
      'martes 10:00 → almuerzo del martes',
      '2026-11-10T10:00',
      'MARTES_ALMUERZO',
      '2026-11-10',
    ],
    [
      'martes 13:00 → cena del martes',
      '2026-11-10T13:00',
      'MARTES_CENA',
      '2026-11-10',
    ],
    [
      'sábado 21:00 → almuerzo del domingo',
      '2026-11-14T21:00',
      'DOMINGO_ALMUERZO',
      '2026-11-15',
    ],
    [
      'lunes 12:00:01 → almuerzo del martes',
      '2026-11-16T12:00:01',
      'MARTES_ALMUERZO',
      '2026-11-17',
    ],
  ])('%s', (_caso, ahora, turnoEsperado, fechaEsperada) => {
    const elegido = elegirTurnoEnVentana(horaArgentina(ahora), TURNOS, 24);

    expect(elegido?.turno.id).toBe(turnoEsperado);
    expect(elegido?.fecha.toISOString()).toBe(`${fechaEsperada}T00:00:00.000Z`);
  });

  it('domingo 23:00 → null: los lunes no hay turnos', () => {
    expect(
      elegirTurnoEnVentana(horaArgentina('2026-11-15T23:00'), TURNOS, 24),
    ).toBeNull();
  });

  it('un turno que empieza justo al cumplirse la ventana queda afuera', () => {
    // Lunes 12:00: el almuerzo del martes empieza a exactamente 24 h.
    expect(
      elegirTurnoEnVentana(horaArgentina('2026-11-16T12:00'), TURNOS, 24),
    ).toBeNull();
  });

  it('ignora los turnos inactivos', () => {
    const sinAlmuerzoMartes = TURNOS.map((t) =>
      t.id === 'MARTES_ALMUERZO' ? { ...t, activo: false } : t,
    );

    const elegido = elegirTurnoEnVentana(
      horaArgentina('2026-11-10T10:00'),
      sinAlmuerzoMartes,
      24,
    );

    expect(elegido?.turno.id).toBe('MARTES_CENA');
  });
});
