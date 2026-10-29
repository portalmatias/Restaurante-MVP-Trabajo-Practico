Los escenarios usan el layout del seed de `plano-mesas`: zona STANDARD con grilla de 12 columnas
por 8 filas, S1 en (0,0) redonda 1 por 1, S2 en (2,0) redonda 1 por 1, S3 en (5,0) cuadrada 2 por
2, S4 en (0,3) rectangular 3 por 2 y S5 en (5,3) rectangular 4 por 2; zona VIP con grilla de 10
por 6, V1 en (0,0) 1 por 1, V2 en (3,0) 2 por 2, V3 en (0,3) 3 por 2 y V4 en (4,3) 6 por 2. S6 es
una mesa de STANDARD de 1 por 1 y sin reservas, cargada en la base para el test en (10,7). S8 es
una mesa de STANDARD sin ubicar, de 11 por 1 y sin reservas, cargada en la base para el test. Las
coordenadas son de la API: base 0, en celdas, `(posX, posY)`.

## MODIFIED Requirements

### Requirement: Listado de Zonas
El sistema SHALL exponer `GET /admin/zonas`, que devuelve las Zonas existentes con su
configuración completa (rango de comensales, anticipación mínima y máxima, ventana de
cancelación, si requiere confirmación del admin, y aforo máximo) y el tamaño de la grilla de su
plano (`planoColumnas` y `planoFilas`).

#### Scenario: Listado devuelve la configuración vigente
- **WHEN** el admin solicita `GET /admin/zonas`
- **THEN** el sistema devuelve las Zonas persistidas con sus valores de configuración actuales

#### Scenario: Listado incluye el tamaño de la grilla
- **WHEN** el admin solicita `GET /admin/zonas` con los datos del seed
- **THEN** la zona STANDARD tiene `planoColumnas` 12 y `planoFilas` 8, y la VIP 10 y 6

### Requirement: Listado de Mesas
El sistema SHALL exponer `GET /admin/mesas`, que devuelve las Mesas existentes y SHALL
permitir filtrar el listado por Zona. Cada Mesa SHALL incluir su ubicación en el plano (`posX` y
`posY`, ambos `null` si la Mesa no está ubicada), su tamaño (`ancho` y `alto`) y su `forma`. Las
respuestas de alta y de edición de una Mesa SHALL incluir los mismos campos.

#### Scenario: Listado filtrado por Zona
- **WHEN** el admin solicita `GET /admin/mesas` indicando una Zona
- **THEN** el sistema devuelve únicamente las Mesas que pertenecen a esa Zona

#### Scenario: Listado incluye la ubicación
- **WHEN** el admin solicita `GET /admin/mesas` con los datos del seed
- **THEN** S3 tiene `posX` 5, `posY` 0, `ancho` 2, `alto` 2 y `forma` `CUADRADA`

#### Scenario: Mesa recién creada figura sin ubicar
- **WHEN** el admin da de alta la Mesa S7 en STANDARD
- **THEN** la respuesta del alta y el listado muestran S7 con `posX` y `posY` en `null`, `ancho` y
  `alto` en 1 y `forma` `RECTANGULAR`

## ADDED Requirements

### Requirement: Ubicación de Mesa en el plano
`PATCH /admin/mesas/:id` SHALL aceptar, además de los campos que ya acepta, `posX` y `posY`
(enteros no negativos, o ambos `null` para quitar la Mesa del plano), `ancho` y `alto` (enteros
mayores o iguales a 1) y `forma` (`REDONDA`, `CUADRADA` o `RECTANGULAR`), todos opcionales.
`ancho`, `alto` y `forma` SHALL NOT aceptar `null`. Un valor que no cumple estas reglas SHALL
rechazarse con `400` sin modificar la Mesa. Un pedido sin ninguno de esos campos y sin cambio de
Zona SHALL comportarse igual que antes de este cambio. Un cambio de Zona sin campos del plano
tiene dos diferencias con el comportamiento anterior: la Mesa queda sin ubicar (al final de este
requisito) y su tamaño se valida contra la grilla de la Zona nueva, como se describe abajo.

El `ancho` final SHALL ser menor o igual que `planoColumnas` de la Zona final, y el `alto` final
menor o igual que `planoFilas`, también si la Mesa queda sin ubicar: si no, el sistema SHALL
responder `400` con el mensaje "La mesa no entra en la grilla de <columnas> por <filas>." sin
modificar la Mesa.

