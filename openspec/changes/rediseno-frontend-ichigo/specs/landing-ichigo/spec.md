## ADDED Requirements

### Requirement: Landing mobile-first de una columna
La página `/` SHALL presentar el contenido en una sola columna hasta el breakpoint `md`
(768px) y SHALL pasar a una grilla de varias columnas desde ahí. A 390px de ancho SHALL NOT haber
desplazamiento horizontal de la página. Todo enlace y botón SHALL tener un objetivo táctil de
al menos 44px de alto.

#### Scenario: Una columna en celular
- **WHEN** se abre `/` con un viewport de 390px de ancho
- **THEN** las secciones se apilan en una columna
- **AND** el ancho del documento no supera el del viewport

#### Scenario: Varias columnas en escritorio
- **WHEN** se abre `/` con un viewport de 1440px de ancho
- **THEN** la apertura muestra el texto y la fotografía lado a lado

#### Scenario: Objetivos táctiles
- **WHEN** se miden los enlaces «Reservar una mesa», «Ya tengo un código» y «Elegir fecha y
  turno» a 390px
- **THEN** cada uno mide al menos 44px de alto

### Requirement: Acción principal antes que la foto en celular
La landing SHALL mostrar, antes de cualquier fotografía en el orden del documento y del foco,
el nombre «Ichigo» como `h1`, la propuesta y la acción principal «Reservar una mesa», que SHALL
enlazar a `/reservas`. La acción secundaria «Ya tengo un código» SHALL enlazar a
`/reservas/consultar`. La acción principal SHALL ser visible sin desplazarse a 390×844px.

#### Scenario: Acción visible en el primer viewport
- **WHEN** se abre `/` a 390×844px sin desplazarse
- **THEN** «Reservar una mesa» está completamente dentro del viewport

#### Scenario: Orden del documento
- **WHEN** se recorre el DOM de `/` en orden
- **THEN** el `h1` y el enlace «Reservar una mesa» aparecen antes que la primera imagen

#### Scenario: Sin enlaces a la administración
- **WHEN** se inspeccionan los enlaces de `/` y del encabezado
- **THEN** ninguno apunta a `/admin`

### Requirement: Contenido ilustrativo que no contradice datos reales
La landing SHALL presentar sus textos y fotografías como ilustrativos y SHALL NOT afirmar
cifras, horarios, precios, nombres de personas, premios ni reseñas. Los turnos, las zonas y
los lugares libres reales SHALL obtenerse únicamente en el flujo de reserva, a partir de la API.
Los tres tiempos del omakase (nombres y equivalentes japoneses) y los pasos de «Así se
reserva» SHALL describir el servicio sin comprometer datos del sistema.

#### Scenario: Ningún dato del sistema en la landing
- **WHEN** se lee el texto completo de `/`
- **THEN** no contiene precios, horarios de turnos, cantidades de lugares ni cifras de aforo

#### Scenario: Los pasos de reserva coinciden con el flujo real
- **WHEN** se compara «Así se reserva» con el flujo de `/reservas/nueva`
- **THEN** los tres pasos (elegir fecha, turno y comensales; dejar nombre, email y teléfono sin
  cuenta; guardar el código para consultar o cancelar) describen lo que el flujo hace

#### Scenario: Cierre con la acción repetida
- **WHEN** la persona llega al final de `/`
- **THEN** encuentra un enlace «Elegir fecha y turno» que lleva a `/reservas/nueva`

### Requirement: Fotografías sintéticas optimizadas y sin bloquear el contenido
La landing SHALL mostrar cinco fotografías sintéticas servidas con `next/image`, cada una con
dimensiones declaradas (para evitar saltos de maquetación), `sizes` acorde con su ancho, y
`priority` únicamente en la de la apertura. El texto de la landing SHALL ser legible aunque
ninguna imagen cargue.

#### Scenario: Sin saltos de maquetación
- **WHEN** se carga `/` con la red limitada y se mide el desplazamiento acumulado de diseño
- **THEN** es menor que 0,1

#### Scenario: Texto sin imágenes
- **WHEN** se bloquean los pedidos de imágenes y se abre `/`
- **THEN** el nombre, la propuesta, las secciones y las acciones siguen visibles y operables

#### Scenario: Una sola imagen prioritaria
- **WHEN** se inspecciona el HTML servido de `/`
- **THEN** solo la fotografía de la apertura se precarga con alta prioridad
