## Why

`frontend-base` deja el layout, los tokens, las primitivas de UI y el cliente HTTP tipado,
pero `/admin` es todavía un placeholder sin lógica (`docs/roadmap-mvp.md` Fase 5). Sin este
change, el administrador no tiene forma de loguearse ni de gestionar el salón desde el
navegador: solo existen los endpoints del backend. El roadmap asigna `frontend-admin` a
FedeWerk, con alcance fijo: login, dashboard de aforo, CRUD del salón, confirmar/rechazar
reservas VIP y marcar `NO_SHOW`.

De esos cinco, hoy solo los primeros tres tienen backend mergeado (`auth-admin`,
`gestion-salon`, `reserva-consultar`). Confirmar/rechazar VIP (`reserva-vip`) y marcar
`NO_SHOW` (`cancelacion-turnos`) todavía no tienen implementación — mismo patrón que
`frontend-cliente` (D10 de su `design.md`): la spec fija el comportamiento completo de las
cinco piezas, y `tasks.md` agrupa el trabajo por prerrequisito para que cada grupo se
implemente en cuanto su backend esté disponible, sin tipos a mano ni paths ficticios en el
YAML.

A diferencia de `frontend-cliente` (cliente sin cuenta), este change necesita autenticación:
es la primera vez que el frontend maneja un JWT. `design.md` fija esa decisión.

## What Changes

- Se agrega el flujo de login bajo `/admin/login`: formulario de email + contraseña contra
  `POST /auth/login`, JWT guardado en el navegador (D1 de `design.md`), y las rutas
  `/admin/...` protegidas: sin sesión válida, redirigen a `/admin/login`.
- Se agrega el dashboard de aforo en `/admin` (la pantalla que hoy es placeholder): ocupación
  actual por zona y global para una fecha y un turno elegibles, calculada en el cliente a
  partir de `GET /admin/zonas` (aforo configurado) y `GET /admin/reservas` (comensales de
  Reservas `CONFIRMADA`/`PENDIENTE` de ese turno y esa fecha) — sin agregar un endpoint
  nuevo al backend.
- Se agrega el CRUD de salón bajo `/admin/salon`: listar y editar Zonas
  (`GET`/`PATCH /admin/zonas`), alta/listado/edición/baja de Mesas
  (`POST`/`GET`/`PATCH`/`DELETE /admin/mesas`) y alta/listado/edición/activación de Turnos
  (`POST`/`GET`/`PATCH /admin/turnos`), con los errores `400`/`404`/`409` de cada operación
  (`gestion-salon`).
- Se agrega el listado de Reservas en `/admin/reservas`, sobre `GET /admin/reservas`
  (`reserva-consultar`), con los mismos filtros que expone la API (fecha, estado, zona,
  turno) y paginación. Desde cada fila `PENDIENTE` (zona VIP) se accede a confirmar o
  rechazar; desde cada fila `CONFIRMADA` de un turno ya pasado, a marcar `NO_SHOW` — ambas
  acciones **bloqueadas hasta que sus backends existan** (grupos D y E de `tasks.md`).
- Copy en español rioplatense **formal** (voseo sin lunfardo, tono profesional): a
  diferencia de `frontend-cliente`, que usa voseo coloquial pensado para un cliente que
  reserva desde el celular, este es personal del restaurante operando un panel de trabajo.
  `design.md` (D3) fija el criterio.
- Primer uso de autenticación en el frontend: nuevas utilidades `frontend/src/lib/auth/`
  (sesión, contexto de React) y un cliente HTTP admin aparte
  (`frontend/src/lib/api/admin-client.ts`) que agrega el header `Authorization`, sin tocar el
  `apiClient` público de `frontend-base` (D1 y D2 de `design.md`).

### Fuera de alcance

- Reasignación manual de mesa (no está en el roadmap de ningún change de backend).
- Recuperación de contraseña o refresh token (`config.yaml` §5: no existen en el MVP).
- Alta o baja de Zona, o eliminación de Turno (`gestion-salon` no los expone: alta/baja de
  Zona no están soportadas y los Turnos solo se activan/desactivan).
- Cualquier pantalla del cliente sin cuenta (`frontend-cliente`).
- Confirmar/rechazar VIP y marcar `NO_SHOW` quedan especificados pero no implementados hasta
  que `reserva-vip` y `cancelacion-turnos` mergeen sus endpoints (ver Impact).

