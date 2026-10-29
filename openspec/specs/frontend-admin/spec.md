# frontend-admin Specification

## Purpose
Da al administrador del restaurante, desde el navegador, las pantallas para loguearse, ver
el aforo actual, gestionar zonas/mesas/turnos, y listar y operar sobre las Reservas
(confirmar/rechazar VIP, marcar `NO_SHOW`) — el mismo alcance que hoy solo existe como
endpoints del backend.

## Requirements

### Requirement: Login de administrador
El sistema SHALL exponer un formulario de login en `/admin/login` con los campos email y
contraseña, que al enviarse SHALL invocar `POST /auth/login`. Cuando la API responde con un
token, el sistema SHALL guardar la sesión y SHALL redirigir a `/admin`. El formulario SHALL
deshabilitar el botón de enviar mientras la solicitud está en curso, para no disparar dos
intentos por un doble clic.

#### Scenario: Login exitoso redirige al dashboard
- **WHEN** el administrador envía email y contraseña correctos
- **THEN** el sistema guarda la sesión y muestra `/admin`

#### Scenario: Credenciales incorrectas muestran un error genérico
- **WHEN** la API responde `401` a un intento de login
- **THEN** el formulario muestra un mensaje de error que no distingue si el email existe o
  si la contraseña es la incorrecta
- **AND** la sesión no se guarda

#### Scenario: Body inválido muestra los errores de validación
- **WHEN** la API responde `400` a un intento de login (por ejemplo, email con formato
  inválido)
- **THEN** el formulario muestra los mensajes de validación junto a los campos
  correspondientes

#### Scenario: Límite de intentos superado
- **WHEN** la API responde `429` a un intento de login
- **THEN** el formulario muestra un mensaje indicando que se superó el límite de intentos,
  sin repetir el mensaje genérico de credenciales incorrectas

### Requirement: Persistencia de la sesión dentro de la pestaña
El sistema SHALL conservar la sesión activa mientras la pestaña del navegador permanezca
abierta, incluida una recarga de página, y SHALL descartarla al cerrar la pestaña o la
ventana. El sistema SHALL NOT usar un mecanismo de "recordarme" que sobreviva al cierre del
navegador.

#### Scenario: La sesión sobrevive a un refresh
- **WHEN** el administrador está logueado y recarga la página
- **THEN** sigue viendo las pantallas de `/admin` sin que se le pida loguearse de nuevo

#### Scenario: La sesión no sobrevive a cerrar la pestaña
- **WHEN** el administrador cierra la pestaña o el navegador y vuelve a abrir `/admin`
- **THEN** el sistema le pide loguearse de nuevo

### Requirement: Rutas de administración protegidas por sesión
El sistema SHALL exigir una sesión activa para mostrar cualquier pantalla bajo `/admin/...`
distinta de `/admin/login`, y SHALL redirigir a `/admin/login`, sin parámetros, cuando nunca
hubo una sesión en esa pestaña. Cuando una sesión que existía deja de ser válida sin que el
administrador activara «Cerrar sesión» ni «Renovar sesión» (porque venció por tiempo o porque una
llamada a la API de una pantalla ya autenticada respondió `401` o `403`), el sistema SHALL
descartar la sesión guardada y redirigir a `/admin/login?motivo=sesion-vencida`. Este es el único
requisito que decide ese destino; el mensaje que el login muestra lo define «Motivo visible en el
login».

#### Scenario: Acceso directo sin sesión redirige al login
- **WHEN** una persona sin sesión activa visita `/admin`, `/admin/salon` o
  `/admin/reservas` directamente por URL
- **THEN** el sistema la redirige a `/admin/login`, sin parámetro `motivo` y sin mostrar datos de
  administración

#### Scenario: Una sesión vencida redirige al login en el momento de la primera llamada fallida
- **WHEN** el administrador ya está en una pantalla de `/admin` y una llamada a la API
  responde `401` o `403`
- **THEN** el sistema descarta la sesión guardada y redirige a `/admin/login?motivo=sesion-vencida`

#### Scenario: Una sesión vencida por tiempo redirige al login
- **WHEN** el administrador deja abierta una pantalla de `/admin` hasta que la sesión vence, sin
  hacer pedidos a la API
