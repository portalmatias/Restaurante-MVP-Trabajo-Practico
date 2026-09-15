## Why

Una vez que existe una Reserva, el cliente necesita poder liberarla si cambia de planes, y el
admin necesita poder registrar que un cliente no se presentó. Ninguna capability existente
cubre esto: `modelo-dominio` ya define el estado `CANCELADA`/`NO_SHOW` y las ventanas de
cancelación configurables por Zona (`config.yaml` §6), pero ningún endpoint las expone todavía.
`docs/roadmap-mvp.md` (Fase 4) asigna este change a `lussofacundo-iresm`, con dependencia de
`reservas-crear` para su implementación; la spec no depende de código y se puede escribir ya,
igual que se hizo con `gestion-salon`.

## What Changes

- Se introduce la capability `cancelacion-turnos`, que especifica:
  - **Cancelación por el cliente** (sin cuenta): recibe código de reserva + email, exige que
    coincidan con la Reserva (igual que el resto de las rutas públicas sin cuenta, `config.yaml`
    §5), y transiciona la Reserva a `CANCELADA` si está `PENDIENTE` o `CONFIRMADA`.
  - **Ventana mínima de cancelación por Zona**: rechaza la cancelación si al turno le quedan
    menos horas que la `ventanaCancelacionHoras` configurada para su Zona (2h `STANDARD` / 24h
    `VIP`, valores de `config.yaml` §6, ya modelados en `modelo-dominio`).
  - **Rate limiting** (`@nestjs/throttler`) sobre el endpoint de cancelación, igual que el resto
    de las rutas públicas sin cuenta, porque el código de reserva es de baja entropía.
  - **Marcar `NO_SHOW`** (admin): transiciona una Reserva `CONFIRMADA` a `NO_SHOW`, protegido por
    `JwtAuthGuard` + `RolesGuard(ADMIN)`, y solo permitido después de que el Turno de esa Reserva
    ya pasó.
- No modifica el schema de `modelo-dominio`: reutiliza `Reserva`, `EstadoReserva` y las
  transiciones ya definidas (`PENDIENTE → CANCELADA`, `CONFIRMADA → CANCELADA`,
  `CONFIRMADA → NO_SHOW`).
- Requiere que `disponibilidad` entregue el helper de conversión y el campo
  `ConfiguracionNegocio.zonaHoraria`: si el campo no llega en `modelo-dominio`, la migración
  corresponde al plan B de `disponibilidad`, no a este change.
- Aclara en `config.yaml` la distinción entre horarios locales e instantes UTC y el flujo
  de contrato OpenAPI en diseño primero, YAML ejecutable junto con la implementación.
- No introduce librerías nuevas: `@nestjs/throttler` ya está avalado por `config.yaml` §2.

## Capabilities

### New Capabilities
- `cancelacion-turnos`: cancelación de Reserva por el cliente (código + email, dentro de la
  ventana de la Zona) y marcado de `NO_SHOW` por el admin (solo tras el turno).

### Modified Capabilities
_Ninguna._ Las transiciones `PENDIENTE → CANCELADA`, `CONFIRMADA → CANCELADA` y
`CONFIRMADA → NO_SHOW`, y las ventanas de cancelación por Zona, ya quedaron definidas como
datos/enum en `modelo-dominio`; este change no les agrega ni les cambia ningún requisito de
dominio, solo expone las operaciones que las disparan.

## Impact

- **Depende de:** `reservas-crear` (para que existan Reservas sobre las que operar, y porque
  este change extiende el mismo `ReservasService` — ver roadmap §8), `modelo-dominio` (entidad
  `Reserva`, enum `EstadoReserva`, configuración de Zona), `disponibilidad` (helper
  `inicioTurnoUtc` y configuración `zonaHoraria`, incluida su migración si corresponde) y
  `auth-admin` (`JwtAuthGuard` +
  `RolesGuard(ADMIN)` sobre la ruta de `NO_SHOW`). La ruta pública de cancelación además asume
  que exista `ThrottlerModule` con su guard: se reutiliza si ya lo registró `auth-admin` o
  `reserva-consultar`; si falta, se configura en este change. `fundacion-repo` solo dejó las
  variables de entorno y `disponibilidad` no incluye throttling. La spec no necesita esto
  implementado; su implementación
  sí.
- **Comparte servicio con:** `reserva-consultar` — el roadmap recomienda mergear
  `reserva-consultar` primero y que la implementación de `cancelacion-turnos` rebase sobre ella,
  para no duplicar el código de búsqueda por código + email.
- **Código afectado (cuando se implemente):** extiende `backend/src/reservas/`
  (`reservas.controller.ts`, `reservas.service.ts`, nuevos DTOs de cancelación y de marcado de
  no-show); tests en `backend/src/reservas/**/*.spec.ts` y
  `backend/test/cancelacion-turnos.e2e-spec.ts`.
- **Afecta `openapi/openapi.yaml`:** agrega un endpoint público de cancelación (bajo
  `/reservas/...`, con `security: []`) y un endpoint `/admin/reservas/:id/no-show` (con
  `security: [{ bearerAuth: [] }]`), en el mismo PR de implementación. El fragmento completo
  se define ahora en `design.md`, según `config.yaml` §3 y el roadmap actualizado.
- No agrega variables de entorno nuevas (`THROTTLE_TTL`/`THROTTLE_LIMIT` ya existen desde
  `fundacion-repo`).
