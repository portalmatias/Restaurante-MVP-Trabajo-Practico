## Purpose

Fija en qué interfaces de red escuchan los servicios del sistema y cuándo el backend confía en
encabezados de reenvío para identificar al cliente, de modo que ningún tercero de la red local
pueda alcanzar los servicios de la demo ni falsificar su origen para saltear los límites de
solicitudes.

## ADDED Requirements

### Requirement: Servicios accesibles solo desde la propia máquina por defecto
Con la configuración por defecto del proyecto, el frontend, el backend y la base de datos de
desarrollo SHALL aceptar conexiones únicamente desde la propia máquina (loopback) y SHALL
rechazar las que lleguen por cualquier otra interfaz de red.

#### Scenario: Frontend inaccesible desde la red local
- **WHEN** se levanta el frontend con el script de desarrollo o de producción por defecto y
  otro equipo de la red intenta conectarse a su puerto
- **THEN** la conexión no se establece
- **AND** desde la propia máquina, `http://localhost:3000` responde normalmente

#### Scenario: Backend inaccesible desde la red local
- **WHEN** se levanta el backend sin definir el host de escucha y se intenta conectar a su
  puerto usando la IP de red de la máquina
- **THEN** la conexión no se establece
- **AND** el frontend, desde la misma máquina, sigue llegando al backend

#### Scenario: Base de datos de desarrollo inaccesible desde la red local
- **WHEN** se levanta la base de datos con `docker compose up` y se intenta conectar a su
  puerto usando la IP de red de la máquina
- **THEN** la conexión no se establece
- **AND** el backend y las migraciones, desde la misma máquina, se conectan normalmente

### Requirement: Exposición en la red local solo por decisión explícita
El sistema SHALL permitir exponer el frontend y el backend en la red local únicamente mediante
una acción explícita y documentada (un script o una variable de entorno con un nombre que lo
indique), nunca como efecto de la configuración por defecto.

#### Scenario: Probar desde otro dispositivo de la red
- **WHEN** una persona del equipo necesita abrir la app desde un celular de la misma red
- **THEN** la documentación indica el script explícito que expone el frontend en la red
- **AND** advierte que, mientras está expuesto, cualquier equipo de esa red puede usarlo

#### Scenario: Exposición explícita responde desde la IP de red
- **WHEN** se levanta el frontend con el script explícito de red local (`dev:lan`) y el
  backend con `HOST=0.0.0.0`
- **THEN** `http://<IP-de-red>:3000` responde desde otro equipo o dispositivo de la misma red
- **AND** `http://<IP-de-red>:3001/zonas` responde con el backend

### Requirement: Origen del cliente no falsificable con encabezados
Con la configuración por defecto, el backend SHALL identificar el origen de cada solicitud por
la conexión que la trae y SHALL ignorar `X-Forwarded-For`, `X-Real-IP` y `Forwarded` para ese
fin, de modo que un cliente no pueda presentarse como otro origen para saltear un límite de
solicitudes.

#### Scenario: Cambiar X-Forwarded-For no evita el límite de login
- **WHEN** un mismo cliente envía intentos de login fallidos, cada uno con un valor distinto
  de `X-Forwarded-For`, hasta superar el límite de intentos
- **THEN** el backend responde `429 Too Many Requests` al primer intento que supera el límite,
  igual que si no hubiera enviado el encabezado

#### Scenario: Cambiar X-Forwarded-For no evita el límite de la consulta pública
- **WHEN** un mismo cliente supera el límite de consultas públicas variando
  `X-Forwarded-For` en cada solicitud
- **THEN** el backend responde `429 Too Many Requests` a las consultas que superan el límite

### Requirement: Confianza en proxies solo explícita y acotada
El backend SHALL tomar el origen del cliente de los encabezados de reenvío únicamente cuando
la configuración declara de manera explícita qué saltos son confiables, y en ese caso SHALL
confiar solo en esos saltos. El backend SHALL rechazar al arrancar una configuración que
declare confiables a todos los saltos, que exprese la confianza como un número de saltos, o
que contenga, en cualquier posición de una lista de saltos, un elemento que equivalga a
confiar en todos o un número de saltos. Cada elemento de esa lista SHALL tener uno de los
formatos admitidos (un nombre predefinido de red local o de loopback, una dirección IPv4 o una
subred IPv4 acotada) y el backend SHALL rechazar al arrancar cualquier otro formato, incluidas
las subredes en notación IPv6, porque algunas de sus escrituras, aunque parezcan acotadas,
hacen confiable a cualquier origen.

#### Scenario: Confianza declarada en un salto
- **WHEN** la configuración declara confiable la dirección del proxy de borde y una solicitud
  llega desde ese proxy con `X-Forwarded-For` indicando la IP del cliente
- **THEN** el backend aplica los límites de solicitudes a la IP del cliente, no a la del
  proxy

#### Scenario: Encabezado agregado por un cliente detrás del salto confiable
- **WHEN** con un salto confiable declarado, el cliente envía su propio `X-Forwarded-For` y
  el proxy de borde agrega la IP real al final
- **THEN** el backend usa la IP que agregó el proxy, no la que inventó el cliente

#### Scenario: Configuración que confía en todos los saltos
- **WHEN** se intenta arrancar el backend con una configuración que confía en cualquier salto
- **THEN** el backend no arranca y el error indica que hay que declarar los saltos confiables
  de forma explícita

#### Scenario: Configuración por número de saltos
- **WHEN** se intenta arrancar el backend con una configuración de confianza que es un número
  de saltos (por ejemplo `1`)
- **THEN** el backend no arranca y el error indica que hay que declarar los saltos confiables
  de forma explícita

#### Scenario: Catch-all escondido en una lista de saltos
- **WHEN** se intenta arrancar el backend con una lista de saltos en la que algún elemento
  confía en todos o es un número (por ejemplo `10.0.0.5,0.0.0.0/0` o `loopback, ::/0`)
- **THEN** el backend no arranca y el error indica que hay que declarar los saltos confiables
  de forma explícita

#### Scenario: Subred en notación IPv6 que parece acotada
- **WHEN** se intenta arrancar el backend declarando como confiable `::ffff:10.0.0.0/8` o
  `::/1`
- **THEN** el backend no arranca y el error indica los formatos admitidos
- **AND** ningún cliente puede presentarse como otro origen enviando `X-Forwarded-For`

#### Scenario: Subred IPv4 acotada admitida
- **WHEN** se arranca el backend declarando como confiable `10.0.0.0/8`
- **THEN** el backend arranca y confía solo en los saltos de ese bloque

### Requirement: Condición de despliegue documentada
La documentación del proyecto SHALL indicar que, detrás del proxy `/api` del frontend y sin un
proxy de borde confiable, los límites de solicitudes por cliente se aplican por máquina, y
SHALL indicar qué hace falta para desplegar el sistema: un proxy de borde que sobrescriba
`X-Forwarded-For` y la declaración de ese salto como confiable en el backend.

#### Scenario: Consultar cómo desplegar
- **WHEN** alguien del equipo lee la documentación para desplegar el sistema fuera de una
  máquina local
- **THEN** encuentra la limitación de los límites por cliente detrás de `/api` y los pasos
  para configurar el proxy de borde y la confianza en el backend
