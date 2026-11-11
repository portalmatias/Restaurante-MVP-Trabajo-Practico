## ADDED Requirements

### Requirement: Nota para el restaurante en el paso de datos de contacto
El paso de datos de contacto SHALL incluir, después del teléfono, un campo de texto de varias
líneas «Nota para el restaurante (opcional)», con la ayuda «Por ejemplo: es un cumpleaños,
vamos con un cochecito o alguien tiene una alergia.» y un contador «N de 500 caracteres» que
cuenta cada emoji como un carácter. El campo SHALL poder quedar vacío sin mostrar error. Si
la nota supera los 500 caracteres, el sistema SHALL mostrar el error «La nota puede tener hasta
500 caracteres.» junto al campo y SHALL NOT enviar el formulario. El sistema SHALL enviar la
nota en la creación solo si tiene texto además de espacios.

#### Scenario: Reservar sin nota
- **WHEN** la persona completa nombre, email y teléfono, deja la nota vacía y envía
- **THEN** el sistema crea la reserva sin mostrar error y el pedido no incluye la nota

#### Scenario: Reservar con nota
- **WHEN** la persona escribe "Es un cumpleaños" en la nota y envía
- **THEN** el pedido de creación incluye `notaCliente: "Es un cumpleaños"`

#### Scenario: El contador sigue lo escrito
- **WHEN** la persona escribe "Celíaco 🎂" en la nota
- **THEN** el contador dice «9 de 500 caracteres»

#### Scenario: Nota demasiado larga
- **WHEN** la persona escribe una nota de 501 caracteres e intenta enviar
- **THEN** el campo muestra «La nota puede tener hasta 500 caracteres.» y no se envía el pedido

### Requirement: La nota se muestra en la confirmación y en el detalle
La confirmación de la reserva creada y el detalle de una reserva consultada SHALL mostrar,
cuando la reserva tiene nota, un apartado «Tu nota» con el texto tal como fue guardado,
respetando los saltos de línea. Cuando la reserva no tiene nota, SHALL NOT mostrar el apartado.

#### Scenario: Confirmación con nota
- **WHEN** se crea una reserva con la nota "Es un cumpleaños"
- **THEN** la confirmación muestra «Tu nota» con "Es un cumpleaños"

#### Scenario: Detalle sin nota
- **WHEN** se consulta una reserva sin nota
- **THEN** el detalle no muestra el apartado «Tu nota»

#### Scenario: La nota respeta los saltos de línea
- **WHEN** se consulta una reserva con la nota "Uno es celíaco.\nLlegamos 20:15."
- **THEN** el detalle muestra las dos oraciones en líneas separadas
