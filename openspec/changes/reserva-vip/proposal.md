## Why

Toda Reserva de la Zona `VIP` nace `PENDIENTE` (`config.yaml` §6: "Requiere confirmación del
admin: Sí") y queda así hasta que el admin la aprueba o la rechaza; sin esto, esas Reservas se
quedan bloqueadas para siempre en `PENDIENTE`, ocupando su Mesa (el índice único parcial de
`modelo-dominio` las cuenta como activas) sin que el cliente sepa si finalmente tiene lugar.
`docs/roadmap-mvp.md` (Fase 4) asigna este change a `lussofacundo-iresm`, con dependencia de
`reservas-crear` para su implementación; la spec no depende de código y se puede escribir ya.

## What Changes

- Se introduce la capability `reserva-vip`, que especifica las dos transiciones que solo el
  admin puede disparar sobre una Reserva `PENDIENTE`:
  - **Confirmar**: `PENDIENTE → CONFIRMADA`.
  - **Rechazar**: `PENDIENTE → CANCELADA`.
  - Ambas protegidas por `JwtAuthGuard` + `RolesGuard(ADMIN)` (`auth-admin`), y ambas
    rechazadas con `409 Conflict` si la Reserva no está `PENDIENTE` (transición inválida, ver
    `modelo-dominio`).
- No agrega un endpoint de listado de Reservas pendientes: `reserva-consultar` (Fase 4, dueño
  FedeWerk) ya cubre "listado y filtros para admin"; el admin encuentra las Reservas `PENDIENTE`
  ahí. Este change solo agrega las dos acciones sobre una Reserva puntual.
- No modifica el schema de `modelo-dominio`: reutiliza `Reserva` y las transiciones
  `PENDIENTE → CONFIRMADA` / `PENDIENTE → CANCELADA` ya definidas en su enum `EstadoReserva`.
- No introduce librerías nuevas.

## Capabilities

### New Capabilities
- `reserva-vip`: confirmación y rechazo por el admin de una Reserva `PENDIENTE` (exclusivo de
  la Zona `VIP`, por construcción del flujo de creación).

### Modified Capabilities
_Ninguna._ Las transiciones `PENDIENTE → CONFIRMADA` y `PENDIENTE → CANCELADA` ya quedaron
definidas en `modelo-dominio`; este change no les agrega ni les cambia ningún requisito de
dominio, solo expone las dos operaciones que las disparan.

## Impact

- **Depende de:** `reservas-crear` (para que existan Reservas `PENDIENTE` sobre las que
  operar, y porque este change extiende el mismo `ReservasService`) y `modelo-dominio`
  (entidad `Reserva`, enum `EstadoReserva`). La spec no necesita ninguna de las dos
  implementadas; su implementación sí.
- **Se apoya en:** `reserva-consultar` para que el admin encuentre las Reservas `PENDIENTE`
  que necesita confirmar o rechazar (listado admin). No hay dependencia de código entre ambos
  changes — cada uno agrega sus propias rutas sobre el mismo `ReservasService`.
- **Código afectado (cuando se implemente):** extiende `backend/src/reservas/`
  (`reservas.controller.ts`, `reservas.service.ts`); tests en
  `backend/src/reservas/**/*.spec.ts` y `backend/test/reserva-vip.e2e-spec.ts`.
- **Afecta `openapi/openapi.yaml`:** agrega `/admin/reservas/:id/confirmar` y
  `/admin/reservas/:id/rechazar` (ambos con `security: [bearerAuth]`), en el mismo PR de
  implementación.
- No agrega variables de entorno nuevas.
