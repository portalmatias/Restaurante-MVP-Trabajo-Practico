## ADDED Requirements

### Requirement: El sitio publicado informa qué versión sirve
El frontend SHALL exponer `GET /version`, una ruta pública que responde `200` con un objeto
JSON de un único campo, `sha`, con el SHA completo (40 caracteres hexadecimales en minúscula)
del commit del que se construyó la imagen en ejecución. Si la imagen no trae ese dato, o no
tiene el formato de un SHA completo, SHALL responder `"desconocido"` en lugar del SHA. La
respuesta SHALL llevar `Cache-Control: no-store` y SHALL NOT incluir ningún otro dato (versiones
de herramientas, variables de entorno, fechas ni rutas). La ruta SHALL ignorar la query y el
cuerpo del pedido, y SHALL admitir solo `GET` y `HEAD`. El SHA SHALL fijarse al construir la
imagen, con el mismo valor que el tag y la etiqueta `org.opencontainers.image.revision` de esa
imagen.

#### Scenario: Consulta de la versión
- **WHEN** se pide `GET /version` a un frontend construido con el SHA de un commit
- **THEN** responde `200` con `{"sha": "<ese SHA completo>"}`
- **AND** la respuesta tiene `Cache-Control: no-store`
- **AND** el objeto no tiene más campos que `sha`

#### Scenario: Frontend sin el dato de la versión
- **WHEN** se pide `GET /version` a un frontend que corre sin `BUILD_SHA`, por ejemplo en
  desarrollo local
- **THEN** responde `200` con `{"sha": "desconocido"}`
- **AND** no falla ni devuelve un error

#### Scenario: Valor de versión con formato inválido
- **WHEN** la variable `BUILD_SHA` existe pero no es un SHA completo en minúscula (por ejemplo,
  vacía, corta o con otros caracteres)
- **THEN** responde `{"sha": "desconocido"}` y no repite el valor recibido

#### Scenario: La ruta no refleja el pedido
- **WHEN** se pide `GET /version?sha=otro&x=<script>` con un cuerpo o encabezados cualquiera
- **THEN** la respuesta es la misma que sin parámetros y no contiene nada del pedido

#### Scenario: Métodos que la ruta no admite
- **WHEN** se pide `POST`, `PUT`, `PATCH` o `DELETE` sobre `/version`
- **THEN** responde `405`

#### Scenario: La versión coincide con la imagen
- **WHEN** el CD construye la imagen del frontend de un commit
- **THEN** el SHA horneado en la imagen es el mismo que el del tag `reservas-frontend:<sha>` y el
  de su etiqueta `org.opencontainers.image.revision`

### Requirement: El CD comprueba la versión publicada después de cada despliegue
Después de un despliegue que cambió producción (modo `despliegue` o `vuelta-atras` terminado
con éxito), el workflow de CD SHALL consultar `GET /version` del sitio público, por HTTPS y a
través del mismo nombre que usan los usuarios, y SHALL terminar en error si el sitio no sirve el
SHA desplegado. La consulta SHALL llevar un parámetro distinto en cada ejecución y un pedido
`Cache-Control: no-cache`, para que ninguna caché intermedia responda en su lugar. SHALL
reintentar durante 5 minutos antes de fallar, para absorber el reinicio del servicio. SHALL
verificar el certificado, SHALL NOT seguir redirecciones y SHALL NOT usar credenciales ni
secrets: ni la clave SSH del despliegue ni ninguna otra. SHALL NOT correr cuando el despliegue
falló, volvió atrás por su cuenta o terminó como versión superada.

#### Scenario: El sitio sirve la versión desplegada
- **WHEN** un despliegue de un commit termina con éxito y `GET /version` del sitio público
  devuelve el SHA de ese commit
- **THEN** la comprobación termina en verde
- **AND** el resumen del job indica el SHA verificado y la dirección consultada

#### Scenario: La versión nueva tarda unos segundos en aparecer
- **WHEN** durante los primeros intentos el sitio responde con el SHA anterior o con un error de
  conexión, y dentro de los 5 minutos responde con el SHA desplegado
- **THEN** la comprobación termina en verde

#### Scenario: El sitio sigue sirviendo otra versión
- **WHEN** pasan 5 minutos y el sitio público sigue sirviendo un SHA distinto del desplegado, por
  ejemplo porque una capa de borde conserva una copia vieja
- **THEN** la comprobación termina en error
- **AND** el mensaje indica el SHA esperado, el que se observó y que el despliegue en el
  servidor terminó bien

#### Scenario: Imagen construida sin el dato de la versión
- **WHEN** el sitio responde `{"sha": "desconocido"}` a una comprobación del modo `despliegue`
- **THEN** la comprobación falla de inmediato, sin esperar los 5 minutos
- **AND** el mensaje indica que la imagen se construyó sin `BUILD_SHA`

#### Scenario: Versión superada
- **WHEN** el despliegue termina como versión superada (no cambió nada en producción)
- **THEN** la comprobación no corre
- **AND** el resumen del despliegue sigue diciendo que no se desplegó

#### Scenario: El despliegue falla o vuelve atrás solo
- **WHEN** el despliegue termina en error, incluida la vuelta atrás automática a la versión
  previa
- **THEN** la comprobación no corre y producción sigue en la versión anterior, ya informada

#### Scenario: Otro despliegue más nuevo ya quedó sirviendo
- **WHEN** en modo `despliegue` el sitio sirve un SHA distinto del esperado y ese SHA es de un
  commit posterior del esperado en `main`
- **THEN** la comprobación termina en verde con un aviso de que una versión más nueva ya quedó
  sirviendo

#### Scenario: Vuelta atrás que no se aplicó
- **WHEN** en modo `vuelta-atras` el sitio sirve un SHA posterior al pedido
- **THEN** la comprobación no lo da por bueno y falla pasados los 5 minutos

#### Scenario: Vuelta atrás a una versión anterior a la comprobación
- **WHEN** se vuelve a una versión construida antes de que existiera `/version` y el sitio
  responde `404` en esa ruta durante los 5 minutos
- **THEN** la comprobación termina en verde con un aviso de que esa versión no se puede
  verificar
- **AND** el aviso queda escrito en el resumen del job

#### Scenario: Falta el nombre del sitio
- **WHEN** la variable de repositorio `SUBDOMINIO` no está definida o no es un nombre de
  dominio válido
- **THEN** la comprobación termina en error con un mensaje que dice que el despliegue terminó
  pero no se pudo comprobar la versión publicada
- **AND** no se saltea en silencio

#### Scenario: Certificado inválido o redirección
- **WHEN** el certificado del sitio no es válido, o el sitio responde con una redirección
- **THEN** esa observación no cuenta como éxito, la comprobación reintenta y, si persiste, falla
- **AND** nunca se desactiva la verificación del certificado ni se sigue la redirección a otro
  host

#### Scenario: La comprobación no recibe credenciales
- **WHEN** corre el job de comprobación
- **THEN** no tiene acceso al environment `produccion` ni a sus secrets
- **AND** sus permisos se limitan a leer el contenido del repositorio
