## Purpose

Permite que cualquier persona, sin cuenta, cree una reserva para una fecha, un turno, una zona
y una cantidad de comensales, dejando nombre, email y teléfono. El sistema valida las mismas
reglas que la consulta de disponibilidad en el momento de crear, asigna la mesa
automáticamente, fija el estado inicial según la zona y devuelve un código de reserva. Define
además qué garantías se mantienen cuando varias creaciones llegan al mismo tiempo.

Los escenarios usan los datos del seed de `modelo-dominio`: zona STANDARD (1 a 8 comensales,
anticipación de 2 horas a 30 días, aforo 40, no requiere confirmación del admin, mesas `S1`
y `S2` de capacidad 2, `S3` de 4, `S4` de 6 y `S5` de 8), zona VIP (2 a 12 comensales,
anticipación de 24 horas a 60 días, aforo 20, requiere confirmación del admin, mesas `V1` de
capacidad 2, `V2` de 4, `V3` de 6 y `V4` de 12), aforo global 60, turnos almuerzo 12:00–15:00
y cena 20:00–23:30 de martes a domingo y turnos del lunes inactivos. Las horas son hora local
del restaurante (`America/Argentina/Buenos_Aires`, UTC-3 fijo). Salvo que un escenario diga otra
cosa, el instante actual es 2026-09-15 10:00, no hay reservas activas para el turno y la fecha
pedidos, y el body trae datos de contacto válidos. "La cena del sábado 2026-09-19" es el turno
de cena del sábado con `fecha=2026-09-19`.

## ADDED Requirements

### Requirement: Creación pública de reservas
El sistema SHALL exponer `POST /reservas`, accesible sin autenticación, que recibe en un body
JSON `fecha`, `turnoId`, `zonaId`, `comensales`, `nombreCliente`, `emailCliente` y
`telefonoCliente`, todos obligatorios, y crea una única reserva para esa combinación. Cuando la
reserva se crea, SHALL responder `201 Created`.

#### Scenario: Visitante sin token crea una reserva
- **WHEN** un visitante sin header `Authorization` envía `POST /reservas` para la cena del
  sábado 2026-09-19 en zona STANDARD con `comensales=4`
- **THEN** el sistema responde `201 Created`
- **AND** existe en la base exactamente una reserva nueva con esa fecha, ese turno, 4
  comensales y los datos de contacto enviados

### Requirement: Forma de la respuesta de creación
Ante una creación exitosa, el cuerpo SHALL contener `codigoReserva`, `estado`, `fecha` (con el
formato `YYYY-MM-DD` y el mismo valor enviado), `turnoId`, `zonaId` y `comensales`. El cuerpo
SHALL NOT contener el identificador interno de la reserva, la mesa asignada ni los datos de
contacto.

#### Scenario: La respuesta no expone datos internos
- **WHEN** se crea una reserva para la cena del sábado 2026-09-19 en zona STANDARD con
  `comensales=4`
- **THEN** el cuerpo trae `fecha: "2026-09-19"`, el `turnoId` y el `zonaId` enviados,
  `comensales: 4`, un `codigoReserva` y un `estado`
- **AND** el cuerpo no trae `id`, `mesaId`, `mesa`, `nombreCliente`, `emailCliente` ni
  `telefonoCliente`

### Requirement: Código de reserva
El sistema SHALL generar, para cada reserva creada, un código de 8 caracteres alfanuméricos
que no coincide con el de ninguna otra reserva existente, cualquiera sea su estado. Si el
código generado coincide con uno existente, SHALL generar otro y completar la creación sin
informar el choque al cliente.

#### Scenario: Formato del código
- **WHEN** se crea una reserva
- **THEN** `codigoReserva` tiene exactamente 8 caracteres y todos son letras o dígitos

#### Scenario: Códigos distintos para reservas distintas
- **WHEN** se crean en secuencia 20 reservas válidas
- **THEN** los 20 `codigoReserva` son distintos entre sí

#### Scenario: Colisión de código resuelta sin error
- **WHEN** el primer código generado para una nueva reserva coincide con el de una reserva
  `CANCELADA` existente
- **THEN** el sistema responde `201 Created` con un `codigoReserva` distinto del existente