- **THEN** el sistema descarta la sesión y redirige a `/admin/login?motivo=sesion-vencida`

#### Scenario: El login no aplica el guard de sesión
- **WHEN** una persona sin sesión activa visita `/admin/login`
- **THEN** ve el formulario de login, sin redirección

### Requirement: Cierre de sesión
El sistema SHALL exponer una acción de cerrar sesión, visible en toda pantalla de
`/admin/...`, que al activarse SHALL descartar la sesión guardada y SHALL redirigir a
`/admin/login`.

#### Scenario: Cerrar sesión termina el acceso a las pantallas de admin
- **WHEN** el administrador activa "Cerrar sesión"
- **THEN** el sistema lo redirige a `/admin/login`
- **AND** una visita posterior a `/admin` vuelve a redirigir a `/admin/login`

### Requirement: Dashboard de aforo
El sistema SHALL mostrar en `/admin`, para una fecha y un turno seleccionables, la
ocupación de cada Zona y la ocupación global, calculadas como la suma de comensales de las
Reservas en estado `CONFIRMADA` o `PENDIENTE` de esa fecha y ese turno. La ocupación de
cada Zona SHALL mostrarse junto a su aforo máximo configurado. El sistema SHALL NOT contar
Reservas `CANCELADA` o `NO_SHOW` en la ocupación. Como el aforo máximo global no tiene hoy
un endpoint que lo exponga (decisión D5 del change archivado `frontend-admin`,
`openspec/changes/archive/2026-10-01-frontend-admin/design.md`), la ocupación global SHALL mostrarse sin un
aforo máximo de referencia, hasta que un change de backend lo agregue.

Para cada Zona el sistema SHALL mostrar además el porcentaje de ocupación, los lugares libres
(nunca negativos) y un nivel con nombre escrito. El porcentaje es un entero sin tope, **redondeado
hacia abajo** y calculado con enteros (parte entera de ocupación × 100 ÷ aforo), para que ni el
redondeo ni la coma flotante lo adelanten. El nivel se decide con el mismo valor que se muestra:
«Con lugar» (porcentaje menor que 80), «Casi lleno» (80 o más sin llegar al aforo), «Completo»
(ocupación igual al aforo), «Sobrecupo» (ocupación mayor que el aforo) o «Sin aforo» (aforo máximo
cero). Así el porcentaje llega a 100 solo cuando la zona está completa o en sobrecupo, y 79,6 % no
se muestra como «80 %» con el nivel «Con lugar». Con aforo máximo cero prevalece «Sin aforo» aunque
haya ocupación: no se informa «Sobrecupo» ni porcentaje, los lugares libres son 0 y la barra se
muestra llena si hay ocupación y vacía si no la hay. La barra de
ocupación SHALL exponerse con `role="meter"` y un texto de valor. El sistema SHALL indicar la
hora en que llegó la consulta y, mientras se actualiza, que se muestra la consulta anterior.
Esta lectura es presentacional: no decide ninguna regla de negocio.

#### Scenario: Ocupación calculada sobre Reservas activas
- **WHEN** se muestra el dashboard para una fecha y un turno con Reservas `CONFIRMADA` y
  `PENDIENTE` de varias Zonas
- **THEN** la ocupación de cada Zona es la suma de comensales de esas Reservas en esa Zona,
  junto al aforo máximo configurado de esa Zona
- **AND** la ocupación global es la suma de comensales de todas las Zonas

#### Scenario: Reservas canceladas o no show no cuentan
- **WHEN** existen Reservas `CANCELADA` o `NO_SHOW` para la fecha y el turno elegidos
- **THEN** sus comensales no se suman a la ocupación de su Zona ni a la global

#### Scenario: Sin Reservas, el aforo está en cero
- **WHEN** no hay ninguna Reserva activa para la fecha y el turno elegidos
- **THEN** el dashboard muestra la ocupación de cada Zona y la global en cero

#### Scenario: Cambiar la fecha o el turno actualiza el aforo mostrado
- **WHEN** el administrador cambia la fecha o el turno seleccionados
- **THEN** el dashboard recalcula y muestra la ocupación para la nueva combinación

