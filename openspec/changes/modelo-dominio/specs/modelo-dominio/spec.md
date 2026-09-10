## Purpose

Define las entidades del dominio de reservas (Usuario, Zona, Mesa, Turno, Reserva,
Configuración), el enum de estados de una reserva y las cinco garantías de negocio que
ninguna operación del sistema puede violar. Es la base de datos y de comportamiento sobre la
que se apoyan el resto de las capabilities (auth, gestión de salón, disponibilidad, reservas).

## ADDED Requirements

### Requirement: Entidad Usuario (administrador)
El sistema SHALL modelar un Usuario administrador identificado por un email único, con la
contraseña almacenada únicamente como hash (nunca en texto plano ni de forma reversible), y
un rol. `ADMIN` es el único valor de rol implementado en el MVP.

#### Scenario: Email duplicado rechazado
- **WHEN** se intenta crear un Usuario con un email que ya pertenece a otro Usuario
- **THEN** el sistema rechaza la operación sin crear un segundo registro

### Requirement: Entidad Zona con reglas configurables
El sistema SHALL modelar una Zona (`STANDARD` o `VIP`) con: rango de comensales por reserva
(mínimo y máximo), anticipación mínima y máxima para reservar, ventana mínima de cancelación,
si requiere confirmación del admin, y su aforo máximo. Estos valores SHALL vivir como datos
de configuración (seed o tabla), nunca como constantes en el código fuente.

#### Scenario: Los límites de zona se leen de datos, no de código
- **WHEN** se consulta una Zona persistida con `minComensales=2` y `maxComensales=12`
- **THEN** el sistema devuelve exactamente esos valores, sin que un valor por defecto en el
  código los sobrescriba

### Requirement: Entidad Mesa
El sistema SHALL modelar una Mesa que pertenece a exactamente una Zona y tiene una capacidad
fija de comensales.

#### Scenario: Mesa sin zona rechazada
- **WHEN** se intenta crear una Mesa sin una Zona asociada
- **THEN** el sistema rechaza la operación

### Requirement: Entidad Turno
El sistema SHALL modelar un Turno con día de la semana, hora de inicio, hora de fin y un
indicador de si está activo. Un Turno inactivo no admite Reservas.

#### Scenario: Turno inactivo no admite reservas
- **WHEN** un Turno tiene `activo = false`
- **THEN** el sistema rechaza cualquier intento de crear una Reserva sobre ese Turno

### Requirement: Entidad Reserva y datos de contacto sin cuenta
El sistema SHALL modelar una Reserva con: Mesa asignada, Turno, fecha, cantidad de
comensales, estado, y los datos de contacto del cliente sin cuenta (nombre, email, teléfono),
más un código de reserva alfanumérico de 8 caracteres, único, generado al crearse.

#### Scenario: Código de reserva único
- **WHEN** el sistema genera el código de una nueva Reserva
- **THEN** garantiza que ese código no coincide con el de ninguna otra Reserva existente

### Requirement: Enum EstadoReserva y transiciones válidas
El sistema SHALL restringir el estado de una Reserva a `PENDIENTE`, `CONFIRMADA`, `CANCELADA`
o `NO_SHOW`, y SHALL aceptar únicamente las transiciones: `PENDIENTE → CONFIRMADA`,
`PENDIENTE → CANCELADA`, `CONFIRMADA → CANCELADA` y `CONFIRMADA → NO_SHOW`. Cualquier otra
transición SHALL ser rechazada.

#### Scenario: Transición no listada rechazada
- **WHEN** se intenta transicionar una Reserva de `CANCELADA` a `CONFIRMADA`
- **THEN** el sistema rechaza la transición

### Requirement: Aforo global configurable
El sistema SHALL modelar un aforo máximo global de comensales simultáneos, independiente del
aforo por Zona, como dato de configuración versionable (seed o tabla), no como constante en
el código.

#### Scenario: El aforo global es un dato, no una constante
- **WHEN** se consulta el aforo global configurado
- **THEN** el sistema devuelve el valor persistido, no un número fijo embebido en el código

### Requirement: Invariante — exclusividad de mesa por turno y fecha
El sistema SHALL impedir que dos Reservas activas (`PENDIENTE` o `CONFIRMADA`) compartan la
misma Mesa, el mismo Turno y la misma fecha.

#### Scenario: Doble reserva sobre la misma mesa rechazada
- **WHEN** existe una Reserva activa para una Mesa, un Turno y una fecha determinados
- **AND** se intenta crear otra Reserva activa para esa misma combinación de Mesa, Turno y
  fecha
- **THEN** el sistema rechaza la segunda Reserva

### Requirement: Invariante — capacidad de mesa no excedida
El sistema SHALL impedir que la cantidad de comensales de una Reserva supere la capacidad de
la Mesa asignada.

#### Scenario: Comensales por encima de la capacidad rechazados
- **WHEN** una Mesa tiene una capacidad determinada
- **AND** se intenta crear una Reserva con más comensales que esa capacidad para esa Mesa
- **THEN** el sistema rechaza la Reserva

### Requirement: Invariante — turno activo y mesa de la zona solicitada
El sistema SHALL exigir que toda Reserva apunte a un Turno activo y a una Mesa que pertenezca
a la Zona solicitada.

#### Scenario: Reserva sobre turno inactivo rechazada
- **WHEN** un Turno tiene `activo = false`
- **AND** se intenta crear una Reserva para ese Turno
- **THEN** el sistema rechaza la Reserva

#### Scenario: Mesa de otra zona rechazada
- **WHEN** se solicita una Reserva para la Zona VIP
- **AND** la Mesa elegida pertenece a la Zona STANDARD
- **THEN** el sistema rechaza la Reserva

### Requirement: Invariante — aforo de zona respetado
El sistema SHALL impedir que la suma de comensales de las Reservas activas de un Turno supere
el aforo configurado de la Zona correspondiente, incluso si existe una Mesa físicamente
libre.

#### Scenario: Reserva que excede el aforo restante rechazada
- **WHEN** el aforo restante de una Zona para un Turno y una fecha es menor a los comensales
  solicitados
- **THEN** el sistema rechaza la nueva Reserva aunque haya una Mesa disponible

### Requirement: Invariante — estados terminales no retroceden
El sistema SHALL impedir que una Reserva en estado `CANCELADA` o `NO_SHOW` transicione a
cualquier otro estado.

#### Scenario: Reserva cancelada no puede reactivarse
- **WHEN** una Reserva está en estado `CANCELADA`
- **AND** se intenta transicionarla a `CONFIRMADA` o `PENDIENTE`
- **THEN** el sistema rechaza la transición
