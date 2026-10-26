-- Plano de mesas (change `plano-mesas`, design.md D1): posición, tamaño y forma de cada Mesa
-- en una grilla lógica, y dimensiones de esa grilla en cada Zona.
--
-- Migración aditiva: solo agrega columnas con valor por defecto o nulas, así que no reescribe
-- datos existentes. Las mesas ya cargadas quedan "sin ubicar" (posX y posY nulos) y siguen
-- siendo asignables. Rollback: quitar las siete columnas y después el tipo `FormaMesa`.
--
-- Generada con `prisma migrate diff` contra la base de desarrollo al día (equivalente a
-- `prisma migrate dev --create-only`, que no corre en una terminal no interactiva) y revisada
-- a mano:
--   * Se QUITÓ la sentencia `CREATE UNIQUE INDEX "Reserva_mesaId_turnoId_fecha_key" ...` que
--     Prisma agregaba para "reparar" el índice único de Reserva: ese índice es PARCIAL (solo
--     reservas activas) y se editó a mano en `20260914234727_init_modelo_dominio`. Recrearlo
--     sin el WHERE rompería el invariante 1. Lo vigila `indices-partial.integration-spec.ts`.
--   * Se AGREGARON a mano los CHECK de abajo: el DSL de Prisma no los soporta.

-- CreateEnum
CREATE TYPE "FormaMesa" AS ENUM ('REDONDA', 'CUADRADA', 'RECTANGULAR');

-- AlterTable
ALTER TABLE "Mesa" ADD COLUMN     "alto" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "ancho" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "forma" "FormaMesa" NOT NULL DEFAULT 'RECTANGULAR',
ADD COLUMN     "posX" INTEGER,
ADD COLUMN     "posY" INTEGER;

-- AlterTable
ALTER TABLE "Zona" ADD COLUMN     "planoColumnas" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "planoFilas" INTEGER NOT NULL DEFAULT 8;

-- Una mesa está ubicada (las dos coordenadas) o sin ubicar (ninguna), nunca a medias, y sus
-- coordenadas y su tamaño no pueden quedar fuera de la grilla por abajo. Que la mesa entre en
-- la grilla por arriba (posX + ancho <= planoColumnas) cruza dos tablas y no se puede expresar
-- como CHECK: lo valida quien escribe la posición (`validarLayout`, que usa el seed).
ALTER TABLE "Mesa"
  ADD CONSTRAINT "Mesa_posicion_completa_check" CHECK (("posX" IS NULL) = ("posY" IS NULL)),
  ADD CONSTRAINT "Mesa_posX_check" CHECK ("posX" >= 0),
  ADD CONSTRAINT "Mesa_posY_check" CHECK ("posY" >= 0),
  ADD CONSTRAINT "Mesa_ancho_check" CHECK ("ancho" >= 1),
  ADD CONSTRAINT "Mesa_alto_check" CHECK ("alto" >= 1);

ALTER TABLE "Zona"
  ADD CONSTRAINT "Zona_planoColumnas_check" CHECK ("planoColumnas" >= 1),
  ADD CONSTRAINT "Zona_planoFilas_check" CHECK ("planoFilas" >= 1);