#### Scenario: Porcentaje y lugares libres por zona
- **WHEN** una zona tiene 30 comensales sobre un aforo de 40
- **THEN** el dashboard muestra «30 / 40», «75 % ocupado», «10 lugares libres» y el nivel
  «Con lugar»

#### Scenario: Umbral de casi lleno
- **WHEN** una zona tiene 32 comensales sobre un aforo de 40 (80 %)
- **THEN** el nivel es «Casi lleno»

#### Scenario: Zona completa y sobrecupo
- **WHEN** una zona tiene 40 de 40 comensales
- **THEN** el nivel es «Completo» y se informa «0 lugares libres»
- **AND** si tuviera 45 de 40, el nivel es «Sobrecupo», los lugares libres son 0 y se informa
  «5 por encima del aforo»

#### Scenario: El porcentaje se redondea hacia abajo
- **WHEN** una zona tiene 39 comensales sobre un aforo de 49 (79,59 %)
- **THEN** el dashboard muestra «79 % ocupado» y el nivel «Con lugar», no «80 %»

#### Scenario: Casi completo no muestra 100 %
- **WHEN** una zona tiene 199 comensales sobre un aforo de 200 (99,5 %)
- **THEN** el dashboard muestra «99 % ocupado» y el nivel «Casi lleno», no «100 %» ni «Completo»

#### Scenario: Aforo máximo cero
- **WHEN** una zona tiene aforo máximo 0
- **THEN** el nivel es «Sin aforo», no se muestra un porcentaje y se informa «0 lugares libres»
- **AND** si además hubiera 5 comensales, el nivel sigue siendo «Sin aforo» y no «Sobrecupo»

#### Scenario: El nivel no depende del color
- **WHEN** se captura el dashboard en escala de grises
- **THEN** cada zona sigue mostrando el nombre de su nivel y, salvo en «Sin aforo» (que no
  informa porcentaje), su porcentaje en texto

### Requirement: Listado y edición de Zonas
El sistema SHALL listar las Zonas existentes con su configuración completa en
`/admin/salon`, y SHALL permitir editar el rango de comensales, la anticipación mínima y
máxima, la ventana de cancelación, si requiere confirmación del admin, y el aforo máximo de
una Zona. El sistema SHALL NOT ofrecer una acción para crear o eliminar una Zona.

#### Scenario: Edición exitosa refleja los nuevos valores
- **WHEN** el administrador edita la configuración de una Zona con valores válidos
- **THEN** el sistema los envía a `PATCH /admin/zonas/:id` y, al confirmar la API, el
  listado muestra los valores nuevos

#### Scenario: Rango de comensales inválido rechazado con el error en el campo
- **WHEN** la API responde `400` a una edición porque el mínimo de comensales resultante
  supera al máximo
- **THEN** el sistema muestra el error junto al campo correspondiente y no actualiza el
  listado

### Requirement: Alta, listado y edición de Mesas
El sistema SHALL listar las Mesas existentes, opcionalmente filtradas por Zona, en
`/admin/salon`, y SHALL permitir dar de alta una Mesa nueva (Zona, capacidad, etiqueta) y
editar la Zona, la capacidad o la etiqueta de una Mesa existente.

#### Scenario: Alta exitosa aparece en el listado
- **WHEN** el administrador da de alta una Mesa con una Zona, una capacidad y una etiqueta
  válidas y únicas
- **THEN** el sistema la envía a `POST /admin/mesas` y, al confirmar la API, la Mesa nueva
  aparece en el listado

#### Scenario: Etiqueta duplicada rechazada
- **WHEN** la API responde `409` a un alta o una edición porque ya existe una Mesa con esa
  etiqueta
- **THEN** el sistema muestra ese error junto al campo de etiqueta

#### Scenario: Zona inexistente rechazada
- **WHEN** la API responde `404` a un alta porque la Zona indicada no existe
- **THEN** el sistema muestra un error indicando que la Zona no es válida

### Requirement: Baja de Mesa con confirmación
El sistema SHALL permitir dar de baja una Mesa, y SHALL pedir una confirmación explícita
antes de enviar la baja, dado que es una acción irreversible. Cuando la API rechace la baja
porque la Mesa tiene Reservas asociadas, el sistema SHALL mostrar ese motivo sin dar de baja
la Mesa.

