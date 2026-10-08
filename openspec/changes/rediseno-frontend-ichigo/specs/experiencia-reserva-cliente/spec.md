## ADDED Requirements

### Requirement: Los turnos del día se eligen como tablillas
En el Paso 1 de `/reservas/nueva`, una vez elegida una fecha elegible, el sistema SHALL ofrecer
los turnos de ese día de la semana como un grupo de `Tablilla` rotulado «Turno», en lugar de un
control `<select>`. Cada tablilla SHALL mostrar la hora de inicio, «a» y la hora de fin, y SHALL
tener como nombre accesible el rango completo (por ejemplo, «20:00 a 23:30»). Mientras no haya
fecha elegible, el sistema SHALL mostrar el texto «Elegí una fecha para ver los turnos de ese
día». Elegir una tablilla SHALL fijar el `turnoId` del asistente sin cambiar las reglas de
validación ni los parámetros de URL que ya definía `frontend-cliente`.

#### Scenario: Turnos como botones dentro de un grupo
- **WHEN** la persona elige una fecha con dos turnos activos
- **THEN** el grupo «Turno» contiene dos botones con `aria-pressed="false"` cuyos nombres son los
  rangos horarios de cada turno

#### Scenario: Elegir un turno descarta a los demás
- **WHEN** la persona toca la tablilla de la cena
- **THEN** esa tablilla queda con `aria-pressed="true"`
- **AND** la del almuerzo pasa a descartada pero sigue habilitada

#### Scenario: Sin fecha, sin turnos
- **WHEN** el campo de fecha está vacío o contiene una fecha no elegible
- **THEN** no se muestra ninguna tablilla y aparece el texto «Elegí una fecha para ver los
  turnos de ese día»

#### Scenario: Los turnos fuera del día no se ofrecen
- **WHEN** la fecha elegida cae en un día en que un turno no está activo
- **THEN** ese turno no aparece como tablilla

### Requirement: La acción de continuar queda alcanzable en celular
En el Paso 1, el botón de continuar SHALL permanecer fijo al pie del viewport (`sticky`) en
pantallas menores a 640px, con fondo opaco y borde superior, y SHALL volver a la posición
normal desde 640px.

#### Scenario: Botón fijo en celular
- **WHEN** se abre `/reservas/nueva` a 390×844px y se desplaza la página
- **THEN** el botón de continuar permanece visible al pie del viewport

#### Scenario: Botón normal en escritorio
- **WHEN** se abre `/reservas/nueva` a 1440px de ancho
- **THEN** el botón de continuar está en el flujo del documento, no fijo

### Requirement: Pantalla cuando no hay nada para reservar
Si el catálogo no trae zonas o no trae turnos activos, el Paso 1 SHALL mostrar el título «Todavía
no hay lugares para reservar», un aviso informativo que lo explica y un enlace «Volver» a
`/reservas`, en lugar de un formulario que no puede completarse.

#### Scenario: Sin turnos activos
- **WHEN** `GET /turnos` responde una lista vacía
- **THEN** el Paso 1 muestra el aviso y el enlace «Volver»
- **AND** no se muestra el formulario de selección

#### Scenario: Sin zonas
- **WHEN** `GET /zonas` responde una lista vacía
- **THEN** el Paso 1 muestra el mismo aviso

### Requirement: Pantallas de estado para ruta inexistente y error inesperado
El sistema SHALL mostrar, para una ruta inexistente, una pantalla con el título «No encontramos
esa página», una explicación y las acciones «Volver al inicio» y «Reservá una mesa». Ante un error
inesperado que impida renderizar el layout, SHALL mostrar una pantalla con el título «Ichigo no
está disponible por ahora» y un botón «Reintentar». Ambas pantallas SHALL usar la misma
composición (tablilla colgada y mensaje), un `h1` único y los tokens de la identidad.

#### Scenario: Ruta inexistente
- **WHEN** una persona abre `/esta-ruta-no-existe`
- **THEN** ve el título «No encontramos esa página» y el título de la pestaña es «Página no
  encontrada | Ichigo»
- **AND** «Volver al inicio» lleva a `/`

#### Scenario: Error inesperado
- **WHEN** el layout raíz lanza una excepción al renderizar
- **THEN** se muestra «Ichigo no está disponible por ahora» con el botón «Reintentar»
- **AND** al activar «Reintentar» se vuelve a intentar renderizar la ruta

