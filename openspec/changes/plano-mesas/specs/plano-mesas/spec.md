## Purpose
Permite que cualquier persona, sin cuenta, vea el plano del salón de una zona del restaurante
Ichigo con el estado de cada mesa (libre, ocupada o que no alcanza) para una fecha, un turno y
una cantidad de comensales, y lo presenta en el paso 2 de la reserva de forma accesible. Es
informativo: la mesa se sigue asignando de forma automática al confirmar la reserva.

Los escenarios usan los datos del seed: zona STANDARD (mesas S1 y S2 de 2 comensales, S3 de 4,
S4 de 6 y S5 de 8; grilla de 12 por 8), zona VIP (mesas V1 de 2, V2 de 4, V3 de 6 y V4 de 12;
grilla de 10 por 6), aforos 40 (STANDARD), 20 (VIP) y 60 (global), y turnos almuerzo 12:00–15:00
y cena 20:00–23:30 de martes a domingo (los del lunes, inactivos). Las horas son hora local del
restaurante (`America/Argentina/Buenos_Aires`, UTC-3 fijo). Salvo que un escenario diga otra
cosa, no hay reservas activas para el turno y la fecha consultados (las reservas de ejemplo del
seed, entre ellas una `CONFIRMADA` en S3 para la cena del próximo sábado, no cuentan: los
tests parten de una base sin reservas) y el instante actual es 2026-09-15 10:00.

## ADDED Requirements

### Requirement: Consulta pública del plano de mesas
El sistema SHALL exponer `GET /plano-mesas`, accesible sin autenticación, que recibe como query
params obligatorios `fecha`, `turnoId`, `zonaId` y `comensales`, con las mismas validaciones y
los mismos códigos de error que `GET /disponibilidad`: `400` si la consulta está mal formada y
`404` si el turno o la zona no existen. La consulta SHALL ser de solo lectura: no reserva, no
bloquea nada y no modifica datos.

#### Scenario: Visitante sin token consulta el plano
- **WHEN** un visitante sin header `Authorization` consulta `GET /plano-mesas` con
  `fecha=2026-09-19`, el `turnoId` de la cena del sábado, el `zonaId` de STANDARD y
  `comensales=4`
- **THEN** el sistema responde `200 OK` con el plano de la zona STANDARD

#### Scenario: Parámetro mal formado
- **WHEN** se consulta `GET /plano-mesas` con `comensales=0`
- **THEN** el sistema responde `400 Bad Request`

#### Scenario: Zona inexistente
- **WHEN** se consulta `GET /plano-mesas` con un `zonaId` que no corresponde a ninguna zona
- **THEN** el sistema responde `404 Not Found`

#### Scenario: La consulta no modifica datos
- **WHEN** se consulta el plano cinco veces seguidas para la misma combinación
- **THEN** la cantidad de reservas y de mesas en la base es la misma antes y después

### Requirement: Forma de la respuesta del plano
Ante una consulta válida, el sistema SHALL responder `200 OK` con `zona` (nombre de la zona),
`columnas` y `filas` (dimensiones de la grilla del plano de la zona), `disponible`,
`lugaresRestantes` y `motivos` (con el mismo contenido que devolvería `GET /disponibilidad` para
la misma consulta) y `mesas`, una lista con **todas** las mesas de la zona consultada, ordenada
por `etiqueta`. Cada mesa SHALL incluir `etiqueta`, `capacidad`, `forma`, `posX`, `posY`,
`ancho`, `alto` y `estado`. Que no haya lugar para reservar no es un error: la respuesta SHALL
seguir siendo `200`.

#### Scenario: Plano de STANDARD sin reservas
- **WHEN** se consulta la cena del sábado con `fecha=2026-09-19`, zona STANDARD y `comensales=4`
- **THEN** la respuesta trae `zona: "STANDARD"`, `columnas: 12`, `filas: 8`,
  `disponible: true` y `motivos: []`
- **AND** `mesas` contiene exactamente S1, S2, S3, S4 y S5, en ese orden

#### Scenario: El veredicto coincide con el de la consulta de disponibilidad
- **WHEN** se consulta el plano y `GET /disponibilidad` con los mismos cuatro parámetros
- **THEN** `disponible`, `lugaresRestantes` y `motivos` del plano son iguales a los de la
  consulta de disponibilidad

#### Scenario: No hay lugar y aun así responde 200
- **WHEN** se consulta el almuerzo del lunes con `fecha=2026-09-21` (turno inactivo), zona
  STANDARD y `comensales=2`
- **THEN** el sistema responde `200 OK` con `disponible: false` y `motivos` que contiene
  `TURNO_INACTIVO`
