## Purpose

Permite al cliente sin cuenta ver el estado de su Reserva presentando su código y su email, y
al administrador listar y filtrar las Reservas del restaurante, sin que la ruta pública
permita enumerar Reservas ajenas ni exponga datos de contacto.

## ADDED Requirements

### Requirement: Consulta pública de una Reserva por código y email
El sistema SHALL exponer una operación pública (sin cuenta) que recibe el código de una
Reserva y el email del cliente, y SHALL devolver esa Reserva únicamente cuando ambos
coinciden con una misma Reserva. La operación SHALL ser `POST /reservas/consultar`, con el
`codigo` y el `email` en el body JSON, y SHALL responder `200 OK`. La consulta SHALL devolver
la Reserva en cualquier estado (`PENDIENTE`, `CONFIRMADA`, `CANCELADA` o `NO_SHOW`) y SHALL
ser de solo lectura.

#### Scenario: Código y email coincidentes devuelven la Reserva
- **WHEN** el cliente envía el código y el email de una Reserva `CONFIRMADA`
- **THEN** el sistema responde `200 OK` con esa Reserva y su estado `CONFIRMADA`

#### Scenario: Reserva pendiente muestra su estado
- **WHEN** el cliente consulta una Reserva de la Zona `VIP` que todavía no fue confirmada
- **THEN** el sistema responde `200 OK` con el estado `PENDIENTE`

#### Scenario: Reserva cancelada sigue siendo consultable
- **WHEN** el cliente consulta una Reserva que ya está `CANCELADA` o `NO_SHOW`
- **THEN** el sistema responde `200 OK` con ese estado, para que el cliente pueda comprobar
  que la cancelación quedó registrada

#### Scenario: La consulta no modifica la Reserva
- **WHEN** el cliente consulta la misma Reserva dos veces seguidas
- **THEN** ambas respuestas son iguales y el estado, la mesa y la fecha de última
  modificación de la Reserva no cambian

### Requirement: Código y email deben coincidir sin revelar cuál falló
El sistema SHALL responder `404 Not Found` cuando el código no corresponde a ninguna Reserva
o cuando el email no coincide con el de esa Reserva, y SHALL usar exactamente la misma
respuesta (mismo código HTTP y mismo cuerpo) en ambos casos, de modo que quien consulta no
pueda deducir si un código existe. Este requisito SHALL aplicar el mismo criterio que la
cancelación por código y email.

#### Scenario: Email que no coincide rechazado
- **WHEN** el cliente envía el código de una Reserva existente junto con un email distinto
  del registrado
- **THEN** el sistema responde `404 Not Found` y no devuelve ningún dato de la Reserva

#### Scenario: Código inexistente rechazado de forma indistinguible
- **WHEN** el cliente envía un código con formato válido que no corresponde a ninguna Reserva
- **THEN** el sistema responde el mismo `404 Not Found`, con el mismo cuerpo, que ante un
  email que no coincide

#### Scenario: El email de otra Reserva no da acceso
- **WHEN** el cliente envía el código de la Reserva A junto con el email registrado en la
  Reserva B
- **THEN** el sistema responde `404 Not Found` y no devuelve datos de A ni de B

### Requirement: Código y email se comparan sin distinguir mayúsculas y minúsculas
El sistema SHALL comparar el código de Reserva y el email sin distinguir mayúsculas de
minúsculas, y SHALL tratar el email como texto literal: ningún carácter del email SHALL
funcionar como comodín o patrón de búsqueda. El sistema SHALL seguir guardando el email tal
cual lo recibió al crear la Reserva.

#### Scenario: Código en minúsculas encuentra la Reserva
- **WHEN** el cliente envía el código de una Reserva escrito en minúsculas junto con su
  email correcto
- **THEN** el sistema responde `200 OK` con esa Reserva

#### Scenario: Email con otras mayúsculas encuentra la Reserva
- **WHEN** la Reserva se creó con `Ana.Perez@Example.com` y el cliente consulta con
  `ana.perez@example.com`
- **THEN** el sistema responde `200 OK` con esa Reserva

#### Scenario: Caracteres de patrón en el email no funcionan como comodín
- **WHEN** existe una Reserva con email `ana_perez@example.com` y el cliente consulta con el
  código correcto y el email `anaXperez@example.com`, o con `%@example.com`
- **THEN** el sistema responde `404 Not Found`

