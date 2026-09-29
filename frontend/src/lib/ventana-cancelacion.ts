import { ARGENTINA_OFFSET_MS } from "./fecha-hora";

const MS_POR_HORA = 60 * 60 * 1000;

// `HH:mm` (POST /reservas/consultar) o `1970-01-01THH:mm[:ss[.sss]]Z` (GET /turnos): las dos son
// la hora local del restaurante, sin conversión de huso horario. `HH:mm` equivale a `:00`.
const FORMATO_HORA_LOCAL = /^(\d{2}):(\d{2})$/;
const FORMATO_HORA_ISO = /^1970-01-01T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?Z$/;
const FORMATO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Hora del día en milisegundos. Una hora mal formada lanza, no da `false` por NaN. */
function leerHoraInicioMs(valor: string): number {
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
function leerFechaMs(valor: string): number {
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
 * Ayuda de navegación (design.md D9): estima si a `ahora` le faltan al menos
 * `ventanaCancelacionHoras` para el inicio del turno, solo para decidir si se ofrece el botón
 * "Cancelar mi reserva". El servidor vuelve a validar y es la única fuente de verdad.
 *
 * El inicio se arma como `inicioTurnoUtc` del backend: fecha + hora local de inicio + offset
 * fijo de Argentina, leído con `getUTC*`. La hora de inicio se acepta como `HH:mm` o como ISO
 * `1970-01-01THH:mm:ss.sssZ` (con sus segundos y milisegundos); una fecha o una hora mal
 * formadas o imposibles lanzan un error. El borde es inclusivo
 * (exactamente la ventana antes del inicio todavía se puede cancelar), igual que
 * `cancelacion-turnos`.
 */
export function puedeCancelarSegunVentana(
  fecha: string,
  horaInicioTurno: string,
  ventanaCancelacionHoras: number,
  ahora: Date,
): boolean {
  const inicioNaiveMs = leerFechaMs(fecha) + leerHoraInicioMs(horaInicioTurno);
  // La combinación fecha + hora está en hora local de Argentina: restar el (negativo) offset
  // da el instante UTC real.
  const inicioUtcMs = inicioNaiveMs - ARGENTINA_OFFSET_MS;

  return inicioUtcMs - ahora.getTime() >= ventanaCancelacionHoras * MS_POR_HORA;
}
