## Why

`fundacion-repo` dejó el job `test` de CI corriendo sin PostgreSQL a propósito (design.md,
D8): en la Fase 1 no existían `schema.prisma`, migraciones ni `seed.ts`, y levantar un service
container contra la nada solo habría puesto el PR en rojo por "Missing script". La deuda quedó
anotada explícitamente ahí y otra vez en el `proposal.md` de `fundacion-repo` ("Deuda
deliberada"): "Los pasos con PostgreSQL y los tests e2e de §9 se agregan en el change
`ci-integracion-db`, inmediatamente después de `modelo-dominio`."

`modelo-dominio` ya mergeó a `main` (PR #12) con `schema.prisma`, dos migraciones, `seed.ts`
idempotente, y una suite de tests de integración contra base real
(`backend/test/*.integration-spec.ts`, corridos localmente con `npm run test:integration -w
backend`) que cubre:

- Los cinco invariantes de negocio del §6 (incluido el de aforo global, agregado en el review
  del PR #12).
- Un guard que verifica contra el catálogo de Postgres (`pg_index`) que el índice único
  parcial `Reserva_mesaId_turnoId_fecha_key` —la garantía real del invariante 1— sigue siendo
  parcial y no fue reemplazado por un `prisma migrate dev` que regenere el índice desde el
  `@@unique` sin condición del `schema.prisma`.

Ninguno de esos tests corre en CI hoy. `config.yaml` §12 exige explícitamente que el job de
tests corra "las pruebas unitarias **y de integración**", y §9 exige que las de integración
corran "contra una base de datos real de test levantada por docker-compose, no contra mocks de
Prisma". Mientras esto no se resuelva, la Definition of Done de §13 ("CI en verde" cubriendo lo
que pide §9) no se cumple para ningún change que dependa de esas reglas de negocio —
`disponibilidad`, `reservas-crear`, `cancelacion-turnos` y `reserva-vip` las heredan todas.

Este change es exactamente la contrapartida que `fundacion-repo` prometió: conectar
`test:integration` a un service container de Postgres en CI. Nada más.

## What Changes

- **`.github/workflows/ci.yml`**, job `test`: se agrega un `services: postgres` (mismo tag de
  imagen que `docker-compose.yml`, `postgres:16.4-alpine`, con healthcheck) y dos pasos nuevos
  después de "Tests e2e del backend": aplicar las migraciones contra la base del service
  container (`prisma migrate deploy`, no `migrate dev` — ver D2) y correr `npm run
  test:integration -w backend`.
- **Ningún cambio de aplicación.** No se toca `backend/src/`, `schema.prisma` ni
  `openapi/openapi.yaml`. Es un change de infraestructura de CI, igual en naturaleza a
  `fundacion-repo` (que también fijó `skip_specs: true`).
- **`README.md`**: la nota de la sección "Integración continua" que hoy dice que
  `test:integration` "todavía no corre en CI" pasa a describir que sí corre, contra un service
  container efímero (no contra `reservas_dev`/`reservas_test` de Docker Compose local).

## Capabilities

### New Capabilities
_Ninguna._ Este change no introduce comportamiento observable del sistema de reservas.

### Modified Capabilities
_Ninguna._ No declara requisitos ni escenarios nuevos — por eso fija `skip_specs: true` en su
`.openspec.yaml`, igual que `fundacion-repo`.

## Impact

**Archivo modificado:** `.github/workflows/ci.yml` (único archivo de comportamiento real).
**Archivo modificado (doc):** `README.md` (la nota de CI que ya quedó desactualizada una vez,
ver PR #12).

**Ningún archivo nuevo, ninguna dependencia nueva.** `test:integration` y su config de Jest
(`backend/test/jest-integration.json`) ya existen desde `modelo-dominio`.

**Cierra:** la deuda deliberada de `fundacion-repo` (D8) y la ventana de riesgo que
`docs/roadmap-mvp.md` §12 marca como "corta y deliberada" ("la cobertura de CI crece en dos
etapas... el riesgo es olvidarse de cerrarla").

**Desbloquea:** que la Definition of Done de §13 se pueda marcar completa, en lo que hace a
tests de integración, para `modelo-dominio` y para todo change posterior que dependa de sus
invariantes.