#### Scenario: La tablilla de estado es decorativa
- **WHEN** se inspecciona la pantalla de estado
- **THEN** el contenedor de la tablilla tiene `aria-hidden="true"` y el mensaje es el `h1`

### Requirement: Espera tras el límite de intentos al crear la reserva
Cuando `POST /reservas` responde `429`, el sistema SHALL mostrar el mensaje de límite de
intentos, SHALL deshabilitar el botón de envío durante 30 segundos con el texto «Esperá un
momento para reintentar», y SHALL volver a habilitarlo al cumplirse ese plazo. Mientras el botón
esté en espera, el sistema SHALL NOT enviar una nueva solicitud, ni aun con la tecla Enter. Los
datos ya tipeados SHALL conservarse.

#### Scenario: Bloqueo temporal
- **WHEN** la API responde `429` al confirmar la reserva
- **THEN** el botón queda deshabilitado con el texto «Esperá un momento para reintentar»
- **AND** los campos conservan lo que la persona escribió

#### Scenario: Pasada la espera, se puede reintentar
- **WHEN** transcurren 30 segundos desde el `429`
- **THEN** el botón vuelve a decir «Confirmar reserva» y a estar habilitado

#### Scenario: Enter durante la espera no envía
- **WHEN** el botón está en espera y la persona presiona Enter en un campo
- **THEN** no se hace ninguna solicitud a `POST /reservas`

### Requirement: Sin «Reintentar» inmediato al verificar la ventana de cancelación
En el detalle de una reserva consultada, si la verificación de si todavía se puede cancelar
(la consulta de zonas) responde `429`, el sistema SHALL mostrar un aviso informativo que pide
esperar unos minutos y volver a consultar, y SHALL NOT ofrecer el botón «Reintentar». Si la
verificación falla por otro error de red o de servidor, SHALL conservar el botón «Reintentar»
que ya definía `frontend-cliente`. En ningún caso SHALL ofrecer «Cancelar reserva» mientras la
verificación no haya confirmado que la ventana lo permite.

#### Scenario: 429 al verificar
- **WHEN** la consulta de zonas del detalle responde `429`
- **THEN** se muestra «Hiciste demasiados intentos y no pudimos verificar si todavía podés
  cancelar. Esperá unos minutos y volvé a consultar tu reserva.»
- **AND** no aparecen los botones «Reintentar» ni «Cancelar reserva»

#### Scenario: Otro error al verificar
- **WHEN** la consulta de zonas del detalle falla por red o responde `5xx`
- **THEN** se ofrece «Reintentar» y no se ofrece «Cancelar reserva»

### Requirement: Gestión del foco al cambiar de vista
Cuando el detalle de una reserva reemplaza al formulario de consulta, el foco SHALL pasar al
título del detalle. Cuando la persona vuelve del detalle al formulario, el foco SHALL pasar al
título del formulario. Tras cancelar una reserva con éxito, el foco SHALL pasar al título del
detalle, porque el botón que abrió el diálogo deja de existir. Los títulos SHALL ser
focalizables por programa (`tabindex="-1"`) sin mostrar un contorno de foco propio.

#### Scenario: Foco al abrir el detalle
- **WHEN** una consulta exitosa muestra el detalle
- **THEN** `document.activeElement` es el `h1` del detalle

#### Scenario: Foco al volver al formulario
- **WHEN** desde el detalle la persona activa «Consultar otra reserva»
- **THEN** `document.activeElement` es el `h1` «Consultá tu reserva»

#### Scenario: Foco tras cancelar
- **WHEN** la cancelación se confirma y el detalle muestra la reserva cancelada
- **THEN** `document.activeElement` es el `h1` del detalle y no `body`

### Requirement: Los estados del flujo se distinguen por texto
El estado de una reserva consultada y los avisos del flujo (error, información, límite de
intentos) SHALL comunicarse con texto legible, no solo con color, y las reglas de cada zona
SHALL expresarse como «Reservá con al menos N horas de anticipación y hasta N días antes.».
Los códigos de reserva y las cifras SHALL mostrarse con números tabulares.

#### Scenario: Estado de la reserva consultada
- **WHEN** se consulta una reserva `CONFIRMADA`
- **THEN** el detalle muestra la palabra del estado dentro de la etiqueta de estado

#### Scenario: Regla de anticipación de la zona
- **WHEN** el Paso 1 lista la zona VIP con 24 horas mínimas y 60 días máximos de anticipación
- **THEN** su descripción dice «Reservá con al menos 24 horas de anticipación y hasta 60 días
  antes.»
