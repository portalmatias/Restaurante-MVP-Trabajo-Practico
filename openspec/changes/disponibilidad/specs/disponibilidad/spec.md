## Purpose

Permite que cualquier persona, sin cuenta, consulte si hay lugar para una cantidad de
comensales en una fecha, un turno y una zona, y por qué no lo hay. Define además las reglas
de disponibilidad que la creación de reservas tiene que evaluar igual que la consulta.

Los escenarios usan los datos del seed de `modelo-dominio`: zona STANDARD (1 a 8 comensales,
anticipación de 2 horas a 30 días, aforo 40, mesas de capacidad 2, 2, 4, 6 y 8), zona VIP
(2 a 12 comensales, anticipación de 24 horas a 60 días, aforo 20, mesas de capacidad 2, 4, 6
y 12), aforo global 60, turnos almuerzo 12:00–15:00 y cena 20:00–23:30 de martes a domingo
y turnos del lunes inactivos. Las horas son hora local del restaurante
(`America/Argentina/Buenos_Aires`, UTC-3). Salvo que un escenario diga otra cosa, no hay
reservas activas para el turno y la fecha consultados.

## ADDED Requirements

### Requirement: Consulta pública de disponibilidad
El sistema SHALL exponer `GET /disponibilidad`, accesible sin autenticación, que recibe como
query params obligatorios `fecha`, `turnoId`, `zonaId` y `comensales`, y evalúa una única
combinación de esos cuatro valores.

#### Scenario: Visitante sin token consulta disponibilidad
- **WHEN** un visitante sin header `Authorization` consulta `GET /disponibilidad` con
  `fecha=2026-09-19`, el `turnoId` de la cena del sábado, el `zonaId` de STANDARD y
  `comensales=4`
- **AND** el instante actual es 2026-09-15 10:00
- **THEN** el sistema responde `200 OK` con el resultado de la evaluación

### Requirement: Forma de la respuesta de disponibilidad
Ante una consulta válida, el sistema SHALL responder `200 OK` haya lugar o no, con un cuerpo
que contiene `disponible` (booleano), `lugaresRestantes` (entero mayor o igual a 0, medido en
comensales) y `motivos` (lista de objetos con `codigo` y `mensaje`). `disponible` SHALL ser
`true` si y solo si `motivos` está vacía. `codigo` SHALL ser uno de `TURNO_INACTIVO`,
`TURNO_NO_CORRESPONDE_A_FECHA`, `ANTICIPACION_MINIMA`, `ANTICIPACION_MAXIMA`,
`COMENSALES_FUERA_DE_RANGO`, `AFORO_ZONA`, `AFORO_GLOBAL` o `SIN_MESA_DISPONIBLE`, y
`mensaje` SHALL ser un texto en español para personas. La consulta SHALL NOT responder
`409` ni `422`.

#### Scenario: Hay lugar
- **WHEN** se consulta la cena del sábado con `fecha=2026-09-19`, zona STANDARD y
  `comensales=4`
- **AND** el instante actual es 2026-09-15 10:00
- **THEN** el sistema responde `200 OK` con `disponible: true`, `lugaresRestantes: 40` y
  `motivos: []`

#### Scenario: No hay lugar y aun así responde 200
- **WHEN** se consulta el almuerzo del lunes con `fecha=2026-09-21`, zona STANDARD y
  `comensales=4`
- **AND** el instante actual es 2026-09-15 10:00
- **THEN** el sistema responde `200 OK`, no `409`
- **AND** el cuerpo trae `disponible: false` y `motivos` con un único elemento cuyo `codigo`
  es `TURNO_INACTIVO` y cuyo `mensaje` es un texto no vacío

### Requirement: Regla de turno activo
El sistema SHALL informar el motivo `TURNO_INACTIVO` cuando el turno consultado tiene
`activo = false`.

#### Scenario: Turno del lunes inactivo
- **WHEN** se consulta el almuerzo del lunes con `fecha=2026-09-21` (lunes), zona STANDARD y
  `comensales=2`
- **AND** el instante actual es 2026-09-15 10:00
- **THEN** `motivos` contiene exactamente `TURNO_INACTIVO`