- **AND** `mesas` trae las cinco mesas de STANDARD

### Requirement: Estado de cada mesa
El sistema SHALL informar el `estado` de cada mesa de la zona para la fecha, el turno y los
comensales consultados con estos criterios, aplicados en este orden: `OCUPADA` si la mesa tiene
una reserva `PENDIENTE` o `CONFIRMADA` en ese turno y esa fecha; `NO_ALCANZA` si no está
ocupada y su capacidad es menor que `comensales`; `LIBRE` si no está ocupada y su capacidad es
mayor o igual a `comensales`. Una mesa cuya única reserva en ese turno y fecha está `CANCELADA`
o `NO_SHOW` SHALL considerarse no ocupada. Una mesa de otra zona SHALL NOT aparecer.

#### Scenario: Mesa con reserva confirmada
- **WHEN** existe una reserva `CONFIRMADA` de 3 comensales en la mesa S5 para la cena del sábado
  2026-09-19
- **AND** se consulta el plano de ese turno y fecha, zona STANDARD, `comensales=2`
- **THEN** S5 tiene `estado: "OCUPADA"`
- **AND** S1, S2, S3 y S4 tienen `estado: "LIBRE"`

#### Scenario: Mesa con reserva pendiente
- **WHEN** existe una reserva `PENDIENTE` en la mesa V3 para la cena del sábado 2026-09-19
- **AND** se consulta el plano de ese turno y fecha, zona VIP, `comensales=2`
- **THEN** V3 tiene `estado: "OCUPADA"`

#### Scenario: Mesa que no alcanza
- **WHEN** se consulta la cena del sábado con `fecha=2026-09-19`, zona STANDARD y
  `comensales=5`
- **THEN** S1, S2 y S3 tienen `estado: "NO_ALCANZA"`
- **AND** S4 y S5 tienen `estado: "LIBRE"`

#### Scenario: Capacidad exacta es libre
- **WHEN** se consulta la cena del sábado con `fecha=2026-09-19`, zona STANDARD y
  `comensales=4`
- **THEN** S3 (capacidad 4) tiene `estado: "LIBRE"`

#### Scenario: Ocupada tiene precedencia sobre no alcanza
- **WHEN** existe una reserva `CONFIRMADA` en la mesa S1 para la cena del sábado 2026-09-19
- **AND** se consulta el plano de ese turno y fecha, zona STANDARD, `comensales=4`
- **THEN** S1 (capacidad 2) tiene `estado: "OCUPADA"`, no `NO_ALCANZA`

#### Scenario: Reservas canceladas o ausentes liberan la mesa
- **WHEN** la única reserva de la mesa V4 para la cena del sábado 2026-09-19 está `CANCELADA` y
  la única de V3 está `NO_SHOW`
- **AND** se consulta el plano de ese turno y fecha, zona VIP, `comensales=2`
- **THEN** V3 y V4 tienen `estado: "LIBRE"`

#### Scenario: Las reservas de otra fecha, turno o zona no ocupan la mesa
- **WHEN** existe una reserva `CONFIRMADA` en S5 para el almuerzo del sábado 2026-09-19 y otra
  en V4 para la cena del sábado 2026-09-19
- **AND** se consulta el plano de la cena del sábado 2026-09-19, zona STANDARD, `comensales=2`
- **THEN** S5 tiene `estado: "LIBRE"`
- **AND** `mesas` no contiene ninguna mesa VIP

### Requirement: El plano no contradice la reserva real
El sistema SHALL derivar el `estado` de las mesas de la misma consulta de mesas libres y de las
mismas reglas de disponibilidad que usan la consulta de disponibilidad y la creación de
reservas, sin reimplementarlas. Por lo tanto, el plano SHALL contener al menos una mesa `LIBRE`
si y solo si `motivos` no incluye `SIN_MESA_DISPONIBLE`. Cuando `disponible` es `false`, el
sistema SHALL informar los motivos aun si hay mesas `LIBRE`.

#### Scenario: Sin mesa libre que alcance coincide con SIN_MESA_DISPONIBLE
- **WHEN** existe una reserva `CONFIRMADA` de 3 comensales en la mesa STANDARD de 8 para la
  cena del sábado 2026-09-19
- **AND** se consulta el plano de ese turno y fecha, zona STANDARD, `comensales=7`
- **THEN** ninguna mesa tiene `estado: "LIBRE"` (S5 está `OCUPADA` y las demás `NO_ALCANZA`)
- **AND** `motivos` contiene exactamente `SIN_MESA_DISPONIBLE`

