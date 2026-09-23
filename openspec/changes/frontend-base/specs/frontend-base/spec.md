## Purpose

Define el layout compartido, el esqueleto de rutas, el sistema de diseño (tokens, tipografía,
accesibilidad y estilo mobile-first) y el cliente HTTP tipado que usan todas las pantallas del
frontend. Es la base sobre la que `frontend-cliente` y `frontend-admin` construyen sus
pantallas reales; este change no implementa ningún flujo de negocio.

Salvo que un escenario diga otra cosa: el viewport de referencia mobile es 375px de ancho
(iPhone SE / gama baja), y los de verificación adicionales son 768px (tablet), 1024px
(notebook chica) y 1440px (escritorio). Los tokens de color referidos son los definidos en
este change: `primary` (`#171717` sobre `#FFFFFF`), `secondary` (`#404040` sobre `#FFFFFF`),
`accent` (`#A16207` sobre `#FFFFFF`), `background`/`card` (`#FFFFFF`),
`foreground`/`card-foreground` (`#171717`), `muted` (`#E8ECF0`) con `muted-foreground`
(`#475569`), `border` (`#E5E5E5`), `destructive` (`#DC2626` sobre `#FFFFFF`) y `ring`
(`#171717`).

## ADDED Requirements

### Requirement: Layout compartido y esqueleto de rutas
El sistema SHALL servir un layout compartido con encabezado y pie de página en todas las
rutas, y SHALL exponer `/` (landing), `/admin` y `/reservas` como páginas placeholder que usan
ese layout. Ninguna de las tres SHALL contener lógica de negocio, autenticación ni las
pantallas reales de reserva o administración: eso es alcance de `frontend-cliente` y
`frontend-admin`.

#### Scenario: La landing enlaza a los dos flujos
- **WHEN** una persona visita `/`
- **THEN** la página muestra un enlace a `/reservas` y un enlace a `/admin`

#### Scenario: Las rutas placeholder comparten el layout
- **WHEN** una persona visita `/admin` o `/reservas`
- **THEN** ambas páginas muestran el mismo encabezado y pie de página que `/`

#### Scenario: El idioma del documento es español
- **WHEN** se carga cualquier página del sitio
- **THEN** el elemento `<html>` tiene el atributo `lang="es"`

### Requirement: Tokens de diseño como única fuente de color
Todo color visible en un componente de la interfaz (fondo, texto, borde, foco) SHALL provenir
de un token semántico definido centralmente. Ningún componente de la interfaz SHALL fijar un
color mediante un valor hexadecimal u otro literal de color escrito directamente en su propio
código.

#### Scenario: Un componente de la UI usa un token, no un literal
- **WHEN** se inspecciona el color de fondo calculado de una primitiva de la UI (por ejemplo,
  `Button` en su variante primaria)
- **THEN** el valor coincide con el del token semántico correspondiente (`primary`)
- **AND** el código fuente del componente no contiene un valor hexadecimal de color

### Requirement: Estilo mobile-first
Las hojas de estilo SHALL definir primero las reglas para pantallas angostas (sin prefijo de
breakpoint, pensadas para 375px de ancho) y SHALL agregar o ajustar reglas para pantallas más
grandes únicamente mediante breakpoints de ancho mínimo (`sm:`, `md:`, `lg:` o equivalentes).
Ninguna regla de estilo SHALL definirse primero para escritorio y luego recortarse para
mobile con un breakpoint de ancho máximo.

#### Scenario: Las reglas base son las de mobile
- **WHEN** se inspecciona la hoja de estilos de un componente compartido (por ejemplo, el
  layout o una primitiva de la UI)
- **THEN** las clases sin prefijo de breakpoint son las que rigen a 375px de ancho
- **AND** cualquier clase con prefijo `sm:`, `md:` o `lg:` solo agrega o cambia estilos para
  anchos iguales o mayores al de ese prefijo

#### Scenario: Sin scroll horizontal en ningún viewport de referencia
- **WHEN** se renderiza `/`, `/admin` o `/reservas` con un ancho de viewport de 375px, 768px,
  1024px o 1440px
- **THEN** ningún elemento del documento produce scroll horizontal

#### Scenario: Las acciones primarias son alcanzables en mobile
- **WHEN** se renderiza una pantalla con una acción primaria (por ejemplo, el botón `primary`
  de `Button` dentro del layout) a 375px de ancho
- **THEN** esa acción ocupa el ancho completo disponible del contenedor
- **AND** queda ubicada dentro de la mitad inferior de la pantalla o al final natural del
  flujo de contenido, sin requerir scroll adicional para descubrirla

#### Scenario: La navegación no depende de hover
- **WHEN** se interactúa con la navegación del encabezado usando solo foco de teclado o toque,
  sin disparar eventos de `hover`
- **THEN** todos los enlaces de la navegación son visibles y accionables sin que un estado
  `hover` sea necesario para mostrarlos o para operarlos

### Requirement: Contraste de texto accesible
Todo texto SHALL alcanzar una relación de contraste de al menos 4.5:1 contra su fondo, usando
las combinaciones de tokens semánticos definidas para el sistema de diseño.

#### Scenario: Contraste de las combinaciones definidas
- **WHEN** se calcula la relación de contraste entre cada color de texto semántico (`primary`,
  `secondary`, `accent`, `foreground`, `card-foreground`, `muted-foreground`,
  `destructive`) y el fondo sobre el que este change lo define
- **THEN** la relación es de al menos 4.5:1 en cada combinación

