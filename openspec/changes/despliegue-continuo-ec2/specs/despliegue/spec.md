## Purpose

Define cómo una versión aprobada de `main` llega a producción en un único servidor. Cubre qué
superficie de red queda expuesta, cómo se protegen los secretos y las credenciales, con qué
datos arranca producción, cómo se identifica al cliente para los límites de solicitudes y cómo
se vuelve a una versión anterior.

## ADDED Requirements

### Requirement: Despliegue automático solo desde main con CI en verde
El sistema SHALL desplegar a producción, sin intervención manual, cada commit que llegue a
`main` por push y cuyo CI haya terminado en verde. SHALL NOT desplegar commits de otras ramas,
de pull requests ni de forks, ni un commit cuyo CI haya fallado o se haya cancelado.

#### Scenario: Merge a main con CI en verde
- **WHEN** se mergea un pull request a `main` y el CI de ese commit termina en verde
- **THEN** se inicia el despliegue de ese commit a producción
- **AND** al terminar, producción sirve la versión de ese commit

#### Scenario: CI en rojo sobre main
- **WHEN** el CI de un commit de `main` falla o se cancela
- **THEN** no se inicia ningún despliegue
- **AND** producción sigue sirviendo la versión anterior

#### Scenario: Pull request o rama que no es main
- **WHEN** el CI corre sobre un pull request (incluido uno desde un fork) o sobre otra rama
- **THEN** no se inicia ningún despliegue y el workflow no recibe credenciales de AWS

#### Scenario: Dos merges seguidos
- **WHEN** se mergean dos commits a `main` mientras el primero todavía se está desplegando
- **THEN** los despliegues corren de a uno, sin superponerse
- **AND** producción termina sirviendo el commit más reciente

### Requirement: Versiones trazables e inmutables
Cada despliegue SHALL corresponder a un único commit de `main`, identificado por su SHA
completo. Los artefactos que se despliegan SHALL estar etiquetados con ese SHA y SHALL NOT
modificarse después de publicados, de modo que desplegar el mismo SHA dos veces ejecute
exactamente lo mismo.

#### Scenario: Identificar qué versión está en producción
- **WHEN** alguien del equipo necesita saber qué versión corre en producción
- **THEN** el último despliegue exitoso del workflow de CD informa el SHA desplegado
- **AND** en el servidor queda registrado el mismo SHA

#### Scenario: Despliegue con un identificador inválido
- **WHEN** el procedimiento de despliegue recibe un valor que no es un SHA completo de commit
- **THEN** lo rechaza sin modificar nada en el servidor

### Requirement: Verificación posterior y vuelta atrás automática
Después de levantar una versión nueva, el despliegue SHALL comprobar que la aplicación
responde a través del proxy de borde, tanto la página pública como una consulta a la API. Si
la comprobación falla, SHALL volver a levantar la versión anterior y el workflow SHALL
terminar en error.

#### Scenario: Versión nueva sana
- **WHEN** la versión nueva responde a la comprobación dentro del tiempo límite
- **THEN** el despliegue termina en verde y la versión nueva queda registrada como actual

#### Scenario: Versión nueva que no responde
- **WHEN** la versión nueva no responde a la comprobación dentro del tiempo límite
- **THEN** el servidor vuelve a levantar la versión anterior
- **AND** el workflow de CD termina en error, indicando que hubo vuelta atrás

#### Scenario: Vuelta atrás manual
- **WHEN** el equipo necesita volver a una versión anterior ya desplegada
- **THEN** la documentación indica cómo desplegar ese SHA anterior sin reconstruir nada

### Requirement: Migraciones antes de servir la versión nueva
El despliegue SHALL aplicar las migraciones de base de datos versionadas del commit antes de
que la versión nueva empiece a atender solicitudes. Si una migración falla, el despliegue
SHALL detenerse sin levantar la versión nueva.

#### Scenario: Commit con una migración nueva
- **WHEN** se despliega un commit que agrega una migración
- **THEN** la migración se aplica antes de que el backend nuevo atienda solicitudes

#### Scenario: Migración que falla
- **WHEN** una migración falla durante el despliegue
- **THEN** la versión nueva no se levanta, la anterior sigue atendiendo y el workflow termina
  en error

### Requirement: Superficie de red mínima
Desde internet, el servidor de producción SHALL aceptar conexiones únicamente en el puerto
HTTP del proxy de borde. La base de datos, el backend y el frontend SHALL NOT aceptar
conexiones directas desde fuera del servidor, y el servidor SHALL NOT exponer acceso remoto
por SSH.

#### Scenario: Conexión directa a la base de datos
- **WHEN** desde internet se intenta conectar al puerto de PostgreSQL de la IP pública
- **THEN** la conexión no se establece

#### Scenario: Conexión directa al backend o al frontend
- **WHEN** desde internet se intenta conectar a los puertos internos del backend o del
  frontend en la IP pública
- **THEN** la conexión no se establece

#### Scenario: Intento de SSH
- **WHEN** desde internet se intenta abrir una sesión SSH contra la IP pública
- **THEN** la conexión no se establece

#### Scenario: Acceso normal
- **WHEN** un cliente abre `http://<IP-pública>/`
- **THEN** recibe la aplicación servida a través del proxy de borde

### Requirement: Secretos fuera del repositorio, las imágenes y los logs
Los secretos de producción (secreto del JWT, contraseña de la base de datos y credenciales del
admin) SHALL guardarse cifrados fuera del repositorio. Solo el servidor de producción SHALL
leerlos, y solo al desplegar. SHALL NOT aparecer en el repositorio, en las imágenes de
contenedor, en los argumentos del workflow ni en sus logs. En el servidor, el archivo que los
contiene SHALL ser legible solo por el administrador del sistema.