#### Scenario: Baja exitosa la quita del listado
- **WHEN** el administrador confirma la baja de una Mesa sin Reservas asociadas
- **THEN** el sistema la envía a `DELETE /admin/mesas/:id` y, al confirmar la API, la Mesa
  deja de aparecer en el listado

#### Scenario: Baja cancelada en la confirmación no envía nada
- **WHEN** el administrador inicia la baja de una Mesa y cancela en el paso de confirmación
- **THEN** el sistema no envía ninguna solicitud y la Mesa sigue en el listado

#### Scenario: Mesa con Reservas asociadas rechazada
- **WHEN** la API responde `409` a una baja porque la Mesa tiene Reservas asociadas
- **THEN** el sistema muestra ese motivo y la Mesa sigue en el listado

### Requirement: Alta, listado, edición y activación de Turnos
El sistema SHALL listar los Turnos existentes en `/admin/salon`, y SHALL permitir dar de
alta un Turno nuevo (día de la semana, hora de inicio, hora de fin) y editar el día, el
horario o el estado activo/inactivo de un Turno existente. El sistema SHALL mostrar las
horas de un Turno en formato `HH:mm`, sin conversión de zona horaria (son horas locales del
restaurante).

#### Scenario: Alta exitosa aparece en el listado
- **WHEN** el administrador da de alta un Turno con un día y un horario válidos que no
  chocan con uno existente
- **THEN** el sistema lo envía a `POST /admin/turnos` y, al confirmar la API, el Turno
  nuevo aparece en el listado con sus horas en `HH:mm`

#### Scenario: Turno duplicado rechazado
- **WHEN** la API responde `409` a un alta o una edición porque ya existe un Turno para ese
  día y esa hora de inicio
- **THEN** el sistema muestra ese error junto a los campos de día y horario

#### Scenario: Desactivar un Turno no lo elimina del listado
- **WHEN** el administrador desactiva un Turno existente
- **THEN** el sistema lo envía a `PATCH /admin/turnos/:id` con `activo: false` y, al
  confirmar la API, el Turno sigue en el listado marcado como inactivo

### Requirement: Listado de Reservas con filtros y paginación
El sistema SHALL listar las Reservas en `/admin/reservas`, con filtros por fecha, estado,
Zona y Turno equivalentes a los que expone `GET /admin/reservas`, y SHALL paginar el
listado. El sistema SHALL mostrar, por cada Reserva, al menos su código, su estado, la
fecha, el Turno, la Zona, los comensales y los datos de contacto del cliente. El estado de
cada Reserva SHALL mostrarse con su nombre escrito (`PENDIENTE` como «Pendiente», `CONFIRMADA`
como «Confirmada», `CANCELADA` como «Cancelada» y `NO_SHOW` como «Ausente») dentro de un sello
que además lleve una forma y un pictograma propios de cada estado, de modo que el estado no se
distinga solo por el color. El sistema SHALL ofrecer una búsqueda por código, nombre o email
dentro de la página ya cargada, que no modifica los filtros ni la consulta a la API.

#### Scenario: Filtrar por estado pendiente
- **WHEN** el administrador filtra el listado por estado `PENDIENTE`
- **THEN** el sistema muestra solo las Reservas `PENDIENTE`

#### Scenario: Combinar varios filtros
- **WHEN** el administrador combina un filtro de fecha con uno de Zona
- **THEN** el sistema muestra solo las Reservas que cumplen los dos filtros a la vez

#### Scenario: Cambiar de página no pierde los filtros activos
- **WHEN** el administrador tiene filtros activos y avanza a la página siguiente del
  listado
- **THEN** el sistema mantiene los mismos filtros y muestra la página siguiente de ese
  resultado filtrado

#### Scenario: Sin resultados muestra un estado vacío, no un error
- **WHEN** los filtros activos no coinciden con ninguna Reserva
- **THEN** el sistema muestra un mensaje de que no hay Reservas para esos filtros, sin
  tratarlo como un error

