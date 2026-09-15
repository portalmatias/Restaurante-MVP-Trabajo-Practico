## Why

El admin necesita configurar el salón antes de que exista ninguna reserva: qué mesas hay, a
qué zona pertenece cada una y qué turnos de servicio están activos. Hoy esos datos solo pueden
cargarse a mano en la base (vía `seed.ts` de `modelo-dominio`); no existe ningún endpoint que
permita administrarlos después del arranque inicial. `docs/roadmap-mvp.md` (Fase 3) identifica
esto como el tercer track en paralelo de la Fase 3 y lo asigna a `lussofacundo-iresm`; la spec
se puede escribir ya porque no depende de código, aunque su implementación sí va a depender del
guard de `auth-admin`.

## What Changes

- Se introduce la capability `gestion-salon`, que especifica el CRUD administrativo de Zonas,
  Mesas y Turnos, protegido en su totalidad por `JwtAuthGuard` + `RolesGuard(ADMIN)`
  (`auth-admin`).
- **Zonas:** solo lectura y actualización de configuración. `Zona.nombre` es un enum de dos
  valores fijos (`STANDARD`/`VIP`, ver `openspec/specs/modelo-dominio/spec.md`); no se agregan
  ni se eliminan zonas, solo se listan y se editan sus valores de configuración
  (`minComensales`, `maxComensales`, anticipación mínima/máxima, ventana de cancelación,
  `requiereConfirmacionAdmin`, `aforoMaximo`).
- **Mesas:** CRUD completo (alta, listado con filtro por zona, edición de capacidad/etiqueta/
  zona, baja). La baja y el cambio de zona se rechazan si la Mesa tiene Reservas activas
  (`PENDIENTE`/`CONFIRMADA`) que dependen de ella, para no romper el invariante 1 de
  `modelo-dominio` (exclusividad mesa+turno+fecha) ni dejar reservas huérfanas.
- **Turnos:** alta, listado, edición de horario/día, y activación/desactivación. La
  desactivación es el mecanismo de "baja" (`activo = false`, ya modelado en `modelo-dominio`) en
  vez de un delete físico, porque las Reservas existentes referencian el Turno por FK.
- No modifica el schema de `modelo-dominio`: reutiliza las entidades `Zona`, `Mesa` y `Turno`
  ya definidas, sin agregarles campos.
- No introduce librerías nuevas: usa NestJS + `class-validator` (ya avalados por
  `config.yaml` §2) y los guards de `auth-admin`.

## Capabilities

### New Capabilities
- `gestion-salon`: CRUD administrativo de Zonas (solo lectura/actualización), Mesas (CRUD
  completo) y Turnos (alta/edición/activación), bajo rutas `/admin/*` protegidas por rol
  `ADMIN`.

### Modified Capabilities
_Ninguna._ Las entidades `Zona`, `Mesa` y `Turno` ya quedaron definidas en `modelo-dominio`;
este change no les agrega ni les cambia ningún requisito de dominio, solo expone operaciones
de administración sobre ellas.

## Impact

- **Depende de:** `auth-admin` (guard mergeado, para la implementación — la spec de este
  change no lo necesita) y `modelo-dominio` (entidades `Zona`, `Mesa`, `Turno` ya migradas).
- **Bloquea:** ninguna otra capability del roadmap depende de `gestion-salon` para avanzar,
  aunque `frontend-admin` (Fase 5) va a consumir estos endpoints para el CRUD del salón.
- **Código afectado (cuando se implemente):** `backend/src/zonas/`, `backend/src/mesas/`,
  `backend/src/horarios/` (módulo de Turnos, nombre heredado de `config.yaml` §7), cada uno con
  `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`; tests en
  `backend/src/{zonas,mesas,horarios}/**/*.spec.ts` y
  `backend/test/{zonas,mesas,horarios}.e2e-spec.ts`.
- **Afecta `openapi/openapi.yaml`:** agrega los paths `/admin/zonas`, `/admin/mesas` y
  `/admin/turnos` (GET/POST/PATCH/DELETE según corresponda) con `security: [bearerAuth]`, en
  el mismo PR de implementación.
- No agrega variables de entorno nuevas.