#### Scenario: Inspeccionar una imagen publicada
- **WHEN** alguien descarga una imagen publicada y revisa su contenido, sus capas y su
  configuración
- **THEN** no encuentra ningún secreto de producción

#### Scenario: Revisar los logs del workflow de CD
- **WHEN** alguien con acceso de lectura al repositorio revisa los logs de un despliegue
- **THEN** no encuentra ningún secreto de producción

### Requirement: Credenciales de despliegue temporales y acotadas
El workflow de CD SHALL autenticarse en AWS con credenciales temporales emitidas para cada
ejecución, sin claves de acceso permanentes guardadas en GitHub. Esas credenciales SHALL
servir solo para ejecutar el procedimiento de despliegue sobre la instancia de producción, y
solo para ejecuciones del workflow de despliegue sobre `main`.

#### Scenario: Ejecución desde otra rama o desde un fork
- **WHEN** un workflow que no corre sobre `main` en el entorno de producción intenta obtener
  credenciales de AWS
- **THEN** AWS rechaza la solicitud

#### Scenario: Uso de las credenciales para otra acción
- **WHEN** con las credenciales del despliegue se intenta una acción distinta del
  procedimiento de despliegue (por ejemplo, ejecutar un comando arbitrario en la instancia o
  leer los secretos)
- **THEN** AWS la rechaza por falta de permisos

### Requirement: Datos iniciales y admin propios de producción
Producción SHALL arrancar con el catálogo necesario para operar (zonas, mesas, turnos y
configuración de negocio) y sin reservas de ejemplo. La cuenta de admin de producción SHALL
crearse con credenciales provistas como secretos de producción y SHALL NOT poder usar las
credenciales documentadas en el README para el entorno de desarrollo. Cargar los datos
iniciales SHALL ser idempotente y SHALL NOT sobrescribir la contraseña de un admin existente.

#### Scenario: Login con las credenciales del README
- **WHEN** alguien intenta loguearse en producción con el email y la contraseña de admin que
  documenta el README
- **THEN** el login falla con `401`

#### Scenario: Login con las credenciales de producción
- **WHEN** el admin se loguea con las credenciales guardadas como secreto de producción
- **THEN** el login funciona

#### Scenario: Contraseña de admin débil
- **WHEN** la contraseña de admin provista para producción tiene menos de 16 caracteres o
  coincide con la del entorno de desarrollo
- **THEN** la carga de datos iniciales se detiene con un error y no crea la cuenta

#### Scenario: Despliegue repetido
- **WHEN** se despliega una versión nueva sobre una base que ya tiene datos
- **THEN** no se duplican zonas, mesas ni turnos, y la contraseña del admin existente no
  cambia

#### Scenario: Sin reservas de ejemplo
- **WHEN** se consulta la base de producción recién inicializada
- **THEN** no hay reservas

### Requirement: Datos persistentes entre despliegues
Los datos de la base de producción SHALL conservarse a través de despliegues, vueltas atrás y
reinicios del servidor.

#### Scenario: Reserva creada antes de un despliegue
- **WHEN** un cliente crea una reserva y después se despliega una versión nueva
- **THEN** la reserva sigue consultable con su código y email

#### Scenario: Reinicio del servidor
- **WHEN** la instancia se reinicia
- **THEN** la aplicación vuelve a responder sola, con los mismos datos

### Requirement: Límites de solicitudes por IP real del cliente en producción
En producción, el proxy de borde SHALL reemplazar cualquier `X-Forwarded-For` que mande el
cliente por la IP de la conexión, y el backend SHALL confiar únicamente en el salto interno
del frontend. Así, los límites de solicitudes se cuentan por la IP real de cada cliente y un
cliente no puede falsificarla.

#### Scenario: Dos clientes distintos
- **WHEN** un cliente agota el límite de intentos de login en producción
- **THEN** otro cliente, desde otra IP, puede seguir intentando loguearse y recibe `401`, no
  `429`

#### Scenario: Cliente que falsifica X-Forwarded-For
- **WHEN** un cliente supera el límite de intentos de login mandando un `X-Forwarded-For`
  distinto en cada intento
- **THEN** recibe `429` en el mismo intento que si no hubiera mandado el encabezado

### Requirement: Riesgo de HTTP documentado y camino a HTTPS
Mientras producción se sirva por HTTP sin cifrar, la documentación SHALL indicar el riesgo
aceptado (credenciales del admin, JWT y datos de contacto de las reservas viajan sin cifrar) y
SHALL describir el paso a HTTPS como un cambio de configuración del proxy de borde y del
firewall, sin cambios de código en la aplicación. Las respuestas SHALL incluir encabezados de
seguridad que no dependan de HTTPS.

#### Scenario: Consultar el estado de seguridad del despliegue
- **WHEN** alguien del equipo o la docente lee la documentación de despliegue
- **THEN** encuentra que producción usa HTTP, qué datos quedan expuestos por eso y qué hace
  falta para pasar a HTTPS

#### Scenario: Encabezados de seguridad
- **WHEN** un cliente pide cualquier página de producción
- **THEN** la respuesta incluye `X-Content-Type-Options: nosniff`, una política que impide
  mostrar la app dentro de un frame de otro sitio y una `Referrer-Policy` restrictiva
- **AND** no expone en los encabezados la versión del servidor ni del framework
