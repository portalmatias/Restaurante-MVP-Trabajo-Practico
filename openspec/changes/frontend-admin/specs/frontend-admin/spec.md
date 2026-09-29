## Purpose

Da al administrador del restaurante, desde el navegador, las pantallas para loguearse, ver
el aforo actual, gestionar zonas/mesas/turnos, y listar y operar sobre las Reservas
(confirmar/rechazar VIP, marcar `NO_SHOW`) — el mismo alcance que hoy solo existe como
endpoints del backend.

## ADDED Requirements

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
distinta de `/admin/login`, y SHALL redirigir a `/admin/login` cuando no la haya. El sistema
SHALL redirigir de la misma forma cuando una llamada a la API responde `401` durante el uso
de una pantalla ya autenticada (sesión vencida o token inválido), descartando la sesión
guardada.

#### Scenario: Acceso directo sin sesión redirige al login
- **WHEN** una persona sin sesión activa visita `/admin`, `/admin/salon` o
  `/admin/reservas` directamente por URL
- **THEN** el sistema la redirige a `/admin/login`, sin mostrar datos de administración

#### Scenario: Una sesión vencida redirige al login en el momento de la primera llamada fallida
- **WHEN** el administrador ya está en una pantalla de `/admin` y una llamada a la API
  responde `401`
- **THEN** el sistema descarta la sesión guardada y redirige a `/admin/login`

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
El sistema SHALL mostrar en `/admin` el aforo global y el aforo de cada Zona para una fecha y
un turno seleccionables, calculando la ocupación como la suma de comensales de las Reservas
en estado `CONFIRMADA` o `PENDIENTE` de esa fecha y ese turno, sobre el aforo máximo
configurado de cada Zona y el aforo global. El sistema SHALL NOT contar Reservas
`CANCELADA` o `NO_SHOW` en la ocupación.

#### Scenario: Ocupación calculada sobre Reservas activas
- **WHEN** se muestra el dashboard para una fecha y un turno con Reservas `CONFIRMADA` y
  `PENDIENTE` de varias Zonas
- **THEN** la ocupación de cada Zona es la suma de comensales de esas Reservas en esa Zona
- **AND** la ocupación global es la suma de comensales de todas las Zonas

#### Scenario: Reservas canceladas o no show no cuentan
- **WHEN** existen Reservas `CANCELADA` o `NO_SHOW` para la fecha y el turno elegidos
- **THEN** sus comensales no se suman a la ocupación de su Zona ni a la global

#### Scenario: Sin Reservas, el aforo está en cero
- **WHEN** no hay ninguna Reserva activa para la fecha y el turno elegidos
- **THEN** el dashboard muestra la ocupación de cada Zona y la global en cero, sobre el
  aforo máximo configurado

#### Scenario: Cambiar la fecha o el turno actualiza el aforo mostrado
- **WHEN** el administrador cambia la fecha o el turno seleccionados
- **THEN** el dashboard recalcula y muestra la ocupación para la nueva combinación

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
fecha, el Turno, la Zona, los comensales y los datos de contacto del cliente.

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

### Requirement: Confirmar y rechazar una Reserva VIP pendiente
El sistema SHALL ofrecer, sobre cada Reserva en estado `PENDIENTE` del listado, las
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
El sistema SHALL ofrecer, sobre cada Reserva en estado `CONFIRMADA`, la acción de marcar
`NO_SHOW`, y SHALL pedir una confirmación explícita antes de enviarla. Al marcarla, el
sistema SHALL actualizar el estado de esa Reserva en el listado sin recargar toda la
página.

#### Scenario: Marcar no show actualiza el estado
- **WHEN** el administrador confirma marcar `NO_SHOW` sobre una Reserva `CONFIRMADA`
- **THEN** el sistema la envía a `PATCH /admin/reservas/:id/no-show` y, al confirmar la
  API, esa fila del listado pasa a mostrar el estado `NO_SHOW`

#### Scenario: Marcar no show antes de que termine el turno rechazado
- **WHEN** la API rechaza con `409` un intento de marcar `NO_SHOW` porque el turno de esa
  Reserva todavía no terminó
- **THEN** el sistema muestra ese motivo y la Reserva sigue mostrando el estado
  `CONFIRMADA`

#### Scenario: Solo las Reservas confirmadas ofrecen esta acción
- **WHEN** se muestra una Reserva en estado `PENDIENTE`, `CANCELADA` o `NO_SHOW`
- **THEN** el listado no ofrece la acción de marcar `NO_SHOW` sobre esa fila
