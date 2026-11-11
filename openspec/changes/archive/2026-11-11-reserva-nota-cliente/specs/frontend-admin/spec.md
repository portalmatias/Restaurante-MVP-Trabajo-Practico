## ADDED Requirements

### Requirement: Nota del cliente en el listado de Reservas
El listado de `/admin/reservas` SHALL mostrar la nota de cada Reserva que la tenga, junto a
sus datos de contacto, con el rótulo «Nota» y respetando los saltos de línea. Una Reserva sin
nota SHALL NOT mostrar el rótulo. La búsqueda «Buscar en esta página» SHALL NOT buscar en el
texto de las notas.

#### Scenario: Reserva con nota
- **WHEN** el listado muestra una Reserva con la nota "Vamos con un cochecito"
- **THEN** la fila muestra «Nota» con "Vamos con un cochecito"

#### Scenario: La nota respeta los saltos de línea
- **WHEN** el listado muestra una Reserva con la nota "Uno es celíaco.\nLlegamos 20:15."
- **THEN** la fila muestra las dos oraciones en líneas separadas

#### Scenario: Reserva sin nota
- **WHEN** el listado muestra una Reserva sin nota
- **THEN** la fila no muestra el rótulo «Nota»

#### Scenario: La búsqueda no mira las notas
- **WHEN** el administrador busca "cochecito" en «Buscar en esta página» y ninguna Reserva
  tiene ese texto en su código, nombre o email
- **THEN** se muestra el aviso de búsqueda sin coincidencias, aunque una nota lo contenga
