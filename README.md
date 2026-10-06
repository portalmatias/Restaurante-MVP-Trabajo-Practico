# Sistema de Reservas de Restaurante

MVP de una plataforma de reservas para un restaurante. Un cliente puede consultar
disponibilidad, crear una reserva, consultarla y cancelarla **sin crear cuenta**; un
administrador gestiona mesas, zonas y horarios, y ve el estado del aforo.

Trabajo Práctico grupal. Las reglas del proyecto —stack, reglas de negocio, convenciones,
flujo de trabajo— viven en [`openspec/config.yaml`](openspec/config.yaml), que es la
constitución del repo. El orden de trabajo está en [`docs/roadmap-mvp.md`](docs/roadmap-mvp.md).

## Arquitectura

El sistema es un monorepo con dos aplicaciones que solo se comunican por HTTP, a través de un
contrato OpenAPI escrito antes que el código:

```mermaid
flowchart LR
  nav["Navegador<br/>(cliente o admin)"]
  subgraph front["frontend/ — Next.js (App Router)"]
    paginas["Páginas<br/>/reservas/... y /admin/..."]
    proxy["Proxy de mismo origen<br/>/api/* → backend"]
  end
  subgraph back["backend/ — NestJS"]
    guards["ThrottlerGuard (global)<br/>JwtAuthGuard + RolesGuard (admin)"]
    modulos["Módulos de dominio<br/>controllers → services"]
    prisma["PrismaService"]
  end
  db[("PostgreSQL")]
  contrato[/"openapi/openapi.yaml<br/>(contrato)"/]

  nav -- "páginas (HTML)" --> paginas
  nav -- "/api/*" --> proxy
  paginas -- "Server Components" --> guards
  proxy --> guards --> modulos --> prisma --> db
  contrato -. "tipos del cliente" .-> front
  contrato -. "chequeo de deriva en CI" .-> back
```

### Componentes

| Componente | Tecnología | Responsabilidad |
|---|---|---|
| `frontend/` | Next.js 16 (App Router) + React, TypeScript | Interfaz del cliente (`/reservas/...`) y panel del admin (`/admin/...`). Server Components por defecto; `"use client"` solo donde hay interacción. |
| `backend/` | NestJS 11 sobre Node.js, TypeScript | API REST. Toda la lógica de negocio y la validación de reglas e invariantes. |
| Base de datos | PostgreSQL 16 con Prisma | Persistencia. El schema solo cambia por migraciones versionadas en `backend/prisma/migrations/`. |
| Contrato | OpenAPI 3.1 (`openapi/openapi.yaml`) | Única dependencia entre frontend y backend: el frontend genera sus tipos desde el contrato y CI verifica que el backend no se desvíe. |

### Cómo viaja una solicitud

1. El navegador nunca llama directo al backend: pide `/api/...` **al mismo origen** del
   frontend, y Next lo reescribe hacia `NEXT_PUBLIC_API_URL`. Así no hace falta habilitar
   CORS en el backend.
2. Los Server Components, que corren en el servidor de Next, llaman al backend directamente por
   esa misma URL.
3. En el backend, cada solicitud pasa en este orden por:
   - el límite de solicitudes (`ThrottlerGuard`, global);
   - en las rutas `/admin/...`, la verificación del JWT y del rol (`JwtAuthGuard` y
     `RolesGuard`);
   - la validación del body o la query con DTOs y `class-validator` (`ValidationPipe` global
     con `whitelist`);
   - el controller, que delega en un service; las reglas de negocio viven en los services.
4. Los services acceden a la base solo por Prisma. Las operaciones que tienen que ser atómicas
   (crear una reserva) corren en una transacción, y la base refuerza el invariante de "una
   reserva activa por mesa y turno" con un índice único parcial.

### Backend por módulo de dominio

| Módulo | Endpoints | Acceso |
|---|---|---|
| `disponibilidad/` | `GET /disponibilidad` | público |
| `zonas/`, `horarios/` | `GET /zonas`, `GET /turnos` (catálogo); `/admin/zonas`, `/admin/turnos` | público / admin |
| `mesas/` | `/admin/mesas` | admin |
| `reservas/` | `POST /reservas`, `POST /reservas/consultar`, `POST /reservas/{codigo}/cancelar`; `/admin/reservas` (listado, confirmar, rechazar, no-show) | público con límite / admin |
| `auth/` | `POST /auth/login` | público con límite |
| `prisma/`, `common/` | — | acceso a datos y utilidades de zona horaria (UTC−3) |

