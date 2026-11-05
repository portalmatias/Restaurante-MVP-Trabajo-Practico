## Context

Cadena de producción (`deploy/docker-compose.prod.yml`): visitante → **Cloudflare** (proxy) → **Caddy** (único servicio con puertos) → **frontend** (Next, IP fija 172.30.0.10) → **backend** → postgres. El backend cuenta los límites por `req.ip` (`ThrottlerGuard`); `TRUST_PROXY=172.30.0.10` hace que Express confíe en un solo salto, el frontend.

Supuesto de diseño de `despliegue-continuo-ec2` (D5, comentario del `Caddyfile`): Caddy «sobrescribe `X-Forwarded-For` con la IP de la conexión», o sea la del visitante. Detrás de Cloudflare esa conexión es la del borde, así que el dato que baja hasta el backend es la dirección de un borde de Cloudflare. Efecto observado el 29/10/2026 contra producción (ver proposal.md, Why): el límite de login de 5 por minuto se reparte entre bordes.

Qué ofrece Caddy 2.11 (versión fijada en el compose): en las opciones globales, `servers { trusted_proxies static <rangos> ; client_ip_headers CF-Connecting-IP }` hace que Caddy tome como `{client_ip}` el valor de ese encabezado solo si la conexión viene de un rango declarado; si no, usa la dirección de la conexión. `reverse_proxy` permite fijar un encabezado hacia el servicio con `header_up`.

Restricción: la lista de rangos de Cloudflare no se escribe de memoria ni se copia de un tercero; sale de <https://www.cloudflare.com/ips-v4> y <https://www.cloudflare.com/ips-v6> y queda en el repositorio con fecha.

## Goals / Non-Goals

**Goals:**
- El backend recibe la IP real del visitante como único origen y los límites cuentan por ella.
- Un cliente que no pasa por Cloudflare no puede elegir su origen con ningún encabezado.
- El origen deja de ser alcanzable salteando Cloudflare.

**Non-Goals:**
- Bloqueo o reputación de IPs, WAF o reglas de Cloudflare.
- Cambiar los límites numéricos (5/min en login, 10/min por defecto, 60/min en rutas de admin).
- Automatizar el grupo de seguridad de AWS (es manual y documentado).
- Cambios en el frontend o en la API.

## Decisions

### D1. Caddy resuelve la IP del cliente y la escribe una sola vez
En `deploy/Caddyfile`: opciones globales con `trusted_proxies static` (rangos de Cloudflare) y `client_ip_headers CF-Connecting-IP`; en `reverse_proxy`, `header_up X-Forwarded-For {client_ip}` y se descartan `X-Real-IP`, `Forwarded` y `CF-Connecting-IP`, para que el frontend reciba un único valor, sobrescrito, nunca el que mande el visitante. También se fijan `header_up X-Forwarded-Host {host}` y `header_up X-Forwarded-Proto {scheme}`: con `trusted_proxies` Caddy deja de sobrescribirlos y conserva los que llegan, y Cloudflare deja pasar los del visitante. Next los usa para URLs absolutas, redirecciones y el chequeo de origen de las server actions (agregado por la revisión del PR, 05/11/2026).

*Alternativa descartada:* que el backend lea `CF-Connecting-IP`. Obliga a código nuevo y a confiar en un encabezado que cualquiera puede mandar si el origen queda expuesto.

### D2. Rangos estáticos en el repositorio, con fecha y procedimiento
Los rangos viven en un único archivo versionado (por ejemplo `deploy/cloudflare-ips.txt`) y de él sale el bloque `trusted_proxies` del `Caddyfile`: el contenedor de Caddy solo recibe el `Caddyfile`, así que hace falta una comprobación de coherencia que falle en CI si el bloque renderizado no coincide con el archivo (requisito «única y verificable»). Un script chico compara además la lista versionada con la publicada por Cloudflare y muestra las altas y las bajas por separado; corre a mano y en un workflow programado (semanal) que falla cuando hay diferencias.

*Alternativas descartadas:* un módulo `caddy-cloudflare` o una imagen propia de Caddy (una imagen más que mantener), y bajar la lista en cada arranque (agrega una dependencia de red al despliegue y deja abierta la pregunta de qué hacer si la descarga falla). Con la lista estática hay dos fallas posibles, y ninguna es inocua: (a) un rango **nuevo** de Cloudflare que está en las reglas de red pero no en la lista de confianza hace que ese tráfico se cuente por el borde, es decir que el límite se reparte entre bordes como hoy (el bug se reabre solo para ese tráfico); si tampoco está en las reglas de red, esas conexiones no llegan. (b) un rango **retirado** por Cloudflare sigue siendo de confianza hasta quitarlo: solo lo aprovecharía quien controle direcciones de ese rango, pero es una confianza que sobra. El control para las dos es la revisión periódica de la lista y la comprobación programada, no un argumento de que el fallback es seguro.