### Requirement: Formato de la solicitud de consulta validado antes de buscar
El sistema SHALL rechazar con `400 Bad Request` una consulta a la que le falte el código o el
email, cuyo código no sea alfanumérico de exactamente 8 caracteres, cuyo email no tenga
formato válido, o que incluya campos no declarados, sin buscar la Reserva. Un `400` SHALL NOT
revelar si algún código existe.

#### Scenario: Código con formato inválido rechazado
- **WHEN** el cliente envía un código de 7 caracteres, o con símbolos
- **THEN** el sistema responde `400 Bad Request`

#### Scenario: Email con formato inválido rechazado
- **WHEN** el cliente envía un email que no tiene formato de dirección de correo
- **THEN** el sistema responde `400 Bad Request`

#### Scenario: Body incompleto rechazado
- **WHEN** el cliente envía un body sin `codigo` o sin `email`
- **THEN** el sistema responde `400 Bad Request` y el mensaje indica el campo faltante

### Requirement: La consulta pública devuelve solo una vista mínima de la Reserva
El sistema SHALL devolver en la consulta pública únicamente el código de la Reserva, su
estado, la fecha, la cantidad de comensales, el turno (identificador, hora de inicio y hora
de fin) y la zona (identificador y nombre). El sistema SHALL NOT incluir el identificador
interno de la Reserva, la mesa asignada, el nombre, el email ni el teléfono del cliente, ni
marcas de creación o modificación. La fecha SHALL viajar como fecha de calendario local
(`YYYY-MM-DD`) y las horas del turno como horas locales del restaurante (`HH:mm`), sin
conversión de zona horaria.

#### Scenario: La respuesta no contiene datos internos ni de contacto
- **WHEN** el cliente consulta una Reserva con código y email correctos
- **THEN** la respuesta contiene solo los campos de la vista mínima y ninguno de los datos
  excluidos

#### Scenario: Fecha y horas se devuelven como fueron guardadas
- **WHEN** se consulta una Reserva del `2026-09-19` en un turno de 20:00 a 23:30
- **THEN** la respuesta informa la fecha `2026-09-19` y las horas `20:00` y `23:30`,
  con el mismo resultado sin importar la zona horaria del servidor

### Requirement: Rate limiting de la consulta pública
El sistema SHALL limitar la cantidad de consultas públicas por cliente en una ventana de
tiempo, con los valores configurados para el sistema, para evitar la enumeración de códigos
por fuerza bruta (`config.yaml` §5). Superado el límite, el sistema SHALL responder
`429 Too Many Requests` sin buscar la Reserva, aunque el código y el email sean correctos.

#### Scenario: Superar el límite rechaza la consulta
- **WHEN** un mismo cliente supera la cantidad de consultas permitidas dentro de la ventana
- **THEN** el sistema responde `429 Too Many Requests` a las consultas siguientes

#### Scenario: Consulta correcta rechazada una vez superado el límite
- **WHEN** un cliente que ya superó el límite envía un código y un email correctos
- **THEN** el sistema responde `429 Too Many Requests` y no devuelve la Reserva

### Requirement: Rutas de listado de Reservas protegidas por autenticación de administrador
El sistema SHALL exigir un JWT válido de rol `ADMIN` (ver capability `auth-admin`) para
acceder al listado de Reservas.

#### Scenario: Solicitud sin token rechazada
- **WHEN** se solicita `GET /admin/reservas` sin header `Authorization`
- **THEN** el sistema responde `401 Unauthorized` sin devolver ninguna Reserva

#### Scenario: Token de rol incorrecto rechazado
- **WHEN** se solicita `GET /admin/reservas` con un JWT válido cuyo rol no es `ADMIN`
- **THEN** el sistema responde `403 Forbidden` sin devolver ninguna Reserva

### Requirement: Listado de Reservas para el administrador
El sistema SHALL exponer `GET /admin/reservas`, que devuelve las Reservas existentes con su
identificador, código, estado, fecha, comensales, datos de contacto del cliente, turno, zona
y mesa asignada. El listado SHALL incluir Reservas en cualquier estado salvo que se filtre, y
SHALL responder `200 OK` con una lista vacía cuando ninguna Reserva cumpla los filtros.

#### Scenario: El listado devuelve las Reservas con su identificador
- **WHEN** el admin solicita `GET /admin/reservas`
- **THEN** el sistema devuelve las Reservas existentes, cada una con su identificador interno,
  para poder operar sobre ella desde otras rutas de admin