#### Scenario: El estado se distingue por texto y forma
- **WHEN** el listado muestra una Reserva en cada uno de los cuatro estados
- **THEN** cada sello contiene el nombre del estado escrito
- **AND** los cuatro sellos tienen un pictograma y un tratamiento de borde o relleno distintos
  entre sí

#### Scenario: Búsqueda dentro de la página
- **WHEN** el administrador escribe un fragmento de un código, nombre o email en «Buscar en esta
  página»
- **THEN** la tabla muestra solo las filas de la página actual que lo contienen, sin cambiar la
  URL ni repetir el pedido a la API
- **AND** la fila con el aviso de una acción fallida sigue visible aunque no coincida, porque la
  persona acaba de actuar sobre ella

#### Scenario: Búsqueda sin coincidencias
- **WHEN** el texto buscado no coincide con ninguna fila de la página
- **THEN** se muestra un aviso que lo dice, distinto del estado vacío de los filtros

### Requirement: Confirmar y rechazar una Reserva pendiente
En la práctica solo la Zona VIP deja Reservas `PENDIENTE` (es la única con
`requiereConfirmacionAdmin: true` en el seed), pero esta acción se habilita por **estado**,
no por Zona, para seguir siéndolo si otra Zona adopta esa configuración. El sistema SHALL
ofrecer, sobre cada Reserva en estado `PENDIENTE` del listado, las
acciones de confirmar y rechazar, y SHALL pedir una confirmación explícita antes de
rechazar, dado que es una transición irreversible. Al confirmar o rechazar, el sistema
SHALL actualizar el estado de esa Reserva en el listado sin recargar toda la página.

#### Scenario: Confirmar una Reserva pendiente actualiza su estado
- **WHEN** el administrador confirma una Reserva `PENDIENTE`
- **THEN** el sistema la envía a `PATCH /admin/reservas/:id/confirmar` y, al confirmar la
  API, esa fila del listado pasa a mostrar el estado `CONFIRMADA`

#### Scenario: Rechazar una Reserva pendiente actualiza su estado
- **WHEN** el administrador confirma el rechazo de una Reserva `PENDIENTE` en el paso de
  confirmación
- **THEN** el sistema la envía a `PATCH /admin/reservas/:id/rechazar` y, al confirmar la
  API, esa fila del listado pasa a mostrar el estado `CANCELADA`

#### Scenario: Una Reserva que ya cambió de estado rechaza la acción
- **WHEN** el administrador intenta confirmar o rechazar una Reserva que otra persona ya
  transicionó (la API responde `409`)
- **THEN** el sistema muestra ese conflicto y refresca el estado real de esa Reserva en el
  listado, sin aplicar el cambio que el administrador pidió

#### Scenario: Solo las Reservas pendientes ofrecen estas acciones
- **WHEN** se muestra una Reserva en estado `CONFIRMADA`, `CANCELADA` o `NO_SHOW`
- **THEN** el listado no ofrece las acciones de confirmar ni de rechazar sobre esa fila

### Requirement: Marcar una Reserva confirmada como no show
El sistema SHALL ofrecer, sobre cada Reserva en estado `CONFIRMADA`, la acción «Marcar ausente»
(que envía la transición `NO_SHOW`), y SHALL pedir una confirmación explícita antes de enviarla.
El estado `NO_SHOW` SHALL mostrarse al administrador como «Ausente». Al marcarla, el sistema
SHALL actualizar el estado de esa Reserva en el listado sin recargar toda la página.

#### Scenario: Marcar no show actualiza el estado
- **WHEN** el administrador confirma «Sí, marcar ausente» sobre una Reserva `CONFIRMADA`
- **THEN** el sistema la envía a `PATCH /admin/reservas/:id/no-show` y, al confirmar la
  API, esa fila del listado pasa a mostrar el estado «Ausente»

#### Scenario: Marcar no show antes de que termine el turno rechazado
- **WHEN** la API rechaza con `409` un intento de marcar `NO_SHOW` porque el turno de esa
  Reserva todavía no terminó
- **THEN** el sistema muestra ese motivo y la Reserva sigue mostrando el estado «Confirmada»

#### Scenario: Solo las Reservas confirmadas ofrecen esta acción
- **WHEN** se muestra una Reserva en estado `PENDIENTE`, `CANCELADA` o `NO_SHOW`
- **THEN** el listado no ofrece la acción «Marcar ausente» sobre esa fila

