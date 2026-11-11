## MODIFIED Requirements

### Requirement: Creación pública de reservas
El sistema SHALL exponer `POST /reservas`, accesible sin autenticación, que recibe en un body
JSON `fecha`, `turnoId`, `zonaId`, `comensales`, `nombreCliente`, `emailCliente` y
`telefonoCliente`, todos obligatorios, y `notaCliente`, opcional (puede omitirse o venir en `null`), y crea una única reserva para
esa combinación. Cuando la reserva se crea, SHALL responder `201 Created`.

#### Scenario: Visitante sin token crea una reserva
- **WHEN** un visitante sin header `Authorization` envía `POST /reservas` para la cena del
  sábado 2026-09-19 en zona STANDARD con `comensales=4`
- **THEN** el sistema responde `201 Created`
- **AND** existe en la base exactamente una reserva nueva con esa fecha, ese turno, 4
  comensales y los datos de contacto enviados

#### Scenario: Reserva sin nota
- **WHEN** un visitante envía `POST /reservas` sin `notaCliente`
- **THEN** el sistema responde `201 Created` y la reserva queda con la nota en `null`

#### Scenario: Nota en null
- **WHEN** un visitante envía `POST /reservas` con `notaCliente: null`
- **THEN** el sistema responde `201 Created` y la reserva queda con la nota en `null`

### Requirement: Forma de la respuesta de creación
Ante una creación exitosa, el cuerpo SHALL contener `codigoReserva`, `estado`, `fecha` (con el
formato `YYYY-MM-DD` y el mismo valor enviado), `turnoId`, `zonaId`, `comensales` y
`notaCliente` (la nota guardada, o `null` si no hay). El cuerpo SHALL NOT contener el
identificador interno de la reserva, la mesa asignada ni los datos de contacto.

#### Scenario: La respuesta no expone datos internos
- **WHEN** se crea una reserva para la cena del sábado 2026-09-19 en zona STANDARD con
  `comensales=4`
- **THEN** el cuerpo trae `fecha: "2026-09-19"`, el `turnoId` y el `zonaId` enviados,
  `comensales: 4`, un `codigoReserva` y un `estado`
- **AND** el cuerpo no trae `id`, `mesaId`, `mesa`, `nombreCliente`, `emailCliente` ni
  `telefonoCliente`

#### Scenario: La respuesta devuelve la nota guardada
- **WHEN** se crea una reserva con `notaCliente: "  Es un cumpleaños  "`
- **THEN** el cuerpo trae `notaCliente: "Es un cumpleaños"`

### Requirement: Validación del body
El sistema SHALL responder `400 Bad Request`, sin evaluar reglas y sin persistir nada, cuando
falta alguno de los siete campos obligatorios, cuando `fecha` no tiene el formato `YYYY-MM-DD`
o no es una fecha de calendario válida (incluido un valor con hora), cuando `turnoId` o
`zonaId` no son UUID, cuando `comensales` no es un entero mayor o igual a 1, cuando
`emailCliente` no es un email válido, cuando `nombreCliente` o `telefonoCliente` están vacíos
o solo tienen espacios, cuando `notaCliente` viene (distinta de `null`) y no es un texto o supera los
500 caracteres, o cuando el body trae algún campo distinto de los siete obligatorios y
`notaCliente` (por ejemplo `mesaId`, `estado` o `codigoReserva`). El cuerpo SHALL tener la
forma `{ statusCode: 400, message: string[], error: "Bad Request" }`.

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

#### Scenario: Nota que no es texto
- **WHEN** se envía `notaCliente: 42`
- **THEN** el sistema responde `400 Bad Request`
- **AND** la cantidad de reservas en la base no cambia

## ADDED Requirements

### Requirement: Nota del cliente
El sistema SHALL guardar la `notaCliente` recibida sin los espacios del principio y del final.
Una nota vacía, con solo espacios o en `null` SHALL guardarse como `null`. El largo SHALL
contarse en puntos de código Unicode, después de quitar esos espacios, y SHALL admitir
hasta 500; una nota
más larga SHALL rechazarse con `400 Bad Request` sin persistir nada. La nota SHALL admitir
saltos de línea, acentos y emojis, y un emoji simple SHALL contar como un carácter; un emoji compuesto (familia, bandera, tono
de piel) o con selector de variación SHALL contar como varios, uno por punto de código. La nota SHALL
NOT intervenir en ninguna regla de negocio: no cambia la disponibilidad, la asignación de mesa
ni el estado inicial.

#### Scenario: Nota guardada sin los espacios de los bordes
- **WHEN** se crea una reserva con `notaCliente: "  Uno es celíaco.\nLlegamos 20:15.  "`
- **THEN** la reserva queda con la nota `"Uno es celíaco.\nLlegamos 20:15."`

#### Scenario: Nota vacía se guarda como sin nota
- **WHEN** se crea una reserva con `notaCliente: "   "`
- **THEN** el sistema responde `201 Created` y la reserva queda con la nota en `null`

#### Scenario: Nota en el límite
- **WHEN** se crea una reserva con una nota de 500 caracteres
- **THEN** el sistema responde `201 Created` y guarda la nota completa

#### Scenario: Nota demasiado larga
- **WHEN** se envía una nota de 501 caracteres
- **THEN** el sistema responde `400 Bad Request`
- **AND** la cantidad de reservas en la base no cambia

#### Scenario: Los espacios de los bordes no cuentan para el límite
- **WHEN** se envía una nota de 500 caracteres con dos espacios al principio
- **THEN** el sistema responde `201 Created`

#### Scenario: Un emoji simple cuenta como un carácter
- **WHEN** se envía una nota de 499 letras seguidas de "🎂"
- **THEN** el sistema responde `201 Created`

#### Scenario: Un emoji con selector de variación cuenta como varios
- **WHEN** se envía una nota de 499 letras seguidas de "❤️" (dos puntos de código)
- **THEN** el sistema responde `400 Bad Request`
- **AND** la cantidad de reservas en la base no cambia

#### Scenario: La nota no cambia las reglas de negocio
- **WHEN** se intenta crear una reserva sin lugar en el turno, con una nota
- **THEN** el sistema la rechaza igual que sin nota
