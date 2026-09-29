import { fechaCalendarioAIso } from '../common/timezone';
import type { ReservaAdminRespuesta } from './dto/reserva-admin-respuesta.dto';
import {
  formatearHoraLocal,
  type ReservaParaConsulta,
} from './reserva-consultada.mapper';

/**
 * Vista completa de una Reserva para el listado de administrador (design.md D6 de
 * `reserva-consultar`). A diferencia de `aReservaConsultadaRespuesta`, incluye el `id`
 * interno, los datos de contacto, la mesa y `createdAt` — datos que la consulta pública
 * nunca puede devolver.
 *
 * `ReservaParaConsulta` (de `reserva-consultada.mapper`) ya trae todo lo necesario: incluye
 * todos los campos escalares de `Reserva` más `turno` y `mesa.zona`.
 */
export function aReservaAdminRespuesta(
  reserva: ReservaParaConsulta,
): ReservaAdminRespuesta {
  return {
    id: reserva.id,
    codigoReserva: reserva.codigoReserva,
    estado: reserva.estado,
    fecha: fechaCalendarioAIso(reserva.fecha),
    comensales: reserva.comensales,
    nombreCliente: reserva.nombreCliente,
    emailCliente: reserva.emailCliente,
    telefonoCliente: reserva.telefonoCliente,
    turno: {
      id: reserva.turno.id,
      horaInicio: formatearHoraLocal(reserva.turno.horaInicio),
      horaFin: formatearHoraLocal(reserva.turno.horaFin),
    },
    zona: {
      id: reserva.mesa.zona.id,
      nombre: reserva.mesa.zona.nombre,
    },
    mesa: {
      id: reserva.mesa.id,
      etiqueta: reserva.mesa.etiqueta,
    },
    createdAt: reserva.createdAt.toISOString(),
  };
}