## Capabilities

### New Capabilities
- `frontend-admin`: login de administrador, dashboard de aforo, gestión de zonas/mesas/
  turnos y listado de Reservas con las acciones de confirmar/rechazar VIP y marcar
  `NO_SHOW`, todo bajo `/admin/...`.

### Modified Capabilities
_Ninguna._ `frontend-base` no cambia ningún requisito: este change consume su layout, sus
primitivas y su cliente HTTP, y agrega un cliente HTTP admin y utilidades de sesión nuevas
sin alterar el contrato que `frontend-base` ya fija (ver Impact).

## Impact

- **Depende de (agrupado para permitir implementación incremental, mismo criterio que D10 de
  `frontend-cliente`):**
  - **Grupo A — login y sesión:** necesita `POST /auth/login` (`auth-admin`, mergeado).
  - **Grupo B — dashboard de aforo:** necesita `GET /admin/zonas` (`gestion-salon`,
    mergeado) y `GET /admin/reservas` (`reserva-consultar`, mergeado).
  - **Grupo C — CRUD de salón:** necesita `GET`/`PATCH /admin/zonas`,
    `POST`/`GET`/`PATCH`/`DELETE /admin/mesas` y `POST`/`GET`/`PATCH /admin/turnos`
    (`gestion-salon`, mergeado).
  - **Grupo D — listado de Reservas:** necesita `GET /admin/reservas` (`reserva-consultar`,
    mergeado).
  - **Grupo E — confirmar/rechazar VIP:** necesita `PATCH /admin/reservas/:id/confirmar` y
    `.../rechazar` (`reserva-vip`, **spec mergeada, implementación pendiente**). Bloqueado.
  - **Grupo F — marcar `NO_SHOW`:** necesita `PATCH /admin/reservas/:id/no-show`
    (`cancelacion-turnos`, **spec mergeada, implementación pendiente**). Bloqueado.
  - **`frontend-base`**: layout, tokens, primitivas (`Button`, `Field`, `Input`, `Select`,
    `Card`, `Alert`, `Label`), cliente HTTP tipado (`apiClient`, `toApiResult`) y el proxy
    `/api`. Mergeado (#43).
  - El cliente HTTP tipado solo tiene tipos para los paths presentes en
    `openapi/openapi.yaml` en el momento de regenerarlos: los grupos E y F no pueden
    escribirse contra el cliente tipado real hasta que sus PRs mergeen su fragmento OpenAPI.
    `tasks.md` los deja bloqueados explícitamente, sin tipos a mano ni paths ficticios.
- **Desbloquea:** el flujo manual de punta a punta de `docs/roadmap-mvp.md` §13 (Fase 5,
  columna admin) y `entrega-final`, para los grupos A a D; E y F quedan pendientes de sus
  backends.
- **Código afectado (en la implementación):**
  - Nuevo: `frontend/app/admin/login/`, `frontend/app/admin/salon/`,
    `frontend/app/admin/reservas/`, `frontend/src/lib/auth/` (sesión, contexto),
    `frontend/src/lib/api/admin-client.ts`, componentes cliente de cada pantalla y las
    utilidades puras de aforo/paginación.
  - Reescrito: `frontend/app/admin/page.tsx` (placeholder → dashboard real), `frontend/app/admin/layout.tsx` (nuevo, envuelve `/admin/...` con el chequeo de sesión).
  - Sin cambios en `frontend/src/components/ui/*` ni en `frontend/src/lib/api/client.ts`,
    `errors.ts` (D1, D2 de `design.md`): este change no los extiende, a diferencia de
    `frontend-cliente`.
- **API / `openapi/openapi.yaml`:** este change no modifica el contrato; consume los paths ya
  publicados de `auth-admin`, `gestion-salon` y `reserva-consultar`, y (cuando mergeen) los
  de `reserva-vip` y `cancelacion-turnos`.
- **Base de datos:** sin cambios; el frontend no tiene schema propio.
- **Dependencias npm:** ninguna nueva. La sesión se guarda con `sessionStorage` (nativo, ver
  `design.md` D1); no se agrega una librería de manejo de formularios ni de estado global.