### Requirement: Regla de correspondencia entre turno y fecha
El sistema SHALL informar el motivo `TURNO_NO_CORRESPONDE_A_FECHA` cuando el día de la semana
de `fecha`, tomado del calendario local del restaurante, es distinto del día de la semana del
turno.

#### Scenario: Turno de otro día de la semana
- **WHEN** se consulta la cena del martes con `fecha=2026-09-16` (miércoles), zona STANDARD y
  `comensales=2`
- **AND** el instante actual es 2026-09-15 10:00
- **THEN** `motivos` contiene exactamente `TURNO_NO_CORRESPONDE_A_FECHA`

#### Scenario: Turno del mismo día de la semana
- **WHEN** se consulta la cena del miércoles con `fecha=2026-09-16` (miércoles), zona
  STANDARD y `comensales=2`
- **AND** el instante actual es 2026-09-15 10:00
- **THEN** `motivos` no contiene `TURNO_NO_CORRESPONDE_A_FECHA`

### Requirement: Regla de anticipación mínima
El sistema SHALL informar el motivo `ANTICIPACION_MINIMA` cuando el tiempo entre el instante
actual y el inicio del turno en esa fecha es menor que la anticipación mínima de la zona. Un
tiempo exactamente igual a la anticipación mínima SHALL estar permitido. Un turno cuyo inicio
ya pasó SHALL informar este motivo, lo que cubre la prohibición de reservar en el pasado
(RN-06).

#### Scenario: Exactamente la anticipación mínima está permitida
- **WHEN** se consulta el almuerzo del martes con `fecha=2026-09-15`, zona STANDARD y
  `comensales=2`
- **AND** el instante actual es 2026-09-15 10:00 (exactamente 2 horas antes de las 12:00)
- **THEN** `motivos` no contiene `ANTICIPACION_MINIMA`

#### Scenario: Un minuto menos que la anticipación mínima
- **WHEN** se consulta el almuerzo del martes con `fecha=2026-09-15`, zona STANDARD y
  `comensales=2`
- **AND** el instante actual es 2026-09-15 10:01 (1 hora 59 minutos antes)
- **THEN** `motivos` contiene exactamente `ANTICIPACION_MINIMA`

#### Scenario: Anticipación mínima de la zona VIP
- **WHEN** se consulta la cena del miércoles con `fecha=2026-09-16`, zona VIP y
  `comensales=2`
- **AND** el instante actual es 2026-09-15 20:01 (23 horas 59 minutos antes)
- **THEN** `motivos` contiene exactamente `ANTICIPACION_MINIMA`

#### Scenario: Fecha pasada
- **WHEN** se consulta el almuerzo del martes con `fecha=2026-09-08`, zona STANDARD y
  `comensales=2`
- **AND** el instante actual es 2026-09-15 10:00
- **THEN** `motivos` contiene exactamente `ANTICIPACION_MINIMA`
- **AND** `motivos` no contiene `ANTICIPACION_MAXIMA`

### Requirement: Regla de anticipación máxima
El sistema SHALL informar el motivo `ANTICIPACION_MAXIMA` cuando el tiempo entre el instante
actual y el inicio del turno en esa fecha es mayor que la anticipación máxima de la zona,
medida en días de 24 horas. Un tiempo exactamente igual a la anticipación máxima SHALL estar
permitido.

#### Scenario: Exactamente 30 días en STANDARD está permitido
- **WHEN** se consulta el almuerzo del jueves con `fecha=2026-10-15`, zona STANDARD y
  `comensales=2`
- **AND** el instante actual es 2026-09-15 12:00 (exactamente 30 días antes)
- **THEN** `motivos` no contiene `ANTICIPACION_MAXIMA`

#### Scenario: Un minuto más que 30 días en STANDARD
- **WHEN** se consulta el almuerzo del jueves con `fecha=2026-10-15`, zona STANDARD y
  `comensales=2`
- **AND** el instante actual es 2026-09-15 11:59
- **THEN** `motivos` contiene exactamente `ANTICIPACION_MAXIMA`

#### Scenario: Exactamente 60 días en VIP está permitido
- **WHEN** se consulta la cena del sábado con `fecha=2026-11-14`, zona VIP y `comensales=2`
- **AND** el instante actual es 2026-09-15 20:00 (exactamente 60 días antes)
- **THEN** `motivos` no contiene `ANTICIPACION_MAXIMA`

