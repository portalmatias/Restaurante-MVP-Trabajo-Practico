## ADDED Requirements

### Requirement: Origen real del visitante detrás del proxy de borde
Cuando el sitio público se sirve detrás de Cloudflare, el sistema SHALL identificar a cada visitante por la dirección IP real que Cloudflare informa para esa conexión y SHALL usar esa dirección, y ninguna otra, para contar los límites de solicitudes (login, consulta pública de reservas y el resto de los límites por origen). La dirección SHALL ser la misma para todas las solicitudes del visitante aunque lleguen por bordes de Cloudflare distintos.

#### Scenario: Dos visitantes distintos no comparten contador
- **WHEN** dos visitantes con direcciones IP distintas hacen intentos de login fallidos a través de Cloudflare, cada uno por debajo del límite
- **THEN** ninguno de los dos recibe `429 Too Many Requests`
- **AND** un tercer visitante no se ve afectado por los intentos de los otros dos

#### Scenario: Un mismo visitante comparte contador aunque cambie de borde
- **WHEN** un mismo visitante supera el límite de intentos de login y sus solicitudes llegan por bordes de Cloudflare con direcciones distintas
- **THEN** el sistema responde `429 Too Many Requests` al primer intento que supera el límite, como si todas hubieran llegado por el mismo borde

#### Scenario: El visitante no puede elegir su origen con encabezados
- **WHEN** un visitante envía a través de Cloudflare `X-Forwarded-For`, `X-Real-IP`, `Forwarded` o `CF-Connecting-IP` con valores inventados
- **THEN** el sistema ignora esos valores y lo cuenta por la dirección que Cloudflare informa para su conexión

### Requirement: El encabezado de Cloudflare solo se acepta desde Cloudflare
El sistema SHALL tomar `CF-Connecting-IP` como origen del visitante únicamente cuando la conexión provenga de un rango de direcciones publicado por Cloudflare. Una conexión que no provenga de esos rangos SHALL ser identificada por su propia dirección, y los encabezados `CF-Connecting-IP`, `X-Forwarded-For`, `X-Real-IP` y `Forwarded` que traiga SHALL ignorarse para ese fin.

#### Scenario: Conexión directa con CF-Connecting-IP inventado
- **WHEN** una conexión que no viene de un rango de Cloudflare envía `CF-Connecting-IP` con la dirección de otra persona
- **THEN** el sistema la cuenta por su dirección real
- **AND** el contador de la dirección inventada no cambia

#### Scenario: Rango de Cloudflare desactualizado
- **WHEN** Cloudflare incorpora un rango nuevo que todavía no figura en la lista del sistema
- **THEN** las conexiones de ese rango se identifican por la dirección del borde (más estricto, nunca más permisivo)
- **AND** no se acepta ningún `CF-Connecting-IP` de ese rango hasta actualizar la lista

### Requirement: Tráfico web solo desde Cloudflare
El servidor de producción SHALL aceptar conexiones web (HTTP y HTTPS) únicamente desde los rangos de direcciones publicados por Cloudflare, para que nadie llegue al origen salteando el proxy y sus límites. El acceso de administración por SSH SHALL conservar su regla propia, independiente de Cloudflare.

#### Scenario: Conexión directa al origen
- **WHEN** alguien se conecta a la IP del servidor por los puertos 80 o 443 desde una dirección que no es de Cloudflare
- **THEN** la conexión no se establece

#### Scenario: Acceso normal por Cloudflare
- **WHEN** un visitante abre el sitio a través de Cloudflare
- **THEN** el sitio responde normalmente
- **AND** la renovación del certificado de Let's Encrypt sigue funcionando

### Requirement: Lista de rangos de Cloudflare documentada y verificable
El proyecto SHALL documentar de dónde sale la lista de rangos de Cloudflare que usa el sistema, cómo se actualiza y cómo comprobar que la lista vigente coincide con la que publica Cloudflare. El sistema SHALL poder comprobarlo con un procedimiento repetible que no requiera cambiar código de la aplicación.

#### Scenario: Comprobar que la lista está al día
- **WHEN** una persona sigue el procedimiento documentado de comprobación
- **THEN** obtiene la diferencia entre la lista del sistema y la publicada por Cloudflare
- **AND** si hay diferencias, el procedimiento indica cómo actualizar la lista
