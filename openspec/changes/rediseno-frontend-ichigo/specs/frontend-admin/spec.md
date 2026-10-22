## MODIFIED Requirements

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
- **THEN** cada zona sigue mostrando el nombre de su nivel y su porcentaje en texto

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

#### Scenario: Búsqueda sin coincidencias
- **WHEN** el texto buscado no coincide con ninguna fila de la página
- **THEN** se muestra un aviso que lo dice, distinto del estado vacío de los filtros

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

## ADDED Requirements

### Requirement: Aviso de sesión por vencer
El sistema SHALL avisar al administrador, en toda pantalla de `/admin/...` con sesión activa,
cuando falten cinco minutos o menos para que venza la sesión. El aviso SHALL ser un mensaje con
`role="alert"` que indique los minutos restantes (con «minuto» o «minutos» según corresponda),
advierta que los cambios sin guardar se pierden al vencer y ofrezca el botón «Renovar sesión».
Como no hay renovación automática, «Renovar sesión» SHALL descartar la sesión y llevar a
`/admin/login?motivo=renovar`. Es una acción del administrador: manda sobre la regla de sesión
que desaparece y SHALL NOT dispararla, de modo que nunca lleva a `?motivo=sesion-vencida`. El
sistema SHALL controlar el vencimiento por tiempo, aunque la pestaña no haga pedidos a la API.

#### Scenario: Aviso con cinco minutos o menos
- **WHEN** la sesión vence en 4 minutos
- **THEN** se muestra un mensaje con rol de alerta que dice «Tu sesión vence en 4 minutos»
- **AND** el mensaje incluye el botón «Renovar sesión»

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
