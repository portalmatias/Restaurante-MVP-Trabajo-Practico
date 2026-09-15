## Purpose

Permite al cliente liberar una Reserva que ya no va a usar, dentro de la ventana mínima de
anticipación de su Zona, y al admin registrar que un cliente confirmado no se presentó a su
turno.

## ADDED Requirements

### Requirement: Cancelación de Reserva por código y email
El sistema SHALL exponer una operación pública (sin cuenta) que recibe el código de una
Reserva y el email del cliente, y SHALL exigir que ambos coincidan con una Reserva existente
para procesar la cancelación, sin indicar cuál de los dos datos era incorrecto si no coinciden.
La operación SHALL ser `POST /reservas/:codigo/cancelar`, con el email en el body JSON,
y SHALL responder `204 No Content` sin cuerpo cuando la cancelación sea exitosa.

#### Scenario: Código y email coincidentes cancelan la Reserva
- **WHEN** el cliente envía el código y el email correctos de una Reserva `PENDIENTE` o
  `CONFIRMADA` dentro de la ventana de cancelación de su Zona
- **THEN** el sistema transiciona la Reserva a `CANCELADA`

#### Scenario: Email que no coincide rechazado
- **WHEN** el cliente envía un código de Reserva válido junto con un email que no coincide con
  el registrado para esa Reserva
- **THEN** el sistema responde `404 Not Found` sin indicar cuál dato era incorrecto

#### Scenario: Código inexistente rechazado de forma indistinguible
- **WHEN** el cliente envía un código que no corresponde a ninguna Reserva
- **THEN** el sistema responde el mismo `404 Not Found` que ante un email que no coincide, sin
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
- **THEN** el sistema rechaza la cancelación con `409 Conflict`

### Requirement: Solo Reservas activas pueden cancelarse
El sistema SHALL rechazar la cancelación de una Reserva que ya está en un estado terminal
(`CANCELADA` o `NO_SHOW`).

#### Scenario: Cancelar una Reserva ya cancelada rechazado
- **WHEN** se solicita cancelar una Reserva que ya está `CANCELADA`
- **THEN** el sistema rechaza la operación con `409 Conflict`

#### Scenario: Cancelar una Reserva NO_SHOW rechazado
- **WHEN** se solicita cancelar una Reserva que ya está `NO_SHOW`
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
La operación SHALL ser `PATCH /admin/reservas/:id/no-show` y SHALL responder `204 No Content`
sin cuerpo al completarse, o `404 Not Found` si no existe la Reserva. El sistema SHALL exigir
que el instante actual sea estrictamente posterior al fin real del Turno. Si `horaFin` es
anterior a `horaInicio` en hora local, el fin SHALL calcularse sobre el día siguiente del
calendario local de la Reserva, antes de convertirlo a UTC con la zona horaria del restaurante.

#### Scenario: Marcar NO_SHOW después de que terminó el turno
- **WHEN** el admin marca como `NO_SHOW` una Reserva `CONFIRMADA` cuyo Turno ya terminó
- **THEN** el sistema transiciona la Reserva a `NO_SHOW`

#### Scenario: Marcar NO_SHOW antes de que termine el turno rechazado
- **WHEN** el admin intenta marcar como `NO_SHOW` una Reserva `CONFIRMADA` cuyo Turno todavía
  no terminó
- **THEN** el sistema rechaza la operación con `409 Conflict`

#### Scenario: Marcar NO_SHOW rechazado un minuto antes del cierre, con el turno cruzando medianoche en UTC
- **WHEN** el admin intenta marcar como `NO_SHOW` una Reserva `CONFIRMADA` del turno de cena
  (20:00–23:30 hora local del restaurante), a un minuto de que termine, aunque en UTC el fin
  de ese turno ya caiga después de medianoche del día siguiente
- **THEN** el sistema rechaza la operación con `409 Conflict`, calculando "el turno terminó"
  sobre la hora local del restaurante y no sobre una lectura literal de la hora en UTC

#### Scenario: Marcar NO_SHOW sobre una Reserva que no está CONFIRMADA rechazado
- **WHEN** el admin intenta marcar como `NO_SHOW` una Reserva que no está en estado
  `CONFIRMADA`
- **THEN** el sistema rechaza la operación con `409 Conflict`

#### Scenario: Turno que termina al día siguiente conserva la fecha local de fin
- **GIVEN** una Reserva `CONFIRMADA` del 31 de diciembre con Turno 23:00–01:00 local
- **WHEN** el admin intenta marcar `NO_SHOW` a las 23:30 del 31 de diciembre o a las 00:59
  del 1 de enero
- **THEN** el sistema responde `409 Conflict` porque el fin es el 1 de enero a la 01:00 local

#### Scenario: NO_SHOW en el instante exacto de fin rechazado
- **GIVEN** una Reserva `CONFIRMADA` con Turno 23:00–01:00 local
- **WHEN** el admin intenta marcar `NO_SHOW` exactamente a la 01:00 local del día siguiente
- **THEN** el sistema responde `409 Conflict`

#### Scenario: NO_SHOW después del fin del turno nocturno permitido
- **GIVEN** una Reserva `CONFIRMADA` del 31 de diciembre con Turno 23:00–01:00 local
- **WHEN** el admin marca `NO_SHOW` a la 01:01 local del 1 de enero
- **THEN** el sistema transiciona a `NO_SHOW` y responde `204 No Content` sin cuerpo

#### Scenario: NO_SHOW de Reserva inexistente rechazado
- **WHEN** el admin solicita marcar `NO_SHOW` con un UUID válido que no identifica una Reserva
- **THEN** el sistema responde `404 Not Found`

#### Scenario: Ruta de marcado de NO_SHOW sin token rechazada
- **WHEN** se solicita marcar `NO_SHOW` sin header `Authorization`
- **THEN** el sistema responde `401 Unauthorized` sin ejecutar la operación

#### Scenario: Ruta de marcado de NO_SHOW con token de rol incorrecto rechazada
- **WHEN** se solicita marcar `NO_SHOW` presentando un JWT válido pero emitido para un rol
  distinto de `ADMIN`
- **THEN** el sistema responde `403 Forbidden` sin ejecutar la operación

### Requirement: Validación del formato de las solicitudes
El sistema SHALL responder `400 Bad Request` si el código de cancelación no es alfanumérico
de 8 caracteres, si el body no contiene un email válido o si el identificador de NO_SHOW no
es un UUID válido. Los errores de negocio SHALL usar los códigos definidos en los requisitos
anteriores; un código con formato válido inexistente SHALL responder `404`, no `400`.

#### Scenario: Cancelación con formato inválido rechazada
- **WHEN** se solicita cancelar con un código de formato inválido o sin un email válido en el body
- **THEN** el sistema responde `400 Bad Request` sin modificar Reservas

#### Scenario: NO_SHOW con identificador inválido rechazado
- **WHEN** el admin solicita marcar `NO_SHOW` con un identificador que no es un UUID válido
- **THEN** el sistema responde `400 Bad Request` sin modificar Reservas
