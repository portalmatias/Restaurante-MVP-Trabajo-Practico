/**
 * Reservas de demostración del seed de desarrollo (change `seed-datos-demo`, spec
 * `modelo-dominio`, requisito "Reservas de demostración del seed").
 *
 * Sirven para mostrar a mano dos reglas que los datos de ejemplo de `seed.ts` no permiten ver:
 * - `SEEDPAS2`: reserva CONFIRMADA de un turno ya terminado, para marcarla NO_SHOW.
 * - `SEEDVTN2`: reserva VIP en el próximo turno que empieza dentro de la ventana de cancelación,
 *   para que cancelarla sea rechazado. Como la anticipación mínima es igual a la ventana, una
 *   reserva creada por la API nunca queda en esa situación.
 *
 * Solo se cargan en desarrollo, nunca en producción.
 */
import { DiaSemana, PrismaClient } from '@prisma/client';

import {
  ARGENTINA_OFFSET_MS,
  inicioTurnoUtc,
  normalizarFechaCalendarioUtc,
} from '../src/common/timezone';

const MS_POR_HORA = 60 * 60 * 1000;
const MS_POR_DIA = 24 * MS_POR_HORA;

/** Índice de `getUTCDay()` (0 = domingo) → día de la semana del dominio. */
const DIA_POR_INDICE: DiaSemana[] = [
  DiaSemana.DOMINGO,
  DiaSemana.LUNES,
  DiaSemana.MARTES,
  DiaSemana.MIERCOLES,
  DiaSemana.JUEVES,
  DiaSemana.VIERNES,
  DiaSemana.SABADO,
];

export interface TurnoCandidato {
  id: string;
  diaSemana: DiaSemana;
  horaInicio: Date;
  activo: boolean;
}

/**
 * Elige el turno activo de inicio más próximo que empieza después de `ahora` y a menos de
 * `ventanaHoras` (un turno que empieza justo al cumplirse la ventana todavía se puede cancelar,
 * así que queda afuera). Devuelve la fecha calendario (medianoche UTC) y el turno, o `null` si
 * ninguno cumple.
 */
export function elegirTurnoEnVentana<T extends TurnoCandidato>(
  ahora: Date,
  turnos: T[],
  ventanaHoras: number,
): { fecha: Date; turno: T } | null {
  const finVentana = ahora.getTime() + ventanaHoras * MS_POR_HORA;
  // Fecha calendario de hoy en Argentina: el instante corrido por el offset, truncado al día.
  const hoy = normalizarFechaCalendarioUtc(
    new Date(ahora.getTime() + ARGENTINA_OFFSET_MS),
  );
  const dias = Math.ceil(ventanaHoras / 24);

  let elegido: { fecha: Date; turno: T; inicio: number } | null = null;
  for (let d = 0; d <= dias; d++) {
    const fecha = new Date(hoy.getTime() + d * MS_POR_DIA);
    const dia = DIA_POR_INDICE[fecha.getUTCDay()];
    for (const turno of turnos) {
      if (!turno.activo || turno.diaSemana !== dia) continue;
      const inicio = inicioTurnoUtc(fecha, turno.horaInicio).getTime();
      if (inicio <= ahora.getTime() || inicio >= finVentana) continue;
      if (!elegido || inicio < elegido.inicio) {
        elegido = { fecha, turno, inicio };
      }
    }
  }
  return elegido ? { fecha: elegido.fecha, turno: elegido.turno } : null;
}

interface ReservaDemo {
  codigoReserva: string;
  mesaId: string;
  turnoId: string;
  fecha: Date;
  comensales: number;
  nombreCliente: string;
  emailCliente: string;
  telefonoCliente: string;
}

/**
 * Upsert por código, igual que las reservas de ejemplo de `seed.ts`: `estado` queda fuera del
 * `update` para no revertir una reserva que alguien ya transicionó (invariante de estados
 * terminales), pero `fecha` y `turnoId` sí se reescriben.
 */
async function upsertReserva(prisma: PrismaClient, reserva: ReservaDemo) {
  const { codigoReserva, ...datos } = reserva;
  await prisma.reserva.upsert({
    where: { codigoReserva },
    update: datos,
    create: { ...reserva, estado: 'CONFIRMADA' },
  });
}

/**
 * Carga `SEEDPAS2` y `SEEDVTN2`. Necesita el catálogo ya cargado (mesas S2 y V2, turnos).
 * `ahora` se puede inyectar para los tests; el seed usa el reloj real.
 */
export async function seedReservasDemo(
  prisma: PrismaClient,
  log: (mensaje: string) => void = console.log,
  ahora: Date = new Date(),
) {
  const [mesaStandard, mesaVip, turnos] = await Promise.all([
    prisma.mesa.findUniqueOrThrow({ where: { etiqueta: 'S2' } }),
    prisma.mesa.findUniqueOrThrow({
      where: { etiqueta: 'V2' },
      include: { zona: true },
    }),
    prisma.turno.findMany(),
  ]);

  // Miércoles 07/01/2026, fijo para que sea reproducible y siempre pasado (como SEEDNSW2).
  const fechaPasada = new Date(Date.UTC(2026, 0, 7));
  const cenaMiercoles = turnos.find(
    (t) =>
      t.diaSemana === DiaSemana.MIERCOLES && t.horaInicio.getUTCHours() === 20,
  );
  if (!cenaMiercoles) {
    throw new Error('Falta el turno de cena del miércoles en el catálogo');
  }
  await upsertReserva(prisma, {
    codigoReserva: 'SEEDPAS2',
    mesaId: mesaStandard.id,
    turnoId: cenaMiercoles.id,
    fecha: fechaPasada,
    comensales: 2,
    nombreCliente: 'Valeria Sosa',
    emailCliente: 'valeria.sosa@example.com',
    telefonoCliente: '+54 9 11 5555-0005',
  });

  const ventanaHoras = mesaVip.zona.ventanaCancelacionHoras;
  const enVentana = elegirTurnoEnVentana(ahora, turnos, ventanaHoras);
  if (!enVentana) {
    log(
      `Seed: no se creó SEEDVTN2 (reserva VIP dentro de la ventana de cancelación): ningún turno activo empieza en las próximas ${ventanaHoras} h. Para crearla, correr el seed de nuevo más tarde.`,
    );
    return;
  }
  await upsertReserva(prisma, {
    codigoReserva: 'SEEDVTN2',
    mesaId: mesaVip.id,
    turnoId: enVentana.turno.id,
    fecha: enVentana.fecha,
    comensales: 4,
    nombreCliente: 'Andrés Molina',
    emailCliente: 'andres.molina@example.com',
    telefonoCliente: '+54 9 11 5555-0006',
  });
}
