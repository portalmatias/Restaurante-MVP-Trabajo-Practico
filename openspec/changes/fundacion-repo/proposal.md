## Why

El repositorio no tiene una sola línea de código: hoy solo existen `.claude/`, `docs/` y
`openspec/`. Ningún change posterior del roadmap puede empezar hasta que exista el monorepo,
y ninguno puede *cerrarse* hasta que exista CI, porque la Definition of Done (§13) exige "CI
en verde" para todo change. La Fase 1 de `docs/roadmap-mvp.md` es, por eso, un cuello de
botella secuencial que bloquea a los tres integrantes a la vez.

Este change levanta esa fundación de una sola vez: monorepo, backend, frontend, base de datos
local, contrato OpenAPI y pipeline de CI. No agrega comportamiento al sistema de reservas.

## What Changes

- **Monorepo con npm workspaces.** `package.json` en la raíz con `workspaces: ["backend",
  "frontend"]` y los scripts transversales (`lint`, `typecheck`, `test`, `dev`). ESLint y
  Prettier se instalan solo en la raíz, según §4.
- **`backend/`** generado con `nest new` (TypeScript, npm). Sin módulos de dominio todavía:
  los trae `modelo-dominio` (Fase 2).
- **`frontend/`** generado con `create-next-app` (TypeScript, App Router). Sin pantallas: las
  trae `frontend-base` (Fase 5).
- **`docker-compose.yml`** con dos servicios de PostgreSQL: uno de desarrollo y uno de test,
  en puertos distintos. §10 exige que la base de test sea separada de la de desarrollo.
- **`.env.example`** versionado con las siete variables que enumera §10, sin valores reales.
- **`openapi/openapi.yaml`** esqueleto: `info`, `servers`, `components.securitySchemes` con
  bearer JWT y `paths: {}`. Cada capability posterior lo va llenando en su propio PR.
- **`.github/workflows/ci.yml`** con los cuatro pasos de §12, en tres jobs (`spec`, `lint`,
  `test`). El job `test` **no** levanta PostgreSQL en esta etapa — ver `design.md`.
- **`README.md`** inicial con el bloque "Primer arranque" de §10.
- **Se corrige la redacción de `openspec/config.yaml` §2**, que hoy describe el contrato
  OpenAPI como "Generado/validado desde el backend" y contradice a §3 ("versionado en el
  repo"). Se resuelve a favor de *contract-first*; el detalle y su justificación están en
  `design.md`. Es el mismo mecanismo que usó `diseno-general-app` para editar §5 y §6.
- **Se incorporan tres herramientas nuevas**, cada una justificada en `design.md` como exige
  §2: `@stoplight/spectral-cli` (linter de OpenAPI), la CLI de `openspec` como devDependency,
  y `@nestjs/swagger` (solo para el chequeo de deriva contrato ↔ código en CI).

## Capabilities

### New Capabilities
_Ninguna._ Este change no introduce comportamiento observable del sistema de reservas: crea
el andamiaje del repositorio y el pipeline. Las capabilities de dominio (`modelo-dominio`,
`autenticacion-admin`, `gestion-salon`, `disponibilidad`, `reservas`) se especifican cada una
en su propio change, según `docs/roadmap-mvp.md` §6–§8.

### Modified Capabilities
_Ninguna._ `openspec/specs/` está vacío — todavía no hay specs archivadas sobre las que
declarar un delta.

> Este change fija `skip_specs: true` en su `.openspec.yaml`, igual que `diseno-general-app`.
> No se inventa un requisito solo para satisfacer `openspec validate`.

## Impact

**Archivos creados** (ninguno existe hoy):

```
package.json, package-lock.json, eslint.config.mjs, .prettierrc
backend/**            (nest new)
frontend/**           (create-next-app)
docker-compose.yml
.env.example
openapi/openapi.yaml
.github/workflows/ci.yml
README.md
```

**Archivo modificado:** `openspec/config.yaml` (redacción de §2).

**Dependencias nuevas en la raíz:** ESLint, Prettier, `@stoplight/spectral-cli`, `openspec`.
**Dependencia nueva en `backend/`:** `@nestjs/swagger`.

**Desbloquea:** toda la Fase 2 en adelante del roadmap. En particular `modelo-dominio`, que
no puede correr `prisma migrate` sin el `docker-compose.yml` ni el `DATABASE_URL` de este change.

**Deuda deliberada que este change deja abierta:** el job `test` de CI corre sin base de datos,
porque en la Fase 1 no existen `schema.prisma`, migraciones ni `seed.ts`. Los pasos con
PostgreSQL y los tests e2e de §9 se agregan en el change `ci-integracion-db`, inmediatamente
después de `modelo-dominio`. Va en un change propio porque §14 prohíbe tocar
`.github/workflows/` dentro de un PR de feature.

**Riesgo asumido:** este PR es más grande de lo que le gustaría a §14 ("cambios chicos y
revisables"). Casi todo su volumen es salida de generadores (`nest new`, `create-next-app`).
La mitigación está en `design.md` y en cómo se parte `tasks.md`.
