# Tareas — `ci-integracion-db`

Change chico (~30 minutos de trabajo real, per roadmap §6.1). Una sola tarea de
implementación porque no tiene sentido partir un cambio de 15 líneas de YAML en pasos de
2 horas — sería ceremonia sin valor (config.yaml §14, Prioridad 3: cambios chicos y
revisables, no cambios artificialmente trozados).

## 1. Prerrequisitos (bloqueante)

- [x] 1.1 Confirmar que `modelo-dominio` está mergeado a `main`: existen
      `backend/prisma/schema.prisma`, dos migraciones, y `backend/test/*.integration-spec.ts`
      con el script `test:integration` en `backend/package.json`. Verificado: PR #12 mergeado
      2026-09-17, ambos archivos de test existen en `main`.
- [x] 1.2 Leer las dos suites de integración existentes y confirmar si dependen de
      `npm run db:seed -w backend`. Verificado: ninguna depende del seed — las dos arman sus
      propios datos con `upsert`/`create` y limpian en `afterAll` (ver `design.md`, Context).

## 2. CI

- [ ] 2.1 Agregar `services.postgres` al job `test` de `.github/workflows/ci.yml`
      (`postgres:16.4-alpine`, credenciales `postgres`/`postgres`, base `reservas_test`,
      puerto `5432`, healthcheck `pg_isready`) — ver `design.md` D1 para el YAML exacto.
      Verificar que el job sigue arrancando sin errores de sintaxis (`actionlint` si está
      disponible, o simplemente abriendo el PR y mirando que el job inicie).
- [ ] 2.2 Agregar el paso "Migrar la base de test para los tests de integracion"
      (`npx prisma migrate deploy --schema backend/prisma/schema.prisma` con `DATABASE_URL`
      explícito en `env:`) inmediatamente después de "Tests e2e del backend" — ver `design.md`
      D2. Verificar en el log del job que aplica las dos migraciones sin pedir input.
- [ ] 2.3 Agregar el paso "Tests de integracion del backend (contra Postgres real)"
      (`npm run test:integration -w backend`) inmediatamente después del paso anterior.
      Verificar que corre las dos suites (`reservas-invariantes`, `indices-partial`) y que las
      15 pruebas pasan en el log del job.
- [ ] 2.4 Actualizar la nota de la sección "Integración continua" de `README.md`: ya no es
      cierto que `test:integration` "todavía no corre en CI". Reescribirla para reflejar que
      corre contra un service container efímero de Postgres, sin base de desarrollo ni seed.

## 3. Verificación final

- [ ] 3.1 Abrir el PR `feature/ci-integracion-db` (código) enlazado a este change
      `feature/spec-ci-integracion-db` (ya mergeado si el equipo siguió el flujo de dos PRs).
      Verificar que los tres jobs (`spec`, `lint`, `test`) quedan en verde, y que el job `test`
      muestra explícitamente los pasos de migración y `test:integration` ejecutándose (no solo
      unitarios/e2e).
- [ ] 3.2 Verificación negativa (criterio de cierre pedido por lussofacundo-iresm en el review
      del PR #12): en una rama de prueba, romper a propósito una aserción de
      `indices-partial.integration-spec.ts` (por ejemplo, comparar contra un nombre de índice
      que no existe) y confirmar que el PR de esa rama queda en rojo. Descartar esa rama sin
      mergearla — es solo para demostrar que la compuerta funciona.
- [ ] 3.3 Recorrer la Definition of Done de §13 sobre este PR antes de pedir review. En
      particular, confirmar que ya no queda ninguna mención en el repo (README, roadmap) de
      que las pruebas de integración "no corren en CI".
