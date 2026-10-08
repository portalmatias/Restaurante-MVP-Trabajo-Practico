## ADDED Requirements

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
