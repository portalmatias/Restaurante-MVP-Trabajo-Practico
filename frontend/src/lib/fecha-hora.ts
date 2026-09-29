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

// `HH:mm` (POST /reservas/consultar) o `1970-01-01THH:mm[:ss[.sss]]Z` (GET /turnos): las dos son
// la hora local del restaurante, sin conversión de huso horario. `HH:mm` equivale a `:00`.
const FORMATO_HORA_LOCAL = /^(\d{2}):(\d{2})$/;
const FORMATO_HORA_ISO = /^1970-01-01T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?Z$/;
const FORMATO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Hora del día en milisegundos. Una hora mal formada lanza, no da `false` por NaN. */
export function leerHoraLocalMs(valor: string): number {
  const coincidencia = FORMATO_HORA_LOCAL.exec(valor) ?? FORMATO_HORA_ISO.exec(valor);
  const horas = Number(coincidencia?.[1]);
  const minutos = Number(coincidencia?.[2]);
  const segundos = Number(coincidencia?.[3] ?? 0);
  // Fracción de segundo: se toman los tres primeros dígitos (milisegundos).
  const milisegundos = Number((coincidencia?.[4] ?? "").padEnd(3, "0").slice(0, 3));
  if (!coincidencia || horas > 23 || minutos > 59 || segundos > 59) {
    throw new Error(`La hora de inicio del turno no es válida: "${valor}".`);
  }
  return ((horas * 60 + minutos) * 60 + segundos) * 1000 + milisegundos;
}

/** Medianoche UTC de una fecha `YYYY-MM-DD` que existe en el calendario; si no, lanza. */
export function leerFechaIso(valor: string): number {
  const coincidencia = FORMATO_FECHA.exec(valor);
  const [anio, mes, dia] = [1, 2, 3].map((indice) => Number(coincidencia?.[indice]));
  const medianoche = Date.UTC(anio, mes - 1, dia);
  const fecha = new Date(medianoche);
  // Debe volver a los mismos componentes: 2026-02-30 pasaría a marzo.
  if (
    !coincidencia ||
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    throw new Error(`La fecha de la reserva no es válida: "${valor}".`);
  }
  return medianoche;
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

/** Medianoche UTC de una fecha `YYYY-MM-DD`; una fecha inválida lanza (ver `leerFechaIso`). */
function medianocheUtcDe(fecha: string): Date {
  return new Date(leerFechaIso(fecha));
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
 * Hora de un turno (`HH:mm`). `GET /turnos` la entrega como `1970-01-01THH:mm:00.000Z` y
 * `POST /reservas/consultar` como `HH:mm`: ya es la hora local del restaurante, no un instante
 * real, así que se lee sin convertir de huso horario. Una hora mal formada lanza.
 */
export function formatearHoraTurno(horaIso: string): string {
  const minutosDelDia = Math.floor(leerHoraLocalMs(horaIso) / 60_000);
  return `${dosDigitos(Math.floor(minutosDelDia / 60))}:${dosDigitos(minutosDelDia % 60)}`;
}
