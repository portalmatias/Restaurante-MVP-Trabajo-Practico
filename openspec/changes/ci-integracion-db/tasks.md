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
      **Superado por los hechos (2026-09-17):** para cuando se implementó este change ya
      existían `auth-admin` (PR #25) y el pedido de portalmatias sobre `disponibilidad`
      (PR #12) — ver la nota de Context. El seed sí hace falta ahora (D3 revisada).

## 2. CI

- [x] 2.1 Agregar `services.postgres` al job `test` de `.github/workflows/ci.yml`
      (`postgres:16.4-alpine`, credenciales `postgres`/`postgres`, base `reservas_test`,
      puerto `5432`, healthcheck `pg_isready`) — ver `design.md` D1 para el YAML exacto.
      También se agregó el `env:` a nivel de job con `DATABASE_URL`, `DATABASE_URL_TEST`,
      `JWT_SECRET`, `JWT_EXPIRES_IN`, `THROTTLE_TTL`, `THROTTLE_LIMIT` (D3 revisada — no
      estaba en el plan original). Verificado: YAML parseado con `js-yaml` sin errores.
- [x] 2.2 Agregar los pasos "Migrar la base de datos de test" (`prisma migrate deploy`) y
      "Seed de la base de datos de test" (`npm run db:seed -w backend`), antes de cualquier
      test — ver `design.md` D2/D3. Verificado localmente simulando CI exacto: Postgres
      efímero en el puerto 5432 (parando el compartido primero), **sin ningún `.env`
      presente**, variables exportadas a mano una por una (no dadas por sentado vía un `.env`
      de desarrollo) — así se evita repetir el error que rompió el PR #25. Migra sin pedir
      input y el seed corre limpio.
- [x] 2.3 Agregar el paso "Tests de integracion del backend (contra Postgres real)"
      (`npm run test:integration -w backend`), después de los unitarios y el e2e. Verificado
      en la misma simulación: 3 suites, 21/21 pruebas (`reservas-invariantes`,
      `indices-partial`, más `mesas.integration-spec.ts` que ya llegó con `gestion-salon`).
- [x] 2.4 Actualizar la nota de la sección "Integración continua" de `README.md` y el riesgo
      correspondiente de `docs/roadmap-mvp.md` §12 (tachado con fecha de cierre, mismo patrón
      que el riesgo de *required status checks*). Ya no dicen que `test:integration` "no
      corre en CI".

## 3. Verificación final

- [x] 3.1 Verificación local completa simulando exactamente el job `test` de CI (sin `.env`,
      Postgres efímero, variables exportadas a mano): `npm run lint`, `npm run typecheck`,
      `npm run build -w backend`, `npm run openapi:lint`, `npm run openapi:check`,
      `./node_modules/.bin/openspec validate --all --strict` (7/7), `npm run test -w backend`
      (47/47), `npm run test:e2e` (1/1), `npm run test:integration -w backend` (21/21),
      `npm run test:scripts` (20/20) — todo en verde. Falta abrir el PR real y confirmar los
      tres checks de GitHub Actions (siguiente paso, fuera de este archivo).
- [x] 3.2 Verificación negativa (criterio de cierre pedido por lussofacundo-iresm en el review
      del PR #12): se reemplazó a propósito el nombre del índice en
      `indices-partial.integration-spec.ts` por uno inexistente — la suite falló como se
      esperaba (`Test Suites: 1 failed, 2 passed`, exit code ≠ 0, pondría el PR en rojo). Se
      restauró el archivo original después (`git checkout --`).
- [x] 3.3 Recorrida de la Definition of Done de §13: migración — no aplica (sin cambios de
      schema); `openapi/openapi.yaml` — no aplica (sin endpoints nuevos); `.env.example` — no
      aplica (ninguna variable nueva, todas las usadas ya estaban documentadas); tests de
      reglas de negocio — no aplica (sin comportamiento de dominio nuevo, `skip_specs: true`).
      Confirmado que ya no queda ninguna mención de "test:integration no corre en CI" en
      `README.md` ni en `docs/roadmap-mvp.md`.
