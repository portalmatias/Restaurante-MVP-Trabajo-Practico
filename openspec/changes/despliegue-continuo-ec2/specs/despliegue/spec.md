## Purpose

Define cómo una versión aprobada de `main` llega a producción en un único servidor. Cubre qué
superficie de red queda expuesta, cómo se protegen los secretos y las credenciales, con qué
datos arranca producción, cómo se identifica al cliente para los límites de solicitudes y cómo
se vuelve a una versión anterior.

## ADDED Requirements

### Requirement: Despliegue automático solo desde main con CI en verde
El sistema SHALL desplegar a producción, sin intervención manual, el commit más reciente de
`main` cuyo CI haya terminado en verde. Si llegan varios commits seguidos, SHALL desplegar el
último que tenga el CI en verde y MAY omitir los intermedios. Un commit verde SHALL omitirse
solo si un commit posterior de `main` también tiene el CI en verde. SHALL NOT desplegar commits
de otras ramas, de pull requests ni de forks, ni un commit cuyo CI haya fallado o se haya
cancelado, tampoco a pedido manual. SHALL NOT reemplazar la versión en producción por una más
vieja, salvo una vuelta atrás pedida explícitamente.

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

#### Scenario: CI viejo que termina después de uno nuevo
- **WHEN** el CI de un commit termina en verde después de que un commit posterior de `main` ya
  tiene el CI en verde
- **THEN** no se despliega el commit viejo
- **AND** el workflow informa que la versión fue superada

#### Scenario: Commit posterior con CI en rojo o todavía corriendo
- **WHEN** el CI de un commit termina en verde y el único commit posterior de `main` tiene el
  CI en rojo o todavía no terminó
- **THEN** se despliega el commit verde
- **AND** si el posterior termina después en verde, se despliega también

#### Scenario: Despliegue manual de un commit no válido
- **WHEN** alguien pide a mano un despliegue (no una vuelta atrás) de un commit que no está en
  `main`, cuyo CI no terminó en verde, o que es más viejo que otro commit verde de `main`
- **THEN** el pedido se rechaza sin modificar producción

### Requirement: Versiones trazables e inmutables
Cada despliegue SHALL corresponder a un único commit de `main`, identificado por su SHA
completo. Los artefactos que se despliegan SHALL identificarse por su contenido (digest), no
solo por un nombre que se pueda volver a publicar. El servidor SHALL registrar qué artefactos
exactos corresponden a cada SHA desplegado, de modo que desplegar o volver a la misma versión
ejecute exactamente lo mismo.

#### Scenario: Identificar qué versión está en producción
- **WHEN** alguien del equipo necesita saber qué versión corre en producción
- **THEN** el último despliegue exitoso del workflow de CD informa el SHA desplegado
- **AND** en el servidor queda registrado el mismo SHA

#### Scenario: Tag vuelto a publicar
- **WHEN** alguien vuelve a publicar la imagen de un SHA ya desplegado con otro contenido y
  después se vuelve a esa versión
- **THEN** el servidor usa los artefactos registrados para ese SHA, no los del tag nuevo

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

#### Scenario: Vuelta atrás a la versión que estaba sirviendo
- **WHEN** falla la comprobación de una versión nueva
- **THEN** el servidor vuelve a la versión que estaba sirviendo justo antes de ese intento, no
  a una más vieja

#### Scenario: Vuelta atrás manual
- **WHEN** el equipo necesita volver a una versión anterior ya desplegada
- **THEN** la documentación indica cómo pedir esa vuelta atrás, que no reconstruye nada
- **AND** solo se acepta un SHA que figure entre las versiones desplegadas con éxito

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
Desde internet, el servidor de producción SHALL aceptar conexiones únicamente en los puertos
HTTP y HTTPS del proxy de borde. Mientras producción esté en la etapa HTTP, SHALL aceptarlas
solo desde las direcciones del equipo. La base de datos, el backend y el frontend SHALL NOT aceptar
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

#### Scenario: Acceso de un tercero en la etapa HTTP
- **WHEN** en la etapa HTTP alguien fuera de las direcciones del equipo intenta conectarse al
  puerto HTTP
- **THEN** la conexión no se establece

#### Scenario: Acceso normal
- **WHEN** un cliente abre la dirección pública de producción
- **THEN** recibe la aplicación servida a través del proxy de borde

