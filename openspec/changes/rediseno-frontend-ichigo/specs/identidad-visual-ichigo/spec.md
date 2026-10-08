## ADDED Requirements

### Requirement: Tokens semánticos de la identidad Kakefuda
El sistema SHALL definir en `frontend/app/globals.css` los tokens semánticos de color de la
identidad de Ichigo: `background` (hinoki, `#E8DCC4`), `foreground` y `primary` (tinta sumi,
`#1F1813`), `card` (hinoki claro, `#F3EBDA`), `secondary` y `muted-foreground` (nogal,
`#5C4630`), `muted` (`#D9CBAE`), `border` (canto de madera, `#8A6A43`), `accent`,
`destructive` y `ring` (sello, `#9A2A19`) y `madera` (`#2B221B`) con `madera-foreground`
(`#F3EBDA`). Los componentes SHALL consumir esos tokens a través de las utilidades de
Tailwind y SHALL NOT escribir un color hexadecimal propio. El sistema SHALL ofrecer solo modo
claro.

#### Scenario: Ningún componente fija un color propio
- **WHEN** se buscan literales de color (`#` seguido de 3, 6 u 8 dígitos hexadecimales, `rgb(`,
  `hsl(`) en `frontend/src/components/**` y `frontend/app/**` excluyendo `globals.css`
- **THEN** no hay coincidencias

#### Scenario: Los tokens salen de una única definición
- **WHEN** se inspecciona el color de fondo calculado de `body` y del botón primario
- **THEN** coinciden con los valores de los tokens `background` y `primary` de `globals.css`

#### Scenario: Solo modo claro
- **WHEN** el navegador o el sistema operativo piden esquema oscuro (`prefers-color-scheme: dark`)
- **THEN** la interfaz mantiene los mismos colores claros, porque `globals.css` declara
  `color-scheme: light` y no define valores alternativos

### Requirement: Contrastes mínimos WCAG 2.1 AA de la paleta
Toda combinación de color de texto y fondo de la paleta SHALL alcanzar al menos 4,5:1. Los
bordes de los controles (campos, botones con contorno, tablillas) SHALL alcanzar al menos 3:1
contra el fondo sobre el que se dibujan. El rojo del sello (`accent`) SHALL usarse como texto
solo sobre `background`, `card` o `muted`, y SHALL NOT usarse como texto sobre `madera`;
sobre `madera` SHALL aparecer solo como relleno, con texto `accent-foreground`.

#### Scenario: Contraste de texto de las combinaciones definidas
- **WHEN** se calcula la relación de contraste de `foreground` sobre `background`, de
  `muted-foreground` sobre `background`, `card` y `muted`, de `accent` sobre `background`,
  `card` y `muted`, de `primary-foreground` sobre `primary`, de `accent-foreground` sobre
  `accent` y de `madera-foreground` sobre `madera`
- **THEN** cada relación es de al menos 4,5:1 (valores medidos al redactar esta spec: 12,9;
  6,5; 7,5; 5,5; 5,7; 6,5; 4,8; 14,8; 6,5 y 13,1)

#### Scenario: Contraste de bordes de controles
- **WHEN** se calcula el contraste de `border` contra `background` y contra `card`
- **THEN** es de al menos 3:1 (3,66 y 4,19 respectivamente)

#### Scenario: El rojo del sello nunca es texto sobre madera oscura
- **WHEN** se recorren las clases de los componentes que se dibujan sobre `madera`
- **THEN** ninguna aplica `text-accent` ni `text-destructive` sobre ese fondo
- **AND** todo elemento rojo sobre `madera` es un relleno `bg-accent` con texto
  `text-accent-foreground`

