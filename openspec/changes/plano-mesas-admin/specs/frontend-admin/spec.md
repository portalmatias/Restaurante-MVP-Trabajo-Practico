Los escenarios usan el layout del seed de `plano-mesas` (zona STANDARD de 12 columnas por 8
filas; S2 en (2,0) 1 por 1, S3 en (5,0) 2 por 2, S4 en (0,3) 3 por 2, S5 en (5,3) 4 por 2).
La pantalla numera columnas y filas desde 1; la API, desde 0: la columna 6 de la pantalla es
`posX` 5.

## ADDED Requirements

### Requirement: Ubicación de la Mesa en el plano
El formulario de edición de una Mesa en `/admin/salon` SHALL incluir la sección "Ubicación en el
plano" con los campos Columna, Fila, Ancho, Alto y Forma (Redonda, Cuadrada o Rectangular), y
un botón "Quitar del plano" cuando la Mesa está ubicada. Columna y Fila SHALL numerarse desde 1 y
SHALL ofrecer solo los valores con los que la Mesa entra en la grilla de su Zona con el ancho y
el alto elegidos; si un cambio de ancho o de alto deja el valor elegido fuera de la grilla, el
campo SHALL pasar al último valor que entra. Para una Mesa sin ubicar, Columna y Fila SHALL
empezar vacíos y la sección SHALL decir "La mesa no está en el plano."; la Mesa queda ubicada al
guardar con ambos valores elegidos. Guardar con solo uno de los dos SHALL mostrar un error junto
a la sección sin enviar el pedido.

La sección SHALL mostrar una vista previa del plano de la Zona elegida en el formulario: la
grilla, las demás Mesas ubicadas de esa Zona y la Mesa que se edita, destacada, en el lugar y con
el tamaño y la forma de los valores elegidos, actualizada al cambiar cualquiera de ellos. La
vista previa SHALL ser decorativa para lectores de pantalla y SHALL acompañarse de un texto que
describe la ubicación elegida ("S3 ocupa las columnas 6 y 7, filas 1 y 2.") y, si la Mesa se
superpone con otras, las nombra ("Se superpone con S5."). El aviso de superposición SHALL NOT
impedir guardar: lo decide la API. Los errores `400` y `409` de la API sobre la ubicación SHALL
mostrarse junto a la sección.

El listado de Mesas SHALL mostrar la ubicación de cada una ("Columna 6, fila 1") o "Sin ubicar".
El formulario de alta SHALL NOT incluir la sección: la Mesa nueva se crea sin ubicar.

#### Scenario: Mover una mesa
- **WHEN** el administrador edita S4, elige la columna 9 y la fila 6 y guarda
- **THEN** el sistema envía a `PATCH /admin/mesas/:id` `posX` 8 y `posY` 5 y, al confirmar la API,
  el listado muestra S4 en "Columna 9, fila 6"

#### Scenario: La vista previa sigue los valores elegidos
- **WHEN** el administrador edita S3 y cambia el ancho a 3
- **THEN** la vista previa dibuja S3 con 3 celdas de ancho y el texto dice "S3 ocupa las columnas
  6 a 8, filas 1 y 2."

#### Scenario: Aviso de superposición en la vista previa
- **WHEN** el administrador edita S4 y elige la columna 5 y la fila 4
- **THEN** el texto de la vista previa dice "Se superpone con S5."
- **AND** el botón de guardar sigue habilitado

#### Scenario: Superposición rechazada por la API
- **WHEN** la API responde `409` con "La mesa se superpone con S3."
- **THEN** el sistema muestra ese mensaje junto a la sección "Ubicación en el plano" y no cierra
  el formulario

#### Scenario: Columna limitada por el ancho
- **WHEN** el administrador edita S5, que tiene 4 de ancho, en una zona de 12 columnas
- **THEN** la Columna ofrece de 1 a 9

#### Scenario: Ancho mayor corrige la columna
- **WHEN** el administrador edita S2 con la columna 12 elegida y cambia el ancho a 2
- **THEN** la Columna pasa a 11

#### Scenario: Mesa sin ubicar
- **WHEN** el administrador edita una Mesa sin ubicar
- **THEN** Columna y Fila están vacíos, la sección dice "La mesa no está en el plano." y la vista
  previa no dibuja esa Mesa

#### Scenario: Ubicación a medias no se envía
- **WHEN** el administrador edita una Mesa sin ubicar, elige solo la columna y guarda
- **THEN** el sistema muestra un error junto a la sección y no envía el pedido

#### Scenario: Quitar del plano
- **WHEN** el administrador edita S2, toca "Quitar del plano" y guarda
- **THEN** el sistema envía `posX` y `posY` en `null` y el listado muestra S2 "Sin ubicar"

#### Scenario: Cambio de zona en el formulario
- **WHEN** el administrador cambia la Zona de una Mesa en el formulario
- **THEN** la vista previa pasa a mostrar la grilla y las Mesas de la Zona nueva, y Columna y Fila
  quedan vacíos

#### Scenario: Alternativa textual de la vista previa
- **WHEN** un lector de pantalla recorre la sección
- **THEN** el dibujo de la vista previa no se anuncia y el texto de la ubicación sí