### Requirement: Regla de rango de comensales por zona
El sistema SHALL informar el motivo `COMENSALES_FUERA_DE_RANGO` cuando `comensales` es menor
que el mínimo o mayor que el máximo de la zona. El mínimo y el máximo exactos SHALL estar
permitidos.

#### Scenario: Bordes exactos de STANDARD permitidos
- **WHEN** se consulta la cena del sábado con `fecha=2026-09-19` y zona STANDARD, una vez con
  `comensales=1` y otra con `comensales=8`
- **AND** el instante actual es 2026-09-15 10:00
- **THEN** ambas respuestas traen `disponible: true`

#### Scenario: Bordes exactos de VIP permitidos
- **WHEN** se consulta la cena del sábado con `fecha=2026-09-19` y zona VIP, una vez con
  `comensales=2` y otra con `comensales=12`
- **AND** el instante actual es 2026-09-15 10:00
- **THEN** ambas respuestas traen `disponible: true`

#### Scenario: Debajo del mínimo VIP
- **WHEN** se consulta la cena del sábado con `fecha=2026-09-19`, zona VIP y `comensales=1`
- **AND** el instante actual es 2026-09-15 10:00
- **THEN** `motivos` contiene exactamente `COMENSALES_FUERA_DE_RANGO`

#### Scenario: Encima del máximo STANDARD
- **WHEN** se consulta la cena del sábado con `fecha=2026-09-19`, zona STANDARD y
  `comensales=9`
- **AND** el instante actual es 2026-09-15 10:00
- **THEN** `motivos` contiene, en este orden, `COMENSALES_FUERA_DE_RANGO` y
  `SIN_MESA_DISPONIBLE` (ninguna mesa STANDARD tiene capacidad para 9)

### Requirement: Regla de aforo de zona
El sistema SHALL informar el motivo `AFORO_ZONA` cuando la suma de comensales de las reservas
`PENDIENTE` o `CONFIRMADA` de la zona para ese turno y esa fecha, más los comensales
solicitados, supera el aforo máximo de la zona. Llenar el aforo exacto SHALL estar
permitido.

#### Scenario: Llenar exacto el aforo de zona está permitido
- **WHEN** para la cena del sábado 2026-09-19 existen en VIP una reserva `CONFIRMADA` de 12
  comensales en la mesa de 12 y una `PENDIENTE` de 6 comensales en la mesa de 6
- **AND** se consulta ese turno y esa fecha en zona VIP con `comensales=2`, con el instante
  actual 2026-09-15 10:00
- **THEN** la respuesta trae `disponible: true` y `lugaresRestantes: 2`

#### Scenario: Superar el aforo de zona con mesa libre
- **WHEN** para la cena del sábado 2026-09-19 existen en VIP una reserva `CONFIRMADA` de 12
  comensales en la mesa de 12 y una `PENDIENTE` de 6 comensales en la mesa de 6
- **AND** se consulta ese turno y esa fecha en zona VIP con `comensales=4`, con el instante
  actual 2026-09-15 10:00
- **THEN** `motivos` contiene exactamente `AFORO_ZONA`, aunque la mesa VIP de 4 está libre
- **AND** `lugaresRestantes` es 2

### Requirement: Regla de aforo global
El sistema SHALL informar el motivo `AFORO_GLOBAL` cuando la suma de comensales de las
reservas `PENDIENTE` o `CONFIRMADA` de todas las zonas para ese turno y esa fecha, más los
comensales solicitados, supera el aforo global. Llenar el aforo global exacto SHALL estar
permitido.

#### Scenario: Llenar exacto el aforo global está permitido
- **WHEN** el aforo global está configurado en 30 (con las mesas del seed, que suman 46
  lugares, un aforo global de 60 no se puede alcanzar)
- **AND** para la cena del sábado 2026-09-19 existen reservas activas de 12 y 6 comensales en
  VIP y de 8 comensales en la mesa STANDARD de 8
- **AND** se consulta ese turno y esa fecha en zona STANDARD con `comensales=4`, con el
  instante actual 2026-09-15 10:00
- **THEN** la respuesta trae `disponible: true` y `lugaresRestantes: 4`

#### Scenario: Superar el aforo global con lugar en la zona
- **WHEN** el aforo global está configurado en 30
- **AND** para la cena del sábado 2026-09-19 existen reservas activas de 12 y 6 comensales en
  VIP y de 8 comensales en la mesa STANDARD de 8