### Requirement: Foco visible y navegación por teclado
Todo elemento interactivo (enlace, botón, campo de formulario, control de selección) SHALL
mostrar un indicador de foco visible cuando recibe el foco del teclado, y SHALL ser alcanzable
y operable navegando únicamente con teclado.

#### Scenario: El foco de teclado es visible
- **WHEN** se navega con la tecla Tab hasta un elemento interactivo de la interfaz
- **THEN** ese elemento muestra un anillo de foco visible con contraste suficiente contra su
  fondo

#### Scenario: Toda la interfaz es alcanzable sin mouse
- **WHEN** se recorre una página con la tecla Tab desde el principio del documento
- **THEN** el foco pasa por todos los elementos interactivos de esa página en un orden
  coherente con el orden visual, sin quedar atrapado ni saltear ninguno

### Requirement: Campos de formulario accesibles
Todo campo de formulario de las primitivas de la UI SHALL tener una etiqueta (`<label>`)
visible y asociada al control, nunca solo un `placeholder` a modo de etiqueta. Cuando el campo
tiene un error de validación, el mensaje de error SHALL mostrarse junto al campo y SHALL estar
asociado a él mediante `aria-describedby`.

#### Scenario: La etiqueta está asociada al campo
- **WHEN** se renderiza la primitiva `Field` con una etiqueta
- **THEN** el elemento `<label>` está asociado al control mediante `htmlFor`/`id`
- **AND** el control es identificable por su nombre accesible cuando se lo busca por rol y
  etiqueta (por ejemplo, con `getByRole` y su `name` accesible)

#### Scenario: El error queda enlazado al campo
- **WHEN** se renderiza la primitiva `Field` con un mensaje de error
- **THEN** el control tiene `aria-describedby` apuntando al `id` del texto de error
- **AND** el texto de error es visible junto al campo, no solo dentro de un resumen aparte

### Requirement: Objetivos táctiles mínimos
Todo elemento interactivo SHALL tener un área táctil de al menos 44×44px.

#### Scenario: Tamaño mínimo de un botón
- **WHEN** se mide el área táctil renderizada de cualquier variante de `Button` o de un enlace
  de la navegación
- **THEN** el ancho y el alto son de al menos 44px cada uno

### Requirement: Iconografía accesible
Cuando la interfaz use un ícono, SHALL ser un ícono SVG, nunca un carácter emoji. Un ícono que
solo decora sin aportar información adicional SHALL marcarse como decorativo
(`aria-hidden="true"`); un ícono que es el único contenido de un control interactivo SHALL
tener un nombre accesible mediante texto alternativo o `aria-label`.

#### Scenario: Ícono decorativo no interfiere con el lector de pantalla
- **WHEN** la interfaz muestra un ícono junto a un texto que ya expresa el mismo significado
- **THEN** el ícono es un SVG marcado con `aria-hidden="true"`

#### Scenario: Ícono como único contenido de un control tiene nombre accesible
- **WHEN** la interfaz muestra un control interactivo cuyo único contenido visual es un ícono
- **THEN** ese control expone un nombre accesible mediante `aria-label` o texto alternativo, no
  solo el ícono

### Requirement: Cliente HTTP con tipos generados desde el contrato
El sistema SHALL derivar los tipos del cliente HTTP exclusivamente del contrato
`openapi/openapi.yaml`, regenerándolos con una herramienta de generación de tipos. Ningún tipo
del cliente HTTP SHALL escribirse a mano, y el cliente SHALL exponer tipos únicamente para los
paths presentes en el contrato en el momento de generarlos.

#### Scenario: Regenerar tipos refleja un cambio del contrato
- **WHEN** se agrega un campo a un schema de `openapi/openapi.yaml` y se regeneran los tipos
  del cliente
- **THEN** el tipo generado para ese schema incluye el campo nuevo, sin edición manual

#### Scenario: Un path ausente del contrato no compila
- **WHEN** código del frontend intenta invocar al cliente HTTP con un path que no existe en
  `openapi/openapi.yaml`
- **THEN** el chequeo de tipos (`tsc --noEmit`) falla para ese código, antes de llegar a
  ejecutarse

#### Scenario: La URL base sale de configuración
- **WHEN** el cliente HTTP arma una petición
- **THEN** usa como URL base el valor de la variable de entorno `NEXT_PUBLIC_API_URL`, sin una
  URL fija escrita en el código

### Requirement: Mapeo tipado de errores de la API
El cliente HTTP SHALL traducir toda respuesta de error de la API a un resultado tipado y
discriminable de una respuesta exitosa, preservando la información que la API envía en cada
forma de error.

#### Scenario: Error 400 con lista de mensajes
- **WHEN** la API responde `400` con `ErrorRespuesta` cuyo `message` es una lista de textos
- **THEN** el resultado tipado del cliente expone esa lista de mensajes, sin descartar ninguno

#### Scenario: Error 404 con mensaje único
- **WHEN** la API responde `404` con `ErrorRespuesta` cuyo `message` es un único texto
- **THEN** el resultado tipado del cliente expone ese texto

#### Scenario: Error 409 con motivos de negocio
- **WHEN** la API responde `409` con un cuerpo que incluye `motivos` (`MotivoNoDisponible[]`)
- **THEN** el resultado tipado del cliente expone cada motivo con su `codigo` y su `mensaje`,
  en el mismo orden en que la API los envió

#### Scenario: Respuesta exitosa se distingue del error
- **WHEN** la API responde con un código `2xx`
- **THEN** el resultado del cliente expone los datos de la respuesta y no expone ningún campo
  de error
