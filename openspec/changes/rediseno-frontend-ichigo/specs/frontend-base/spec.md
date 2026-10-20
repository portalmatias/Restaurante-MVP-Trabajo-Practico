## MODIFIED Requirements

### Requirement: Layout compartido y esqueleto de rutas
El sistema SHALL servir un layout compartido con encabezado y pie de página públicos en todas
las rutas públicas (`/` y `/reservas/**`), y SHALL exponer `/admin` como página accesible por URL
directa. Las rutas `/admin` y las que cuelgan de `/admin/` SHALL NOT mostrar el encabezado ni
el pie públicos: el panel tiene su propio encabezado y su propia navegación. La decisión SHALL
tomarse por la ruta exacta (`/admin` o prefijo `/admin/`), de modo que una ruta como
`/administrar` conserve el marco público. El encabezado público SHALL mostrar el nombre «Ichigo» como enlace a `/` y la navegación pública
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
- **THEN** la página `/admin` se muestra, aunque ninguna página pública la enlace

#### Scenario: Las rutas placeholder comparten el layout
- **WHEN** una persona visita `/` o `/reservas` (rutas públicas, entre ellas la página placeholder)
- **THEN** ambas páginas muestran el mismo encabezado y el mismo pie de página

#### Scenario: El panel de administración no muestra el marco público
- **WHEN** se visita `/admin`, `/admin/login`, `/admin/reservas` o `/admin/salon`
- **THEN** la página no muestra el encabezado público («Ichigo», «Reservas», «Consultar
  reserva») ni el pie «Ichigo es un restaurante ficticio…»
- **AND** el contenido sigue dentro de un único elemento `main`

#### Scenario: Una ruta parecida a /admin conserva el marco público
- **WHEN** se evalúa una ruta como `/administrar`
- **THEN** se la trata como pública y muestra el encabezado y el pie

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
(`BotonCompacto`) SHALL tener al menos 36px de alto solo cuando ningún dispositivo de entrada
disponible es un puntero grueso (no coincide `any-pointer: coarse`), y SHALL conservar los 44px
cuando lo haya. Así un equipo híbrido (pantalla táctil con mouse) conserva el área táctil
completa.

#### Scenario: Tamaño mínimo de un botón
- **WHEN** se mide el área táctil renderizada de cualquier variante de `Button` o de un enlace
  de la navegación
- **THEN** el ancho y el alto son de al menos 44px cada uno

#### Scenario: Acción de fila en una pantalla táctil
- **WHEN** se mide un `BotonCompacto` del listado de reservas en un dispositivo con
  `any-pointer: coarse`
- **THEN** su alto es de al menos 44px

#### Scenario: Equipo híbrido con pantalla táctil y mouse
- **WHEN** se mide un `BotonCompacto` en un dispositivo cuyo puntero principal es fino pero que
  también tiene una pantalla táctil (`any-pointer: coarse`)
- **THEN** su alto es de al menos 44px

#### Scenario: Acción de fila con mouse
- **WHEN** se mide un `BotonCompacto` del listado de reservas en un dispositivo sin
  `any-pointer: coarse`
- **THEN** su alto es de al menos 36px
