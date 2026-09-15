/**
 * Utilidad de zona horaria fija para la aplicación.
 *
 * Argentina (America/Argentina/Buenos_Aires) está en UTC-3 desde 2009 y no observa
 * horario de verano (DST). Por eso el offset es una constante fija y no requiere
 * una librería de zonas horarias completa (date-fns-tz, luxon, etc.).
 *
 * Si en el futuro el equipo necesitara soportar otro huso horario, esta decisión
 * deberá revisarse: habría que reemplazar esta constante por una configuración
 * dinámica (variable de entorno, tabla en BD, o librería TZ completa) y auditar
 * todos los puntos de consumo (reservas-crear, cancelacion-turnos, reserva-vip).
 * No está pensado para ser extensible ahora — es una decisión deliberada de
 * simplicidad para el MVP (config.yaml §2: no agregar deps sin justificar en design.md).
 */

/** Offset fijo de Argentina respecto a UTC en milisegundos: -3 horas = -10800000 ms. */
export const ARGENTINA_OFFSET_MS = -3 * 60 * 60 * 1000;

/** Offset fijo de Argentina respecto a UTC en horas. */
export const ARGENTINA_OFFSET_HORAS = -3;

/**
 * Convierte una hora local de Argentina (representada como Date con componente de hora
 * en UTC, como la devuelve Prisma para @db.Time) a un Date en UTC real para
 * comparaciones contra "ahora".
 *
 * Prisma devuelve @db.Time como un Date en la época Unix (1970-01-01) con la hora
 * en UTC. Como esa hora en realidad es "hora local de Argentina", para obtener el
 * instante UTC real hay que restar el offset (sumar 3 horas).
 *
 * @param horaLocalArgentina Date con la hora en UTC que representa hora local AR
 * @returns Date en UTC real (mismo instante, zona distinta)
 */
export function horaLocalArgentinaAUtc(horaLocalArgentina: Date): Date {
  return new Date(horaLocalArgentina.getTime() - ARGENTINA_OFFSET_MS);
}

/**
 * Convierte un Date en UTC a la hora local de Argentina equivalente (como Date
 * en época Unix con la hora desplazada), para guardar en @db.Time.
 *
 * @param utc Date en UTC
 * @returns Date en época Unix con hora local AR
 */
export function utcAHoraLocalArgentina(utc: Date): Date {
  return new Date(utc.getTime() + ARGENTINA_OFFSET_MS);
}

/**
 * Obtiene el día de la semana (0 = domingo ... 6 = sábado) de una fecha calendario
 * pura (@db.Date) de forma estable, independiente de la zona horaria del proceso.
 *
 * @param fecha Date que representa una fecha calendario (sin componente de hora significativo)
 * @returns número 0-6 (domingo-sábado) según UTC, que coincide con el día calendario
 */
export function diaSemanaDeFecha(fecha: Date): number {
  return fecha.getUTCDay();
}