### D3. Cerrar el origen con el grupo de seguridad
Reglas de entrada para 80 y 443 solo desde los rangos de Cloudflare; el puerto 22 conserva su regla. Sin esto, quien conozca la IP elástica puede conectarse directo. D1 ya neutraliza un `CF-Connecting-IP` inventado desde una conexión que no es de Cloudflare, pero cerrar el origen evita además saltear Cloudflare y sus límites de borde.

### D4. El valor de `TRUST_PROXY` se decide midiendo, no suponiendo
El backend confía hoy en el frontend (un salto). Lo que llega en `X-Forwarded-For` depende de cómo el frontend (Next, `rewrites` hacia el backend) reenvía el encabezado, y ese detalle no está comprobado en este repositorio. Por eso la primera tarea reproduce la cadena real del compose de producción y mide qué `req.ip` ve el backend, antes de tocar el `Caddyfile`. Si el valor actual de `TRUST_PROXY` alcanza, no hay cambios en `backend/`; si no, se ajusta la variable (no el código) y se actualizan los escenarios de `exposicion-red` que dependan de ella.

### D5. La verificación en producción usa el contador, no la lectura de logs
Para comprobar «dos visitantes, dos contadores» sin credenciales: pedidos de login fallidos con datos falsos desde dos salidas distintas (por ejemplo la conexión de la PC y un celular con datos) no se afectan entre sí, y repetidos desde una sola superan el límite al sexto intento. Pero esa prueba, sola, puede pasar con el bug presente si las dos salidas caen en bordes distintos. Por eso, antes de darla por válida: (1) se registra el `CF-RAY` de cada pedido (indica el centro de datos del borde) y se mide, con el diagnóstico de la tarea 1.1, qué IP ve el backend para cada salida; (2) el criterio exige IPs de cliente distintas en el backend para las dos salidas y la misma IP para un mismo visitante. El caso «un mismo visitante cambia de borde» no se puede forzar en producción: se cubre con la prueba reproducible de la tarea 2.1 (conexiones simuladas con bordes distintos y el mismo `CF-Connecting-IP`) y, en producción, solo cuando el `CF-RAY` muestre bordes distintos para un mismo visitante.

## Risks / Trade-offs

- [Rangos de Cloudflare desactualizados] → comprobación programada (D2) que señala altas y bajas; altas sin cargar reabren el bug para ese tráfico, bajas sin retirar dejan confianza de más. Ver D2.
- [Una conexión de un rango de Cloudflare sin `CF-Connecting-IP`] → se identifica por la dirección de la conexión (la del borde), sin usar ningún `X-Forwarded-For` que traiga; es un caso raro, cubierto por el spec.
- [Cerrar 80 y 443 deja afuera a Cloudflare si la lista del grupo de seguridad queda vieja] → usar una lista de prefijos administrada, o un recordatorio de revisión en el runbook; verificar el sitio tras cada actualización.
- [La renovación de certificados de Let's Encrypt (HTTP-01) pasa por Cloudflare] → ya funciona así hoy (docs/despliegue.md §6); la tarea 5.4 lo confirma después de cerrar el origen.
- [Un error en el `Caddyfile` deja el sitio caído] → el despliegue valida y vuelve atrás por su cuenta (`deploy/desplegar.sh`); se prueba antes con `caddy validate` en la imagen fijada.
- [La prueba manual de D5 puede activar límites reales] → se hace con datos falsos y se espera un minuto, porque el límite es por ventana.

## Migration Plan

1. Medir la cadena real en local (tarea 1.1) y fijar el diseño final del `Caddyfile`.
2. Cambiar `Caddyfile`, comentarios del compose y docs en un PR; el CD lo despliega y `verificar` confirma que el sitio sigue sirviendo.
3. Verificación manual de los contadores (D5).
4. Recién entonces, restringir el grupo de seguridad (D3), con el sitio abierto en otra pestaña para comprobar que sigue respondiendo. Revertir una regla de AWS es inmediato.

Marcha atrás: volver al commit anterior del `Caddyfile` (el CD tiene vuelta atrás) y reabrir 80 y 443 a `0.0.0.0/0` en el grupo de seguridad.