- **AND** se consulta ese turno y esa fecha en zona STANDARD con `comensales=6`, con el
  instante actual 2026-09-15 10:00
- **THEN** `motivos` contiene exactamente `AFORO_GLOBAL`, aunque a la zona STANDARD le quedan
  32 lugares y la mesa de 6 está libre
- **AND** `lugaresRestantes` es 4

### Requirement: Regla de mesa disponible
El sistema SHALL informar el motivo `SIN_MESA_DISPONIBLE` cuando ninguna mesa de la zona
consultada tiene capacidad mayor o igual a `comensales` y está libre de reservas `PENDIENTE`
o `CONFIRMADA` para ese turno y esa fecha. No se combinan mesas. Una mesa cuya única reserva
para ese turno y fecha está `CANCELADA` o `NO_SHOW` SHALL considerarse libre.

#### Scenario: Aforo con lugar pero sin mesa que alcance
- **WHEN** para la cena del sábado 2026-09-19 existe una reserva `CONFIRMADA` de 3 comensales
  en la mesa STANDARD de 8
- **AND** se consulta ese turno y esa fecha en zona STANDARD con `comensales=7`, con el
  instante actual 2026-09-15 10:00
- **THEN** `motivos` contiene exactamente `SIN_MESA_DISPONIBLE`
- **AND** `lugaresRestantes` es 37

#### Scenario: Mesa con reserva cancelada vuelve a estar libre
- **WHEN** para la cena del sábado 2026-09-19 la única reserva de la mesa VIP de 12 está
  `CANCELADA`
- **AND** se consulta ese turno y esa fecha en zona VIP con `comensales=12`, con el instante
  actual 2026-09-15 10:00
- **THEN** la respuesta trae `disponible: true`

### Requirement: Evaluación de todas las reglas en orden fijo
El sistema SHALL evaluar siempre las ocho reglas, sin detenerse en la primera que falla, e
informar en `motivos` todas las que fallan en este orden fijo: `TURNO_INACTIVO`,
`TURNO_NO_CORRESPONDE_A_FECHA`, `ANTICIPACION_MINIMA`, `ANTICIPACION_MAXIMA`,
`COMENSALES_FUERA_DE_RANGO`, `AFORO_ZONA`, `AFORO_GLOBAL`, `SIN_MESA_DISPONIBLE`.

#### Scenario: Varios motivos a la vez
- **WHEN** se consulta la cena del lunes (inactiva) con `fecha=2026-09-22` (martes), zona VIP
  y `comensales=1`
- **AND** el instante actual es 2026-09-22 19:00
- **THEN** `motivos` contiene exactamente, en este orden, `TURNO_INACTIVO`,
  `TURNO_NO_CORRESPONDE_A_FECHA`, `ANTICIPACION_MINIMA` y `COMENSALES_FUERA_DE_RANGO`
- **AND** `disponible` es `false`

### Requirement: Cálculo de lugares restantes
El sistema SHALL calcular `lugaresRestantes` como el menor valor entre lo que le queda a la
zona (aforo de la zona menos los comensales activos de la zona) y lo que le queda al salón
(aforo global menos los comensales activos de todas las zonas), para ese turno y esa fecha,
sin restar los comensales solicitados. Solo cuentan las reservas `PENDIENTE` y `CONFIRMADA`.
Si el cálculo da negativo, SHALL devolver 0.

#### Scenario: Lugares restantes no descuenta lo solicitado
- **WHEN** no hay reservas activas para la cena del sábado 2026-09-19
- **AND** se consulta ese turno y esa fecha en zona VIP con `comensales=12`, con el instante
  actual 2026-09-15 10:00
- **THEN** `lugaresRestantes` es 20, no 8

#### Scenario: Reservas canceladas y ausentes no cuentan
- **WHEN** para la cena del sábado 2026-09-19 existen en VIP una reserva `CANCELADA` de 12
  comensales y una `NO_SHOW` de 6 comensales
- **AND** se consulta ese turno y esa fecha en zona VIP con `comensales=2`, con el instante
  actual 2026-09-15 10:00
- **THEN** `lugaresRestantes` es 20

