## Why

Hoy un cliente sin cuenta recibe un código al reservar y no tiene cómo volver a ver su
Reserva: no puede saber si una Reserva `VIP` sigue `PENDIENTE` o ya fue confirmada, ni
comprobar que una cancelación quedó registrada. El admin, por su parte, no tiene forma de
listar Reservas, y las acciones de otros changes lo necesitan: `reserva-vip` opera sobre las
`PENDIENTE` y `cancelacion-turnos` marca `NO_SHOW` por `id`, pero ninguna ruta entrega ese
`id`. `config.yaml` §5 ya fija el modelo (código + email, ambos deben coincidir, con rate
limiting contra enumeración) y `docs/roadmap-mvp.md` (Fase 4) asigna este change a
`FedeWerk`, con dependencia de `reservas-crear` para su implementación. La spec no depende
de código y se puede escribir ya.

Además, `reservas-crear` dejó abiertas dos preguntas que este change debe cerrar porque es
quien compara: si el código de reserva se busca ignorando mayúsculas y minúsculas, y si el
email se compara normalizado.

## What Changes

- Se introduce la capability `reserva-consultar`, con dos operaciones de solo lectura:
  - **Consulta pública por código + email**: `POST /reservas/consultar` con `codigo` y
    `email` en el body. Devuelve una vista mínima de la Reserva (sin `id`, sin mesa y sin
    datos de contacto). Si el código no existe o el email no coincide, responde el mismo
    `404` sin distinguir cuál falló. Lleva rate limiting.
  - **Listado para el admin**: `GET /admin/reservas`, protegido por `JwtAuthGuard` +
    `RolesGuard(ADMIN)`, con filtros por `fecha`, `estado`, `zonaId` y `turnoId`, orden
    estable y paginación. Cada ítem incluye el `id` que necesitan `reserva-vip` y
    `cancelacion-turnos`.
- **Decisiones que este change cierra** (detalle y alternativas en `design.md`):
  - El código se compara sin distinguir mayúsculas y minúsculas; el email también. El
    email se sigue guardando tal cual llega (no cambia `reservas-crear`).
  - La consulta es un `POST` con el email en el body, **no** el `GET` que sugería el roadmap:
    el email es un dato personal y no debe quedar en la URL ni en los logs de acceso, el
    mismo criterio con el que `cancelacion-turnos` descartó `DELETE` con query string.
  - La búsqueda por código + email vive en un único método de `ReservasService`
    (`buscarPorCodigoYEmail`), para que `cancelacion-turnos` lo reutilice en lugar de
    duplicarlo, como recomienda el roadmap.
- No modifica el schema de `modelo-dominio`, no agrega variables de entorno ni librerías
  nuevas (`@nestjs/throttler` ya está registrado).

**Fuera de alcance:** cancelar, confirmar o rechazar Reservas (`cancelacion-turnos` y
`reserva-vip`); buscar por email solamente ("mis reservas"); detalle de una Reserva por `id`;
filtros por rango de fechas o por nombre de cliente; envío del código por email;
reasignación manual de mesa.

## Capabilities

### New Capabilities
- `reserva-consultar`: consulta pública de una Reserva por código + email, con vista mínima y
  respuesta indistinguible ante código inexistente o email incorrecto, y listado paginado y
  filtrable de Reservas para el admin.

### Modified Capabilities
_Ninguna._ `openspec/specs/` todavía no tiene specs vigentes (las de `modelo-dominio` y
`auth-admin` siguen como changes activos) y este change no altera ningún requisito de
dominio: lee la `Reserva` y sus relaciones tal como las define `modelo-dominio`.

## Impact

- **Depende de:** `reservas-crear` (para que existan `ReservasController`, `ReservasService`
  y Reservas reales sobre las que consultar; la spec no lo necesita implementado, la
  implementación sí), `modelo-dominio` (entidad `Reserva` y sus relaciones), `auth-admin`
  (`JwtAuthGuard` + `RolesGuard` en el listado; hoy `AuthModule` todavía no está registrado
  en `AppModule`) y `ci-integracion-db` (para que los tests de integración corran en CI
  contra PostgreSQL). Toma prestado de `disponibilidad` el validador de fecha de calendario
  y el schema `ErrorRespuesta`.
- **Lo consumen:** `cancelacion-turnos` (reutiliza `buscarPorCodigoYEmail` y el mismo `404`
  genérico; el roadmap recomienda mergear este change primero), `reserva-vip` (el admin
  encuentra las `PENDIENTE` y obtiene su `id` con `GET /admin/reservas?estado=PENDIENTE`) y
  `frontend-cliente` / `frontend-admin` (pantallas de consulta y de listado).
- **Código afectado (cuando se implemente):** extiende `backend/src/reservas/`
  (`reservas.controller.ts`, `reservas.service.ts`, DTOs de consulta y de listado); tests en
  `backend/src/reservas/**/*.spec.ts`, `backend/test/reserva-consultar.integration-spec.ts` y
  `backend/test/reserva-consultar.e2e-spec.ts`.
- **Afecta `openapi/openapi.yaml`:** agrega `POST /reservas/consultar` (`security: []`) y
  `GET /admin/reservas` (`bearerAuth`), en el mismo PR de implementación. El fragmento
  completo se define ahora en `design.md`, según `config.yaml` §3.
- **Seguridad:** la consulta pública es la superficie que `config.yaml` §5 marca como
  enumerable, y el listado devuelve datos personales de todas las Reservas. Ambos puntos se
  tratan como requisitos de la spec con tests que intentan violarlos, no como notas de
  diseño.
