# Sistema de Reservas de Restaurante

MVP de una plataforma de reservas para un restaurante. Un cliente puede consultar
disponibilidad, crear una reserva, consultarla y cancelarla **sin crear cuenta**; un
administrador gestiona mesas, zonas y horarios, y ve el estado del aforo.

Trabajo Práctico grupal. Las reglas del proyecto —stack, reglas de negocio, convenciones,
flujo de trabajo— viven en [`openspec/config.yaml`](openspec/config.yaml), que es la
constitución del repo. El orden de trabajo está en [`docs/roadmap-mvp.md`](docs/roadmap-mvp.md).

## Requisitos

- Node.js 20 LTS o superior
- npm 10 o superior
- Docker y Docker Compose (solo para PostgreSQL)

## Primer arranque

```bash
git clone <repo> && cd <repo>
cp .env.example .env          # completar valores locales
cp .env.example backend/.env  # Prisma CLI corre con cwd=backend/, busca su propio .env ahí
npm install                   # instala todos los workspaces
docker compose up -d          # levanta PostgreSQL
npm run db:migrate -w backend # aplica las migraciones de Prisma
npm run db:seed -w backend    # carga datos de prueba (admin, zonas, mesas, turnos, reservas)
npm run dev                   # levanta backend y frontend
```

> **Por qué hay dos copias de `.env`:** el backend en tiempo de ejecución (`ConfigModule`)
> busca `.env` tanto en la raíz como en `backend/`, pero el Prisma CLI (`db:migrate`,
> `db:seed`) corre con el working directory en `backend/` y solo mira ahí. Ambos archivos
> están en `.gitignore` — nunca se commitean.

## Puertos y bases

| Qué | Dónde |
|---|---|
| Frontend (Next.js) | `http://localhost:3000` |
| Backend (NestJS) | `http://localhost:3001` |
| PostgreSQL | `localhost:5432` |
| Base de desarrollo | `reservas_dev` |
| Base de test | `reservas_test` |

Las dos bases viven en el mismo contenedor de PostgreSQL y se crean solas la primera vez que
levantás `docker compose up -d`. El usuario y la contraseña de desarrollo local son
`postgres` / `postgres`: son credenciales de juguete para tu máquina, no secretos.

## Comandos

