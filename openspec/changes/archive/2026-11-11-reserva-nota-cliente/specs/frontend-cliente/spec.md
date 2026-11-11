## ADDED Requirements

### Requirement: Nota para el restaurante en el paso de datos de contacto
El paso de datos de contacto SHALL incluir, después del teléfono, un campo de texto de varias
líneas «Nota para el restaurante (opcional)», con la ayuda «Por ejemplo: es un cumpleaños,
vamos con un cochecito o alguien tiene una alergia.» y un contador «N de 500 caracteres» que
cuenta puntos de código Unicode (un emoji simple es un carácter; uno compuesto, varios). El campo SHALL poder quedar vacío sin mostrar error. Si
la nota supera los 500 caracteres, el sistema SHALL mostrar el error «La nota puede tener hasta
500 caracteres.» junto al campo y SHALL NOT enviar el formulario. El contador, el límite de 500, el
error y el pedido SHALL usar el texto sin los espacios del principio y del final. El sistema
SHALL enviar la nota en la creación solo si tiene texto además de espacios.

#### Scenario: Reservar sin nota
- **WHEN** la persona completa nombre, email y teléfono, deja la nota vacía y envía
- **THEN** el sistema crea la reserva sin mostrar error y el pedido no incluye la nota

#### Scenario: Reservar con nota
- **WHEN** la persona escribe "Es un cumpleaños" en la nota y envía
- **THEN** el pedido de creación incluye `notaCliente: "Es un cumpleaños"`

#### Scenario: El contador sigue lo escrito
- **WHEN** la persona escribe "Celíaco 🎂" en la nota
- **THEN** el contador dice «9 de 500 caracteres»

#### Scenario: Los espacios de los bordes no cuentan
- **WHEN** la persona escribe dos espacios seguidos de 500 caracteres de texto y envía
- **THEN** el contador dice «500 de 500 caracteres» y el pedido incluye la nota sin esos espacios

#### Scenario: Nota demasiado larga
- **WHEN** la persona escribe una nota de 501 caracteres e intenta enviar
- **THEN** el campo muestra «La nota puede tener hasta 500 caracteres.» y no se envía el pedido

### Requirement: La nota se muestra en la confirmación
La confirmación de la reserva recién creada (`/reservas/nueva/exito`) SHALL mostrar, cuando la
reserva tiene nota, un apartado «Tu nota» con el texto tal como fue guardado (el de la
respuesta de la creación), respetando los saltos de línea. Cuando la reserva no tiene nota,
SHALL NOT mostrar el apartado. La nota SHALL NOT viajar en la URL: llega a la confirmación
guardada en el navegador al crear la reserva. Por eso, si el navegador no permite guardarla, o
si ya se borró porque la persona salió de la confirmación navegando por el sitio, la
confirmación SHALL NOT mostrar el apartado aunque la reserva tenga nota; la nota sigue guardada
en la reserva y el administrador la ve en el listado. El detalle de una reserva
consultada con código y email SHALL NOT mostrar la nota, porque la consulta pública no la
devuelve.

#### Scenario: Confirmación con nota
- **WHEN** la persona crea una reserva con la nota "  Es un cumpleaños  " y el sistema la
  lleva a la pantalla de confirmación
- **THEN** la confirmación muestra «Tu nota» con "Es un cumpleaños"
- **AND** la URL de la confirmación no contiene la nota

#### Scenario: Confirmación sin nota
- **WHEN** la persona crea una reserva sin nota
- **THEN** la confirmación no muestra el apartado «Tu nota»

#### Scenario: La nota ya no está guardada en el navegador
- **WHEN** la persona crea una reserva con nota, sale de la confirmación navegando por el sitio
  y después vuelve a la misma confirmación, o el navegador no permite guardar datos
- **THEN** la confirmación no muestra el apartado «Tu nota» y el resto de la pantalla se ve igual
- **AND** la nota sigue guardada en la reserva

#### Scenario: La nota respeta los saltos de línea
- **WHEN** la persona crea una reserva con la nota "Uno es celíaco.\nLlegamos 20:15."
- **THEN** la confirmación muestra las dos oraciones en líneas separadas

#### Scenario: El detalle consultado no muestra la nota
- **WHEN** se consulta con código y email una reserva creada con nota
- **THEN** el detalle no muestra el apartado «Tu nota»
