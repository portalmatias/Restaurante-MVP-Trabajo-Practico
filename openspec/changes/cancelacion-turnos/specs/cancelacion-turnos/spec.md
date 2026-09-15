## Purpose

Permite al cliente liberar una Reserva que ya no va a usar, dentro de la ventana mínima de
anticipación de su Zona, y al admin registrar que un cliente confirmado no se presentó a su
turno.

## ADDED Requirements

### Requirement: Cancelación de Reserva por código y email
El sistema SHALL exponer una operación pública (sin cuenta) que recibe el código de una
Reserva y el email del cliente, y SHALL exigir que ambos coincidan con una Reserva existente
para procesar la cancelación, sin indicar cuál de los dos datos era incorrecto si no coinciden.

#### Scenario: Código y email coincidentes cancelan la Reserva
- **WHEN** el cliente envía el código y el email correctos de una Reserva `PENDIENTE` o
  `CONFIRMADA` dentro de la ventana de cancelación de su Zona
- **THEN** el sistema transiciona la Reserva a `CANCELADA`

#### Scenario: Email que no coincide rechazado
- **WHEN** el cliente envía un código de Reserva válido junto con un email que no coincide con
  el registrado para esa Reserva
- **THEN** el sistema rechaza la cancelación sin indicar cuál dato era incorrecto

#### Scenario: Código inexistente rechazado de forma indistinguible
- **WHEN** el cliente envía un código que no corresponde a ninguna Reserva
- **THEN** el sistema responde de la misma forma que ante un email que no coincide, sin
  revelar si el código existe

### Requirement: Ventana mínima de cancelación por Zona
El sistema SHALL rechazar la cancelación de una Reserva cuando, al momento de la solicitud, al
inicio de su Turno le queden menos horas que la `ventanaCancelacionHoras` configurada para la
Zona de esa Reserva.

#### Scenario: Cancelación en el límite exacto de la ventana permitida
- **WHEN** al inicio del Turno le quedan exactamente las horas de la ventana de cancelación
  configurada para la Zona de la Reserva
- **THEN** el sistema permite la cancelación

#### Scenario: Cancelación fuera de la ventana rechazada
- **WHEN** al inicio del Turno le quedan menos horas que la ventana de cancelación configurada
  para la Zona de la Reserva
- **THEN** el sistema rechaza la cancelación

### Requirement: Solo Reservas activas pueden cancelarse
El sistema SHALL rechazar la cancelación de una Reserva que ya está en un estado terminal
(`CANCELADA` o `NO_SHOW`).

#### Scenario: Cancelar una Reserva ya cancelada rechazado
- **WHEN** se solicita cancelar una Reserva que ya está `CANCELADA`
- **THEN** el sistema rechaza la operación con `409 Conflict`

### Requirement: Límite de intentos de cancelación
El sistema SHALL limitar la cantidad de intentos de cancelación por origen en una ventana de
tiempo, rechazando los intentos que superan ese límite antes de validar código y email.

#### Scenario: Cancelación bloqueada tras exceder el límite de intentos
- **WHEN** un mismo origen supera el límite configurado de intentos de cancelación dentro de
  la ventana de tiempo configurada
- **THEN** el sistema rechaza los intentos siguientes de ese origen con `429 Too Many
  Requests`, sin validar código ni email

### Requirement: Marcado de NO_SHOW por el admin
El sistema SHALL exponer una operación protegida por rol `ADMIN` que transiciona una Reserva
`CONFIRMADA` a `NO_SHOW`, y SHALL rechazarla si el Turno de esa Reserva todavía no terminó.

#### Scenario: Marcar NO_SHOW después de que terminó el turno
- **WHEN** el admin marca como `NO_SHOW` una Reserva `CONFIRMADA` cuyo Turno ya terminó
- **THEN** el sistema transiciona la Reserva a `NO_SHOW`

#### Scenario: Marcar NO_SHOW antes de que termine el turno rechazado
- **WHEN** el admin intenta marcar como `NO_SHOW` una Reserva `CONFIRMADA` cuyo Turno todavía
  no terminó
- **THEN** el sistema rechaza la operación

#### Scenario: Marcar NO_SHOW rechazado un minuto antes del cierre, con el turno cruzando medianoche en UTC
- **WHEN** el admin intenta marcar como `NO_SHOW` una Reserva `CONFIRMADA` del turno de cena
  (20:00–23:30 hora local del restaurante), a un minuto de que termine, aunque en UTC el fin
  de ese turno ya caiga después de medianoche del día siguiente
- **THEN** el sistema rechaza la operación, calculando "el turno terminó" sobre la hora local
  del restaurante y no sobre una lectura literal de la hora en UTC

#### Scenario: Marcar NO_SHOW sobre una Reserva que no está CONFIRMADA rechazado
- **WHEN** el admin intenta marcar como `NO_SHOW` una Reserva que no está en estado
  `CONFIRMADA`
- **THEN** el sistema rechaza la operación con `409 Conflict`

#### Scenario: Ruta de marcado de NO_SHOW sin token rechazada
- **WHEN** se solicita marcar `NO_SHOW` sin header `Authorization`
- **THEN** el sistema responde `401 Unauthorized` sin ejecutar la operación