### Requirement: Tipografías auto-hosteadas con licencia OFL
El sistema SHALL cargar sus tipografías con `next/font/local` desde archivos versionados en
`frontend/src/fonts/`, sin descargarlas de un servicio externo al compilar ni al ejecutar:
Shippori Mincho para el nombre, fechas y títulos; Zen Kaku Gothic New para la interfaz, y Yuji
Syuku únicamente para la palabra «Ichigo». Cada fuente SHALL estar recortada a los caracteres
que la interfaz usa (latín, latín extendido, hiragana de «いちご» y los kanji de los sellos) y
el repositorio SHALL incluir el texto de la licencia OFL de cada una. Los títulos de las
pantallas y el texto japonés fuera del recorte SHALL tener una pila de fuentes de respaldo del
sistema.

#### Scenario: El repositorio trae las fuentes y sus licencias
- **WHEN** se lista `frontend/src/fonts/`
- **THEN** hay archivos `woff` de las tres familias y un archivo `OFL-*.txt` por cada una

#### Scenario: Ninguna pantalla pide fuentes a un tercero
- **WHEN** se abre cualquier página en el navegador con la pestaña de red abierta, con la
  caché vacía
- **THEN** no hay pedidos a `fonts.googleapis.com` ni a `fonts.gstatic.com`
- **AND** el código del frontend no importa `next/font/google`

#### Scenario: Yuji Syuku se usa solo para el nombre
- **WHEN** se inspecciona la familia tipográfica calculada de la palabra «Ichigo» del
  encabezado y de un título `h2` de la landing
- **THEN** el nombre usa Yuji Syuku seguida de Shippori Mincho y el título usa Shippori Mincho

### Requirement: Metadatos del documento
El sistema SHALL declarar el título del sitio como «Ichigo» con la plantilla `%s | Ichigo`, SHALL
declarar el idioma del documento como `es-AR` y SHALL asignar un título propio a cada
pantalla pública (inicio de reservas, elección de fecha y turno, disponibilidad, datos,
reserva registrada, consulta y no encontrada) que describa su contenido. La landing SHALL
mostrar solo «Ichigo».

#### Scenario: Título de una pantalla del flujo
- **WHEN** una persona abre `/reservas/consultar`
- **THEN** el título de la pestaña es «Consultá tu reserva | Ichigo»

#### Scenario: Título de la landing
- **WHEN** una persona abre `/`
- **THEN** el título de la pestaña es «Ichigo»

#### Scenario: Idioma del documento
- **WHEN** se carga cualquier página del sitio
- **THEN** el elemento `<html>` tiene el atributo `lang="es-AR"`

#### Scenario: Títulos distintos en pantallas distintas
- **WHEN** se comparan los títulos de `/reservas`, `/reservas/nueva`, `/reservas/nueva/datos`,
  `/reservas/nueva/resultado`, `/reservas/nueva/exito` y `/reservas/consultar`
- **THEN** no hay dos iguales y todos terminan en « | Ichigo»

### Requirement: Procedencia documentada de las imágenes
Toda imagen raster que se sirva desde `frontend/public/ichigo/` SHALL ser una fotografía
sintética o propia y SHALL estar listada en `frontend/public/ichigo/PROCEDENCIA.md` con su
herramienta de origen, la fecha, el prompt o autoría y su uso. Las imágenes SHALL NOT contener
texto, logotipos ni personas reconocibles, y SHALL llevar un texto alternativo descriptivo
cuando comunican contenido.

#### Scenario: Cada imagen del repositorio está documentada
- **WHEN** se compara la lista de archivos de `frontend/public/ichigo/` con las filas de
  `PROCEDENCIA.md`
- **THEN** cada archivo `.png` tiene su fila con herramienta, fecha, prompt y uso
- **AND** el documento aclara que las fotos no son de un local real

#### Scenario: El contenido ilustrativo se declara como tal
- **WHEN** se lee el pie de página de cualquier pantalla pública
- **THEN** dice que Ichigo es un restaurante ficticio y proyecto académico

#### Scenario: Texto alternativo en las fotografías
- **WHEN** se inspeccionan los elementos `<img>` de la landing
- **THEN** cada uno tiene un atributo `alt` no vacío que describe lo que se ve
