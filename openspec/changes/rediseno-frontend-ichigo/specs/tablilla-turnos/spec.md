## ADDED Requirements

### Requirement: Tablilla como control de selección de turno
El sistema SHALL ofrecer el componente `Tablilla`, un `<button type="button">` que representa un
turno como una tablilla de madera colgada. SHALL exponer su estado con `aria-pressed`
(`true` solo cuando es la elegida) y SHALL aceptar un nombre accesible en español mediante
`aria-label`. El texto principal y el detalle SHALL ir siempre en español y en horizontal. El
objetivo táctil de una tablilla SHALL ser de al menos 44×44px.

#### Scenario: Tablilla libre
- **WHEN** se renderiza una `Tablilla` en estado `libre`
- **THEN** es un botón con `aria-pressed="false"`, habilitado
- **AND** su texto principal se lee en horizontal

#### Scenario: Tablilla elegida
- **WHEN** se renderiza una `Tablilla` en estado `elegida`
- **THEN** tiene `aria-pressed="true"` y queda de frente con el borde marcado y el sello
- **AND** el sello es decorativo (`aria-hidden="true"`)

#### Scenario: Nombre accesible en español
- **WHEN** se renderiza una `Tablilla` con `aria-label="20:00 a 23:30"`
- **THEN** su nombre accesible es «20:00 a 23:30» y no incluye el texto japonés

#### Scenario: Objetivo táctil
- **WHEN** se mide una `Tablilla` renderizada a 390px de ancho
- **THEN** su ancho y su alto son de al menos 44px

### Requirement: Estados descartada y completa
Cuando una persona elige una tablilla, las demás SHALL pasar al estado `descartada`: se dan
vuelta mostrando la madera oscura con su texto atenuado y SHALL seguir siendo tocables para
cambiar la elección. Una tablilla en estado `completa` SHALL mostrarse boca abajo con un sello
de «completo», SHALL estar deshabilitada, SHALL NOT exponer `aria-pressed` y SHALL anunciar
«Completo» a los lectores de pantalla.

#### Scenario: Las demás se dan vuelta pero siguen tocables
- **WHEN** hay tres tablillas y la persona toca la segunda
- **THEN** la segunda queda `aria-pressed="true"` y las otras dos pasan a `descartada`
- **AND** las otras dos siguen habilitadas y, al tocar una, esa pasa a `elegida`

#### Scenario: Turno completo
- **WHEN** se renderiza una `Tablilla` en estado `completa`
- **THEN** el botón está deshabilitado y no tiene atributo `aria-pressed`
- **AND** el texto «Completo» está disponible para lectores de pantalla

#### Scenario: Exactamente una elegida
- **WHEN** la persona elige turnos sucesivamente
- **THEN** en todo momento hay como máximo una tablilla con `aria-pressed="true"`

### Requirement: Texto japonés solo decorativo
Una `Tablilla` o `TablillaPaso` SHALL poder mostrar un equivalente japonés del título en
vertical al costado. Ese texto SHALL tener `aria-hidden="true"` y `lang="ja"`, SHALL NOT ser el
único portador de información y SHALL NOT reemplazar al español.

#### Scenario: El japonés queda fuera del árbol de accesibilidad
- **WHEN** se renderiza una tablilla con `japones="夕食"`
- **THEN** el elemento que lo contiene tiene `aria-hidden="true"` y `lang="ja"`
- **AND** el título en español sigue visible en horizontal

#### Scenario: Sin japonés, la tablilla funciona igual
- **WHEN** se renderiza una tablilla sin la propiedad `japones`
- **THEN** no se muestra ningún texto vertical y el resto del contenido no cambia de lugar

### Requirement: TablillaPaso informativa
El sistema SHALL ofrecer el componente `TablillaPaso`, una tablilla que solo informa: SHALL NOT
ser un control, SHALL NOT recibir foco de teclado y SHALL mostrar el mismo texto bilingüe
(español horizontal, japonés vertical decorativo).

#### Scenario: No es interactiva
- **WHEN** se navega con la tecla Tab por una lista de `TablillaPaso`
- **THEN** el foco no se detiene en ninguna de ellas

#### Scenario: Se usa dentro de una lista
- **WHEN** la landing muestra los tres tiempos del omakase
- **THEN** cada `TablillaPaso` está dentro de un elemento `<li>` de una lista ordenada