#### Scenario: Mesa libre pero aforo superado
- **WHEN** para la cena del sábado 2026-09-19 existen en VIP una reserva `CONFIRMADA` de 12
  comensales en la mesa de 12 y una `PENDIENTE` de 6 comensales en la mesa de 6
- **AND** se consulta el plano de ese turno y fecha, zona VIP, `comensales=4`
- **THEN** V2 (capacidad 4) tiene `estado: "LIBRE"`
- **AND** `disponible` es `false` y `motivos` contiene exactamente `AFORO_ZONA`

#### Scenario: La mesa que asigna la reserva estaba libre en el plano
- **WHEN** se consulta el plano de la cena del sábado 2026-09-19, zona STANDARD,
  `comensales=3`, y después se crea una reserva con esos mismos datos
- **THEN** la mesa asignada a la reserva figuraba con `estado: "LIBRE"` en el plano
- **AND** una nueva consulta del plano muestra esa mesa como `OCUPADA`

#### Scenario: Dos reservas concurrentes sobre la última mesa
- **WHEN** solo S5 está libre y alcanza para `comensales=7`, y dos creaciones de reserva se
  envían a la vez
- **THEN** exactamente una se crea y la otra recibe el rechazo habitual de la creación
- **AND** el plano consultado después muestra S5 como `OCUPADA`

### Requirement: El plano no expone datos de reservas ni de terceros
El sistema SHALL NOT incluir en la respuesta del plano ningún dato de las reservas: ni sus
ids, códigos, nombres, emails o teléfonos, ni la cantidad de comensales, el estado o la fecha de
creación de la reserva que ocupa una mesa, ni el id de la mesa. Cada mesa SHALL exponer
únicamente `etiqueta`, `capacidad`, `forma`, `posX`, `posY`, `ancho`, `alto` y `estado`. Una mesa
ocupada por una reserva `PENDIENTE` y otra ocupada por una `CONFIRMADA` SHALL ser
indistinguibles.

#### Scenario: Ningún dato personal en la respuesta
- **WHEN** existe una reserva `CONFIRMADA` con nombre "Raúl Benítez", email
  "raul@ejemplo.com", teléfono "+54 11 5555-1234" y un código de reserva conocido en la mesa S4
  para la cena del sábado 2026-09-19
- **AND** se consulta el plano de ese turno y fecha, zona STANDARD, `comensales=2`
- **THEN** el cuerpo de la respuesta, serializado, no contiene ninguno de esos cuatro textos ni
  el id de la reserva
- **AND** S4 solo trae las ocho propiedades permitidas

#### Scenario: Pendiente y confirmada se ven igual
- **WHEN** hay una reserva `PENDIENTE` en V3 y una `CONFIRMADA` en V4 para el mismo turno y
  fecha
- **THEN** ambas mesas tienen `estado: "OCUPADA"` y ningún otro valor las diferencia

### Requirement: Mesas sin ubicar en el plano
El sistema SHALL incluir en `mesas` a las mesas de la zona que no tienen posición, con `posX` y
`posY` en `null` y el `estado` calculado igual que para las demás, y SHALL NOT fallar por
ellas. El cliente SHALL mostrarlas en la lista textual con la indicación "sin ubicar" y SHALL
NOT dibujarlas.

#### Scenario: Mesa creada por el admin sin posición
- **WHEN** el admin da de alta la mesa "S6" de 4 comensales en STANDARD sin posición
- **AND** se consulta el plano de la zona STANDARD
- **THEN** `mesas` incluye S6 con `posX: null`, `posY: null` y un `estado` válido

### Requirement: Límite de solicitudes y caché del plano
El sistema SHALL limitar `GET /plano-mesas` a 120 solicitudes por ventana de 60 segundos por
origen y SHALL responder `429 Too Many Requests` al superarlo, sin ejecutar la consulta. La
respuesta del plano SHALL llevar `Cache-Control: no-store`, porque es una foto del momento.

#### Scenario: Solicitudes dentro del límite
- **WHEN** un origen envía 120 consultas de plano en una ventana de 60 segundos
- **THEN** ninguna responde `429`

#### Scenario: La solicitud siguiente al límite se rechaza
- **WHEN** el mismo origen envía una solicitud número 121 en la misma ventana
- **THEN** el sistema responde `429 Too Many Requests`

#### Scenario: Sin caché
- **WHEN** se consulta el plano
- **THEN** la respuesta incluye el header `Cache-Control: no-store`

