import { ARGENTINA_OFFSET_MS } from "./fecha-hora";

const MS_POR_HORA = 60 * 60 * 1000;

// `HH:mm` (POST /reservas/consultar) o `1970-01-01THH:mm:ss.sssZ` (GET /turnos): las dos son la
// hora local del restaurante, sin conversión de huso horario.
const FORMATO_HORA_LOCAL = /^(\d{2}):(\d{2})$/;
const FORMATO_HORA_ISO = /^1970-01-01T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?Z$/;

/** Normaliza la hora de inicio de un turno. Una hora mal formada lanza, no da `false` por NaN. */
function leerHoraInicio(valor: string): { horas: number; minutos: number } {
  const coincidencia = FORMATO_HORA_LOCAL.exec(valor) ?? FORMATO_HORA_ISO.exec(valor);
  const horas = Number(coincidencia?.[1]);
  const minutos = Number(coincidencia?.[2]);
  if (!coincidencia || horas > 23 || minutos > 59) {
    throw new Error(`La hora de inicio del turno no es válida: "${valor}".`);
  }
  return { horas, minutos };
}

/**
 * Ayuda de navegación (design.md D9): estima si a `ahora` le faltan al menos
 * `ventanaCancelacionHoras` para el inicio del turno, solo para decidir si se ofrece el botón
 * "Cancelar mi reserva". El servidor vuelve a validar y es la única fuente de verdad.
 *
 * El inicio se arma como `inicioTurnoUtc` del backend: fecha + hora local de inicio + offset
 * fijo de Argentina, leído con `getUTC*`. La hora de inicio se acepta como `HH:mm` o como ISO
 * `1970-01-01THH:mm:00.000Z`; cualquier otra forma lanza un error. El borde es inclusivo
 * (exactamente la ventana antes del inicio todavía se puede cancelar), igual que
 * `cancelacion-turnos`.
 */
export function puedeCancelarSegunVentana(
  fecha: string,
  horaInicioTurno: string,
  ventanaCancelacionHoras: number,
  ahora: Date,
): boolean {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const { horas, minutos } = leerHoraInicio(horaInicioTurno);
  const inicioNaiveMs = Date.UTC(anio, mes - 1, dia, horas, minutos);
  // La combinación fecha + hora está en hora local de Argentina: restar el (negativo) offset
  // da el instante UTC real.
  const inicioUtcMs = inicioNaiveMs - ARGENTINA_OFFSET_MS;

  return inicioUtcMs - ahora.getTime() >= ventanaCancelacionHoras * MS_POR_HORA;
}
