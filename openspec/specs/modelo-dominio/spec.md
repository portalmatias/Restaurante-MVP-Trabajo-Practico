# modelo-dominio Specification

## Purpose
Define las entidades del dominio de reservas (Usuario, Zona, Mesa, Turno, Reserva,
Configuración), el enum de estados de una reserva y las cinco garantías de negocio que
ninguna operación del sistema puede violar. Es la base de datos y de comportamiento sobre la
que se apoyan el resto de las capabilities (auth, gestión de salón, disponibilidad, reservas).

## Requirements

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
más un código de reserva alfanumérico de 8 caracteres, único, generado al crearse. La Reserva
SHALL poder llevar además una nota del cliente, opcional, de hasta 500 caracteres; una Reserva
sin nota la tiene vacía (`null`), y las Reservas existentes antes de este cambio quedan sin nota.

#### Scenario: Código de reserva único
- **WHEN** el sistema genera el código de una nueva Reserva
- **THEN** garantiza que ese código no coincide con el de ninguna otra Reserva existente

#### Scenario: Reservas anteriores sin nota
- **WHEN** se aplica la migración que agrega la nota a una base con Reservas existentes
- **THEN** esas Reservas quedan con la nota en `null` y el resto de sus datos sin cambios

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

### Requirement: Invariante — turno coincide con el día de la semana de la reserva
El sistema SHALL exigir que el día de la semana de la fecha de una Reserva coincida con el
`diaSemana` del `Turno` seleccionado. Una reserva para un lunes no puede usar un turno de
martes, ni viceversa.

#### Scenario: Reserva con fecha en día distinto al del turno rechazada
- **WHEN** se intenta crear una Reserva con `fecha` que cae en lunes
- **AND** el `Turno` seleccionado tiene `diaSemana = MARTES`
- **THEN** el sistema rechaza la Reserva

### Requirement: Invariante — aforo de zona respetado
El sistema SHALL impedir que la suma de comensales de las Reservas activas de un Turno supere
el aforo configurado de la Zona correspondiente, incluso si existe una Mesa físicamente
libre.

#### Scenario: Reserva que excede el aforo restante rechazada
- **WHEN** el aforo restante de una Zona para un Turno y una fecha es menor a los comensales
  solicitados
- **THEN** el sistema rechaza la nueva Reserva aunque haya una Mesa disponible

### Requirement: Invariante — aforo global respetado
El sistema SHALL impedir que la suma de comensales de las Reservas activas de un Turno y una
fecha, sumando **todas** las Zonas, supere el `aforoGlobal` configurado en
`ConfiguracionNegocio`, incluso si el aforo de cada Zona individual todavía no se superó.

#### Scenario: Reserva que excede el aforo global rechazada aunque el aforo de su Zona alcance
- **WHEN** la suma de comensales activos de todas las Zonas para un Turno y una fecha, más los
  comensales solicitados, supera el `aforoGlobal` configurado
- **AND** el aforo restante de la Zona solicitada individualmente todavía alcanzaría
- **THEN** el sistema rechaza la nueva Reserva

### Requirement: Invariante — estados terminales no retroceden
El sistema SHALL impedir que una Reserva en estado `CANCELADA` o `NO_SHOW` transicione a
cualquier otro estado.

#### Scenario: Reserva cancelada no puede reactivarse
- **WHEN** una Reserva está en estado `CANCELADA`
- **AND** se intenta transicionarla a `CONFIRMADA` o `PENDIENTE`
- **THEN** el sistema rechaza la transición

### Requirement: Posición y forma de la Mesa en el plano
La entidad Mesa SHALL tener `posX` y `posY` opcionales (esquina superior izquierda en una grilla
lógica, base 0, en celdas), `ancho` y `alto` enteros mayores o iguales a 1 con valor por defecto
1, y `forma` con valores `REDONDA`, `CUADRADA` o `RECTANGULAR` con valor por defecto
`RECTANGULAR`. `posX` y `posY` SHALL ser ambos nulos o ambos no nulos, y no negativos. Una Mesa
sin posición SHALL seguir siendo una Mesa válida para la asignación y la disponibilidad. Agregar
estas columnas SHALL NOT alterar los datos existentes.

#### Scenario: Mesa existente conserva sus datos tras la migración
- **WHEN** se aplica la migración sobre una base con mesas y reservas cargadas
- **THEN** todas las mesas conservan `id`, `zonaId`, `capacidad` y `etiqueta`, todas las reservas
  conservan su `mesaId`
- **AND** las mesas tienen `posX` y `posY` nulos, `ancho` y `alto` en 1 y `forma` en
  `RECTANGULAR`

#### Scenario: Posición a medias rechazada
- **WHEN** se intenta guardar una mesa con `posX` igual a 2 y `posY` nulo
- **THEN** la base rechaza la escritura

#### Scenario: Posición negativa rechazada
- **WHEN** se intenta guardar una mesa con `posX` igual a -1
- **THEN** la base rechaza la escritura

#### Scenario: Mesa sin posición sigue siendo asignable
- **WHEN** una mesa no tiene posición y es la única libre de capacidad suficiente
- **THEN** la consulta de disponibilidad y la creación de reservas la consideran igual que a
  una mesa con posición

### Requirement: Dimensiones del plano de la Zona
La entidad Zona SHALL tener `planoColumnas` y `planoFilas`, enteros mayores o iguales a 1, con
valores por defecto 12 y 8, que definen el tamaño de la grilla de su plano.

#### Scenario: Valores por defecto
- **WHEN** se crea una zona sin indicar las dimensiones del plano
- **THEN** `planoColumnas` es 12 y `planoFilas` es 8

#### Scenario: Dimensión inválida rechazada
- **WHEN** se intenta guardar una zona con `planoColumnas` igual a 0
- **THEN** la base rechaza la escritura

### Requirement: Layout inicial del seed
El seed SHALL ubicar todas las mesas de ambas zonas dentro de la grilla de su zona, sin
solaparse entre sí. Para STANDARD (12 por 8): S1 en (0,0) redonda 1 por 1, S2 en (2,0) redonda
1 por 1, S3 en (5,0) cuadrada 2 por 2, S4 en (0,3) rectangular 3 por 2 y S5 en (5,3)
rectangular 4 por 2. Para VIP (10 por 6): V1 en (0,0) redonda 1 por 1, V2 en (3,0) cuadrada 2
por 2, V3 en (0,3) rectangular 3 por 2 y V4 en (4,3) rectangular 6 por 2. El seed SHALL seguir
siendo idempotente.

#### Scenario: Todas las mesas del seed entran en su grilla
- **WHEN** se corre el seed sobre una base vacía
- **THEN** para cada mesa, `posX + ancho` es menor o igual a `planoColumnas` de su zona y
  `posY + alto` es menor o igual a `planoFilas`

#### Scenario: Ningún solapamiento
- **WHEN** se corre el seed
- **THEN** no hay dos mesas de la misma zona cuyas celdas se superpongan

#### Scenario: Seed idempotente con posiciones
- **WHEN** se corre el seed dos veces seguidas
- **THEN** la cantidad de mesas no cambia y cada mesa conserva la misma posición, tamaño y
  forma
