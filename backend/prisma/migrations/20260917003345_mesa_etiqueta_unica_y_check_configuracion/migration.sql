-- Unicidad de Mesa.etiqueta (schema.prisma: Mesa.etiqueta @unique).
--
-- Sin esta constraint, dos corridas concurrentes de `seed.ts` podían crear la misma mesa
-- duplicada: ambas veían con `findFirst` que la etiqueta no existía todavía y ambas hacían
-- `create` antes de que la otra insertara (hallazgo de review del PR #12). Con el índice
-- único, la segunda corrida falla con P2002 en vez de duplicar la fila; `seed.ts` ya usa esta
-- constraint para resolver un upsert real por clave natural.
--
-- Reconciliación previa (hallazgo de review del PR #12, bloqueante): si esta migración se
-- aplica sobre una base que YA tiene duplicados de `etiqueta` generados por la corrida
-- concurrente descripta arriba, `CREATE UNIQUE INDEX` de abajo falla y bloquea el deploy.
-- Antes de crear el índice, para cada grupo de Mesas con la misma etiqueta:
--   1. Elegimos como fila canónica la de menor `id` (criterio arbitrario pero determinístico
--      y estable entre corridas; no hay una noción de "más vieja" porque Mesa no tiene
--      `createdAt`).
--   2. Reasignamos toda `Reserva.mesaId` que apunte a las filas descartadas hacia la
--      canónica, para no dejar Reservas huérfanas (FK `Reserva_mesaId_fkey`) ni perder datos.
--   3. Borramos las filas de Mesa descartadas.
-- Sobre una base sin duplicados (el caso normal, incluida cualquier corrida limpia de
-- `prisma migrate deploy`) el bucle no encuentra grupos con `count(*) > 1` y no hace nada.
DO $$
DECLARE
  fila RECORD;
BEGIN
  FOR fila IN
    SELECT (array_agg(id ORDER BY id))[1] AS canonico,
           (array_agg(id ORDER BY id))[2:] AS descartados
    FROM "Mesa"
    GROUP BY etiqueta
    HAVING count(*) > 1
  LOOP
    UPDATE "Reserva" SET "mesaId" = fila.canonico WHERE "mesaId" = ANY(fila.descartados);
    DELETE FROM "Mesa" WHERE id = ANY(fila.descartados);
  END LOOP;
END $$;

CREATE UNIQUE INDEX "Mesa_etiqueta_key" ON "Mesa"("etiqueta");

-- EDICIÓN MANUAL — no la regeneres con `prisma migrate dev` sin revisar este archivo.
--
-- El schema DSL de Prisma no soporta un CHECK constraint arbitrario. `ConfiguracionNegocio`
-- está pensada como fila única (id fijo = 1, ver design.md de `modelo-dominio`): `@id
-- @default(1)` solo fija el valor por defecto de un INSERT sin id explícito, pero no impide
-- que alguien inserte una segunda fila con `id = 2`. Este CHECK lo hace cumplir a nivel de
-- base de datos.
ALTER TABLE "ConfiguracionNegocio"
  ADD CONSTRAINT "ConfiguracionNegocio_id_check" CHECK (id = 1);
