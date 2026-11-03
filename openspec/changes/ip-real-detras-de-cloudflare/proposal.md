## Why

El sitio público pasa por Cloudflare con proxy (docs/despliegue.md §6). Caddy, que hoy no declara qué proxies son confiables, toma como cliente la dirección de Cloudflare y no la del visitante. El límite de intentos del login (5 por minuto) y los de las consultas públicas quedan entonces contados por borde de Cloudflare, no por persona: en una prueba contra producción (29/10/2026), 12 intentos de login fallidos seguidos dieron todos 401, y en una segunda tanda apareció un 429 entre respuestas 401. Eso debilita la protección contra fuerza bruta y agrupa a visitantes legítimos que comparten un borde. El runbook ya lo dejó como pendiente de «otro change».

## What Changes

- Caddy confía únicamente en los rangos publicados de Cloudflare para leer la IP real del visitante (`CF-Connecting-IP`) y se la entrega a la aplicación como único origen del cliente, descartando lo que el visitante haya puesto en `X-Forwarded-For`, `X-Real-IP` o `Forwarded`.
- Una conexión que no viene de Cloudflare no puede presentarse con otra IP: `CF-Connecting-IP` y compañía se ignoran si el origen no es un rango de Cloudflare.
- El servidor deja de aceptar tráfico web que no pase por Cloudflare (grupo de seguridad de la instancia limitado a los rangos de Cloudflare en 80 y 443), con un procedimiento documentado para refrescar la lista.
- La lista de rangos de Cloudflare tiene una única fuente versionada, de la que sale la configuración de Caddy; una comprobación de integración continua falla si difieren y una comprobación periódica señala altas y bajas respecto de la lista que publica Cloudflare.
- Una verificación repetible comprueba que dos visitantes distintos tienen contadores distintos y que un mismo visitante, aunque llegue por bordes distintos, comparte el suyo; en producción solo vale si se confirma qué IP ve el backend.
- Se actualiza `docs/despliegue.md` (sección Cloudflare y el comentario de `deploy/docker-compose.prod.yml`, que hoy dice que Caddy ve «la IP real del cliente»).

No hay cambios en la API ni en el frontend.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `exposicion-red`: se agregan requisitos sobre el origen del visitante detrás de un proxy de borde declarado (Cloudflare) y sobre aceptar tráfico web solo desde ese proxy. Los requisitos existentes no cambian.

## Impact

- `deploy/Caddyfile` y `deploy/docker-compose.prod.yml` (comentarios y, si hace falta, variables).
- `docs/despliegue.md`: §6 «El subdominio pasa por Cloudflare» (procedimiento de actualización de rangos) y las secciones que hoy suponen el puerto 80/443 abierto a `0.0.0.0/0` o el acceso directo a la IP: §2 (tabla del security group), §7 (pruebas con acceso directo), §9 (paso que abre el grupo a `0.0.0.0/0` y diagnósticos) y §11 (etapa transitoria en HTTP, donde Cloudflare todavía no está delante).
- `package.json` y `.github/workflows/ci.yml`: las pruebas nuevas entran en las listas de `test:scripts`/`test:deploy`, y una comprobación periódica de la lista de Cloudflare (workflow programado).
- Prueba de integración sin Docker real para la lógica de confianza, y verificación en producción después de desplegar.
- Infraestructura manual: grupo de seguridad de la instancia en AWS (lo hace una persona; no se automatiza en este change).
- Sin cambios en `backend/` salvo que la verificación de la tarea 1.1 demuestre que `TRUST_PROXY` necesita otro valor (ver design.md, D4).
