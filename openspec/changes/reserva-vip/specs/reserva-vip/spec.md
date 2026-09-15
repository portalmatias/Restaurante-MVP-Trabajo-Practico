## Purpose

Le da al admin las dos acciones que resuelven una Reserva `PENDIENTE` de la Zona `VIP`:
confirmarla u rechazarla, sin las cuales esas Reservas quedarían bloqueadas indefinidamente.

## ADDED Requirements

### Requirement: Confirmación de Reserva pendiente
El sistema SHALL exponer una operación protegida por rol `ADMIN` que transiciona una Reserva
`PENDIENTE` a `CONFIRMADA`.

#### Scenario: Confirmación exitosa
- **WHEN** el admin confirma una Reserva que está `PENDIENTE`
- **THEN** el sistema la transiciona a `CONFIRMADA`

#### Scenario: Confirmar una Reserva que no está pendiente rechazado
- **WHEN** el admin intenta confirmar una Reserva que no está `PENDIENTE`
- **THEN** el sistema rechaza la operación con `409 Conflict`

### Requirement: Rechazo de Reserva pendiente
El sistema SHALL exponer una operación protegida por rol `ADMIN` que transiciona una Reserva
`PENDIENTE` a `CANCELADA`.

#### Scenario: Rechazo exitoso
- **WHEN** el admin rechaza una Reserva que está `PENDIENTE`
- **THEN** el sistema la transiciona a `CANCELADA`

#### Scenario: Rechazar una Reserva que no está pendiente rechazado
- **WHEN** el admin intenta rechazar una Reserva que no está `PENDIENTE`
- **THEN** el sistema rechaza la operación con `409 Conflict`

### Requirement: Rutas de confirmación y rechazo protegidas por autenticación de administrador
El sistema SHALL rechazar cualquier solicitud de confirmación o rechazo que no incluya un JWT
válido de rol `ADMIN`.

#### Scenario: Confirmación o rechazo sin token rechazados
- **WHEN** se solicita confirmar o rechazar una Reserva sin header `Authorization`
- **THEN** el sistema responde `401 Unauthorized` sin ejecutar la operación
