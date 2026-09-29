/**
 * Utilidades puras de fecha y hora del restaurante (design.md D2).
 *
 * Convención (config.yaml §7): todo el cálculo usa `Date.UTC` y `getUTC*`, nunca los métodos
 * de zona horaria local del proceso, para que el resultado no dependa del dispositivo.
 */

/** Offset fijo de Argentina respecto de UTC, en milisegundos (-3 horas, sin horario de verano). */
export const ARGENTINA_OFFSET_MS = -3 * 60 * 60 * 1000;

function dosDigitos(numero: number): string {
  return String(numero).padStart(2, "0");
}

/**
 * Día de hoy (`YYYY-MM-DD`) en el calendario del restaurante. Suma el offset fijo de Argentina
 * al instante recibido y lo lee con `getUTC*`, sin `Intl`.
 */
export function fechaLocalDeHoy(ahora: Date): string {
  const local = new Date(ahora.getTime() + ARGENTINA_OFFSET_MS);
  return `${local.getUTCFullYear()}-${dosDigitos(local.getUTCMonth() + 1)}-${dosDigitos(local.getUTCDate())}`;
}

/** Día de la semana de un turno, con los mismos valores que el enum `DiaSemana` del contrato. */
export type DiaSemana =
  | "LUNES"
  | "MARTES"
  | "MIERCOLES"
  | "JUEVES"
  | "VIERNES"
  | "SABADO"
  | "DOMINGO";

// Indexado por `getUTCDay()` (0 = domingo ... 6 = sábado).
const DIAS_POR_INDICE_UTC: readonly DiaSemana[] = [
  "DOMINGO",
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
];

/** Convierte una fecha de calendario `YYYY-MM-DD` en la medianoche UTC de ese día. */
function medianocheUtcDe(fecha: string): Date {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
}

/** Día de la semana de una fecha `YYYY-MM-DD`, sin depender del huso horario del proceso. */
export function diaSemanaDeFechaLocal(fecha: string): DiaSemana {
  return DIAS_POR_INDICE_UTC[medianocheUtcDe(fecha).getUTCDay()];
}

const formateadorFechaLarga = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  // La fecha ya es una medianoche UTC de calendario: leerla en UTC devuelve exactamente ese
  // día, en cualquier huso horario del dispositivo.
  timeZone: "UTC",
});

/** Fecha `YYYY-MM-DD` en texto largo en español (ej. "sábado, 19 de septiembre de 2026"). */
export function formatearFechaLargaEs(fecha: string): string {
  return formateadorFechaLarga.format(medianocheUtcDe(fecha));
}

/**
 * Hora de un turno (`HH:mm`). La API la entrega como `1970-01-01THH:mm:00.000Z`: ya es la hora
 * local del restaurante con fecha fija, no un instante real, así que se lee con `getUTC*` y
 * sin convertir de huso horario.
 */
export function formatearHoraTurno(horaIso: string): string {
  const hora = new Date(horaIso);
  return `${dosDigitos(hora.getUTCHours())}:${dosDigitos(hora.getUTCMinutes())}`;
}