### Requirement: Secretos fuera del repositorio, las imágenes y los logs
Los secretos de producción (secreto del JWT, contraseña de la base de datos y credenciales del
admin) SHALL guardarse cifrados fuera del repositorio. Solo el servidor de producción SHALL
leerlos, y solo al desplegar. SHALL NOT aparecer en el repositorio, en las imágenes de
contenedor, en los argumentos del workflow ni en sus logs. En el servidor, el archivo que los
contiene SHALL ser legible solo por el administrador del sistema.

#### Scenario: Inspeccionar una imagen publicada
- **WHEN** alguien descarga una imagen publicada y revisa su sistema de archivos, sus capas y
  su configuración
- **THEN** no encuentra ningún archivo `.env` ni ningún secreto de producción

#### Scenario: Revisar los logs del workflow de CD
- **WHEN** alguien con acceso de lectura al repositorio revisa los logs de un despliegue
- **THEN** no encuentra ningún secreto de producción

### Requirement: Credenciales de la instancia fuera del alcance de los contenedores
Los contenedores de la aplicación SHALL NOT poder obtener las credenciales del rol de la
instancia, que leen los secretos de producción.

#### Scenario: Contenedor que consulta los metadatos de la instancia
- **WHEN** desde cualquier contenedor se pide un token o credenciales al servicio de metadatos
  de la instancia
- **THEN** la solicitud no obtiene respuesta

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

### Requirement: HTTPS con el subdominio de producción
Cuando el subdominio de producción apunte a la IP pública del servidor, el proxy de borde SHALL
servir la aplicación por HTTPS con un certificado válido que obtiene y renueva solo. Un control
automático SHALL avisar al equipo si el certificado está por vencer o deja de ser válido. SHALL
redirigir a HTTPS toda solicitud HTTP que no sea la validación del certificado, y las
respuestas por HTTPS SHALL incluir `Strict-Transport-Security`. Activar HTTPS SHALL ser un
cambio de configuración, sin cambios de código en la aplicación. Los certificados SHALL
conservarse entre despliegues y reinicios.

#### Scenario: Acceso por el subdominio
- **WHEN** un cliente abre `https://<subdominio>/`
- **THEN** la conexión usa un certificado válido para ese nombre y recibe la aplicación
- **AND** la respuesta incluye `Strict-Transport-Security`

#### Scenario: Acceso por HTTP con el subdominio activo
- **WHEN** un cliente abre `http://<subdominio>/reservas`
- **THEN** recibe una redirección permanente a `https://<subdominio>/reservas`

#### Scenario: Certificado por vencer
- **WHEN** al certificado de producción le quedan menos de 21 días de validez o deja de ser
  válido
- **THEN** el control automático falla y el equipo recibe el aviso de GitHub

#### Scenario: Despliegue con el certificado ya emitido
- **WHEN** se despliega una versión nueva o se reinicia la instancia
- **THEN** el proxy de borde reutiliza el certificado guardado, sin pedir uno nuevo

### Requirement: Etapa transitoria en HTTP documentada
Mientras el subdominio no apunte al servidor, producción MAY servirse por HTTP en la IP
pública. La documentación SHALL indicar el riesgo aceptado para esa etapa (las credenciales del
admin, el JWT y los datos de contacto de las reservas viajan sin cifrar) y que en ella no se
cargan datos reales. También SHALL indicar los pasos para activar HTTPS cuando el subdominio
esté listo.

#### Scenario: Consultar el estado de seguridad del despliegue
- **WHEN** alguien del equipo o la docente lee la documentación de despliegue
- **THEN** encuentra si producción está en la etapa HTTP o en HTTPS, qué datos quedan
  expuestos en la etapa HTTP y cómo se activa HTTPS con el subdominio

### Requirement: Encabezados de seguridad
Todas las respuestas de producción SHALL incluir encabezados de seguridad básicos y SHALL NOT
exponer la versión del servidor ni del framework.

#### Scenario: Encabezados de seguridad
- **WHEN** un cliente pide cualquier página de producción
- **THEN** la respuesta incluye `X-Content-Type-Options: nosniff`, una política que impide
  mostrar la app dentro de un frame de otro sitio y una `Referrer-Policy` restrictiva
- **AND** no expone en los encabezados la versión del servidor ni del framework