### Requirement: Estado inicial según la zona
El sistema SHALL crear la reserva en estado `PENDIENTE` cuando la zona pedida requiere
confirmación del admin y en estado `CONFIRMADA` cuando no la requiere, según la configuración
de la zona y no según su nombre. El estado inicial SHALL NOT tomarse del body.

#### Scenario: Reserva STANDARD queda confirmada
- **WHEN** se crea una reserva para la cena del sábado 2026-09-19 en zona STANDARD con
  `comensales=4`
- **THEN** la respuesta y la reserva persistida tienen `estado: CONFIRMADA`

#### Scenario: Reserva VIP queda pendiente
- **WHEN** se crea una reserva para la cena del sábado 2026-09-19 en zona VIP con
  `comensales=6`
- **THEN** la respuesta y la reserva persistida tienen `estado: PENDIENTE`

#### Scenario: El estado enviado por el cliente se rechaza
- **WHEN** se envía `POST /reservas` para la cena del sábado 2026-09-19 en zona VIP con
  `comensales=6` y además `estado: "CONFIRMADA"` en el body
- **THEN** el sistema responde `400 Bad Request`
- **AND** la cantidad de reservas en la base no cambia

#### Scenario: El estado sigue a la configuración y no al nombre
- **WHEN** la zona STANDARD está configurada para requerir confirmación del admin
- **AND** se crea una reserva para la cena del sábado 2026-09-19 en zona STANDARD con
  `comensales=4`
- **THEN** la reserva queda `PENDIENTE`

### Requirement: Asignación automática de mesa por mejor ajuste
El sistema SHALL asignar a la reserva, entre las mesas de la zona pedida que no tienen una
reserva `PENDIENTE` o `CONFIRMADA` para ese turno y esa fecha, la de menor capacidad que sea
mayor o igual a `comensales`. Si hay varias con esa misma capacidad, SHALL elegir la de menor
etiqueta en orden lexicográfico. No se combinan mesas. La mesa SHALL NOT tomarse del body.

#### Scenario: Se elige la mesa más chica que alcanza
- **WHEN** se crea una reserva para la cena del sábado 2026-09-19 en zona STANDARD con
  `comensales=3`
- **THEN** la reserva queda asignada a la mesa `S3` (capacidad 4), no a `S4` ni a `S5`

#### Scenario: Capacidad exacta
- **WHEN** se crea una reserva para la cena del sábado 2026-09-19 en zona VIP con
  `comensales=12`
- **THEN** la reserva queda asignada a la mesa `V4`

#### Scenario: Desempate por etiqueta
- **WHEN** se crea una reserva para la cena del sábado 2026-09-19 en zona STANDARD con
  `comensales=2`
- **THEN** la reserva queda asignada a la mesa `S1`

#### Scenario: Mesa ocupada se saltea
- **WHEN** para la cena del sábado 2026-09-19 la mesa `S1` tiene una reserva `CONFIRMADA`
- **AND** se crea una reserva para ese turno y esa fecha en zona STANDARD con `comensales=2`
- **THEN** la reserva queda asignada a la mesa `S2`

#### Scenario: Mesa con reserva cancelada se considera libre
- **WHEN** para la cena del sábado 2026-09-19 la única reserva de la mesa `S1` está
  `CANCELADA`
- **AND** se crea una reserva para ese turno y esa fecha en zona STANDARD con `comensales=2`
- **THEN** la reserva queda asignada a la mesa `S1`

#### Scenario: Mesa de otro turno o de otra fecha no ocupa
- **WHEN** la mesa `S3` tiene una reserva `CONFIRMADA` para el almuerzo del sábado 2026-09-19
  y otra para la cena del sábado 2026-09-26
- **AND** se crea una reserva para la cena del sábado 2026-09-19 en zona STANDARD con
  `comensales=3`
- **THEN** la reserva queda asignada a la mesa `S3`

#### Scenario: La mesa enviada por el cliente se rechaza
- **WHEN** se envía `POST /reservas` para la cena del sábado 2026-09-19 en zona STANDARD con
  `comensales=2` y además el `mesaId` de `S5` en el body
- **THEN** el sistema responde `400 Bad Request`
- **AND** la cantidad de reservas en la base no cambia

