## MODIFIED Requirements

### Requirement: Confianza en proxies solo explícita y acotada
El backend SHALL tomar el origen del cliente de los encabezados de reenvío únicamente cuando
la configuración declara de manera explícita qué saltos son confiables, y en ese caso SHALL
confiar solo en esos saltos. Los saltos confiables son los que **se conectan al backend** y
están entre él y el proxy de borde. Detrás del proxy `/api`, ese salto es el servidor del
frontend, no el proxy de borde. El backend SHALL rechazar al arrancar:

- una configuración que declare confiables a todos los saltos;
- una que exprese la confianza como un número de saltos;
- una lista de saltos que contenga, en cualquier posición, un elemento que equivalga a confiar
  en todos o un número de saltos.

Cada elemento de esa lista SHALL tener uno de estos formatos admitidos:

- un nombre predefinido de red local o de loopback;
- una dirección IPv4;
- una subred IPv4 con prefijo `/8` o mayor.

El backend SHALL rechazar al arrancar cualquier otro formato. Eso incluye una subred IPv4 con
prefijo menor que `/8` y las subredes en notación IPv6, porque algunas de sus escrituras, aunque
parezcan acotadas, hacen confiable a cualquier origen.

#### Scenario: Confianza declarada en un salto
- **WHEN** la configuración declara confiable la dirección del frontend, que es el salto que se
  conecta al backend, y una solicitud llega desde ese salto con `X-Forwarded-For` indicando la
  IP del cliente que escribió el proxy de borde
- **THEN** el backend aplica los límites de solicitudes a la IP del cliente, no a la del
  frontend ni a la del proxy

#### Scenario: Confianza declarada solo en el proxy de borde detrás de /api
- **WHEN** la configuración declara confiable únicamente la dirección del proxy de borde, pero
  las solicitudes llegan al backend desde el frontend
- **THEN** el backend no toma el origen de `X-Forwarded-For` y aplica los límites a la
  dirección del frontend
- **AND** la documentación advierte que esa configuración deja los límites por máquina

#### Scenario: Encabezado agregado por un cliente detrás del salto confiable
- **WHEN** con un salto confiable declarado, el cliente, cuya IP no pertenece a ningún salto
  confiable, envía su propio `X-Forwarded-For` y el salto confiable agrega la IP real al final
- **THEN** el backend usa la IP que agregó el salto, no la que inventó el cliente

#### Scenario: Proxy de borde que reemplaza el encabezado
- **WHEN** el proxy de borde reemplaza el `X-Forwarded-For` del cliente por la IP de la
  conexión, como exige la condición de despliegue
- **THEN** el backend usa esa IP aunque el cliente esté dentro de una subred declarada
  confiable

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
- **THEN** el backend no arranca y el error pide declarar los saltos confiables e indica los
  formatos admitidos
- **AND** ningún cliente puede presentarse como otro origen enviando `X-Forwarded-For`

#### Scenario: Subred IPv4 con prefijo menor que /8
- **WHEN** se intenta arrancar el backend declarando como confiable `10.0.0.0/7`
- **THEN** el backend no arranca y el error pide declarar los saltos confiables e indica los
  formatos admitidos

#### Scenario: Subred IPv4 acotada admitida
- **WHEN** se arranca el backend declarando como confiable `10.0.0.0/8`
- **THEN** el backend arranca y confía solo en los saltos de ese bloque

### Requirement: Condición de despliegue documentada
La documentación del proyecto SHALL indicar que, detrás del proxy `/api` del frontend y sin un
proxy de borde confiable, los límites de solicitudes por cliente se aplican por máquina. Para
desplegar el sistema, SHALL indicar que hacen falta tres cosas:

- un proxy de borde que sobrescriba `X-Forwarded-For` con la IP de la conexión;
- la declaración, como confiables en el backend, de los saltos que se conectan a él (el
  servidor del frontend), no la del proxy de borde;
- que ni el frontend ni el backend sean accesibles salteando el proxy de borde, porque el
  frontend reenvía tal cual el `X-Forwarded-For` que recibe.

#### Scenario: Consultar cómo desplegar
- **WHEN** alguien del equipo lee la documentación para desplegar el sistema fuera de una
  máquina local
- **THEN** encuentra la limitación de los límites por cliente detrás de `/api` y los pasos
  para configurar el proxy de borde y la confianza en el backend
- **AND** la documentación indica que el salto que se declara confiable es el frontend y que el
  frontend no debe ser accesible salteando el proxy de borde