El sistema SHALL validar el lugar que resulta de aplicar el pedido a la Mesa (la Zona, la
posición y el tamaño finales) contra la grilla de la Zona final y contra las demás Mesas
ubicadas de esa Zona, y SHALL rechazar la edición sin modificar la Mesa cuando:
- llega solo una de las dos coordenadas, o una coordenada `null` junto a otra no nula: `400`,
  aunque el valor que llega coincida con el guardado;
- la Mesa queda fuera de la grilla (`posX + ancho` mayor que `planoColumnas`, o `posY + alto`
  mayor que `planoFilas`): `400` con el mensaje "La mesa queda fuera de la grilla de
  <columnas> por <filas>.";
- la Mesa comparte al menos una celda con otra Mesa ubicada de la misma Zona: `409` con el
  mensaje "La mesa se superpone con <etiquetas>.", que nombra cada Mesa con la que se superpone.

Si un pedido cumple más de una de esas condiciones, el sistema SHALL responder la primera en este
orden: coordenada a medias, tamaño mayor que la grilla, Mesa fuera de la grilla y superposición.
Los valores fuera de rango (el primer párrafo de este requisito) se rechazan con `400` antes que
cualquier otra validación, como hoy los demás datos de entrada inválidos. Las validaciones de
"Edición de Mesa preserva las Reservas activas" (capacidad por debajo de una Reserva activa y
cambio de Zona con Reservas activas) y la de Zona inexistente SHALL correr después de esas y antes
que las cuatro condiciones de ubicación de arriba: un pedido con valores válidos que falla una de
ellas y además una condición de ubicación SHALL recibir la respuesta de la validación existente.
Cualquier combinación de `forma`, `ancho` y `alto` SHALL ser válida: una Mesa `REDONDA` o
`CUADRADA` con lados distintos se acepta y el plano la dibuja estirada.

Dos Mesas que solo se tocan por un lado SHALL NOT considerarse superpuestas. La posición de una Mesa sin
ubicar SHALL NOT validarse contra la grilla ni contra otras Mesas; su tamaño sí, como se dijo
arriba. La validación SHALL correr solo si el
pedido cambia la posición, el tamaño o la Zona, comparando los valores finales con los guardados
en la Mesa (no por la sola presencia de los campos en el pedido): un pedido que reenvía los mismos
valores, o que solo cambia la `forma` (o los campos que no son del plano), SHALL NOT validarse
contra la grilla ni contra otras Mesas. Los problemas que ya existieran entre
otras Mesas de la Zona SHALL NOT impedir la edición. Si dos ediciones simultáneas dejarían dos
Mesas superpuestas, el sistema SHALL aceptar como mucho una de ellas.

Si el pedido cambia la Zona de la Mesa y no trae `posX` ni `posY`, la Mesa SHALL quedar sin
ubicar en la Zona nueva. Si los trae, la posición se valida contra la grilla y las Mesas de la
Zona nueva.

#### Scenario: Mover una mesa a un lugar libre
- **WHEN** el admin envía `PATCH /admin/mesas/:id` para S4 con `posX` 8 y `posY` 5
- **THEN** el sistema guarda la posición y la respuesta muestra S4 en (8,5) con `ancho` 3 y
  `alto` 2

#### Scenario: Mesas que se tocan por un lado se aceptan
- **WHEN** el admin mueve S1 a `posX` 1 y `posY` 0, justo al lado de S2
- **THEN** el sistema guarda la posición

#### Scenario: Superposición rechazada
- **WHEN** el admin intenta mover S1 a `posX` 5 y `posY` 1, dentro de S3
- **THEN** el sistema responde `409` con el mensaje "La mesa se superpone con S3."
- **AND** S1 sigue en (0,0)

#### Scenario: Cambio de tamaño que invade otra mesa rechazado
- **WHEN** el admin envía para S4 solo `ancho` 6, sin coordenadas
- **THEN** el sistema responde `409` con el mensaje "La mesa se superpone con S5."

#### Scenario: Fuera de la grilla gana sobre la superposición
- **WHEN** el admin intenta mover S4 (3 por 2) a `posX` 10 y `posY` 6: se sale por la derecha y
  además pisa a S6 en (10,7)
- **THEN** el sistema responde `400` "La mesa queda fuera de la grilla de 12 por 8." y no `409`

#### Scenario: Mesa fuera de la grilla rechazada
- **WHEN** el admin intenta mover S5 a `posX` 10 y `posY` 3
- **THEN** el sistema responde `400` con el mensaje "La mesa queda fuera de la grilla de 12 por
  8."
