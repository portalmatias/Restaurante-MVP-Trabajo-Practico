## MODIFIED Requirements

### Requirement: Layout compartido y esqueleto de rutas
El sistema SHALL servir un layout compartido con encabezado y pie de página en todas las
rutas, y SHALL exponer `/` (landing), `/admin` y `/reservas` como páginas que usan ese layout.
El encabezado SHALL mostrar el nombre «Ichigo» como enlace a `/` y la navegación pública
(«Reservas» y «Consultar reserva»). El idioma del documento SHALL ser español rioplatense
(`es-AR`), y el título de cada página SHALL seguir la plantilla definida por la capability
`identidad-visual-ichigo`.

#### Scenario: La landing solo muestra el flujo del cliente
- **WHEN** una persona visita `/`
- **THEN** la página muestra un enlace a `/reservas`
- **AND** ni la página ni el encabezado muestran un enlace a `/admin` ni mencionan la
  administración

#### Scenario: El personal entra a la administración por URL directa
- **WHEN** una persona escribe la dirección `/admin` en el navegador
- **THEN** la página `/admin` se muestra con el mismo layout, aunque ninguna página pública la
  enlace

#### Scenario: Las rutas placeholder comparten el layout
- **WHEN** una persona visita `/admin` o `/reservas`
- **THEN** ambas páginas muestran el mismo pie de página que `/`

#### Scenario: El idioma del documento es español
- **WHEN** se carga cualquier página del sitio
- **THEN** el elemento `<html>` tiene el atributo `lang="es-AR"`

#### Scenario: El encabezado lleva el nombre del restaurante
- **WHEN** se carga cualquier página pública
- **THEN** el encabezado muestra «Ichigo» como enlace a `/`
- **AND** su navegación incluye «Reservas» y «Consultar reserva» y ningún enlace a `/admin`

### Requirement: Contraste de texto accesible
Todo texto SHALL alcanzar una relación de contraste de al menos 4.5:1 contra su fondo, usando
las combinaciones de tokens semánticos definidas para el sistema de diseño. Los bordes de los
controles de formulario y de los botones con contorno SHALL alcanzar al menos 3:1 contra el
fondo sobre el que se dibujan.

#### Scenario: Contraste de las combinaciones definidas
- **WHEN** se calcula la relación de contraste entre cada color de texto semántico (`primary`,
  `secondary`, `accent`, `foreground`, `card-foreground`, `muted-foreground`,
  `destructive`) y el fondo sobre el que el sistema de diseño lo define
- **THEN** la relación es de al menos 4.5:1 en cada combinación

#### Scenario: Contraste de los bordes de controles
- **WHEN** se calcula la relación de contraste entre el token `border` y los fondos `background`
  y `card`
- **THEN** la relación es de al menos 3:1 en ambos casos

### Requirement: Objetivos táctiles mínimos
Todo elemento interactivo SHALL tener un área táctil de al menos 44×44px. Como única
excepción, las acciones compactas de fila de las tablas del panel de administración
(`BotonCompacto`) SHALL tener al menos 36px de alto cuando el dispositivo de entrada principal
es un puntero fino (`pointer: fine`), y SHALL conservar los 44px en pantallas táctiles.

#### Scenario: Tamaño mínimo de un botón
- **WHEN** se mide el área táctil renderizada de cualquier variante de `Button` o de un enlace
  de la navegación
- **THEN** el ancho y el alto son de al menos 44px cada uno

#### Scenario: Acción de fila en una pantalla táctil
- **WHEN** se mide un `BotonCompacto` del listado de reservas en un dispositivo con
  `pointer: coarse`
- **THEN** su alto es de al menos 44px

#### Scenario: Acción de fila con mouse
- **WHEN** se mide un `BotonCompacto` del listado de reservas en un dispositivo con
  `pointer: fine`
- **THEN** su alto es de al menos 36px
