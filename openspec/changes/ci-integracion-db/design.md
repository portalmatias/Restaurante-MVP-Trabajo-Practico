## Context

Ver `proposal.md` — Why. Estado de partida (post-merge de `modelo-dominio`, PR #12):

- `.github/workflows/ci.yml` tiene tres jobs (`spec`, `lint`, `test`). El job `test` corre,
  en este orden: `npm run test -w backend` (unitarios), `npm run test:e2e` (e2e sin base de
  datos), `npm run test:scripts`. No hay ningún `services:` declarado.
- `backend/package.json` ya tiene el script `test:integration` (`jest --config
  ./test/jest-integration.json`), que matchea `backend/test/*.integration-spec.ts` y no lo
  corre ningún otro script.
- Tres suites viven ahí hoy: `reservas-invariantes.integration-spec.ts` (invariantes del §6),
  `indices-partial.integration-spec.ts` (índice único parcial, consultando `pg_index`) y
  `mesas.integration-spec.ts` (baja de mesas con reservas, incorporada por #24).
- `backend/test/jest-integration.setup.ts` fija `process.env.DATABASE_URL` a
  `process.env.DATABASE_URL_TEST`, con fallback a
  `postgresql://postgres:postgres@localhost:5432/reservas_test` si esa variable no está.
- Invariantes y mesas crean sus fixtures y comparten zonas por nombre; índices solo consulta
  el catálogo. Ejecutar el seed primero deja STANDARD/VIP creadas y evita la carrera de alta
  inicial entre sus `upsert`. No aísla escrituras posteriores sobre esas filas compartidas.
- `gestion-salon` (#24) incorporó services y tests, no controllers ni dependencia del admin
  del seed. `auth-admin` (#25) sigue abierto: su `auth.integration-spec.ts` no existe en esta
  rama, pero necesitará el admin del seed cuando se integre.
- `disponibilidad` registrará un módulo con Prisma en `AppModule`; los tests que inicializan
  la aplicación necesitarán PostgreSQL aunque antes fueran solo un smoke test. Por eso se
  prepara la base antes de cualquier test, no solamente antes de `test:integration`.

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

Este change actualiza `openspec/config.yaml` §9 para admitir explícitamente esta alternativa
en CI. Se conserva PostgreSQL real, base exclusiva de test y migraciones versionadas;
Docker Compose sigue siendo la forma de levantar la base local.

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

### D3 — Variables compartidas de arranque y URLs limitadas al job de tests

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

*Decisión:* declarar `JWT_SECRET`, `JWT_EXPIRES_IN`, `THROTTLE_TTL` y `THROTTLE_LIMIT`
como `env:` del workflow. `DATABASE_URL` y `DATABASE_URL_TEST` quedan en el job `test`,
que es el único con un service container. Son valores ficticios de CI; el JWT usa
`secreto-de-ci-no-es-real`, nunca una clave de producción.

*Por qué compartir la configuración de arranque:* `spec` también construye `AppModule`
mediante `NestFactory.create` en `openapi:check`. Cuando se registre auth, `JwtStrategy`
necesitará `JWT_SECRET` durante esa construcción. El script no llama `app.init()` ni
`app.listen()`, por lo que no ejecuta el hook de conexión de Prisma y no requiere otra base
por ese motivo. Si un módulo futuro realiza I/O en su constructor o exige variables nuevas,
habrá que reevaluar el workflow; esto no promete cubrir requisitos futuros desconocidos.

*Se agrega también un seed* (`npm run db:seed -w backend`, después de migrar): crea las zonas
compartidas antes de los workers de Jest y prepara el admin que requerirá la suite de auth
del PR #25. Ninguna de las tres suites actuales usa ese admin. El seed es idempotente
(config.yaml §10); no sustituye la limpieza de fixtures ni el aislamiento entre suites.

## Risks / Trade-offs

- **El job `test` se vuelve más lento** (levantar Postgres + migrar + seedear antes de correr
  ningún test). → Es exactamente el costo que `fundacion-repo` decidió posponer en D8, no
  evitar. Verificado en la implementación: el costo adicional es de un puñado de segundos, no
  minutos.
- **Las mismas credenciales de juguete (`postgres`/`postgres`, y ahora también un `JWT_SECRET`
  de CI) quedan en el YAML y en `.env.example`.** → Ya son públicas y no-secretas por decisión
  explícita de config.yaml §10; el `JWT_SECRET` de CI es un valor propio, obviamente falso, no
  el mismo que documenta `.env.example` para desarrollo.
- **La configuración de entorno es una lista fija de variables.** Si un change futuro necesita una
  variable nueva de `.env.example` para que su módulo arranque en CI, va a tener que tocar
  `.github/workflows/` igual que este change — pero eso ya está permitido para un change de
  infraestructura de CI (no para un PR de feature, config.yaml §14). Se aceptó ampliar la
  lista ahora a las seis variables documentadas en vez de agregar solo `DATABASE_URL`, para no
  repetir este mismo bloqueo con cada módulo nuevo (ver D3).
- **Datos compartidos:** el seed evita la carrera de creación inicial, no que dos suites
  sobrescriban STANDARD/VIP. #27 propone serializarlas; verificar esa configuración al
  combinar los PRs y usar bases distintas para ejecuciones independientes simultáneas.
- **Riesgo cerrado al mergear:** con esto se cierra la "ventana corta y deliberada" que
  `docs/roadmap-mvp.md` §12 marca como riesgo del proyecto ("la cobertura de CI crece en dos
  etapas... el riesgo es olvidarse de cerrarla"), y se desbloquea la apertura en verde de
  `disponibilidad` (pedido explícito de portalmatias en el PR #12, 2026-09-17).

## Migration Plan

No hay migración de datos: es un cambio de configuración de CI únicamente.

```
1. Editar .github/workflows/ci.yml: agregar `services.postgres`, URLs en el job `test`,
   JWT/throttling a nivel workflow y los pasos de migracion + seed + test:integration.
2. Actualizar README.md, docs/roadmap-mvp.md y la equivalencia de infraestructura en
   openspec/config.yaml §9. Coordinar los artefactos de spec compartidos con #26.
3. Verificacion local simulando CI exactamente: sin ningun .env presente, con Postgres efimero
   en el puerto 5432 y las variables del `env:` del job exportadas a mano (no dadas por sentado
   via un .env de desarrollo que CI no tiene) — asi se evita repetir el error que rompio el
   PR #25 (un getOrThrow que funcionaba local por tener .env, pero explotaba en CI).
4. Abrir el PR: verificar que los tres checks siguen en verde, y en particular que "Tests (backend)"
   ahora muestra los pasos de migracion, seed y test:integration ejecutandose (no solo unitarios/e2e).
5. Verificacion negativa: ejecutar una aserción deliberadamente incorrecta en una copia
   temporal de la suite y comprobar salida distinta de cero. Verificar que el paso de CI
   ejecuta el mismo comando sin continue-on-error ni mecanismos que oculten fallos.
   Distinguir esta prueba local de una ejecución negativa real en GitHub Actions.
```

*Rollback:* revertir los cambios de workflow y las afirmaciones de cobertura de README y
roadmap de forma coordinada. Revisar también `openspec/config.yaml` y los artefactos del
change. Se perderá la cobertura de integración en CI; no hay migraciones de datos que revertir.