El detalle de cada endpoint, con sus esquemas y respuestas, está en
[`openapi/openapi.yaml`](openapi/openapi.yaml).

### Identidad y acceso

- **Cliente sin cuenta:** reserva con nombre, email y teléfono, y recibe un código de 8
  caracteres. Para consultar o cancelar presenta **código + email**, que tienen que coincidir.
  Como el código no es un secreto criptográfico, esas rutas tienen límite de solicitudes contra
  la enumeración.
- **Administrador:** login con email y contraseña (hash con bcrypt), que devuelve un JWT de 60
  minutos con su rol. Viaja en `Authorization: Bearer` y protege todas las rutas `/admin/...`.

### Controles de seguridad

- **Límites de solicitudes por origen:**
  - login: 5 por minuto;
  - consulta y cancelación públicas: `THROTTLE_LIMIT` por minuto;
  - cada ruta de admin: 60 por minuto.
- **Validación estricta de entrada:** los campos que no declara el DTO se rechazan con `400`.
- **Exposición mínima:** en local, los tres servicios escuchan solo en loopback, y el backend no
  confía en `X-Forwarded-For` salvo que se declare explícitamente el salto confiable (ver
  [Red y límites de solicitudes](#red-y-límites-de-solicitudes)).
- **Secretos fuera del repositorio:** el secreto del JWT y las credenciales salen de variables
  de entorno; `.env` nunca se commitea.
- **Datos personales:** ningún endpoint público expone datos de otras reservas. La consulta
  responde `404` sin aclarar si falló el código o el email.

### Fechas y horas

Las fechas y horas se guardan y viajan en **UTC**. Los turnos son horas locales del
restaurante (`America/Argentina/Buenos_Aires`, UTC−3 fijo), y el backend las combina con la
fecha de la reserva para validar anticipación, ventana de cancelación y no-show. La conversión
para mostrar es responsabilidad del frontend.

### Cómo se construye

Cada funcionalidad nace como un *change* de OpenSpec en `openspec/changes/`, con propuesta,
specs, diseño y tareas. Los changes terminados se archivan, y sus requisitos pasan a
`openspec/specs/`, que describe el comportamiento vigente del sistema. CI valida las specs, el
contrato, el lint, los tipos y los tests en cada PR (ver
[Integración continua](#integración-continua)).

## Requisitos

- Node.js 20.12 o superior (20 LTS)
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

## Red y límites de solicitudes

El sistema corre **solo en local** para la demo. Por eso, con la configuración por defecto,
los tres servicios escuchan únicamente en loopback (`127.0.0.1`) y ningún otro equipo de la
red (por ejemplo, el Wi-Fi de la facultad) puede conectarse a ellos:

| Servicio | Dónde escucha | Cómo se cambia |
|---|---|---|
| Frontend | `127.0.0.1:3000` (`npm run dev` y `npm run start -w frontend`) | `npm run dev:lan -w frontend` |
| Backend | `127.0.0.1:3001` | `HOST=0.0.0.0` en el `.env` |
| PostgreSQL | `127.0.0.1:5432` (`docker-compose.yml`) | no se expone |

`http://localhost:3000` y `http://localhost:3001` siguen funcionando desde la propia máquina.

**Si tu contenedor de PostgreSQL es anterior a este cambio**, sigue publicado en todas las
interfaces hasta que lo recrees. Los datos viven en un volumen con el nombre del *proyecto*
de Docker Compose, que por defecto es el nombre de la carpeta desde la que se creó el
contenedor. Si corrés `docker compose up -d --force-recreate` desde otra carpeta (otro clon,
otro worktree), Docker responde que el nombre `reservas-postgres` ya está en uso. **No borres
el contenedor para salir de ese error**: si lo quitás y lo volvés a crear desde la otra
carpeta, Compose usa **otro** volumen y vas a ver una base vacía (los datos no se pierden,
quedan en el volumen anterior, pero la app deja de verlos). Para recrearlo conservando el
mismo volumen, usá el proyecto con el que fue creado:

```bash
# bash
docker compose -p "$(docker inspect reservas-postgres -f '{{index .Config.Labels "com.docker.compose.project"}}')" up -d --force-recreate
```

```powershell
# PowerShell
docker compose -p (docker inspect reservas-postgres -f '{{index .Config.Labels \"com.docker.compose.project\"}}') up -d --force-recreate
```

Para comprobarlo: `docker ps` tiene que mostrar `127.0.0.1:5432->5432/tcp`, y tus datos
tienen que seguir ahí (por ejemplo, las reservas del seed en el listado de admin).

### Probar desde otro dispositivo (`dev:lan`)

Para abrir la app desde un celular de la misma red, levantá el frontend con
`npm run dev:lan -w frontend` (escucha en `0.0.0.0`) y entrá a `http://<IP-de-tu-máquina>:3000`.
El backend no hace falta exponerlo: el navegador del celular le habla al frontend, y el
frontend llega al backend por el proxy `/api` desde tu máquina.

> **Advertencia:** mientras `dev:lan` está levantado, **cualquier equipo de esa red** puede
> usar la app, incluido el login de admin y la consulta pública de reservas, y agotar sus
> límites de solicitudes. Usalo solo en una red de confianza y cortalo apenas termines.
> Lo mismo vale para `HOST=0.0.0.0` en el backend.

### Límites por cliente detrás de `/api`

El navegador nunca llama directo al backend: pasa por el proxy `/api` de Next. Para el
backend, entonces, **todos los pedidos llegan desde la misma IP, la del servidor de Next**, y
los límites de solicitudes "por cliente" (5 intentos de login por minuto, `THROTTLE_LIMIT`
consultas o cancelaciones con código de reserva por ventana, y los propios de las rutas de
admin) se cuentan **por máquina**, no por persona. En local es aceptable: con
los servicios en loopback, esa máquina es el único cliente posible.

El backend **no confía en `X-Forwarded-For`** (ni en `X-Real-IP` ni en `Forwarded`) para
identificar al cliente: Next reenvía ese encabezado tal cual lo manda el navegador, así que
confiar en él permitiría inventar una IP en cada pedido y saltear el límite contra la fuerza
bruta del login. `backend/test/exposicion-red.e2e-spec.ts` lo fija.

### Condición para desplegar

Desplegar el sistema fuera de una máquina local **no está soportado tal como está**. Hace
falta, como mínimo:

1. Un **proxy de borde** (nginx, Caddy, el balanceador de la plataforma) delante de Next que
   **sobrescriba** `X-Forwarded-For` con la IP real del cliente (no que la agregue a la que
   mandó el cliente).
2. Declarar como confiables en el backend, con `TRUST_PROXY`, los saltos que hay entre ese
   proxy de borde y el backend (el servidor de Next, que es quien se conecta al backend; por
   ejemplo `loopback` si corren en la misma máquina). El formato es una lista separada por
   coma de `loopback`, `linklocal`, `uniquelocal`, direcciones IPv4 (`10.0.0.5`) o subredes
   IPv4 con prefijo `/8` o mayor (`10.0.0.0/8`). El backend **no arranca** con cualquier otro
   valor: `true`, `*`, un número de saltos, una subred demasiado amplia o cualquier notación
   IPv6 (algunas, como `::/1`, coinciden con cualquier IPv4 — ver GHSA-jqcg-44mw-7w3h).
3. Que nadie pueda llegar a Next ni al backend salteando el proxy de borde: si un cliente
   habla directo con Next, el `X-Forwarded-For` que manda llega intacto al backend (el proxy
   `/api` lo reenvía tal cual) y el backend lo tomaría como cierto.

El detalle de las decisiones está en `openspec/changes/exposicion-red-local/design.md`.

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

- Todo entra a `main` por Pull Request, con al menos una aprobación de un compañero. GitHub lo
  hace cumplir: `main` está protegida, exige la aprobación y los tres checks de CI
  (`Especificación (OpenSpec + OpenAPI)`, `Lint y tipos` y `Tests (backend)`), y la regla
  aplica también a los administradores.
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
