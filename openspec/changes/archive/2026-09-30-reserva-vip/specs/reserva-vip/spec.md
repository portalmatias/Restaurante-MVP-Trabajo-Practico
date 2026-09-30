## Purpose

Le da al admin las dos acciones que resuelven una Reserva `PENDIENTE` de la Zona `VIP`:
confirmarla o rechazarla, sin las cuales esas Reservas quedarían bloqueadas indefinidamente.

## ADDED Requirements

### Requirement: Confirmación de Reserva pendiente
El sistema SHALL exponer una operación protegida por rol `ADMIN` que transiciona una Reserva
`PENDIENTE` a `CONFIRMADA`.

#### Scenario: Confirmación exitosa
- **WHEN** el admin confirma una Reserva que está `PENDIENTE`
- **THEN** el sistema la transiciona a `CONFIRMADA`

#### Scenario: Confirmación bloqueada si la Reserva no está pendiente
- **WHEN** el admin intenta confirmar una Reserva que no está `PENDIENTE`
- **THEN** el sistema rechaza la operación con `409 Conflict`

### Requirement: Rechazo de Reserva pendiente
El sistema SHALL exponer una operación protegida por rol `ADMIN` que transiciona una Reserva
`PENDIENTE` a `CANCELADA`.

#### Scenario: Rechazo exitoso
- **WHEN** el admin rechaza una Reserva que está `PENDIENTE`
- **THEN** el sistema la transiciona a `CANCELADA`

#### Scenario: Rechazo bloqueado si la Reserva no está pendiente
- **WHEN** el admin intenta rechazar una Reserva que no está `PENDIENTE`
- **THEN** el sistema rechaza la operación con `409 Conflict`

### Requirement: Rutas de confirmación y rechazo protegidas por autenticación de administrador
El sistema SHALL rechazar cualquier solicitud de confirmación o rechazo que no incluya un JWT
válido de rol `ADMIN`.

#### Scenario: Confirmación o rechazo sin token rechazados
- **WHEN** se solicita confirmar o rechazar una Reserva sin header `Authorization`
- **THEN** el sistema responde `401 Unauthorized` sin ejecutar la operación

#### Scenario: Confirmación o rechazo con token de rol incorrecto rechazados
- **WHEN** se solicita confirmar o rechazar una Reserva presentando un JWT válido pero emitido
  para un rol distinto de `ADMIN`
- **THEN** el sistema responde `403 Forbidden` sin ejecutar la operación
