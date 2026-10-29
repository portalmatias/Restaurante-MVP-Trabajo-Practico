Los escenarios usan el layout del seed de `plano-mesas` (zona STANDARD de 12 columnas por 8
filas; S2 en (2,0) 1 por 1, S3 en (5,0) 2 por 2, S4 en (0,3) 3 por 2, S5 en (5,3) 4 por 2; zona
VIP de 10 por 6, con V4 en (4,3) 6 por 2). V5 es una mesa de VIP de 1 por 1 y sin reservas, en
(7,5), y S7 una mesa de STANDARD sin ubicar.
La pantalla numera columnas y filas desde 1; la API, desde 0: la columna 6 de la pantalla es
`posX` 5.

## ADDED Requirements

### Requirement: Ubicación de la Mesa en el plano
El formulario de edición de una Mesa en `/admin/salon` SHALL incluir la sección "Ubicación en el
plano" con los campos Columna, Fila, Ancho, Alto y Forma (Redonda, Cuadrada o Rectangular), y
un botón "Quitar del plano" cuando la Mesa está ubicada. Columna y Fila SHALL numerarse desde 1 y
SHALL ofrecer solo los valores con los que la Mesa entra en la grilla de su Zona con el ancho y
el alto elegidos; si un cambio de ancho o de alto deja el valor elegido fuera de la grilla, el
campo SHALL pasar al último valor que entra. Si cambia la Zona elegida y el ancho o el alto
superan su grilla, Ancho y Alto SHALL pasar al máximo de la grilla nueva antes de calcular las
opciones de Columna y Fila. Si después se vuelve a elegir la Zona original de la Mesa, Columna,
Fila, Ancho y Alto SHALL volver a los valores con los que se abrió el formulario, para que el
pedido no la quite del plano sin querer: los guardados, o los de una Mesa fuera de la grilla (más
abajo) si la Mesa guardada no entra en ella. Para una Mesa sin ubicar, Columna y Fila SHALL
empezar vacíos y la sección SHALL decir "La mesa no está en el plano."; la Mesa queda ubicada al
guardar con ambos valores elegidos. Guardar con solo uno de los dos SHALL mostrar un error junto
a la sección sin enviar el pedido.

La sección SHALL mostrar una vista previa del plano de la Zona elegida en el formulario: la
grilla, las demás Mesas ubicadas de esa Zona (siempre las de la Zona elegida en ese momento,
aunque las respuestas de la API lleguen en otro orden) y la Mesa que se edita, destacada, en el lugar y con
el tamaño y la forma de los valores elegidos, actualizada al cambiar cualquiera de ellos. La
vista previa SHALL ser decorativa para lectores de pantalla y SHALL acompañarse de un texto que
describe la ubicación elegida ("S3 ocupa las columnas 6 y 7, filas 1 y 2.") y, si la Mesa se
superpone con otras, las nombra ("Se superpone con S5."). La Mesa que se edita SHALL NOT contar
como otra Mesa en ese aviso, aunque su posición guardada venga en el listado de la Zona. Si no se
pueden cargar las demás Mesas de la Zona, la vista previa SHALL dibujar igual la grilla y la Mesa
que se edita, y SHALL avisar que no puede detectar superposiciones. El aviso de superposición, o
su falta, SHALL NOT impedir guardar: lo decide la API. Los errores `400` y `409` de la API sobre la ubicación SHALL
mostrarse junto a la sección.

Una Mesa guardada que no entra en la grilla de su Zona SHALL tratarse en el formulario como sin
ubicar: Columna y Fila empiezan vacíos, Ancho y Alto pasan al máximo de la grilla si la superan,
y la sección SHALL decir "La mesa quedó fuera de la grilla de la zona: elegí una ubicación
nueva.". Guardarla sin elegir ubicación SHALL enviar `posX` y `posY` en `null`.

El listado de Mesas SHALL mostrar la ubicación de cada una ("Columna 6, fila 1"), "Sin ubicar" o,
si no entra en la grilla de su Zona, "Fuera de la grilla".
El formulario de alta SHALL NOT incluir la sección: la Mesa nueva se crea sin ubicar.

#### Scenario: Mover una mesa
- **WHEN** el administrador edita S4, elige la columna 9 y la fila 6 y guarda
- **THEN** el sistema envía a `PATCH /admin/mesas/:id` `posX` 8 y `posY` 5 y, al confirmar la API,
  el listado muestra S4 en "Columna 9, fila 6"

#### Scenario: La vista previa sigue los valores elegidos
- **WHEN** el administrador edita S3 y cambia el ancho a 3
- **THEN** la vista previa dibuja S3 con 3 celdas de ancho y el texto dice "S3 ocupa las columnas
  6 a 8, filas 1 y 2."
