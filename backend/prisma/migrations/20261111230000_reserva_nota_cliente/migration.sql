-- Nota del cliente en la Reserva (change `reserva-nota-cliente`, design.md D1).
--
-- Migración aditiva: agrega una columna nula, así que no reescribe datos existentes. Las
-- reservas ya cargadas quedan sin nota (`NULL`). `varchar(500)` cuenta caracteres (puntos de
-- código), igual que el DTO. Rollback: quitar la columna.
--
-- Generada con `prisma migrate diff` contra la base de desarrollo al día (equivalente a
-- `prisma migrate dev --create-only`, que no corre en una terminal no interactiva) y revisada
-- a mano, como `20261026161439_plano_mesas`:
--   * Se QUITÓ la sentencia `CREATE UNIQUE INDEX "Reserva_mesaId_turnoId_fecha_key" ...` que
--     Prisma agregaba para "reparar" el índice único de Reserva: ese índice es PARCIAL (solo
--     reservas activas) y se editó a mano en `20260914234727_init_modelo_dominio`. Recrearlo
--     sin el WHERE rompería el invariante 1. Lo vigila `indices-partial.integration-spec.ts`.

-- AlterTable
ALTER TABLE "Reserva" ADD COLUMN     "notaCliente" VARCHAR(500);
