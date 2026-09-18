## Context

Ver `proposal.md` — Why. Estado de partida (post-merge de `modelo-dominio`, PR #12):

- `.github/workflows/ci.yml` tiene tres jobs (`spec`, `lint`, `test`). El job `test` corre,
  en este orden: `npm run test -w backend` (unitarios), `npm run test:e2e` (e2e sin base de
  datos), `npm run test:scripts`. No hay ningún `services:` declarado.
- `backend/package.json` ya tiene el script `test:integration` (`jest --config
  ./test/jest-integration.json`), que matchea `backend/test/*.integration-spec.ts` y no lo
  corre ningún otro script.
- Dos suites viven ahí hoy: `reservas-invariantes.integration-spec.ts` (los cinco invariantes
  de negocio del §6, incluido aforo global) e `indices-partial.integration-spec.ts` (guard
  contra drift del índice único parcial de `Reserva`, consultando `pg_index` directo).
- `backend/test/jest-integration.setup.ts` fija `process.env.DATABASE_URL` a
  `process.env.DATABASE_URL_TEST`, con fallback a
  `postgresql://postgres:postgres@localhost:5432/reservas_test` si esa variable no está.
- Ninguna de las dos suites depende de `npm run db:seed -w backend`: ambas arman sus propios
  datos con `prisma.zona.upsert(...)` (por nombre, no por id) y sus propios `mesa.create` /
  `turno.create`, y limpian lo que crearon en `afterAll`. Verificado leyendo el código de las
  dos, no asumido.
- **Actualizado durante la implementación (2026-09-17):** en el tiempo que tardó en escribirse
  esta spec, se mergeó `gestion-salon` (PR #24) y se abrió `auth-admin` (PR #25). Los dos
  agregaron controllers reales y, con ellos, suites de integración que **sí** necesitan datos
  conocidos (el admin del seed, para `auth.integration-spec.ts`). Además, portalmatias
  reportó en el PR #12 que `disponibilidad` (con `GET /disponibilidad`, controller real) va a
  registrar `DisponibilidadModule` en `AppModule` — y simuló que eso rompe `test:e2e` sin
  Postgres (las 4 suites fallan, incluida `app.e2e-spec.ts`, hoy verde). Esto invalida la
  Non-Goal original de "sin seed" (ver D3 revisada abajo) y confirma que este change ya no es
  opcional: bloquea la apertura en verde de `disponibilidad`.

Tres restricciones de `config.yaml` dan forma al diseño:

1. **§14 prohíbe tocar `.github/workflows/` dentro de un PR de feature** — por eso esto es un
   change propio, igual que `fundacion-repo`.
2. **§9 exige que las pruebas de integración corran contra una base de datos real, no contra
   mocks** — ya se cumple en cómo están escritas las suites; lo que falta es que CI las corra.
3. **§12 exige que el job de tests corra unitarias y de integración**, y que un PR con CI en
   rojo nunca se mergee.

## Goals / Non-Goals

**Goals:**

- Que `npm run test:integration -w backend` corra en CI, contra Postgres real, en cada PR y en
  cada push a `main`.
- Que una prueba de integración rota realmente ponga el PR en rojo (criterio de cierre que
  pidió lussofacundo-iresm en el review del PR #12: "ver la suite realmente ejecutada y
  aprobada... un CI verde por excluir esa suite no prueba que este bloqueo esté resuelto").
- Cero cambios en `backend/src/`, en el `schema.prisma` o en `openapi/openapi.yaml`.

**Non-Goals:**

- No se agrega una base `reservas_dev` en CI: nada en el pipeline necesita datos de
  desarrollo, solo la de test.
- No se tocan los *required status checks* de la protección de `main`: el job sigue
  llamándose `test` ("Tests (backend)"), solo se le agregan pasos. No hace falta re-configurar
  nada en GitHub.
- No se resuelve la deuda de "el schema.prisma y el índice parcial editado a mano pueden
  desincronizarse" — **ese es justamente el problema que ataca el nuevo guard automático**;
  este change solo lo conecta a CI, no cambia su lógica.

## Decisions

### D1 — Un solo `services: postgres` en el job `test`, no un `docker-compose up` en CI

GitHub Actions soporta *service containers* nativos (`jobs.<job>.services`), que arrancan
antes que los `steps` y exponen su puerto al runner. Se usa eso en vez de instalar Docker
Compose y correr `docker-compose.yml` dentro del job.

*Por qué:* el service container es la forma idiomática de GitHub Actions para esto, no agrega
una dependencia de herramienta (`docker compose` ya está en el runner, pero orquestar el mismo
archivo que usa desarrollo local mezclaría dos formas de levantar Postgres para el mismo fin).
Además `docker-compose.yml` levanta **dos** bases (`reservas_dev` y `reservas_test`) porque
D5 de `fundacion-repo` decidió compartir un solo contenedor en desarrollo local; en CI no hace
falta ninguna base de desarrollo, así que un service container con una sola base (`POSTGRES_DB:
reservas_test`) es más simple y más rápido de levantar que reusar el script de init de dos
bases.

*Configuración concreta:*

```yaml
services:
  postgres:
    image: postgres:16.4-alpine   # mismo tag que docker-compose.yml — D5 de fundacion-repo
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: reservas_test
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 5s
      --health-timeout 5s
      --health-retries 10
```

Con esas credenciales y ese puerto, el **fallback que ya tiene** `jest-integration.setup.ts`
(`postgresql://postgres:postgres@localhost:5432/reservas_test`) apunta directo al service
container.

**Revisado durante la implementación:** sí hace falta declarar `DATABASE_URL`/
`DATABASE_URL_TEST` explícitas como `env:` del job (no alcanza con el fallback) — ver D3, más
abajo, sobre por qué el alcance de las variables de entorno creció más allá de solo la base de
datos. Ninguna es secreta: son las mismas credenciales de juguete que ya documenta
`.env.example` para desarrollo local (config.yaml §10).

### D2 — `prisma migrate deploy`, no `prisma migrate dev`

*Por qué:* `migrate dev` es un comando **interactivo** — puede pedir confirmación o el nombre
de una migración nueva si detecta drift, y falla explícitamente ("the environment is
non-interactive") en un runner de CI sin TTY. Se comprobó corriéndolo a mano contra un
contenedor de Postgres limpio durante el trabajo de `modelo-dominio`. `migrate deploy` aplica
las migraciones ya commiteadas sin generar ninguna nueva y sin pedir input — es el comando que
`prisma` documenta para CI/CD. El script `db:migrate` de `package.json` sigue usando `migrate
dev` porque ese sí es para desarrollo local, donde la interactividad es la ventaja, no un
problema.

*Paso concreto (antes de correr ningún test, para que la base ya esté migrada y seedeada
cuando arranque incluso el smoke test e2e — ver D3):*

```yaml
- name: Migrar la base de datos de test
  run: npx prisma migrate deploy --schema backend/prisma/schema.prisma

- name: Seed de la base de datos de test
  run: npm run db:seed -w backend
```

Ninguno de los dos pasos necesita un `env:` propio: `DATABASE_URL` ya está declarada a nivel
del job (D3).

### D3 — Alcance de las variables de entorno: todo el job, no solo la base de datos

**Decisión revisada durante la implementación**, a partir del hallazgo de portalmatias en el
PR #12 (ver Context): no alcanza con que Prisma tenga `DATABASE_URL` para el paso de
migración. Una vez que un módulo de dominio con controller real (auth-admin, disponibilidad)
se registra en `AppModule`, **cualquier test que haga `app.init()` sobre esa app completa**
—no solo los que corren contra Postgres a propósito— necesita TODAS las variables que ese
módulo lea de `ConfigService`, o el `useFactory` que las pide con `getOrThrow` explota antes
de llegar a la lógica de negocio (pasó en vivo con `THROTTLE_TTL`/`THROTTLE_LIMIT` de
`auth-admin`, PR #25, corregido ahí a `config.get(clave, default)` — pero ese fix no exime a
CI de proveerlas cuando el código sí las necesita para tener el comportamiento real, no solo
un default).

*Decisión:* declarar como `env:` del job `test` completo (no de un paso suelto) las
variables mínimas de `config.yaml` §10 que **no** tienen (o no deberían depender de) un
default de código: `DATABASE_URL`, `DATABASE_URL_TEST`, `JWT_SECRET`, `JWT_EXPIRES_IN`,
`THROTTLE_TTL`, `THROTTLE_LIMIT`. Ninguna es secreta (config.yaml §10) — son las mismas de
`.env.example`, con `JWT_SECRET` cambiado a un valor obviamente no reutilizable
(`secreto-de-ci-no-es-real`) para que nadie lo copie por error a un entorno real.

*Por qué a nivel de job y no por paso:* así, el próximo módulo de dominio que se registre en
`AppModule` (disponibilidad, reservas-crear, cancelacion-turnos, reserva-vip) ya tiene lo que
necesita para arrancar en CI sin que haga falta tocar `.github/workflows/` de nuevo — que
además §14 prohíbe hacer desde un PR de feature. Es la diferencia entre resolver el problema
una vez acá, o repetir este mismo descubrimiento (y este mismo bloqueo) en cada change que
agregue un controller nuevo.

*Se agrega también un seed* (`npm run db:seed -w backend`, después de migrar): los tests de
`auth-admin` (`auth.integration-spec.ts`) loguean contra el admin del seed por email/password
conocidos — a diferencia de `reservas-invariantes.integration-spec.ts` e
`indices-partial.integration-spec.ts`, que siguen sin necesitarlo (arman sus propios datos).
Como el seed es idempotente (config.yaml §10) y no tarda, correrlo siempre es más simple que
condicionar el paso a qué suites existen en cada momento.

## Risks / Trade-offs

- **El job `test` se vuelve más lento** (levantar Postgres + migrar + seedear antes de correr
  ningún test). → Es exactamente el costo que `fundacion-repo` decidió posponer en D8, no
  evitar. Verificado en la implementación: el costo adicional es de un puñado de segundos, no
  minutos.
- **Las mismas credenciales de juguete (`postgres`/`postgres`, y ahora también un `JWT_SECRET`
  de CI) quedan en el YAML y en `.env.example`.** → Ya son públicas y no-secretas por decisión
  explícita de config.yaml §10; el `JWT_SECRET` de CI es un valor propio, obviamente falso, no
  el mismo que documenta `.env.example` para desarrollo.
- **El `env:` del job es una lista fija de variables.** Si un change futuro necesita una
  variable nueva de `.env.example` para que su módulo arranque en CI, va a tener que tocar
  `.github/workflows/` igual que este change — pero eso ya está permitido para un change de
  infraestructura de CI (no para un PR de feature, config.yaml §14). Se aceptó ampliar la
  lista ahora a las seis variables documentadas en vez de agregar solo `DATABASE_URL`, para no
  repetir este mismo bloqueo con cada módulo nuevo (ver D3).
- **Riesgo cerrado, no abierto:** con esto se cierra la "ventana corta y deliberada" que
  `docs/roadmap-mvp.md` §12 marca como riesgo del proyecto ("la cobertura de CI crece en dos
  etapas... el riesgo es olvidarse de cerrarla"), y se desbloquea la apertura en verde de
  `disponibilidad` (pedido explícito de portalmatias en el PR #12, 2026-09-17).

## Migration Plan

No hay migración de datos: es un cambio de configuración de CI únicamente.

```
1. Editar .github/workflows/ci.yml: agregar `services.postgres`, el `env:` del job, y los pasos
   de migracion + seed + test:integration al job `test`.
2. Actualizar la nota de README.md y docs/roadmap-mvp.md sobre el estado de CI (ya no es cierto
   que test:integration "no corre en CI").
3. Verificacion local simulando CI exactamente: sin ningun .env presente, con Postgres efimero
   en el puerto 5432 y las variables del `env:` del job exportadas a mano (no dadas por sentado
   via un .env de desarrollo que CI no tiene) — asi se evita repetir el error que rompio el
   PR #25 (un getOrThrow que funcionaba local por tener .env, pero explotaba en CI).
4. Abrir el PR: verificar que los tres checks siguen en verde, y en particular que "Tests (backend)"
   ahora muestra los pasos de migracion, seed y test:integration ejecutandose (no solo unitarios/e2e).
5. Verificacion negativa: romper a proposito una aserción de indices-partial.integration-spec.ts
   en una rama de prueba y confirmar que el PR de esa rama queda en rojo — la compuerta que pidió
   lussofacundo-iresm como criterio de cierre del PR #12.
```

*Rollback:* revertir el commit que tocó `ci.yml`. Ningún otro archivo cambia, así que el
rollback es de costo cero.
