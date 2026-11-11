## MODIFIED Requirements

### Requirement: La consulta pública devuelve solo una vista mínima de la Reserva
El sistema SHALL devolver en la consulta pública únicamente el código de la Reserva, su
estado, la fecha, la cantidad de comensales, el turno (identificador, hora de inicio y hora
de fin), la zona (identificador y nombre) y la nota del cliente (`notaCliente`, en `null` si
no hay). El sistema SHALL NOT incluir el identificador interno de la Reserva, la mesa
asignada, el nombre, el email ni el teléfono del cliente, ni marcas de creación o
modificación. La fecha SHALL viajar como fecha de calendario local (`YYYY-MM-DD`) y las horas
del turno como horas locales del restaurante (`HH:mm`), sin conversión de zona horaria.

#### Scenario: La respuesta no contiene datos internos ni de contacto
- **WHEN** el cliente consulta una Reserva con código y email correctos
- **THEN** la respuesta contiene solo los campos de la vista mínima y ninguno de los datos
  excluidos

#### Scenario: Fecha y horas se devuelven como fueron guardadas
- **WHEN** se consulta una Reserva del `2026-09-19` en un turno de 20:00 a 23:30
- **THEN** la respuesta informa la fecha `2026-09-19` y las horas `20:00` y `23:30`,
  con el mismo resultado sin importar la zona horaria del servidor

#### Scenario: La consulta devuelve la nota
- **WHEN** el cliente consulta con código y email correctos una Reserva creada con la nota
  "Es un cumpleaños"
- **THEN** la respuesta trae `notaCliente: "Es un cumpleaños"`

#### Scenario: La consulta fallida no revela la nota
- **WHEN** se consulta una Reserva con el código correcto y un email que no coincide
- **THEN** la respuesta no contiene la nota

## ADDED Requirements

### Requirement: Nota del cliente en el listado del administrador
Cada Reserva de `GET /admin/reservas` SHALL incluir `notaCliente`, con la nota guardada o
`null` si no hay. La nota SHALL NOT ser un filtro del listado.

#### Scenario: El listado trae la nota de cada Reserva
- **WHEN** el admin solicita `GET /admin/reservas` y hay una Reserva con la nota "Vamos con un
  cochecito" y otra sin nota
- **THEN** la primera trae `notaCliente: "Vamos con un cochecito"` y la segunda
  `notaCliente: null`
