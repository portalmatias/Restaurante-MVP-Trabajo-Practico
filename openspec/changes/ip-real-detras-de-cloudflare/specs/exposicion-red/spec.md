## ADDED Requirements

### Requirement: Origen real del visitante detrás del proxy de borde
Cuando el sitio público se sirve detrás de Cloudflare, el sistema SHALL identificar a cada visitante por la dirección IP real que Cloudflare informa para esa conexión y SHALL usar esa dirección, y ninguna otra, para contar los límites de solicitudes (login, consulta pública de reservas y el resto de los límites por origen). La dirección SHALL ser la misma para todas las solicitudes del visitante aunque lleguen por bordes de Cloudflare distintos.

#### Scenario: Dos visitantes distintos no comparten contador
- **WHEN** dos visitantes con direcciones IP distintas hacen intentos de login fallidos a través de Cloudflare, cada uno por debajo del límite
- **THEN** ninguno de los dos recibe `429 Too Many Requests`
- **AND** un tercer visitante, con una dirección distinta de las otras dos, no se ve afectado por los intentos de los dos primeros

#### Scenario: Un mismo visitante comparte contador aunque cambie de borde
- **WHEN** un mismo visitante supera el límite de intentos de login y sus solicitudes llegan por bordes de Cloudflare con direcciones distintas
- **THEN** el sistema responde `429 Too Many Requests` al primer intento que supera el límite, como si todas hubieran llegado por el mismo borde

#### Scenario: El visitante no puede elegir su origen con encabezados
- **WHEN** un visitante envía a través de Cloudflare `X-Forwarded-For`, `X-Real-IP`, `Forwarded` o `CF-Connecting-IP` con valores inventados
- **THEN** el sistema ignora esos valores y lo cuenta por la dirección que Cloudflare informa para su conexión

### Requirement: El encabezado de Cloudflare solo se acepta desde Cloudflare
El sistema SHALL tomar `CF-Connecting-IP` como origen del visitante únicamente cuando la conexión provenga de un rango de direcciones de la lista vigente de Cloudflare. Una conexión que no provenga de esos rangos SHALL ser identificada por su propia dirección, y los encabezados `CF-Connecting-IP`, `X-Forwarded-For`, `X-Real-IP` y `Forwarded` que traiga SHALL ignorarse para ese fin. Una conexión de un rango de Cloudflare que llegue sin `CF-Connecting-IP` SHALL ser identificada por la dirección de esa conexión (la del borde).

#### Scenario: Conexión directa con CF-Connecting-IP inventado
- **WHEN** una conexión que no viene de un rango de Cloudflare envía `CF-Connecting-IP` con la dirección de otra persona
- **THEN** el sistema la cuenta por su dirección real
- **AND** el contador de la dirección inventada no cambia

#### Scenario: Conexión de un rango de Cloudflare sin CF-Connecting-IP
- **WHEN** llega una conexión desde un rango de la lista vigente de Cloudflare sin el encabezado `CF-Connecting-IP`
- **THEN** el sistema la identifica por la dirección de esa conexión
- **AND** no usa ningún `X-Forwarded-For` que traiga como origen

### Requirement: Tráfico web solo desde Cloudflare
El servidor de producción SHALL aceptar conexiones web (HTTP y HTTPS) únicamente desde los rangos de direcciones publicados por Cloudflare, para que nadie llegue al origen salteando el proxy y sus límites. El acceso de administración por SSH SHALL conservar su regla propia, independiente de Cloudflare. La lista de rangos que usa el servidor (reglas de red) y la que usa el sistema para confiar en `CF-Connecting-IP` SHALL actualizarse juntas.

#### Scenario: Conexión directa al origen
- **WHEN** alguien se conecta a la IP del servidor por los puertos 80 o 443 desde una dirección que no es de Cloudflare
- **THEN** la conexión no se establece

#### Scenario: Acceso normal por Cloudflare
- **WHEN** un visitante abre el sitio a través de Cloudflare
- **THEN** el sitio responde normalmente
- **AND** la renovación del certificado de Let's Encrypt sigue funcionando

#### Scenario: Cloudflare incorpora un rango que el sistema todavía no conoce
- **WHEN** Cloudflare empieza a servir tráfico desde un rango que no figura todavía en las reglas de red del servidor
- **THEN** las conexiones de ese rango no llegan al servidor (el sitio puede fallar para una parte de los visitantes hasta actualizar la lista)
- **AND** si en cambio el rango sí está en las reglas de red pero no en la lista de confianza del sistema, esas conexiones llegan y se cuentan por la dirección del borde, de modo que el límite se reparte entre bordes como antes de este cambio, solo para ese tráfico

### Requirement: Lista de rangos de Cloudflare documentada, única y verificable
El proyecto SHALL mantener la lista de rangos de Cloudflare en un único lugar versionado, SHALL derivar de ella lo que usa el sistema para confiar en `CF-Connecting-IP`, y SHALL documentar de dónde sale, cómo se actualiza (altas y bajas) y cómo comprobar que coincide con la publicada por Cloudflare. El sistema SHALL fallar una comprobación automática cuando la lista que usa difiera de la versionada, y SHALL señalar periódicamente cuándo la versionada difiere de la publicada, sin requerir cambios en el código de la aplicación.

#### Scenario: Comprobar que la lista está al día
- **WHEN** una persona sigue el procedimiento documentado de comprobación, o se ejecuta la comprobación periódica
- **THEN** se obtiene la diferencia entre la lista versionada y la publicada por Cloudflare, con las altas y las bajas por separado
- **AND** si hay diferencias, el procedimiento indica cómo actualizar la lista versionada y las reglas de red

#### Scenario: La lista que usa el sistema difiere de la versionada
- **WHEN** la configuración que se despliega contiene rangos de confianza distintos de los de la lista versionada
- **THEN** la comprobación de integración continua falla antes del despliegue

#### Scenario: Cloudflare retira un rango
- **WHEN** Cloudflare deja de publicar un rango que sigue en la lista versionada
- **THEN** la comprobación periódica lo señala como baja a retirar
- **AND** hasta retirarlo, ese rango sigue siendo de confianza (riesgo acotado: solo lo aprovecha quien controle direcciones de ese rango)