#### Scenario: Filtrar por estado pendiente
- **WHEN** el admin solicita `GET /admin/reservas` filtrando por estado `PENDIENTE`
- **THEN** el sistema devuelve solo las Reservas `PENDIENTE`, que son las que el admin debe
  confirmar o rechazar

#### Scenario: Filtrar por fecha
- **WHEN** el admin solicita las Reservas de una fecha de calendario
- **THEN** el sistema devuelve solo las Reservas de esa fecha

#### Scenario: Filtrar por zona y por turno
- **WHEN** el admin filtra por una zona y por un turno
- **THEN** el sistema devuelve solo las Reservas cuya mesa pertenece a esa zona y que son de
  ese turno

#### Scenario: Filtros combinados se aplican todos juntos
- **WHEN** el admin combina filtros de estado, fecha, zona y turno
- **THEN** el sistema devuelve solo las Reservas que cumplen todos los filtros a la vez

#### Scenario: Sin resultados no es un error
- **WHEN** el admin aplica filtros bien formados que ninguna Reserva cumple, o filtra por el
  identificador de una zona o un turno que no existe
- **THEN** el sistema responde `200 OK` con una lista vacía y total cero

### Requirement: Filtros del listado validados
El sistema SHALL rechazar con `400 Bad Request` un listado cuya fecha no sea una fecha de
calendario existente con formato `YYYY-MM-DD`, cuyo estado no sea uno de los cuatro estados
de Reserva, cuyos identificadores de zona o turno no tengan formato de identificador, cuyos
parámetros de paginación estén fuera de rango, o que incluya parámetros no declarados. El
sistema SHALL NOT ignorar en silencio un filtro mal escrito, para que el admin no crea estar
viendo un subconjunto cuando está viendo todo.

#### Scenario: Fecha inexistente rechazada
- **WHEN** el admin filtra por la fecha `2026-02-30`
- **THEN** el sistema responde `400 Bad Request`

#### Scenario: Estado desconocido rechazado
- **WHEN** el admin filtra por un estado que no existe
- **THEN** el sistema responde `400 Bad Request`

#### Scenario: Parámetro no declarado rechazado
- **WHEN** el admin envía un parámetro que el listado no define, por ejemplo por un error de
  tipeo en el nombre de un filtro
- **THEN** el sistema responde `400 Bad Request` en lugar de devolver el listado sin filtrar

### Requirement: Orden estable y paginación del listado
El sistema SHALL ordenar el listado por fecha ascendente, luego por hora de inicio del turno
ascendente, luego por fecha de creación ascendente y, como desempate final, por
identificador, de modo que dos páginas consecutivas nunca repitan ni omitan una Reserva. El
sistema SHALL paginar con un tamaño de página por defecto de 20 y un máximo de 100, SHALL
aceptar un desplazamiento no negativo y SHALL informar el total de Reservas que cumplen los
filtros, independiente del tamaño de página.

#### Scenario: Tamaño de página por defecto
- **WHEN** el admin solicita el listado sin indicar el tamaño de página y hay más de 20
  Reservas
- **THEN** el sistema devuelve 20 Reservas e informa el total completo

#### Scenario: Tamaño de página por encima del máximo rechazado
- **WHEN** el admin solicita un tamaño de página mayor a 100, o menor a 1
- **THEN** el sistema responde `400 Bad Request`

#### Scenario: Páginas consecutivas no se superponen
- **WHEN** el admin solicita la primera y la segunda página del mismo listado
- **THEN** ninguna Reserva aparece en las dos páginas y ninguna queda sin aparecer en
  alguna

#### Scenario: Orden cronológico
- **WHEN** el admin lista Reservas de distintas fechas y turnos
- **THEN** el sistema las devuelve de la fecha más próxima a la más lejana y, dentro de una
  fecha, por hora de inicio del turno

### Requirement: Rate limiting del listado de administrador
El sistema SHALL limitar la cantidad de solicitudes al listado de Reservas por cliente en una
ventana de tiempo y SHALL responder `429 Too Many Requests` al superarla, para acotar la
extracción masiva de datos personales con un token robado. El límite SHALL ser lo bastante
holgado para el uso normal de un panel con filtros.

#### Scenario: Superar el límite rechaza el listado
- **WHEN** un cliente autenticado supera la cantidad de solicitudes permitidas dentro de la
  ventana
- **THEN** el sistema responde `429 Too Many Requests` a las solicitudes siguientes

#### Scenario: Uso normal del panel no se rechaza
- **WHEN** el admin cambia varias veces los filtros del listado en pocos segundos
- **THEN** el sistema responde cada solicitud con normalidad
