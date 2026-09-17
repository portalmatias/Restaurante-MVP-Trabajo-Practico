import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ContextoReserva, SolicitudDisponibilidad } from '../reglas/tipos';

/**
 * Cliente de base aceptado por `cargarContexto`: el `PrismaService` inyectado (consulta
 * suelta de `GET /disponibilidad`) o el `tx` de un `prisma.$transaction` (creación de
 * reservas). `PrismaClient` es asignable a `Prisma.TransactionClient`, así que la misma
 * implementación sirve para los dos casos (design.md D1).
 */
export type ClienteBaseDatos = PrismaService | Prisma.TransactionClient;

/**
 * Estados que ocupan cupo y mesa. `CANCELADA` y `NO_SHOW` liberan el lugar, así que no
 * suman a la ocupación ni bloquean una mesa (spec.md → "Ocupación por estado").
 */
const ESTADOS_QUE_OCUPAN: Prisma.EnumEstadoReservaFilter = {
  in: ['PENDIENTE', 'CONFIRMADA'],
};

/**
 * Normaliza una fecha de calendario a medianoche UTC. Prisma trunca un `@db.Date` a la
 * parte de fecha **UTC** del `Date` que recibe, así que pasar un instante con hora (por
 * ejemplo el inicio del turno, que para una cena tardía cae al día siguiente) correría la
 * fecha un día (design.md → Trampas de fechas).
 */
function soloFecha(fecha: Date): Date {
  return new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()),
  );
}

/**
 * Único punto del validador de disponibilidad que lee la base (design.md D1). Devuelve los
 * datos planos que necesitan `evaluarReglas` y `calcularLugaresRestantes`, que son funciones
 * puras y no vuelven a consultar nada.
 *
 * Todo sale de la API tipada de Prisma: `findUnique` para turno, zona y configuración,
 * `aggregate` para la ocupación (la zona de una reserva se resuelve por su mesa, porque
 * `Reserva` no tiene `zonaId`) y `findMany` con `reservas: { none: ... }` para las mesas
 * libres. El `$executeRaw` del módulo es solo para el lock advisory (D6/D7).
 *
 * Si el turno o la zona no existen lanza `NotFoundException` (404), primero el turno y
 * después la zona, en el orden que fija la spec.
 *
 * @param db `PrismaService` o el `tx` de una transacción: la ocupación que se lee dentro de
 *   una transacción que ya tomó `bloquearTurnoFecha` incluye lo que confirmó el anterior.
 */
export async function cargarContexto(
  db: ClienteBaseDatos,
  solicitud: SolicitudDisponibilidad,
): Promise<ContextoReserva> {
  const cliente: Prisma.TransactionClient = db;
  const { turnoId, zonaId } = solicitud;
  const fecha = soloFecha(solicitud.fecha);

  const turno = await cliente.turno.findUnique({
    where: { id: turnoId },
    select: { activo: true, diaSemana: true, horaInicio: true },
  });
  if (!turno) {
    throw new NotFoundException(`No existe un turno con id ${turnoId}`);
  }

  const zona = await cliente.zona.findUnique({
    where: { id: zonaId },
    select: {
      nombre: true,
      minComensales: true,
      maxComensales: true,
      anticipacionMinHoras: true,
      anticipacionMaxDias: true,
      aforoMaximo: true,
      requiereConfirmacionAdmin: true,
    },
  });
  if (!zona) {
    throw new NotFoundException(`No existe una zona con id ${zonaId}`);
  }

  // Fila única de configuración (id = 1), la crea el seed. Que falte no es un error del
  // cliente: la consulta está bien formada y el turno y la zona existen, así que no puede
  // ser un 404 ni (D3) un 409 en una consulta.
  const configuracion = await cliente.configuracionNegocio.findUnique({
    where: { id: 1 },
  });
  if (!configuracion) {
    throw new InternalServerErrorException(
      'No hay configuración de negocio cargada para validar el aforo global.',
    );
  }

  const ocupacionZona = await cliente.reserva.aggregate({
    where: {
      turnoId,
      fecha,
      estado: ESTADOS_QUE_OCUPAN,
      mesa: { zonaId },
    },
    _sum: { comensales: true },
  });

  const ocupacionGlobal = await cliente.reserva.aggregate({
    where: {
      turnoId,
      fecha,
      estado: ESTADOS_QUE_OCUPAN,
    },
    _sum: { comensales: true },
  });

  // Mesas de la zona sin ninguna reserva activa en ese turno y esa fecha. El orden es
  // estable (capacidad y después etiqueta) para que el resultado no dependa del plan de
  // Postgres; elegir cuál se asigna (best fit) es de `reservas-crear`, no de acá.
  const mesasLibres = await cliente.mesa.findMany({
    where: {
      zonaId,
      reservas: {
        none: {
          turnoId,
          fecha,
          estado: ESTADOS_QUE_OCUPAN,
        },
      },
    },
    select: { id: true, etiqueta: true, capacidad: true },
    orderBy: [{ capacidad: 'asc' }, { etiqueta: 'asc' }],
  });

  return {
    turno,
    zona,
    aforoGlobal: configuracion.aforoGlobal,
    ocupadosZona: ocupacionZona._sum.comensales ?? 0,
    ocupadosGlobal: ocupacionGlobal._sum.comensales ?? 0,
    mesasLibres,
  };
}