### Requirement: Mismas reglas que la consulta de disponibilidad
Al crear, el sistema SHALL evaluar las ocho reglas de la capability `disponibilidad` (turno
activo, correspondencia entre turno y fecha, anticipación mínima y máxima, rango de comensales,
aforo de zona, aforo global y mesa disponible), con los mismos bordes, sobre el estado de las
reservas en el momento de crear. Si alguna falla, SHALL responder `409 Conflict` informando
**todas** las que fallan, con los mismos códigos y en el mismo orden fijo que la consulta, y
SHALL NOT persistir ninguna reserva. Para una misma solicitud, en el mismo estado de reservas y
en el mismo instante, la creación SHALL rechazarse si y solo si la consulta informaría al menos
un motivo.

#### Scenario: Turno inactivo
- **WHEN** se intenta crear una reserva para el almuerzo del lunes con `fecha=2026-09-21`, zona
  STANDARD y `comensales=2`
- **THEN** el sistema responde `409 Conflict` con `motivos` que contiene exactamente
  `TURNO_INACTIVO`
- **AND** la cantidad de reservas en la base no cambia

#### Scenario: Varios motivos en orden fijo
- **WHEN** se intenta crear una reserva para la cena del lunes (inactiva) con
  `fecha=2026-09-22` (martes), zona VIP y `comensales=1`
- **AND** el instante actual es 2026-09-22 19:00
- **THEN** el sistema responde `409 Conflict` con `motivos` que contiene exactamente, en este
  orden, `TURNO_INACTIVO`, `TURNO_NO_CORRESPONDE_A_FECHA`, `ANTICIPACION_MINIMA` y
  `COMENSALES_FUERA_DE_RANGO`

#### Scenario: Exactamente la anticipación mínima permite crear
- **WHEN** se crea una reserva para el almuerzo del martes con `fecha=2026-09-15`, zona
  STANDARD y `comensales=2`
- **AND** el instante actual es 2026-09-15 10:00 (exactamente 2 horas antes de las 12:00)
- **THEN** el sistema responde `201 Created`

#### Scenario: Un minuto menos que la anticipación mínima rechaza
- **WHEN** se intenta crear la misma reserva con el instante actual 2026-09-15 10:01
- **THEN** el sistema responde `409 Conflict` con `motivos` que contiene exactamente
  `ANTICIPACION_MINIMA`

#### Scenario: Aforo de zona con el comensal nuevo ya sumado
- **WHEN** para la cena del sábado 2026-09-19 existen en VIP una reserva `CONFIRMADA` de 12
  comensales en `V4` y una `PENDIENTE` de 6 en `V3`
- **AND** se intenta crear una reserva para ese turno y esa fecha en zona VIP con
  `comensales=4`
- **THEN** el sistema responde `409 Conflict` con `motivos` que contiene exactamente
  `AFORO_ZONA`, aunque la mesa `V2` está libre

#### Scenario: Llenar exacto el aforo de zona está permitido
- **WHEN** para la cena del sábado 2026-09-19 existen en VIP una reserva `CONFIRMADA` de 12
  comensales en `V4` y una `PENDIENTE` de 6 en `V3`
- **AND** se crea una reserva para ese turno y esa fecha en zona VIP con `comensales=2`
- **THEN** el sistema responde `201 Created` y la reserva queda asignada a `V1`

#### Scenario: Aforo global
- **WHEN** el aforo global está configurado en 30
- **AND** para la cena del sábado 2026-09-19 existen reservas activas de 12 y 6 comensales en
  VIP y de 8 comensales en `S5`
- **AND** se intenta crear una reserva para ese turno y esa fecha en zona STANDARD con
  `comensales=6`
- **THEN** el sistema responde `409 Conflict` con `motivos` que contiene exactamente
  `AFORO_GLOBAL`

#### Scenario: Sin mesa que alcance
- **WHEN** para la cena del sábado 2026-09-19 existe una reserva `CONFIRMADA` de 3 comensales
  en `S5`
- **AND** se intenta crear una reserva para ese turno y esa fecha en zona STANDARD con
  `comensales=7`
- **THEN** el sistema responde `409 Conflict` con `motivos` que contiene exactamente
  `SIN_MESA_DISPONIBLE`

#### Scenario: Consulta disponible y creación exitosa coinciden
- **WHEN** la consulta de disponibilidad para la cena del sábado 2026-09-19 en zona STANDARD
  con `comensales=4` devuelve `disponible: true`
