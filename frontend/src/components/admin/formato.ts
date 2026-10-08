import type { components } from "../../lib/api/schema";
import { formatearHoraTurno, leerHoraLocalMs, type DiaSemana } from "../../lib/fecha-hora";

type Turno = components["schemas"]["TurnoRespuestaDto"];
export type EstadoReserva = components["schemas"]["ReservaAdminRespuesta"]["estado"];

export const ETIQUETA_DIA: Record<DiaSemana, string> = {
  LUNES: "Lunes",
  MARTES: "Martes",
  MIERCOLES: "Miércoles",
  JUEVES: "Jueves",
  VIERNES: "Viernes",
  SABADO: "Sábado",
  DOMINGO: "Domingo",
};

export const DIAS_SEMANA = Object.keys(ETIQUETA_DIA) as DiaSemana[];

export const ETIQUETA_ESTADO: Record<EstadoReserva, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADA: "Confirmada",
  CANCELADA: "Cancelada",
  NO_SHOW: "Ausente",
};

/** Tono del sello de cada estado (ver `sello.tsx`): texto y forma, no solo color. */
export const TONO_ESTADO: Record<EstadoReserva, "pendiente" | "confirmada" | "cancelada" | "ausente"> = {
  PENDIENTE: "pendiente",
  CONFIRMADA: "confirmada",
  CANCELADA: "cancelada",
  NO_SHOW: "ausente",
};

export const ESTADOS_RESERVA = Object.keys(ETIQUETA_ESTADO) as EstadoReserva[];

/**
 * Hora `HH:mm` de un Turno, tal cual la hora local del restaurante (spec "Alta, listado,
 * edición y activación de Turnos"). `formatearHoraTurno` lanza ante un valor inesperado; en
 * una pantalla, eso no debe tirar todo el listado: se muestra el valor tal cual llegó.
 */
export function horaTurno(valor: string): string {
  try {
    return formatearHoraTurno(valor);
  } catch {
    return valor;
  }
}

export function rangoTurno(turno: Pick<Turno, "horaInicio" | "horaFin">): string {
  return `${horaTurno(turno.horaInicio)} a ${horaTurno(turno.horaFin)}`;
}

function inicioMs(turno: Turno): number {
  try {
    return leerHoraLocalMs(turno.horaInicio);
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

/** Turnos ordenados por día de la semana y hora de inicio. */
export function ordenarTurnos(turnos: Turno[]): Turno[] {
  return [...turnos].sort(
    (a, b) =>
      DIAS_SEMANA.indexOf(a.diaSemana) - DIAS_SEMANA.indexOf(b.diaSemana) ||
      inicioMs(a) - inicioMs(b),
  );
}
