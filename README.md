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
npm install                   # instala todos los workspaces
docker compose up -d          # levanta PostgreSQL
npm run dev                   # levanta backend y frontend
```

> **Todavía no corras `npm run db:migrate` ni `npm run db:seed`.** Esos scripts no existen
> aún: llegan con el change `modelo-dominio`, que es el que introduce `schema.prisma`, las
> migraciones y el seed. Hasta entonces el backend levanta sin tocar la base.

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
| `npm run test:e2e` | Tests e2e del backend (`backend/test/*.e2e-spec.ts`) |
| `npm run test:scripts` | Tests de las utilidades de `scripts/` (`node --test`) |
| `npm run build -w backend` | Compila el backend |
| `npm run openapi:lint` | Lintea el contrato con Spectral |
| `npm run openapi:check` | Verifica que el backend no se desvíe del contrato |

Para correr un script de un solo workspace: `npm run <script> -w backend` (o `-w frontend`).

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
| `test` | Tests unitarios y e2e del backend, más los de `scripts/` |

Un PR con CI en rojo no se mergea, aunque funcione localmente.

> El job `test` **todavía no levanta PostgreSQL**: en esta etapa no existen migraciones ni
> seed. Los tests de integración contra base real se suman en el change `ci-integracion-db`,
> justo después de `modelo-dominio`.

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