- **AND** en ese mismo estado y en ese mismo instante se crea una reserva con esa solicitud
- **THEN** el sistema responde `201 Created`

#### Scenario: Consulta y creación informan los mismos motivos
- **WHEN** la consulta de disponibilidad para una solicitud devuelve `motivos` no vacío
- **AND** en ese mismo estado y en ese mismo instante se intenta crear una reserva con esa
  solicitud
- **THEN** el `409` trae en `motivos` los mismos códigos, en el mismo orden, que la consulta

### Requirement: Forma del rechazo por reglas de negocio
Todo `409 Conflict` de `POST /reservas` SHALL tener un cuerpo
`{ statusCode: 409, message: string, error: "Conflict", motivos: [...] }`, donde cada elemento
de `motivos` tiene `codigo` y `mensaje` en español, como en la consulta de disponibilidad.
`motivos` SHALL estar vacío solo cuando el rechazo se debe a un choque con creaciones
simultáneas y no a una regla. La creación SHALL NOT responder `422`.

#### Scenario: Rechazo con motivos
- **WHEN** se intenta crear una reserva para el almuerzo del lunes con `fecha=2026-09-21`
- **THEN** el cuerpo del `409` tiene `statusCode: 409`, un `message` no vacío,
  `error: "Conflict"` y `motivos` con un elemento cuyo `codigo` es `TURNO_INACTIVO` y cuyo
  `mensaje` es un texto no vacío

### Requirement: Creaciones concurrentes
El sistema SHALL evaluar cada creación contra las reservas ya persistidas por cualquier otra
creación concurrente del mismo turno y la misma fecha, de modo que creaciones simultáneas no
superen el aforo de zona, no superen el aforo global y no asignen la misma mesa dos veces. Una
creación que pierde contra otra SHALL responder `409 Conflict` y SHALL NOT responder `500` ni
ningún otro error del servidor.

#### Scenario: Creaciones simultáneas no superan el aforo de zona
- **WHEN** el aforo de la zona VIP está configurado en 8
- **AND** llegan en simultáneo 4 creaciones para la cena del sábado 2026-09-19 en VIP, cada una
  de 3 comensales
- **THEN** exactamente 2 responden `201 Created` y 2 responden `409 Conflict` con `motivos` que
  contiene exactamente `AFORO_ZONA`
- **AND** la suma de comensales activos de VIP para ese turno y esa fecha es 6

#### Scenario: Creaciones simultáneas no superan el aforo global
- **WHEN** el aforo global está configurado en 10
- **AND** llegan en simultáneo una creación de 6 comensales en STANDARD y otra de 6 comensales
  en VIP, ambas para la cena del sábado 2026-09-19
- **THEN** exactamente una responde `201 Created` y la otra responde `409 Conflict` con
  `motivos` que contiene exactamente `AFORO_GLOBAL`

#### Scenario: Dos creaciones simultáneas por la única mesa que alcanza
- **WHEN** llegan en simultáneo 2 creaciones para la cena del sábado 2026-09-19 en STANDARD,
  cada una de 7 comensales
- **THEN** exactamente una responde `201 Created` y queda asignada a `S5`
- **AND** la otra responde `409 Conflict` con `motivos` que contiene exactamente
  `SIN_MESA_DISPONIBLE`

#### Scenario: Ninguna respuesta concurrente es un error del servidor
- **WHEN** llegan en simultáneo 8 creaciones válidas en formato para la cena del sábado
  2026-09-19 en VIP, cada una de 4 comensales
- **THEN** cada respuesta es `201 Created` o `409 Conflict`
- **AND** la suma de comensales activos de VIP para ese turno y esa fecha no supera 20

#### Scenario: Espera excesiva por otras creaciones del mismo turno y fecha
- **WHEN** una creación para la cena del sábado 2026-09-19 tiene que esperar a otras
  operaciones sobre ese mismo turno y esa misma fecha más tiempo del que el sistema admite
- **THEN** el sistema responde `409 Conflict` con `motivos` vacío y un `message` que invita a
  reintentar
- **AND** no persiste esa reserva