#### Scenario: Nunca negativo si el aforo quedó por debajo de lo ocupado
- **WHEN** para la cena del sábado 2026-09-19 existen en VIP una reserva `CONFIRMADA` de 12
  comensales en la mesa de 12 y otra de 6 comensales en la mesa de 6
- **AND** después el aforo de la zona VIP se configura en 10
- **AND** se consulta ese turno y esa fecha en zona VIP con `comensales=2`, con el instante
  actual 2026-09-15 10:00
- **THEN** `lugaresRestantes` es 0
- **AND** `motivos` contiene exactamente `AFORO_ZONA`

### Requirement: Fecha de calendario y zona horaria del restaurante
El sistema SHALL interpretar `fecha` como una fecha de calendario local del restaurante, y el
inicio del turno como esa fecha más la hora de inicio del turno en la zona horaria
configurada del restaurante. El día de la semana y las reservas que cuentan para la ocupación
SHALL tomarse de esa fecha local, nunca de la fecha UTC del inicio o del fin del turno. El
resultado SHALL ser el mismo sin importar la zona horaria del proceso del servidor.

#### Scenario: Cena que termina al día siguiente en UTC
- **WHEN** se consulta la cena del sábado (20:00–23:30 hora local, es decir
  2026-09-19T23:00Z a 2026-09-20T02:30Z) con `fecha=2026-09-19`, zona STANDARD y
  `comensales=2`
- **AND** existe una reserva activa de 4 comensales para ese turno con fecha 2026-09-19 y
  ninguna con fecha 2026-09-20
- **AND** el instante actual es 2026-09-15 10:00
- **THEN** `motivos` no contiene `TURNO_NO_CORRESPONDE_A_FECHA`
- **AND** `lugaresRestantes` es 36

#### Scenario: La fecha UTC del fin del turno no es la fecha del turno
- **WHEN** se consulta la cena del sábado con `fecha=2026-09-20` (domingo), zona STANDARD y
  `comensales=2`
- **AND** el instante actual es 2026-09-15 10:00
- **THEN** `motivos` contiene exactamente `TURNO_NO_CORRESPONDE_A_FECHA`

#### Scenario: La anticipación se mide contra la hora local del turno
- **WHEN** se consulta la cena del sábado con `fecha=2026-09-19`, zona STANDARD y
  `comensales=2`
- **AND** el instante actual es 2026-09-19 18:00 hora local (2026-09-19T21:00Z)
- **THEN** `motivos` no contiene `ANTICIPACION_MINIMA`, porque el turno empieza a las
  2026-09-19T23:00Z, exactamente 2 horas después

#### Scenario: Instante actual que en UTC ya es el día siguiente
- **WHEN** se consulta la cena del sábado con `fecha=2026-09-19`, zona STANDARD y
  `comensales=2`
- **AND** el instante actual es 2026-09-19 22:00 hora local (2026-09-20T01:00Z)
- **THEN** `motivos` contiene exactamente `ANTICIPACION_MINIMA`

#### Scenario: Mismo resultado con el servidor en UTC o en Buenos Aires
- **WHEN** se hace la misma consulta de la cena del sábado con `fecha=2026-09-19`, con el
  proceso del servidor corriendo una vez con zona horaria UTC y otra con
  `America/Argentina/Buenos_Aires`
- **THEN** las dos respuestas son idénticas

### Requirement: Validación de la consulta
El sistema SHALL responder `400 Bad Request`, sin evaluar reglas, cuando falta alguno de los
cuatro query params, cuando `fecha` no tiene el formato `YYYY-MM-DD` o no es una fecha de
calendario válida (incluido un valor con hora), cuando `turnoId` o `zonaId` no son UUID, o
cuando `comensales` no es un entero mayor o igual a 1. El cuerpo SHALL tener la forma
`{ statusCode: 400, message: string[], error: "Bad Request" }`.

#### Scenario: Falta un parámetro
- **WHEN** se consulta `GET /disponibilidad` sin `zonaId`
- **THEN** el sistema responde `400 Bad Request` con `message` como lista de textos

#### Scenario: Fecha con hora
- **WHEN** se consulta con `fecha=2026-09-19T20:00:00Z`
- **THEN** el sistema responde `400 Bad Request`

