/**
 * Utilidad de zona horaria fija para la aplicación.
 *
 * Decisión de diseño (config.yaml §7, confirmada en la revisión del PR #12): el backend
 * usa el **offset fijo de Argentina** (`America/Argentina/Buenos_Aires`, UTC-3 desde 2009,
 * sin horario de verano). No existe un campo `zonaHoraria` en `ConfiguracionNegocio` ni
 * dependencia de ningún otro módulo (en particular, no de `disponibilidad/zona-horaria.ts`,
 * que pertenece a otro change todavía no integrado en esta rama). Por eso el offset es una
 * constante fija y no requiere una librería de zonas horarias completa (date-fns-tz, luxon,
 * etc.) — es una decisión deliberada de simplicidad para el MVP (config.yaml §2: no agregar
 * deps sin justificar en design.md).
 *
 * Si en el futuro el equipo necesitara soportar otro huso horario, esta decisión deberá
 * revisarse explícitamente: habría que introducir una configuración dinámica (variable de
 * entorno, tabla en BD, o librería TZ completa) y auditar todos los puntos de consumo
 * (reservas-crear, cancelacion-turnos, reserva-vip).
 *
 * `Turno.horaInicio` / `Turno.horaFin` son horas locales del restaurante sin fecha ni offset
 * (`@db.Time`); Prisma las devuelve como `Date` en la época Unix (1970-01-01) con la hora en
 * su parte UTC. `Reserva.fecha` es una fecha calendario pura (`@db.Date`), también sin hora
 * significativa. Para validar anticipación, cancelación y NO_SHOW contra "ahora" (un instante
 * UTC real) hay que combinar ambos campos y aplicar el offset fijo — ver
 * `combinarFechaYHoraLocalEnUtc`, `inicioTurnoUtc` y `finTurnoUtc` más abajo.
 */

/** Offset fijo de Argentina respecto a UTC en milisegundos: -3 horas = -10800000 ms. */
export const ARGENTINA_OFFSET_MS = -3 * 60 * 60 * 1000;

/** Offset fijo de Argentina respecto a UTC en horas. */
export const ARGENTINA_OFFSET_HORAS = -3;

/**
 * Combina una fecha calendario local (`@db.Date`) con una hora local del restaurante
 * (`@db.Time`, `Date` en época 1970 con la hora en su parte UTC) y devuelve el instante
 * UTC real que representan juntas, aplicando el offset fijo de Argentina.
 *
 * Ambos parámetros se leen con métodos `getUTC*` para no depender de la zona horaria del
 * proceso que ejecuta el código (config.yaml §7).
 *
 * @param fecha Date que representa una fecha calendario local (sin componente de hora significativo)
 * @param horaLocal Date en época 1970 cuya parte UTC codifica una hora local de Argentina
 * @returns Date en UTC real correspondiente a "esa fecha calendario, a esa hora local"
 */
export function combinarFechaYHoraLocalEnUtc(fecha: Date, horaLocal: Date): Date {
  const instanteNaive = Date.UTC(
    fecha.getUTCFullYear(),
    fecha.getUTCMonth(),
    fecha.getUTCDate(),
    horaLocal.getUTCHours(),
    horaLocal.getUTCMinutes(),
    horaLocal.getUTCSeconds(),
    horaLocal.getUTCMilliseconds(),
  );
  // instanteNaive trata la combinación fecha+hora como si ya fuera UTC. Como en realidad es
  // hora local de Argentina, hay que sumarle 3 horas para obtener el instante UTC real
  // (restar el offset, que es negativo).
  return new Date(instanteNaive - ARGENTINA_OFFSET_MS);
}

/**
 * Devuelve el día calendario siguiente a `fecha` (sin tocar ninguna hora), usando
 * aritmética de componentes UTC para no depender de la zona horaria del proceso.
 *
 * @param fecha Date que representa una fecha calendario local
 * @returns Date con la fecha calendario siguiente
 */
function avanzarFechaUnDia(fecha: Date): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate() + 1));
}

/**
 * Calcula el instante UTC real de inicio de un turno: la fecha calendario de la reserva
 * combinada con la hora de inicio local del turno.
 *
 * @param fecha Fecha calendario de la reserva (`@db.Date`)
 * @param horaInicio Hora de inicio local del turno (`@db.Time`)
 * @returns Date en UTC real del inicio del turno
 */
export function inicioTurnoUtc(fecha: Date, horaInicio: Date): Date {
  return combinarFechaYHoraLocalEnUtc(fecha, horaInicio);
}

/**
 * Calcula el instante UTC real de fin de un turno: la fecha calendario de la reserva
 * combinada con la hora de fin local del turno.
 *
 * Si la hora de fin es anterior a la hora de inicio (comparando solo la hora del día), el
 * turno cruza la medianoche y el fin corresponde al día calendario siguiente: se avanza la
 * `fecha` un día antes de combinarla con `horaFin`, en vez de sumar 24 horas a un instante
 * UTC ya calculado (evita asumir que un día siempre dura 24 horas exactas, aunque con un
 * offset fijo sin DST esto no varía; mantiene el patrón exigido por config.yaml §7 para
 * cuando esta decisión se revise).
 *
 * @param fecha Fecha calendario de la reserva (`@db.Date`)
 * @param horaInicio Hora de inicio local del turno (`@db.Time`)
 * @param horaFin Hora de fin local del turno (`@db.Time`)
 * @returns Date en UTC real del fin del turno
 */
export function finTurnoUtc(fecha: Date, horaInicio: Date, horaFin: Date): Date {
  const cruzaMedianoche = horaFin.getTime() < horaInicio.getTime();
  const fechaDeFin = cruzaMedianoche ? avanzarFechaUnDia(fecha) : fecha;
  return combinarFechaYHoraLocalEnUtc(fechaDeFin, horaFin);
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
