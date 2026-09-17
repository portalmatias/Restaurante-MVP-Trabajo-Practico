-- Unicidad de Mesa.etiqueta (schema.prisma: Mesa.etiqueta @unique).
--
-- Sin esta constraint, dos corridas concurrentes de `seed.ts` podían crear la misma mesa
-- duplicada: ambas veían con `findFirst` que la etiqueta no existía todavía y ambas hacían
-- `create` antes de que la otra insertara (hallazgo de review del PR #12). Con el índice
-- único, la segunda corrida falla con P2002 en vez de duplicar la fila; `seed.ts` ya usa esta
-- constraint para resolver un upsert real por clave natural.
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
