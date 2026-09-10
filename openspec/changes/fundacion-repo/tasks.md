# Tareas — `fundacion-repo`

Los grupos 1 y 2 son los dos tracks de `design.md` D7 y corren **en paralelo**: ningún archivo
tiene dos dueños. El grupo 3 es secuencial y arranca cuando los dos terminaron.

Toda la tabla de contrato de D7 (nombres de scripts, puertos, nombres de base) es de
cumplimiento obligatorio para ambos tracks: es lo único que les permite no esperarse.

## 1. Track A — Esqueleto del monorepo

- [x] 1.1 Crear el `package.json` de la raíz con `"private": true`, `workspaces: ["backend", "frontend"]`, `engines` en Node 20 / npm 10, y los seis scripts de la tabla de contrato de D7 declarados (aunque algunos queden delegando a workspaces que todavía no existen). Verificar con `npm run` que lista los seis nombres exactos.
- [x] 1.2 Generar `backend/` con `nest new backend --package-manager npm --skip-git`, fijando la versión de la CLI usada y anotándola en el PR. Verificar que `npm run test -w backend` pasa con los specs que trae el scaffolding.
- [x] 1.3 Generar `frontend/` con `create-next-app` en TypeScript y App Router, sin git y sin ejemplos. Fijar y anotar la versión de la CLI. Verificar que `npm run build -w frontend` termina sin errores.
- [x] 1.4 Configurar ESLint y Prettier **solo en la raíz** (§4), con una config compartida que alcance a los dos workspaces, y quitar las configs de lint duplicadas que dejaron los generadores. Verificar que `npm run lint` pasa en limpio, sin warnings.
- [x] 1.5 Agregar el script `typecheck` (`tsc --noEmit`) al `package.json` de cada workspace y cablearlo desde la raíz. Verificar que `npm run typecheck` pasa en limpio en ambos.
- [x] 1.6 Agregar `concurrently` a la raíz (D6) y cablear `npm run dev` para que levante los dos workspaces en paralelo, con el backend en el puerto `3001` y el frontend en `3000`. Verificar levantando ambos y abriendo las dos URLs.
- [x] 1.7 Escribir el `README.md` inicial con el bloque "Primer arranque" de §10 textual y ejecutable, más la tabla de puertos y nombres de base de D7. Verificar siguiéndolo desde cero en un clon limpio.

## 2. Track B — Infra y contrato

- [x] 2.1 Escribir `docker-compose.yml` con un servicio de PostgreSQL, healthcheck, volumen nombrado y un script de init que cree `reservas_dev` y `reservas_test` (D5). Verificar con `docker compose up -d` y listando las dos bases con `psql -l`.
- [x] 2.2 Escribir `.env.example` con exactamente las siete variables de §10 (`DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `NEXT_PUBLIC_API_URL`, `THROTTLE_TTL`, `THROTTLE_LIMIT`), con valores de ejemplo y ningún valor real. Verificar que `cp .env.example .env` deja el proyecto arrancable sin editar nada más que el secreto.
- [x] 2.3 Escribir el esqueleto de `openapi/openapi.yaml`: `openapi: 3.1.0`, `info` con título y descripción **en español** (§8), `servers` apuntando al backend local, `components.securitySchemes` con bearer JWT según §5, y `paths: {}`. Verificar que un parser de OpenAPI 3.1 lo carga sin errores.
- [x] 2.4 Agregar `@stoplight/spectral-cli` a la raíz con `.spectral.yaml` extendiendo `spectral:oas` (D3), y el script `openapi:lint`. Verificar que pasa en limpio sobre el esqueleto y que falla si se le rompe el YAML a propósito.
- [x] 2.5 Implementar `openapi:check` (D1/D2): generar el spec desde `@nestjs/swagger` y diffear **solo** `paths` y `components.schemas` contra el YAML commiteado. Verificar que pasa con `paths` vacío y que se pone en rojo al agregar un controller con un endpoint que no está en el YAML — y revertir esa prueba antes de commitear.
- [x] 2.6 Escribir `.github/workflows/ci.yml` disparado en `pull_request` y en push a `main`, con los tres jobs de D8: `spec` (`openspec validate --strict` + `openapi:lint` + `openapi:check`), `lint` (`lint` + `typecheck`) y `test` (`npm run test -w backend`, **sin** PostgreSQL). Verificar que los tres quedan en verde en el PR de este change.
- [x] 2.7 Agregar la CLI de `openspec` como devDependency de la raíz con versión fijada (D4) y usarla desde el job `spec`. Verificar que `npm run` la resuelve desde `node_modules` y no vía `npx`.
- [x] 2.8 Corregir la redacción de §2 de `openspec/config.yaml`: el contrato OpenAPI pasa de "Generado/validado desde el backend" a contract-first, con el chequeo de deriva como mecanismo de validación (D1). Verificar que §2 y §3 ya no se contradicen leyéndolas seguidas.

## 3. Integración y cierre

- [x] 3.1 Correr `npm install` desde la raíz con los dos workspaces ya generados y commitear un único `package-lock.json`. Verificar que no quedaron `package-lock.json` anidados en `backend/` ni en `frontend/`.
- [x] 3.2 Ejecutar el "Primer arranque" de §10 de punta a punta, salteando `db:migrate` y `db:seed` (todavía no existen, llegan en `modelo-dominio`). Verificar que backend y frontend levantan y responden. *Verificado sobre el working tree, no sobre un clon limpio. El frontend se probó en el puerto 3100 porque el 3000 estaba ocupado por otro servicio de la máquina; ambos respondieron 200.*
- [x] 3.3 Correr `openspec validate --strict` sobre el change y sobre el repo. Verificar que pasa con `skip_specs: true`.
- [x] 3.4 Abrir el PR `feature/fundacion-repo` con descripción en español enlazada a este change, anotando explícitamente las dos deudas que deja abiertas: los pasos de CI con PostgreSQL (`ci-integracion-db`) y los required status checks (tarea 0.4 del roadmap). Verificar que los tres jobs quedan en verde.
- [x] 3.5 Recorrer la Definition of Done de §13 punto por punto sobre este PR antes de pedir review. Verificar que cada punto aplicable está cumplido o explícitamente marcado como no aplicable con su motivo.
