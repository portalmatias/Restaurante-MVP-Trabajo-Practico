# Tareas — `ci-integracion-db`

Change de infraestructura: PostgreSQL real en CI, configuración de arranque y documentación.
Las verificaciones originales y las del seguimiento se distinguen para no atribuir a CI
pruebas que solo se ejecutaron localmente.

## 1. Prerrequisitos (bloqueante)

- [x] 1.1 Confirmar que `modelo-dominio` está mergeado a `main`: existen
      `backend/prisma/schema.prisma`, dos migraciones, y `backend/test/*.integration-spec.ts`
      con el script `test:integration` en `backend/package.json`. Verificado: PR #12 mergeado
      2026-09-17; además, #24 incorporó la suite de mesas.
- [x] 1.2 Revisar las tres suites: invariantes y mesas crean fixtures y comparten zonas;
      índices consulta el catálogo. El seed crea STANDARD/VIP antes de los workers y prepara
      el admin que usará auth cuando se integre #25, todavía abierto. No aísla las ediciones
      posteriores de filas compartidas (ver `design.md`, Context y Risks).

## 2. CI

- [x] 2.1 Agregar `services.postgres` al job `test` de `.github/workflows/ci.yml`
      (`postgres:16.4-alpine`, credenciales `postgres`/`postgres`, base `reservas_test`,
      puerto `5432`, healthcheck `pg_isready`) — ver `design.md` D1 para el YAML exacto.
      URLs a nivel de job; `JWT_SECRET`, `JWT_EXPIRES_IN`, `THROTTLE_TTL` y `THROTTLE_LIMIT`
      compartidos a nivel workflow para cubrir también `spec` (seguimiento del review).
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
      `npm run test:scripts` (20/20) — todo en verde. Confirmación en GitHub Actions del
      head original `ad708c5`: run `35291195947`, tres jobs de CI exitosos, con migraciones,
      seed y las tres suites de integración ejecutadas. Repetir checks para el nuevo head.
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

## 4. Seguimiento del review

- [x] 4.1 Explicitar en `openspec/config.yaml` §9 la equivalencia entre Docker Compose local
      y service container PostgreSQL en CI, sin permitir mocks en integración.
- [x] 4.2 Corregir propuesta, inventario de archivos, suites existentes, justificación del
      seed y rollback; distinguir auth futuro de los services de salón ya mergeados.
- [x] 4.3 Compartir JWT/throttling entre jobs sin mover las URLs de base fuera de `test`.
- [x] 4.4 Validación local del seguimiento (2026-09-19): YAML parseado y aserciones sobre
      herencia de JWT, alcance de URLs, orden de pasos y ausencia de `continue-on-error`.
      OpenSpec 8/8, lint, tipos, build, Spectral y OpenAPI sin deriva. PostgreSQL 16.4 efímero
      en puerto dinámico, dos migraciones y seed; 47 unitarios, 1 e2e, 21 de integración y
      20 tests de scripts aprobados. Variables de CI exportadas explícitamente; no se eliminó
      el `.env` local ni se usó su base. Contenedor eliminado al terminar. No se repitió la
      prueba negativa histórica de 3.2 ni se afirma haber probado la combinación con #25/#27.