- **AND** S5 sigue en (5,3)

#### Scenario: Coordenada a medias rechazada
- **WHEN** el admin envía para S1 `posX` 4 sin `posY`
- **THEN** el sistema responde `400` sin modificar la Mesa

#### Scenario: Coordenada a medias con el valor guardado rechazada
- **WHEN** el admin envía para S1 `posX` 0, igual al guardado, sin `posY`
- **THEN** el sistema responde `400` sin modificar la Mesa

#### Scenario: Valores fuera de rango rechazados
- **WHEN** el admin envía `posX` -1, `ancho` 0, `ancho` `null` o `forma` `TRIANGULAR`
- **THEN** el sistema responde `400` sin modificar la Mesa

#### Scenario: Tamaño mayor que la grilla en una mesa sin ubicar
- **WHEN** el admin envía para S2, ya quitada del plano, `ancho` 13
- **THEN** el sistema responde `400` con el mensaje "La mesa no entra en la grilla de 12 por 8." y
  S2 conserva su ancho

#### Scenario: Cambiar la forma
- **WHEN** el admin envía para S3 `forma` `REDONDA`
- **THEN** el sistema guarda la forma y S3 conserva su posición y su tamaño

#### Scenario: Cambiar la forma de una mesa con un problema previo
- **WHEN** S2 quedó cargada a mano en (5,0), superpuesta con S3, y el admin envía para S2 solo
  `forma` `CUADRADA`
- **THEN** el sistema guarda la forma sin validar la superposición

#### Scenario: Reenviar la ubicación de una mesa con un problema previo
- **WHEN** S2 quedó cargada a mano en (5,0), superpuesta con S3, y el admin envía para S2 `posX`
  5, `posY` 0, `ancho` 1 y `alto` 1, los mismos valores guardados, junto con una etiqueta nueva
- **THEN** el sistema guarda la etiqueta sin validar la superposición

#### Scenario: Las validaciones existentes corren antes que las de ubicación
- **WHEN** S4 tiene una Reserva activa de 3 comensales y el admin envía para S4 `capacidad` 2 junto
  con `posX` 10 y `posY` 6, que la dejarían fuera de la grilla
- **THEN** el sistema responde `409` con el mensaje "La mesa tiene una reserva activa con más
  comensales que la nueva capacidad." y no `400`
- **AND** S4 conserva su capacidad y sigue en (0,3)

#### Scenario: Quitar una mesa del plano
- **WHEN** el admin envía para S2 `posX` `null` y `posY` `null`
- **THEN** S2 queda sin ubicar y el plano de STANDARD la muestra en la lista como sin ubicar

#### Scenario: Cambio de zona sin ubicación nueva deja la mesa sin ubicar
- **WHEN** el admin pasa S6 a VIP y el pedido no trae `posX` ni `posY`
- **THEN** S6 queda en VIP con `posX` y `posY` en `null`

#### Scenario: Cambio de zona de una mesa que no entra en la grilla nueva
- **WHEN** el admin pasa S8, de 11 por 1, a VIP sin campos del plano
- **THEN** el sistema responde `400` con el mensaje "La mesa no entra en la grilla de 10 por 6." y
  S8 sigue en STANDARD

#### Scenario: Cambio de zona con ubicación nueva
- **WHEN** el admin pasa S6 a VIP con `posX` 7 y `posY` 0
- **THEN** el sistema valida la posición contra la grilla de 10 por 6 y las mesas de VIP, y guarda
  S6 en VIP en (7,0)

#### Scenario: Cambio de zona con ubicación fuera de la grilla nueva
- **WHEN** el admin pasa S6 a VIP con `posX` 10 y `posY` 0
- **THEN** el sistema responde `400` con el mensaje "La mesa queda fuera de la grilla de 10 por
  6." y S6 sigue en STANDARD en (10,7)

#### Scenario: Pedido sin campos del plano no cambia la ubicación
- **WHEN** el admin envía para S3 solo una etiqueta nueva
- **THEN** el sistema guarda la etiqueta y S3 conserva su posición, su tamaño y su forma

#### Scenario: Ediciones simultáneas sobre la misma celda
- **WHEN** dos pedidos simultáneos intentan mover S1 y S2 a `posX` 9 y `posY` 6, una celda libre
- **THEN** exactamente uno de los dos responde `200` y queda en (9,6), y el otro recibe `409`
