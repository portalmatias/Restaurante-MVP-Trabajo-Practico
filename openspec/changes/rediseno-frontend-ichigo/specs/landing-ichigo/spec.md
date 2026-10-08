## ADDED Requirements

### Requirement: Landing mobile-first de una columna
La página `/` SHALL presentar el contenido en una sola columna hasta el breakpoint `md`
(768px) y SHALL pasar a una grilla de varias columnas desde ahí. A 390px de ancho SHALL NOT haber
desplazamiento horizontal de la página. Todo enlace y botón SHALL cumplir el objetivo táctil
de al menos 44×44px que fija `frontend-base`.

#### Scenario: Una columna en celular
- **WHEN** se abre `/` con un viewport de 390px de ancho
- **THEN** las secciones se apilan en una columna
- **AND** el ancho del documento no supera el del viewport

#### Scenario: Varias columnas en escritorio
- **WHEN** se abre `/` con un viewport de 1440px de ancho
- **THEN** la apertura muestra el texto y la fotografía lado a lado

#### Scenario: Objetivos táctiles
- **WHEN** se miden los enlaces «Reservá una mesa», «Ya tengo un código» y «Elegí fecha y
  turno» a 390px
- **THEN** cada uno mide al menos 44px de ancho y 44px de alto

### Requirement: Acción principal antes que la foto en celular
La landing SHALL mostrar, antes de cualquier fotografía en el orden del documento y del foco,
el nombre «Ichigo» como `h1`, la propuesta «Omakase japonés. Cada bocado, una sorpresa.» y la
acción principal «Reservá una mesa», que SHALL enlazar a `/reservas`. Las etiquetas de las
acciones de la landing SHALL usar voseo rioplatense, como exige `frontend-cliente`. La acción secundaria «Ya tengo un código» SHALL enlazar a
`/reservas/consultar`. La acción principal SHALL ser visible sin desplazarse a 390×844px.

#### Scenario: Acción visible en el primer viewport
- **WHEN** se abre `/` a 390×844px sin desplazarse
- **THEN** «Reservá una mesa» está completamente dentro del viewport

#### Scenario: Orden del documento
- **WHEN** se recorre el DOM de `/` en orden
- **THEN** el `h1` y el enlace «Reservá una mesa» aparecen antes que la primera imagen

#### Scenario: Propuesta de apertura
- **WHEN** se lee el texto que sigue al `h1` en la apertura de `/`
- **THEN** dice «Omakase japonés. Cada bocado, una sorpresa.»

#### Scenario: Voseo en las acciones
- **WHEN** se leen las etiquetas de los enlaces de acción de `/`
- **THEN** ninguna usa el infinitivo impersonal («Reservar», «Elegir») ni el tuteo

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
- **THEN** los tres pasos (elegir fecha, turno, zona y comensales; dejar nombre, email y teléfono
  sin cuenta; guardar el código para consultar o cancelar) describen lo que el flujo hace

#### Scenario: Cierre con la acción repetida
- **WHEN** la persona llega al final de `/`
- **THEN** encuentra un enlace «Elegí fecha y turno» que lleva a `/reservas/nueva`

### Requirement: Fotografías sintéticas optimizadas y sin bloquear el contenido
La landing SHALL mostrar cinco fotografías sintéticas en formato WebP servidas con
`next/image`. Los cinco archivos de `frontend/public/ichigo/` SHALL pesar en total menos de
300 KB (hoy unos 240 KB). Cada una SHALL tener
dimensiones declaradas (para evitar saltos de maquetación), `sizes` acorde con su ancho, y
`priority` únicamente en la de la apertura. El texto de la landing SHALL ser legible aunque
ninguna imagen cargue.

#### Scenario: Imágenes en WebP y livianas
- **WHEN** se listan los archivos de imagen de `frontend/public/ichigo/` y se suman sus tamaños
- **THEN** los cinco son `.webp`, no hay `.png` y la suma es menor que 300 KB

#### Scenario: Sin saltos de maquetación
- **WHEN** se carga `/` con la red limitada y se mide el desplazamiento acumulado de diseño
- **THEN** es menor que 0,1

#### Scenario: Texto sin imágenes
- **WHEN** se bloquean los pedidos de imágenes y se abre `/`
- **THEN** el nombre, la propuesta, las secciones y las acciones siguen visibles y operables

#### Scenario: Una sola imagen prioritaria
- **WHEN** se inspecciona el HTML servido de `/`
- **THEN** solo la fotografía de la apertura se precarga con alta prioridad
