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
- No se corre `npm run db:seed -w backend` en CI: ninguna suite de integración depende del
  seed (ver Context). Si un change futuro agrega una suite que sí lo necesite, ese change
  agrega el paso de seed — no se anticipa acá sin necesidad concreta (config.yaml §14,
  Prioridad 3).
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
container. No hace falta declarar `DATABASE_URL_TEST` como variable de CI ni como secret —
son las mismas credenciales de juguete que ya documenta `.env.example` para desarrollo local,
nunca secretas (config.yaml §10).

### D2 — `prisma migrate deploy`, no `prisma migrate dev`

*Por qué:* `migrate dev` es un comando **interactivo** — puede pedir confirmación o el nombre
de una migración nueva si detecta drift, y falla explícitamente ("the environment is
non-interactive") en un runner de CI sin TTY. Se comprobó corriéndolo a mano contra un
contenedor de Postgres limpio durante el trabajo de `modelo-dominio`. `migrate deploy` aplica
las migraciones ya commiteadas sin generar ninguna nueva y sin pedir input — es el comando que
`prisma` documenta para CI/CD. El script `db:migrate` de `package.json` sigue usando `migrate
dev` porque ese sí es para desarrollo local, donde la interactividad es la ventaja, no un
problema.

*Paso concreto (después de "Tests e2e del backend", antes de "Tests de las utilidades de
scripts/"):*

```yaml
- name: Migrar la base de test para los tests de integracion
  run: npx prisma migrate deploy --schema backend/prisma/schema.prisma
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/reservas_test

- name: Tests de integracion del backend (contra Postgres real)
  run: npm run test:integration -w backend
```

`DATABASE_URL` se declara explícita en ese paso porque el CLI de Prisma no lee
`jest-integration.setup.ts` (eso solo corre dentro de Jest) — sin un `.env` en el runner (CI no
copia `.env.example`, config.yaml §10 dice que `.env` nunca se commitea), Prisma no tiene de
dónde tomarlo. El paso de `test:integration` en sí no necesita el `env:` porque Jest carga el
fallback del propio `jest-integration.setup.ts`.

### D3 — Sin seed en CI

Ver Non-Goals. Se verificó leyendo las dos suites existentes que ninguna depende de
`npm run db:seed -w backend`; agregar un paso de seed sin una necesidad concreta sería
contradecir la Prioridad 3 de §14 ("no hacer de más"). Si una suite futura sí lo necesita, la
agrega ese change.

## Risks / Trade-offs

- **El job `test` se vuelve más lento** (levantar Postgres + aplicar 2 migraciones antes de la
  suite de integración). → Es exactamente el costo que `fundacion-repo` decidió posponer en
  D8, no evitar. Con dos migraciones y sin seed, el costo adicional es de segundos, no minutos.
- **Las mismas credenciales de juguete (`postgres`/`postgres`) quedan repetidas en el YAML y en
  `.env.example`.** → Ya son públicas y no-secretas por decisión explícita de config.yaml §10;
  duplicarlas en el workflow no cambia esa superficie.
- **Si una suite de integración futura sí necesita el seed**, este change no lo previó. →
  Aceptado (D3): se agrega en el change que la introduzca, no especulativamente acá.
- **Riesgo cerrado, no abierto:** con esto se cierra la "ventana corta y deliberada" que
  `docs/roadmap-mvp.md` §12 marca como riesgo del proyecto ("la cobertura de CI crece en dos
  etapas... el riesgo es olvidarse de cerrarla").

## Migration Plan

No hay migración de datos: es un cambio de configuración de CI únicamente.

```
1. Editar .github/workflows/ci.yml: agregar `services.postgres` y los dos pasos nuevos al job `test`.
2. Actualizar la nota de README.md sobre el estado de CI (ya no es cierto que test:integration "no corre en CI").
3. Abrir el PR: verificar que los tres checks siguen en verde, y en particular que "Tests (backend)"
   ahora muestra los pasos de migracion y test:integration ejecutandose (no solo unitarios/e2e).
4. Verificacion negativa: romper a proposito una aserción de indices-partial.integration-spec.ts
   en una rama de prueba y confirmar que el PR de esa rama queda en rojo — la compuerta que pidió
   lussofacundo-iresm como criterio de cierre del PR #12.
```

*Rollback:* revertir el commit que tocó `ci.yml`. Ningún otro archivo cambia, así que el
rollback es de costo cero.