### Requirement: Plano en el paso 2 de la reserva
El sistema SHALL mostrar, en `/reservas/nueva/resultado`, el plano de la zona elegida con el
estado de sus mesas para la fecha, el turno y los comensales de la selección, debajo del
veredicto de disponibilidad que la pantalla ya presenta. SHALL indicar que el plano es una foto
del momento y que la mesa se asigna automáticamente al confirmar la reserva, y SHALL NOT ofrecer
elegir una mesa. Cuando `disponible` es `false`, SHALL mostrar los motivos antes del plano y
SHALL NOT sugerir que se puede reservar.

#### Scenario: Plano con mesas libres y ocupadas
- **WHEN** la persona llega al resultado con zona STANDARD y 4 comensales, y S5 está ocupada
- **THEN** la pantalla muestra el dibujo del salón y una lista con cada mesa y su estado
- **AND** aclara que la mesa se asigna automáticamente al confirmar

#### Scenario: No hay lugar
- **WHEN** la persona llega al resultado de un turno con `disponible: false`
- **THEN** la pantalla muestra primero los motivos
- **AND** el plano se muestra atenuado con el aviso de que hoy no se puede reservar ese turno

#### Scenario: No se puede elegir mesa
- **WHEN** la persona interactúa con el plano o con la lista
- **THEN** no hay ningún control que seleccione una mesa ni que cambie los datos de la
  reserva

### Requirement: Accesibilidad del plano
El plano SHALL ofrecer una alternativa textual siempre visible: una lista con una entrada por
mesa que dice su etiqueta, su capacidad y su estado en palabras. El estado de cada mesa SHALL
distinguirse sin depender solo del color: cada estado SHALL tener un patrón de relleno, una
marca y un texto propios, y la leyenda SHALL mostrar los tres. El dibujo SHALL ser
transparente para tecnologías de asistencia (`aria-hidden`) porque la lista lo reemplaza; el
plano SHALL incluir un resumen en texto con la cantidad de mesas por estado. Las animaciones y
transiciones SHALL desactivarse con `prefers-reduced-motion: reduce`.

#### Scenario: Lista textual equivalente al dibujo
- **WHEN** se renderiza un plano con S1 `LIBRE`, S2 `OCUPADA` y S3 `NO_ALCANZA`
- **THEN** la lista contiene tres entradas que dicen, en palabras, la etiqueta, la capacidad y
  "Libre", "Ocupada" y "No alcanza" respectivamente

#### Scenario: El estado no depende del color
- **WHEN** se renderiza el dibujo con los tres estados
- **THEN** cada mesa lleva, además de su color, un patrón de relleno distinto, una marca
  distinta y el texto de su estado

#### Scenario: Resumen en texto
- **WHEN** se renderiza un plano con 3 mesas libres, 1 ocupada y 1 que no alcanza
- **THEN** un texto con `role="status"` indica esas tres cantidades

#### Scenario: Movimiento reducido
- **WHEN** el usuario tiene activado `prefers-reduced-motion: reduce`
- **THEN** el plano y su esqueleto de carga no tienen animaciones ni transiciones

### Requirement: Plano usable en celular
El plano SHALL escalar al ancho de la pantalla sin provocar scroll horizontal de la página en
un viewport de 360 px, SHALL mantener legible la etiqueta de cada mesa y SHALL mostrar la lista
textual antes que el dibujo en pantallas angostas.

#### Scenario: Viewport de 360 px
- **WHEN** se muestra el plano de STANDARD (grilla de 12 columnas) en un viewport de 360 px
- **THEN** el ancho del documento no supera el ancho del viewport
- **AND** la lista textual aparece antes que el dibujo

### Requirement: Estados de carga, error y límite del plano
Mientras el plano se pide, el sistema SHALL mostrar un esqueleto con `aria-busy="true"` y un
texto accesible. Si el plano falla por un error de red o `5xx`, SHALL mostrar un mensaje con un
botón para reintentar y SHALL permitir continuar con la reserva. Si responde `429`, SHALL mostrar
un mensaje específico de demasiadas consultas, sin reintento automático. Ningún error del plano
SHALL impedir mostrar el veredicto de disponibilidad ni continuar al paso siguiente.

#### Scenario: Cargando
- **WHEN** el plano todavía no llegó
- **THEN** la pantalla muestra un esqueleto con `aria-busy="true"`

#### Scenario: Error del plano no bloquea la reserva
- **WHEN** el plano responde `500` y la disponibilidad responde `disponible: true`
- **THEN** la pantalla muestra el mensaje de error del plano con un botón "Reintentar"
- **AND** la acción para continuar con la reserva sigue disponible

#### Scenario: Demasiadas consultas
- **WHEN** el plano responde `429`
- **THEN** la pantalla muestra un mensaje que pide probar de nuevo en un minuto
- **AND** no se reintenta automáticamente
