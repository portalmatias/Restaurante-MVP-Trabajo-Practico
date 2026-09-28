import { diaSemanaDeFecha, inicioTurnoUtc } from '../../common/timezone';
import {
  CodigoMotivo,
  DIAS,
  ContextoReserva,
  MotivoNoDisponible,
  SolicitudDisponibilidad,
} from './tipos';

const MS_POR_HORA = 60 * 60 * 1000;
// La anticipación máxima se mide en días de 24 horas (spec.md → "Regla de anticipación máxima").
const MS_POR_DIA = 24 * MS_POR_HORA;

const plural = (n: number, singular: string, pluralTexto: string) =>
  `${n} ${n === 1 ? singular : pluralTexto}`;

/**
 * Evalúa las ocho reglas de disponibilidad y devuelve TODOS los motivos que fallan, en el
 * orden fijo de `CodigoMotivo` (design.md D2). Lista vacía = hay lugar.
 *
 * Es una función pura (design.md D1): no lee la base ni el reloj. `ahora` se inyecta para
 * poder probar los bordes exactos (2 h, 1 h 59 min, 30 días) sin mocks, y el mismo código
 * sirve para la consulta (`GET /disponibilidad`) y para la creación de reservas.
 *
 * Fechas: `solicitud.fecha` es la fecha de calendario local; el día de la semana sale de esa
 * fecha y nunca del instante UTC del inicio del turno, que para una cena tardía cae al día
 * siguiente (design.md → Trampas de fechas).
 */
export function evaluarReglas(
  contexto: ContextoReserva,
  solicitud: SolicitudDisponibilidad,
  ahora: Date,
): MotivoNoDisponible[] {
  const { turno, zona } = contexto;
  const { comensales } = solicitud;
  const motivos: MotivoNoDisponible[] = [];

  if (!turno.activo) {
    motivos.push({
      codigo: CodigoMotivo.TURNO_INACTIVO,
      mensaje: 'El turno elegido no está habilitado para reservas.',
    });
  }

  if (DIAS[diaSemanaDeFecha(solicitud.fecha)] !== turno.diaSemana) {
    motivos.push({
      codigo: CodigoMotivo.TURNO_NO_CORRESPONDE_A_FECHA,
      mensaje:
        'El turno elegido no corresponde al día de la semana de la fecha pedida.',
    });
  }

  // Un turno que ya empezó da un margen negativo y cae en la mínima: cubre RN-06 (no se
  // reserva en el pasado) sin una regla aparte. Los bordes exactos están permitidos.
  const margenMs =
    inicioTurnoUtc(solicitud.fecha, turno.horaInicio).getTime() -
    ahora.getTime();

  if (margenMs < zona.anticipacionMinHoras * MS_POR_HORA) {
    motivos.push({
      codigo: CodigoMotivo.ANTICIPACION_MINIMA,
      mensaje: `En la zona ${zona.nombre} se reserva con al menos ${plural(zona.anticipacionMinHoras, 'hora', 'horas')} de anticipación.`,
    });
  }

  if (margenMs > zona.anticipacionMaxDias * MS_POR_DIA) {
    motivos.push({
      codigo: CodigoMotivo.ANTICIPACION_MAXIMA,
      mensaje: `En la zona ${zona.nombre} se reserva con hasta ${plural(zona.anticipacionMaxDias, 'día', 'días')} de anticipación.`,
    });
  }

  if (comensales < zona.minComensales || comensales > zona.maxComensales) {
    motivos.push({
      codigo: CodigoMotivo.COMENSALES_FUERA_DE_RANGO,
      mensaje: `La zona ${zona.nombre} admite de ${zona.minComensales} a ${zona.maxComensales} comensales por reserva.`,
    });
  }

  // Llenar el aforo exacto está permitido: solo falla si lo supera.
  if (contexto.ocupadosZona + comensales > zona.aforoMaximo) {
    motivos.push({
      codigo: CodigoMotivo.AFORO_ZONA,
      mensaje: `La zona ${zona.nombre} no tiene lugar para ${plural(comensales, 'comensal', 'comensales')} en ese turno y esa fecha.`,
    });
  }

  if (contexto.ocupadosGlobal + comensales > contexto.aforoGlobal) {
    motivos.push({
      codigo: CodigoMotivo.AFORO_GLOBAL,
      mensaje: `El restaurante no tiene lugar para ${plural(comensales, 'comensal', 'comensales')} en ese turno y esa fecha.`,
    });
  }

  // No se combinan mesas: alguna mesa libre tiene que alcanzar sola.
  if (!contexto.mesasLibres.some((mesa) => mesa.capacidad >= comensales)) {
    motivos.push({
      codigo: CodigoMotivo.SIN_MESA_DISPONIBLE,
      mensaje: `No queda una mesa libre en la zona ${zona.nombre} para ${plural(comensales, 'comensal', 'comensales')}.`,
    });
  }

  return motivos;
}

/**
 * Comensales (no mesas) que todavía entran en ese turno y esa fecha: el mínimo entre lo que
 * le queda a la zona y lo que le queda al salón, sin descontar los comensales pedidos, y
 * nunca negativo (por ejemplo, si el admin bajó el aforo por debajo de lo ya ocupado).
 */
export function calcularLugaresRestantes(contexto: ContextoReserva): number {
  return Math.max(
    0,
    Math.min(
      contexto.zona.aforoMaximo - contexto.ocupadosZona,
      contexto.aforoGlobal - contexto.ocupadosGlobal,
    ),
  );
}