- **AND** el texto no avisa ninguna superposición: la posición guardada de S3 no cuenta como otra
  Mesa

#### Scenario: Falla la carga de las mesas de la zona
- **WHEN** el administrador edita S4 y `GET /admin/mesas` de la Zona elegida responde con error
- **THEN** la vista previa dibuja la grilla y S4, la sección dice "No se pudieron cargar las otras
  mesas de la zona: no se puede avisar si se superpone." y el botón de guardar sigue habilitado

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

#### Scenario: Mesa guardada fuera de la grilla
- **WHEN** S4, de 3 por 2, quedó guardada en (10,3) de STANDARD, fuera de la grilla de 12 por 8, y
  el administrador la edita
- **THEN** el listado muestra S4 "Fuera de la grilla", Columna y Fila están vacíos y la sección
  dice "La mesa quedó fuera de la grilla de la zona: elegí una ubicación nueva."
- **AND** al elegir la columna 9 y la fila 6, un lugar libre, y guardar, el sistema envía `posX` 8 y
  `posY` 5 y, al confirmar la API, el listado muestra S4 en "Columna 9, fila 6"

#### Scenario: Mensaje de tamaño de la API junto a la sección
- **WHEN** la API responde `400` con "La mesa no entra en la grilla de 12 por 8."
- **THEN** el sistema muestra ese mensaje junto a la sección "Ubicación en el plano"

#### Scenario: Ubicar una mesa sin ubicar
- **WHEN** el administrador edita S7, elige la columna 12 y la fila 1 y guarda
- **THEN** el sistema envía `posX` 11 y `posY` 0 y, al confirmar la API, el listado muestra S7 en
  "Columna 12, fila 1"

#### Scenario: Guardar sin ubicación no muestra error
- **WHEN** el administrador edita S7, cambia solo la etiqueta y guarda con Columna y Fila vacíos
- **THEN** el sistema guarda la etiqueta sin mostrar error y S7 sigue "Sin ubicar"

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

#### Scenario: Cambios de zona rápidos
- **WHEN** el administrador edita S4, cambia la Zona a VIP y vuelve a STANDARD antes de que
  llegue la respuesta con las Mesas de VIP, y esa respuesta llega después que la de STANDARD
- **THEN** la vista previa dibuja las Mesas de STANDARD y no las de VIP

#### Scenario: Volver a la zona original restaura la ubicación
- **WHEN** el administrador edita S4, cambia la Zona a VIP, vuelve a elegir STANDARD y guarda
- **THEN** Columna y Fila vuelven a 1 y 4, Ancho y Alto a 3 y 2, y el pedido no envía `zonaId`,
  `posX`, `posY`, `ancho` ni `alto`

#### Scenario: Volver a la zona original con una mesa fuera de la grilla
- **WHEN** S4 quedó guardada fuera de la grilla, y el administrador la edita, cambia la Zona a VIP
  y vuelve a STANDARD
- **THEN** Columna y Fila quedan vacíos y la sección dice "La mesa quedó fuera de la grilla de la
  zona: elegí una ubicación nueva.", igual que al abrir el formulario

#### Scenario: Cambio a una zona más chica ajusta el tamaño
- **WHEN** el administrador cambia a VIP (10 por 6) una Mesa de STANDARD de 12 de
  ancho y 8 de alto
- **THEN** Ancho pasa a 10 y Alto a 6, y Columna y Fila ofrecen solo el valor 1

#### Scenario: Cambio de zona sin elegir ubicación
- **WHEN** el administrador cambia V5 a STANDARD, deja Columna y Fila vacíos y guarda
- **THEN** el sistema envía la Zona nueva con `posX` y `posY` en `null`, no muestra error y el
  listado muestra V5 "Sin ubicar"

#### Scenario: Cambio de zona con la misma columna y fila
- **WHEN** el administrador cambia V5, ubicada en la columna 8, fila 6 de VIP, a STANDARD, vuelve a
  elegir la columna 8 y la fila 6 y guarda
- **THEN** el sistema envía la Zona nueva junto con `posX` 7 y `posY` 5

#### Scenario: Pedido con las coordenadas juntas
- **WHEN** el administrador edita S4 y cambia solo la columna
- **THEN** el sistema envía `posX` y `posY` juntos, y no envía `ancho`, `alto` ni `forma`

#### Scenario: Alternativa textual de la vista previa
- **WHEN** un lector de pantalla recorre la sección
- **THEN** el dibujo de la vista previa no se anuncia y el texto de la ubicación sí
