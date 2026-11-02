## 1. Medir la cadena real

- [ ] 1.1 Levantar en local la cadena del compose de producción (Caddy, frontend y backend) y registrar qué `req.ip` ve el backend para: un cliente sin encabezados, un cliente que inventa `X-Forwarded-For` y un cliente que simula a Cloudflare con `CF-Connecting-IP`. Guardar la salida en el PR. Verificar que el resultado actual reproduce el síntoma (el origen no es el del visitante detrás de un proxy declarado); si no lo reproduce, ajustar proposal.md y design.md antes de seguir.
- [ ] 1.2 Obtener las listas oficiales (`ips-v4` e `ips-v6`), guardarlas en `deploy/cloudflare-ips.txt` con fecha y fuente, y verificar con un chequeo de formato CIDR que no hay líneas vacías ni rangos inválidos.

## 2. Pruebas primero

- [ ] 2.1 Escribir primero una prueba de integración de la lógica de confianza (sin Docker de producción: `caddy validate` más un Caddy efímero en CI, o un servidor local que simule las conexiones) para los escenarios del spec: dos visitantes con dos contadores, un mismo visitante por bordes distintos con un solo contador, y `CF-Connecting-IP` o `X-Forwarded-For` inventados desde un origen no confiable ignorados. Verificar que fallan con el `Caddyfile` actual.
- [ ] 2.2 Escribir una prueba del script de comprobación de rangos (diferencia entre la lista local y una lista de ejemplo) y verificar que detecta altas y bajas.

## 3. Implementación

- [ ] 3.1 `deploy/Caddyfile`: `trusted_proxies static` con los rangos, `client_ip_headers CF-Connecting-IP` y `header_up X-Forwarded-For {client_ip}` con el descarte de los demás encabezados. Verificar con `caddy validate` en la imagen fijada y con las pruebas de 2.1 en verde.
- [ ] 3.2 Si la tarea 1.1 lo exige, ajustar `TRUST_PROXY` en el compose (sin cambiar código del backend) y verificar que pasan las pruebas de `exposicion-red` existentes y las de 2.1.
- [ ] 3.3 Escribir el script de comprobación de rangos (D2) y verificar con las pruebas de 2.2 y ejecutándolo contra la lista oficial real.
- [ ] 3.4 Actualizar los comentarios de `deploy/Caddyfile` y de `deploy/docker-compose.prod.yml` (hoy dicen que Caddy ve «la IP real del cliente») y verificar con una lectura que ninguno afirma algo que ya no es cierto.

## 4. Documentación

- [ ] 4.1 `docs/despliegue.md` §6: reemplazar «Pendiente (otro change)» por lo hecho; agregar el procedimiento para actualizar los rangos (cuándo, cómo, qué comprobar) y el de la regla del grupo de seguridad. Verificar que cada comando documentado se probó.
- [ ] 4.2 Correr `openspec validate ip-real-detras-de-cloudflare --strict`, `npx eslint .`, `npm run test:deploy` y `npm run test:scripts`, y verificar que están en verde.

## 5. Después del despliegue (verificaciones posteriores)

- [ ] 5.1 Tras el despliegue del `Caddyfile`, confirmar en Actions que `verificar` queda en verde y que `curl` a `/version` devuelve el SHA desplegado.
- [ ] 5.2 Prueba de contadores en producción (D5): dos orígenes distintos no se afectan entre sí y uno solo supera el límite al sexto intento. Registrar el resultado en el PR.
- [ ] 5.3 Restringir 80 y 443 del grupo de seguridad a los rangos de Cloudflare (lo hace una persona) y verificar que el sitio sigue respondiendo por Cloudflare y que la conexión directa a la IP elástica por esos puertos no se establece.
- [ ] 5.4 Confirmar que la renovación de certificados sigue funcionando tras cerrar el origen (revisar el log de Caddy o forzar una renovación en una ventana controlada).
- [ ] 5.5 Archivar el change con `openspec archive ip-real-detras-de-cloudflare` en su propio PR.