Todo se corre desde la raíz del repo.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta backend y frontend en paralelo |
| `npm run lint` | ESLint sobre los dos workspaces |
| `npm run typecheck` | `tsc --noEmit` sobre los dos workspaces |
| `npm run test -w backend` | Tests unitarios del backend (Jest) |
| `npm run test:e2e` | Tests e2e del backend (`backend/test/*.e2e-spec.ts`) contra la `AppModule` real. Requiere PostgreSQL levantado, con la base de test migrada y con el seed aplicado, y `JWT_SECRET` (ver [Tests que usan la base](#tests-que-usan-la-base-e2e-e-integración)) |
| `npm run test:integration -w backend` | Tests de integración contra PostgreSQL real (`backend/test/*.integration-spec.ts`). Requiere PostgreSQL levantado (`docker compose up -d`), con la base de test migrada y con el seed aplicado, y `JWT_SECRET` (ver [Tests que usan la base](#tests-que-usan-la-base-e2e-e-integración)) |
| `npm run test:scripts` | Tests de las utilidades de `scripts/` (`node --test`) |
| `npm run build -w backend` | Compila el backend |
| `npm run db:migrate -w backend` | Aplica las migraciones de Prisma (`prisma migrate dev`) |
| `npm run db:seed -w backend` | Corre el seed idempotente (`backend/prisma/seed.ts`) |
| `npm run openapi:lint` | Lintea el contrato con Spectral |
| `npm run openapi:check` | Verifica que el backend no se desvíe del contrato |

Para correr un script de un solo workspace: `npm run <script> -w backend` (o `-w frontend`).

### Tests que usan la base (e2e e integración)

`test:e2e` levanta la `AppModule` real (`backend/test/auth.e2e-spec.ts` hace login de admin
contra ella), así que, igual que `test:integration`, necesita una base de PostgreSQL real.
Los dos leen la base de **test**, nunca la de desarrollo:

- **PostgreSQL con `reservas_test` migrada y con el seed aplicado.** `docker compose up -d`
  crea la base vacía; las migraciones y el seed no se aplican solos. `db:migrate` y `db:seed`
  apuntan a la `DATABASE_URL` de tu `.env` (la de `reservas_dev`), así que para la de test se
  la pisa con una variable exportada, que tiene prioridad sobre el `.env`:

  ```bash
  export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reservas_test
  npx prisma migrate deploy --schema backend/prisma/schema.prisma
  npm run db:seed -w backend
  ```

  (En PowerShell: `$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/reservas_test"`.)
  El seed hace falta porque el admin con el que loguean `auth.e2e-spec.ts` y
  `auth.integration-spec.ts` sale de `backend/prisma/seed.ts`.
- **`JWT_SECRET`** (y `JWT_EXPIRES_IN`, `THROTTLE_TTL` y `THROTTLE_LIMIT`). En local salen de tu
  `.env`: los `setup` de Jest de e2e e integración cargan el `.env` de la raíz y el de
  `backend/`, y lo que ya esté exportado en tu terminal tiene prioridad. En CI llegan como
  variables del workflow.
- **`DATABASE_URL_TEST`** (opcional). La base que usan los tests: si no está definida, cae a
  `postgresql://postgres:postgres@localhost:5432/reservas_test`. Se puede definir en el `.env`.

## Estructura

```
/
├── backend/                  # NestJS
├── frontend/                 # Next.js (App Router)
├── openapi/openapi.yaml      # contrato formal de la API
├── openspec/                 # constitución, specs y changes
├── docker/                   # init de las bases de PostgreSQL
├── scripts/                  # utilidades de CI
└── docs/                     # consigna, requerimientos y roadmap
```

`backend/` y `frontend/` no se importan entre sí. El único contrato entre los dos es
`openapi/openapi.yaml`.

## El contrato de la API es contract-first

`openapi/openapi.yaml` se escribe **a mano** y es la fuente de verdad. El frontend deriva sus
tipos de ahí, así que puede avanzar sin esperar a que el backend exista.

Para que el código no se desvíe del contrato, `npm run openapi:check` genera el spec desde el
backend con `@nestjs/swagger` y lo compara contra el YAML commiteado. Si difieren, falla. CI lo
corre en cada PR.

Si agregás o cambiás un endpoint: **primero el YAML, después el código.**

## Integración continua

`.github/workflows/ci.yml` corre en cada Pull Request y en cada push a `main`, con tres jobs:

| Job | Qué corre |
|---|---|
| `spec` | `openspec validate --all --strict`, Spectral, y el chequeo de deriva del contrato |
| `lint` | ESLint y chequeo de tipos |
| `test` | Tests unitarios, e2e, de integración (contra Postgres real) y los de `scripts/` |

Un PR con CI en rojo no se mergea, aunque funcione localmente.

> El job `test` levanta un service container de PostgreSQL (`postgres:16.4-alpine`, una sola
> base `reservas_test` — no hace falta separar dev de test en CI), aplica las migraciones
> (`prisma migrate deploy`) y el seed, y recién ahí corre las cuatro categorías de tests.
> Los e2e también dependen de esa base migrada y con seed: el login de admin que prueban sale
> del seed.
> Las URLs de base (`DATABASE_URL` y `DATABASE_URL_TEST`) quedan en `test`; `JWT_SECRET`,
> `JWT_EXPIRES_IN` y el throttling se definen a nivel workflow. `AuthModule` ya está registrado
> en `AppModule`, así que tanto los e2e de `test` como la generación de OpenAPI de `spec`
> necesitan `JWT_SECRET` para construir la app (sin él, `JwtStrategy` falla).
> `spec` no define `DATABASE_URL` ni levanta PostgreSQL: `openapi:check` construye la app con
> `NestFactory.create` sin llamar a `app.init()`, y `PrismaService` recién conecta en
> `onModuleInit`. Todos los valores son ficticios de CI (config.yaml §10), nunca secretos de
> producción. Un módulo que abra conexiones al construirse, o un cambio de `openapi:check`
> que inicialice la app, requeriría revisar de nuevo el entorno del job `spec`.

## Cómo se trabaja acá

- Todo entra a `main` por Pull Request, con al menos una aprobación de un compañero.
  La protección de rama y los *required status checks* todavía **no están activados** en
  GitHub — son las tareas 0.2 y 0.4 de `docs/roadmap-mvp.md`, y recién se pueden completar
  ahora que los checks de CI corrieron al menos una vez. Hasta entonces la regla es
  acuerdo del equipo, no algo que el repositorio haga cumplir.
- Una rama por cambio: `feature/spec-<nombre>` para las specs, `feature/<nombre>` para el código.
- Commits en Conventional Commits, con la descripción en español: `feat: agregar validación de aforo`.
- Toda feature nace como un change de OpenSpec en `openspec/changes/` antes de escribir código.

El detalle completo está en `openspec/config.yaml` §11 a §14.

## Variables de entorno

`.env.example` lista todas las variables con valores de ejemplo. `.env` está en `.gitignore` y
nunca se commitea: el repositorio es público. Si tu cambio agrega una variable, actualizá
`.env.example` en el mismo PR.

El backend carga ese `.env` con `ConfigModule` de `@nestjs/config`, registrado como global en
`AppModule`. Busca el archivo en la raíz del monorepo y también en `backend/`, así que funciona
igual corriendo `npm run dev` desde la raíz que `npm run start:dev -w backend`. Las variables
quedan disponibles en `process.env` y vía `ConfigService`.

## Modelo de datos y datos de prueba (seed)

El modelo de dominio (`Usuario`, `Zona`, `Mesa`, `Turno`, `Reserva`, `ConfiguracionNegocio`)
vive en [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma) — ver el change de
OpenSpec `modelo-dominio` para el diseño completo, en particular cómo se hace cumplir cada
uno de los cinco invariantes de negocio (`openspec/config.yaml` §6).

Después de correr `npm run db:seed -w backend`, la base de desarrollo queda con:

- Un usuario admin de prueba: `admin@restaurante-mvp.local` / `AdminMVP2026!`. No es un
  secreto real — es solo para loguearse en tu entorno local; nunca se usa en producción.
- Las zonas `STANDARD` y `VIP` con los rangos de comensales, anticipación y ventana de
  cancelación de `config.yaml` §6.
- Mesas de capacidades variadas en cada zona, los turnos de almuerzo/cena (activos de
  martes a domingo, inactivos los lunes) y algunas reservas de ejemplo en distintos estados.

Los valores de aforo (`aforoMaximo` 40 para `STANDARD`, 20 para `VIP`, `aforoGlobal` 60) están
confirmados por el equipo y documentados en `openspec/config.yaml` §6.
