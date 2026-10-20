## ADDED Requirements

### Requirement: Calendario mensual siempre visible para elegir la fecha
El Paso 1 de `/reservas/nueva` SHALL reemplazar el campo de fecha por un calendario mensual
siempre visible (componente `Calendario`, `frontend/src/components/ui/calendario.tsx`), rotulado
«Fecha». El calendario SHALL mostrar un mes por vez, con la semana empezando el lunes, y botones
«Mes anterior» y «Mes siguiente». «Mes anterior» SHALL estar deshabilitado en el mes de hoy y
«Mes siguiente» en el mes del último día elegible. Elegir un día elegible SHALL fijar la fecha
del asistente y SHALL anunciar «Elegiste el <fecha completa>.» en una región `aria-live`; sin
fecha SHALL mostrar «Elegí un día del calendario.». El calendario es una ayuda de navegación: la
validación real de la fecha y de la anticipación de cada zona sigue siendo la del servidor.

#### Scenario: La semana empieza el lunes
- **WHEN** se muestra un mes cuyo día 1 cae un miércoles
- **THEN** los encabezados de columna van de lunes a domingo
- **AND** el día 1 queda en la tercera columna, precedido por dos celdas vacías

#### Scenario: Elegir un día elegible
- **WHEN** la persona activa un día elegible, por ejemplo el sábado 19 de septiembre de 2026
- **THEN** ese día queda con `aria-pressed="true"` y es el único con ese estado
- **AND** aparece «Elegiste el sábado 19 de septiembre de 2026.»

#### Scenario: Límites de la navegación por meses
- **WHEN** se muestra el mes de hoy
- **THEN** «Mes anterior» está deshabilitado
- **AND** al llegar al mes que contiene el último día elegible, «Mes siguiente» está deshabilitado

### Requirement: Días no elegibles distinguidos por texto
El calendario SHALL tratar como no elegible todo día anterior a hoy, todo día cuyo día de la
semana no tiene turnos activos («cerrado») y todo día posterior al máximo de anticipación de
cualquier zona (hoy más el mayor `anticipacionMaxDias` de las zonas). Un día no elegible SHALL
llevar `aria-disabled="true"`, SHALL seguir siendo enfocable con el teclado, SHALL NOT fijar la
fecha al activarlo y SHALL distinguirse por texto y no solo por color: su nombre accesible
termina en «, cerrado» (día de la semana sin turnos) o «, no disponible» (anterior a hoy o más
allá del máximo), y los días cerrados se muestran tachados con la leyenda visible «Los días
tachados están cerrados.».

#### Scenario: Día pasado
- **WHEN** se inspecciona un día anterior a hoy
- **THEN** tiene `aria-disabled="true"` y su nombre accesible termina en «, no disponible»

#### Scenario: Día de la semana sin turnos
- **WHEN** ningún turno activo corresponde a los lunes y se inspecciona un lunes futuro
- **THEN** tiene `aria-disabled="true"`, su nombre accesible termina en «, cerrado» y se muestra
  tachado

#### Scenario: Más allá del máximo de anticipación
- **WHEN** las zonas admiten 30 y 60 días de anticipación y se inspecciona el día 61 contando
  desde hoy
- **THEN** tiene `aria-disabled="true"` y su nombre accesible termina en «, no disponible»
- **AND** el día 60 contando desde hoy, si su día de la semana tiene turnos, es elegible

#### Scenario: Activar un día no elegible no elige nada
- **WHEN** la persona activa un día no elegible
- **THEN** la fecha del asistente no cambia

### Requirement: Nombre accesible completo y marca del día de hoy
Cada día del calendario SHALL ser un `<button>` cuyo nombre accesible es la fecha completa en
español («sábado 19 de septiembre de 2026»), seguida de «, hoy» si es el día de hoy y del sufijo
de no elegibilidad que corresponda. Los encabezados de columna SHALL tener como nombre accesible
el día de la semana completo («lunes»); la abreviatura y el kanji que los acompañan SHALL ser
decorativos (`aria-hidden="true"`). El día de hoy SHALL distinguirse además visualmente por
negrita y subrayado, no solo por color.

#### Scenario: Nombre accesible de un día
- **WHEN** se consulta el nombre accesible del botón del 19 de septiembre de 2026 siendo ese día
  hoy y elegible
- **THEN** es «sábado 19 de septiembre de 2026, hoy»

#### Scenario: Encabezados de columna
- **WHEN** se consultan los encabezados de columna con un lector de pantalla
- **THEN** se leen «lunes», «martes», … «domingo» y no las abreviaturas ni los kanji

### Requirement: Navegación por teclado con tabulación móvil
El calendario SHALL poner un solo día en el orden de tabulación (tabulación móvil): el día
enfocado si pertenece al mes visible o, si no, el primer día visible que no sea anterior a hoy.
Con el foco en un día, las flechas izquierda y derecha SHALL mover el foco un día, arriba y
abajo una semana, Inicio y Fin al lunes y al domingo de esa semana, RePág y AvPág un mes
(conservando el día, o el último del mes si ese día no existe). Si el destino cae en otro mes,
el calendario SHALL mostrar ese mes y mover allí el foco. Un destino anterior a hoy o posterior
al último día elegible SHALL ignorarse y el foco no se mueve. Las teclas de movimiento SHALL
impedir el desplazamiento de la página.

#### Scenario: Un solo día en el orden de tabulación
- **WHEN** se cuentan los botones de día con `tabindex="0"` en el mes visible
- **THEN** hay exactamente uno

#### Scenario: Flechas y semana
- **WHEN** el foco está en un miércoles y se presionan la flecha derecha, la flecha abajo, Inicio
  y Fin (cada una desde el miércoles)
- **THEN** el foco pasa al jueves, al miércoles de la semana siguiente, al lunes y al domingo de
  esa semana, respectivamente

#### Scenario: Cambio de mes con RePág y AvPág
- **WHEN** el foco está en el 31 de enero de 2027 y se presiona AvPág
- **THEN** el calendario muestra febrero y el foco queda en el 28 de febrero

#### Scenario: No se sale del rango elegible
- **WHEN** el foco está en hoy y se presiona la flecha izquierda
- **THEN** el foco no se mueve

### Requirement: El día de hoy lo calcula el servidor
La fecha de hoy que usa el calendario (para marcar el día y para decidir qué días son pasados)
SHALL calcularla el servidor (`app/reservas/nueva/page.tsx`) con el offset fijo de Argentina
(UTC−3) y pasarla como propiedad; el cliente SHALL NOT calcularla con el reloj del navegador ni
con la zona horaria del dispositivo. Los cálculos de fechas del calendario SHALL hacerse con
`Date.UTC` y `getUTC*`, de modo que el resultado no dependa del huso del dispositivo.

#### Scenario: Hoy no depende del dispositivo
- **WHEN** el navegador tiene configurado un huso distinto del de Argentina y son las 22:30 en
  Argentina
- **THEN** el día marcado como hoy es el día calendario de Argentina

#### Scenario: Cambio de día a medianoche de Argentina
- **WHEN** el servidor calcula la fecha de hoy a partir del instante `2026-09-20T02:30:00Z`
  (23:30 del 19 en Argentina)
- **THEN** la propiedad `hoy` que recibe el calendario es `2026-09-19`
