## Why

`auth-admin` registró `ThrottlerGuard` como guard global con el límite por defecto de
`THROTTLE_TTL`/`THROTTLE_LIMIT` (60 s / 10 solicitudes), pensado para las rutas públicas con
código de reserva (`config.yaml` §5). De las rutas de administración, solo
`GET /admin/reservas` tiene un límite propio (60 por minuto, D7 de `reserva-consultar`, porque
"el default global es demasiado bajo para un panel que pagina y cambia filtros"). Las demás
—`/admin/zonas`, `/admin/mesas`, `/admin/turnos` y las acciones
`PATCH /admin/reservas/:id/confirmar|rechazar|no-show`— quedaron con 10 por minuto sin que
ningún change lo decidiera.

Con el panel de `frontend-admin` (PR #58) eso deja de ser teórico: confirmar o rechazar en
ráfaga desde el listado, editar varias Mesas seguidas o volver varias veces a `/admin/salon`
(que vuelve a pedir zonas, mesas y turnos) llega a 11 solicitudes a la misma ruta en un minuto,
y el admin recibe `429` trabajando normalmente. Además, el frontend llega al backend a través
del proxy `/api` de Next (D6 de `frontend-base`), así que todas las sesiones comparten el mismo
origen para el throttler (ver `design.md`), lo que acerca todavía más ese umbral.

## What Changes

- Todas las rutas de administración (`/admin/zonas`, `/admin/mesas`, `/admin/turnos` y
  `/admin/reservas`, incluidas sus acciones) pasan a tener **el mismo límite propio que ya
  tiene `GET /admin/reservas`: 60 solicitudes por minuto**, contado por ruta y por origen.
- El límite de `GET /admin/reservas` no cambia de valor: pasa a declararse una sola vez para
  todo el panel de admin en lugar de en esa ruta suelta.
- `openapi/openapi.yaml` documenta la respuesta `429` en las 12 operaciones de admin que hoy no
  la declaran (hoy ya las limita el guard global, pero el contrato no lo dice).
- **No** cambia ningún límite de rutas públicas ni del login:
  - `POST /auth/login` mantiene su límite estricto de 5 intentos por minuto (defensa contra
    fuerza bruta de credenciales).
  - `POST /reservas/consultar` y `POST /reservas/:codigo/cancelar` mantienen el límite global
    (defensa contra enumeración del código de reserva).
  - Las rutas públicas que hoy no tienen límite (`GET /disponibilidad`, `POST /reservas`,
    catálogos públicos) siguen igual.
- **No** cambia el criterio de rastreo (sigue siendo por IP) ni la configuración de
  `trust proxy`: ambos quedan analizados en `design.md` como alternativa y como pregunta
  abierta, respectivamente.
- No agrega variables de entorno, dependencias ni migraciones.

## Capabilities

### New Capabilities
- `throttle-rutas-admin`: límite de solicitudes común a todas las rutas de administración
  (holgado para el uso del panel, pero acotado para limitar el abuso con un token robado o un
  cliente defectuoso), y la garantía explícita de que el login y las rutas públicas con código
  de reserva conservan sus límites.

### Modified Capabilities
_Ninguna._ El requisito "Rate limiting del listado de administrador" de `reserva-consultar`
sigue valiendo tal cual (el listado mantiene 60 por minuto); este change extiende el mismo
criterio a las demás rutas de admin sin cambiar el comportamiento del listado. El requisito
"Límite de intentos de login" de `auth-admin` tampoco cambia.

## Impact

- **Código afectado (cuando se implemente):** `backend/src/zonas/zonas.controller.ts`,
  `backend/src/mesas/mesas.controller.ts`, `backend/src/horarios/horarios.controller.ts` y
  `backend/src/reservas/reservas-admin.controller.ts` (decorador de límite a nivel de clase y
  `@ApiTooManyRequestsResponse` en cada operación); un decorador compartido nuevo en
  `backend/src/auth/decorators/`. Tests e2e nuevos en
  `backend/test/throttle-rutas-admin.e2e-spec.ts`.
- **Afecta `openapi/openapi.yaml`:** agrega una respuesta `'429'` (solo descripción, como en
  `auth-admin` y `reserva-consultar`) a las 12 operaciones listadas en `design.md`. No cambia
  paths, parámetros ni schemas. Hay que regenerar `frontend/src/lib/api/schema.d.ts`
  (`npm run api:types -w frontend`) para que pase `api:types:check`.
- **Frontend:** sin cambios de código. `frontend-admin` ya traduce un `429` a un mensaje fijo;
  con este change ese mensaje deja de aparecer en el uso normal del panel.
- **Seguridad:** relaja un límite **solo** en rutas que ya exigen JWT + rol `ADMIN`; ninguna
  ruta accesible sin token gana margen. Ver `design.md` → Risks.
- **Depende de:** nada pendiente. Todas las rutas afectadas están en `main`
  (`gestion-salon`, `reserva-consultar`, `cancelacion-turnos`, `reserva-vip`). No depende de
  que se mergee `frontend-admin`.
- No agrega variables de entorno, dependencias ni migraciones de Prisma.
