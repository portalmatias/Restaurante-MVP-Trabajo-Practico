import { DiaSemana } from '@prisma/client';

import { ARGENTINA_OFFSET_MS } from '../../src/common/timezone';
import { DIAS } from '../../src/disponibilidad/reglas/tipos';

/**
 * Helpers de fecha compartidos entre `disponibilidad.e2e-spec.ts` y
 * `reservas-crear.e2e-spec.ts` (cubic, PR #40, hallazgo P3: antes estaban copiados literales
 * en los dos archivos). Las dos suites calculan su fecha de trabajo desde el reloj real y
 * lejos de todo borde (D9 de `disponibilidad`), siempre con `Date.UTC`/getters `getUTC*` para
 * no depender de la zona horaria del proceso (config.yaml §7).
 *
 * Las bandas horarias de cada suite (10:00–10:59 en `reservas-crear`, 06:00–06:59 en
 * `disponibilidad`) quedan locales a cada archivo: no forman parte de esta duplicación.
 */

/** Fecha de calendario (medianoche UTC), la forma en que viaja una `@db.Date` (D4). */
export function fechaCalendario(anio: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(anio, mes - 1, dia));
}

/** Hoy según el calendario local del restaurante (UTC-3), no según el del proceso. */
export function hoyLocal(): Date {
  const ahoraLocal = new Date(Date.now() + ARGENTINA_OFFSET_MS);
  return fechaCalendario(
    ahoraLocal.getUTCFullYear(),
    ahoraLocal.getUTCMonth() + 1,
    ahoraLocal.getUTCDate(),
  );
}

export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(
    Date.UTC(
      fecha.getUTCFullYear(),
      fecha.getUTCMonth(),
      fecha.getUTCDate() + dias,
    ),
  );
}

/** El `DiaSemana` que le corresponde a una fecha de calendario. */
export function diaDe(fecha: Date): DiaSemana {
  return DIAS[fecha.getUTCDay()];
}

/** Primer lunes que cae a `minimoDias` días o más de hoy. Los turnos del lunes son inactivos. */
export function proximoLunes(minimoDias: number): Date {
  let candidata = sumarDias(hoyLocal(), minimoDias);
  while (diaDe(candidata) !== DiaSemana.LUNES) {
    candidata = sumarDias(candidata, 1);
  }
  return candidata;
}

/**
 * `YYYY-MM-DD`, la forma en que viaja `fecha` en el body/query. Reexporta
 * `fechaCalendarioAIso` de `src/common/timezone`: es exactamente la misma lógica (getters
 * `getUTC*`, nunca `toISOString().slice(0, 10)`), así que no hace falta duplicarla acá.
 */
export { fechaCalendarioAIso as fechaISO } from '../../src/common/timezone';

/** Fecha de trabajo: 10 días adelante, lejos de toda anticipación mínima y máxima. */
export const FECHA = sumarDias(hoyLocal(), 10);

/** Primer lunes a 8 días o más de hoy (entre 8 y 14 días). */
export const FECHA_LUNES = proximoLunes(8);