#### Scenario: Fecha de calendario inexistente
- **WHEN** se consulta con `fecha=2026-02-30`
- **THEN** el sistema responde `400 Bad Request`

#### Scenario: Identificador que no es UUID
- **WHEN** se consulta con `turnoId=abc`
- **THEN** el sistema responde `400 Bad Request`

#### Scenario: Comensales no válidos
- **WHEN** se consulta con `comensales=0`, con `comensales=2.5` o con `comensales=dos`
- **THEN** el sistema responde `400 Bad Request` en los tres casos

### Requirement: Turno o zona inexistentes
El sistema SHALL responder `404 Not Found` cuando `turnoId` o `zonaId` tienen formato válido
pero no corresponden a un turno o a una zona existentes. El cuerpo SHALL tener la forma
`{ statusCode: 404, message: string, error: "Not Found" }`.

#### Scenario: Turno inexistente
- **WHEN** se consulta con un `turnoId` UUID válido que no existe en la base y el resto de los
  parámetros válidos
- **THEN** el sistema responde `404 Not Found`

#### Scenario: Zona inexistente
- **WHEN** se consulta con un `zonaId` UUID válido que no existe en la base y el resto de los
  parámetros válidos
- **THEN** el sistema responde `404 Not Found`

### Requirement: La consulta no reserva ni bloquea
El sistema SHALL resolver la consulta de disponibilidad sin crear, modificar ni retener
reservas, mesas o cupo. El resultado SHALL reflejar el estado del momento de la consulta.

#### Scenario: Consultar no crea reservas
- **WHEN** se consulta disponibilidad con un resultado `disponible: true`
- **THEN** la cantidad de reservas en la base es la misma antes y después de la consulta

#### Scenario: Una consulta disponible no reserva el lugar
- **WHEN** para la cena del sábado 2026-09-19 existen en VIP reservas `CONFIRMADA` de 12
  comensales en la mesa de 12 y de 6 comensales en la mesa de 6
- **AND** una consulta de ese turno y esa fecha en VIP con `comensales=2`, con el instante
  actual 2026-09-15 10:00, devuelve `disponible: true` y `lugaresRestantes: 2`
- **AND** después se crea otra reserva `CONFIRMADA` de 2 comensales en la mesa VIP de 2 para
  ese turno y esa fecha
- **THEN** la misma consulta repetida devuelve `disponible: false`, `motivos` con exactamente
  `AFORO_ZONA` y `lugaresRestantes: 0`

### Requirement: Mismas reglas en la consulta y en la creación de reservas
La creación de una reserva SHALL evaluar las mismas ocho reglas, con los mismos bordes, que la
consulta de disponibilidad. Cuando para una solicitud la consulta informaría al menos un
motivo, la creación con esa misma solicitud, en el mismo estado de reservas y en el mismo
instante, SHALL rechazarse con `409 Conflict`. La creación SHALL evaluar las reglas con las
reservas de ese turno y esa fecha ya confirmadas por cualquier creación concurrente, de modo
que creaciones simultáneas no superen el aforo de zona ni el global.

#### Scenario: Una regla que falla en la consulta rechaza la creación
- **WHEN** la consulta para la cena del sábado 2026-09-19 en VIP con `comensales=4` devuelve
  `motivos` con `AFORO_ZONA`
- **AND** en ese mismo estado se intenta crear una reserva con esa fecha, turno, zona y
  comensales
- **THEN** la creación se rechaza con `409 Conflict` y no se persiste ninguna reserva

#### Scenario: Una solicitud disponible no se rechaza por estas reglas
- **WHEN** la consulta para una solicitud devuelve `disponible: true`
- **AND** en ese mismo estado y en ese mismo instante se intenta crear una reserva con esa
  solicitud
- **THEN** la creación no se rechaza por ninguno de los ocho motivos

#### Scenario: Creaciones concurrentes no superan el aforo
- **WHEN** el aforo de la zona VIP está configurado en 8 y no hay reservas activas para la
  cena del sábado 2026-09-19
- **AND** llegan en simultáneo 4 creaciones para ese turno y esa fecha en VIP, cada una de 3
  comensales, con el instante actual 2026-09-15 10:00
- **THEN** se persisten exactamente 2 reservas y las otras 2 se rechazan con `409 Conflict`
- **AND** la suma de comensales activos de VIP para ese turno y esa fecha es 6
