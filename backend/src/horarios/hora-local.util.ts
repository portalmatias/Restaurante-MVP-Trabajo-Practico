const FORMATO_HORA_LOCAL = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

/**
 * Transforma una hora local del restaurante en formato `HH:mm` o `HH:mm:ss` (config.yaml
 * §7: `Turno.horaInicio`/`horaFin` son horas locales, sin fecha) al `Date` en la época
 * 1970 UTC que usa el resto del código (`backend/src/common/timezone.ts`, columna Prisma
 * `@db.Time`). Un valor con otro formato se convierte en `Invalid Date`: `@IsDate()` la
 * rechaza con `400` en vez de que la fecha inválida se cuele hasta Prisma.
 */
export function transformarHoraLocal({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const match = FORMATO_HORA_LOCAL.exec(value);
  if (!match) {
    return new Date(NaN);
  }
  const [, horas, minutos, segundos] = match;
  return new Date(
    Date.UTC(
      1970,
      0,
      1,
      Number(horas),
      Number(minutos),
      Number(segundos ?? '0'),
    ),
  );
}
