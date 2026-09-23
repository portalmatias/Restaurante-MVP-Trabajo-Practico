import { Prisma } from '@prisma/client';

import { fechaCalendarioAIso } from '../../common/timezone';

/**
 * Toma el lock advisory de `(turno, fecha)` dentro de una transacción (design.md D6).
 *
 * `reservas-crear` lo usa como **primera** sentencia de su transacción: el lock se libera
 * solo con el `COMMIT` o el `ROLLBACK`, y en `READ COMMITTED` cada sentencia ve lo que se
 * confirmó antes de empezar, así que el `aggregate` de `cargarContexto` que corre después
 * ya ve la reserva que insertó quien tenía el lock antes. La clave **no** incluye la zona a
 * propósito: dos creaciones en zonas distintas del mismo turno y fecha también compiten por
 * el aforo global.
 *
 * Se usa `$executeRaw` y no `$queryRaw` porque `pg_advisory_xact_lock` devuelve `void` y
 * Prisma falla al deserializar esa columna. `$executeRaw` es API de Prisma (pasa por su
 * conexión y su transacción) y parametriza los valores del template, así que no viola la
 * regla de "nada de SQL directo por fuera de Prisma" ni abre riesgo de inyección: acá no se
 * interpola nada, `${turnoId}` y `${fechaISO}` viajan como parámetros (design.md D7). Los
 * `::text` son los que sugiere D6/Risks para que Postgres no tenga que inferir el tipo de
 * los parámetros de `$1 || ':' || $2` al preparar la sentencia.
 *
 * Vive en una sola función para que la clave del lock exista en un único lugar: cualquier
 * escritura futura que aumente la ocupación de un `(turno, fecha)` tiene que llamar a esta
 * misma función o el lock deja de proteger (design.md → Risks).
 *
 * @param tx Cliente de una transacción interactiva (`prisma.$transaction`). Fuera de una
 *   transacción el lock se liberaría de inmediato y no serviría de nada.
 * @param fecha Fecha de calendario de la reserva (`@db.Date`, medianoche UTC).
 */
export async function bloquearTurnoFecha(
  tx: Prisma.TransactionClient,
  turnoId: string,
  fecha: Date,
): Promise<void> {
  const fechaISO = fechaCalendarioAIso(fecha);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${turnoId}::text || ':' || ${fechaISO}::text))`;
}