#### Scenario: Choque sobre la mesa al persistir
- **WHEN** al momento de persistir, la mesa elegida para una creación ya tiene una reserva
  `PENDIENTE` o `CONFIRMADA` para ese turno y esa fecha, escrita por una operación que no
  respetó la exclusión entre creaciones
- **THEN** el sistema responde `409 Conflict` con `motivos` que contiene exactamente
  `SIN_MESA_DISPONIBLE`
- **AND** no persiste la nueva reserva

### Requirement: Fecha de calendario local
El sistema SHALL persistir como fecha de la reserva exactamente la fecha de calendario local
enviada en `fecha`, sin importar la hora del turno ni la zona horaria del proceso del servidor.
El inicio del turno y el día de la semana SHALL interpretarse igual que en la consulta de
disponibilidad (hora local de Argentina, UTC-3 fijo).

#### Scenario: Cena cuyo inicio en UTC cae al día siguiente
- **WHEN** el turno de cena del sábado está configurado de 22:00 a 23:30 hora local
- **AND** se crea una reserva con `fecha=2026-09-19` en zona STANDARD con `comensales=2`
- **THEN** la respuesta trae `fecha: "2026-09-19"` y la reserva persistida tiene fecha
  2026-09-19, no 2026-09-20

#### Scenario: Mismo resultado con el servidor en UTC o en Buenos Aires
- **WHEN** se crea la misma reserva para la cena del sábado 2026-09-19 con el proceso del
  servidor corriendo una vez con zona horaria UTC y otra con `America/Argentina/Buenos_Aires`,
  sobre la misma base inicial
- **THEN** en los dos casos la reserva persistida tiene fecha 2026-09-19, la misma mesa y el
  mismo estado

### Requirement: Validación del body
El sistema SHALL responder `400 Bad Request`, sin evaluar reglas y sin persistir nada, cuando
falta alguno de los siete campos, cuando `fecha` no tiene el formato `YYYY-MM-DD` o no es una
fecha de calendario válida (incluido un valor con hora), cuando `turnoId` o `zonaId` no son
UUID, cuando `comensales` no es un entero mayor o igual a 1, cuando `emailCliente` no es un
email válido, cuando `nombreCliente` o `telefonoCliente` están vacíos o solo tienen espacios,
o cuando el body trae algún campo distinto de los siete (por ejemplo `mesaId`, `estado` o
`codigoReserva`). El cuerpo SHALL tener la forma `{ statusCode: 400, message: string[], error: "Bad Request" }`.

#### Scenario: Falta un dato de contacto
- **WHEN** se envía `POST /reservas` sin `telefonoCliente`
- **THEN** el sistema responde `400 Bad Request` con `message` como lista de textos
- **AND** la cantidad de reservas en la base no cambia

#### Scenario: Email inválido
- **WHEN** se envía `emailCliente: "ana.perez"`
- **THEN** el sistema responde `400 Bad Request`

#### Scenario: Nombre en blanco
- **WHEN** se envía `nombreCliente: "   "`
- **THEN** el sistema responde `400 Bad Request`

#### Scenario: Fecha con hora o inexistente
- **WHEN** se envía `fecha: "2026-09-19T20:00:00Z"` o `fecha: "2026-02-30"`
- **THEN** el sistema responde `400 Bad Request` en los dos casos

#### Scenario: Identificador que no es UUID
- **WHEN** se envía `zonaId: "vip"`
- **THEN** el sistema responde `400 Bad Request`

#### Scenario: Comensales no válidos
- **WHEN** se envía `comensales` igual a `0`, a `2.5` o a `"4"`
- **THEN** el sistema responde `400 Bad Request` en los tres casos

### Requirement: Turno o zona inexistentes
El sistema SHALL responder `404 Not Found`, sin persistir nada, cuando `turnoId` o `zonaId`
tienen formato válido pero no corresponden a un turno o a una zona existentes. El cuerpo SHALL
tener la forma `{ statusCode: 404, message: string, error: "Not Found" }`.

#### Scenario: Turno inexistente
- **WHEN** se envía un `turnoId` UUID válido que no existe en la base y el resto del body válido
- **THEN** el sistema responde `404 Not Found`

#### Scenario: Zona inexistente
- **WHEN** se envía un `zonaId` UUID válido que no existe en la base y el resto del body válido
- **THEN** el sistema responde `404 Not Found`