### Requirement: Aviso de sesión por vencer
El sistema SHALL avisar al administrador, en toda pantalla de `/admin/...` con sesión activa,
cuando falten cinco minutos o menos para que venza la sesión. El aviso SHALL ser un grupo
visible (`role="group"`, con nombre accesible «Vencimiento de la sesión») que indique los minutos
restantes (con «minuto» o «minutos» según corresponda), advierta que los cambios sin guardar se
pierden al vencer y ofrezca el botón «Renovar sesión». Una región `role="status"` visible solo
para lectores de pantalla SHALL anunciar los minutos restantes; el aviso SHALL NOT usar
`role="alert"`, que interrumpiría lo que la persona está editando.
Como no hay renovación automática, «Renovar sesión» SHALL descartar la sesión y llevar a
`/admin/login?motivo=renovar`. Es una acción del administrador: manda sobre la regla de sesión
que desaparece y SHALL NOT dispararla, de modo que nunca lleva a `?motivo=sesion-vencida`. El
sistema SHALL controlar el vencimiento por tiempo, aunque la pestaña no haga pedidos a la API.

#### Scenario: Aviso con cinco minutos o menos
- **WHEN** la sesión vence en 4 minutos
- **THEN** se muestra el grupo «Vencimiento de la sesión» con el texto «Tu sesión vence en 4
  minutos»
- **AND** una región `status` anuncia «Tu sesión vence en 4 minutos»
- **AND** el grupo incluye el botón «Renovar sesión»

#### Scenario: Sin aviso con más de cinco minutos
- **WHEN** la sesión vence en más de 5 minutos
- **THEN** no se muestra el aviso

#### Scenario: Un solo minuto
- **WHEN** faltan menos de 60 segundos
- **THEN** el aviso dice «1 minuto» (singular)

#### Scenario: Renovar lleva al login
- **WHEN** el administrador activa «Renovar sesión»
- **THEN** el sistema descarta la sesión y lo redirige a `/admin/login?motivo=renovar`

#### Scenario: Renovar no se confunde con una sesión vencida
- **WHEN** el administrador activa «Renovar sesión» y el sistema descarta la sesión guardada
- **THEN** el destino es únicamente `/admin/login?motivo=renovar`, sin pasar por
  `?motivo=sesion-vencida`
- **AND** el login muestra el aviso de renovar y no el de sesión terminada

### Requirement: Motivo visible en el login
El formulario de `/admin/login` SHALL explicar por qué se llegó a él cuando la URL trae el
parámetro `motivo`: con `sesion-vencida` SHALL informar, sin afirmar la causa, que la sesión
terminó o ya no es válida y que la sesión del panel dura un tiempo limitado y no se renueva sola;
con `renovar` SHALL informar que se ingresa de nuevo para renovar la sesión. Los textos SHALL NOT
fijar la duración de la sesión (es configurable con `JWT_EXPIRES_IN` y el frontend no la conoce).
Un valor desconocido SHALL ignorarse sin mostrar mensaje. Cuándo se redirige con cada `motivo` lo
deciden «Rutas de administración protegidas por sesión» y «Aviso de sesión por vencer».

#### Scenario: Aviso de sesión terminada
- **WHEN** se abre `/admin/login?motivo=sesion-vencida`
- **THEN** el login muestra «Tu sesión terminó o ya no es válida», sin decir que venció, porque el
  motivo puede ser otro
- **AND** el texto no menciona una cantidad de minutos

#### Scenario: Aviso de renovar
- **WHEN** se abre `/admin/login?motivo=renovar`
- **THEN** el login explica que se ingresa de nuevo para renovar la sesión, sin mencionar una
  cantidad de minutos

#### Scenario: Cierre voluntario sin mensaje de vencimiento
- **WHEN** el administrador activa «Cerrar sesión»
- **THEN** se lo redirige a `/admin/login` sin parámetro `motivo` y sin mensaje de vencimiento

#### Scenario: Motivo desconocido
- **WHEN** se abre `/admin/login?motivo=cualquiera`
- **THEN** el login se muestra sin ningún aviso adicional
