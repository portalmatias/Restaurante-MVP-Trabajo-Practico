import type { Prisma } from '@prisma/client';

import type { ReservaConsultadaRespuesta } from './dto/reserva-consultada-respuesta.dto';

/**
 * Reserva con las relaciones que necesita la vista de consulta: su turno y la zona de su
 * mesa (`Reserva` no tiene `zonaId`, la zona sale de `mesa.zona`). Es lo que devuelve
 * `ReservasService.buscarPorCodigoYEmail`.
 */
export type ReservaParaConsulta = Prisma.ReservaGetPayload<{
  include: { turno: true; mesa: { include: { zona: true } } };
}>;

/**
 * `YYYY-MM-DD` de una fecha de calendario (`@db.Date`). Se lee con `getUTC*`: Prisma
 * devuelve esa columna como un `Date` a medianoche UTC, y `getDate()` daría el día anterior
 * en un proceso con zona horaria al oeste de UTC (config.yaml §7).
 */
export function formatearFechaCalendario(fecha: Date): string {
  const anio = String(fecha.getUTCFullYear()).padStart(4, '0');
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getUTCDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/**
 * `HH:mm` de una hora local del restaurante (`@db.Time`). Prisma la devuelve como un `Date`
 * en la época Unix con la hora en su parte UTC; se lee con `getUTC*` y **no se convierte**:
 * ya es la hora local de Buenos Aires, sin fecha ni offset (config.yaml §7).
 */
export function formatearHoraLocal(hora: Date): string {
  const horas = String(hora.getUTCHours()).padStart(2, '0');
  const minutos = String(hora.getUTCMinutes()).padStart(2, '0');
  return `${horas}:${minutos}`;
}

/**
 * Vista mínima de una Reserva para quien la consulta con su código y su email (design.md
 * D4). Arma el objeto **campo por campo**, sin esparcir la entidad: así el `id` interno, la
 * mesa, los datos de contacto y las marcas de tiempo no pueden filtrarse a una ruta pública
 * aunque el `include` de la búsqueda cambie.
 */
export function aReservaConsultadaRespuesta(
  reserva: ReservaParaConsulta,
): ReservaConsultadaRespuesta {
  return {
    codigoReserva: reserva.codigoReserva,
    estado: reserva.estado,
    fecha: formatearFechaCalendario(reserva.fecha),
    comensales: reserva.comensales,
    turno: {
      id: reserva.turno.id,
      horaInicio: formatearHoraLocal(reserva.turno.horaInicio),
      horaFin: formatearHoraLocal(reserva.turno.horaFin),
    },
    zona: {
      id: reserva.mesa.zona.id,
      nombre: reserva.mesa.zona.nombre,
    },
  };
}
