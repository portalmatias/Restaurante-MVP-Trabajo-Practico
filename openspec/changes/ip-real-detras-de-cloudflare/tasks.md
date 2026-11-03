## 1. Medir la cadena real

- [ ] 1.1 Levantar en local la cadena del compose de producción (Caddy, frontend y backend) y registrar qué `req.ip` ve el backend para: un cliente sin encabezados, un cliente que inventa `X-Forwarded-For` y un cliente que simula a Cloudflare con `CF-Connecting-IP`. Guardar la salida en el PR, junto con una forma de medir la IP que ve el backend por pedido (diagnóstico temporal, que no se despliega). Verificar que el resultado actual reproduce el síntoma (el origen no es el del visitante detrás de un proxy declarado); si no lo reproduce, ajustar proposal.md y design.md antes de seguir.
- [ ] 1.2 Obtener las listas oficiales (`ips-v4` e `ips-v6`), guardarlas en `deploy/cloudflare-ips.txt` con fecha y fuente, y verificar con un chequeo de formato CIDR que no hay líneas vacías ni rangos inválidos.

## 2. Pruebas primero

- [ ] 2.1 Escribir primero una prueba de integración de la lógica de confianza (sin Docker de producción: `caddy validate` más un Caddy efímero en CI, o un servidor local que simule las conexiones) para los escenarios del spec: dos visitantes con dos contadores, un mismo visitante por bordes distintos con un solo contador, y `CF-Connecting-IP` o `X-Forwarded-For` inventados desde un origen no confiable ignorados. Verificar que fallan con el `Caddyfile` actual los escenarios de contadores (dos visitantes y mismo visitante por bordes distintos, con tres IP distintas para los visitantes); el de encabezados inventados y el de la conexión de Cloudflare sin `CF-Connecting-IP` ya se cumplen hoy y se escriben como guardas de regresión que deben seguir en verde.
- [ ] 2.2 Escribir una prueba de coherencia: el bloque `trusted_proxies` del `Caddyfile` debe coincidir con `deploy/cloudflare-ips.txt`; verificar que falla si se altera un rango en cualquiera de los dos.
- [ ] 2.3 Escribir una prueba del script de comprobación de rangos (diferencia entre la lista local y una lista de ejemplo) y verificar que detecta altas y bajas.

## 3. Implementación

- [ ] 3.1 `deploy/Caddyfile`: `trusted_proxies static` con los rangos, `client_ip_headers CF-Connecting-IP` y `header_up X-Forwarded-For {client_ip}` con el descarte de los demás encabezados. Verificar con `caddy validate` en la imagen fijada y con las pruebas de 2.1 en verde.
- [ ] 3.2 Si la tarea 1.1 lo exige, ajustar `TRUST_PROXY` en el compose (sin cambiar código del backend) y verificar que pasan las pruebas de `exposicion-red` existentes y las de 2.1.
- [ ] 3.3 Escribir el script de comprobación de rangos (D2) y verificar con las pruebas de 2.3 y ejecutándolo contra la lista oficial real.
- [ ] 3.5 Agregar las pruebas de 2.1, 2.2 y 2.3 a las listas fijas de `test:scripts` y `test:deploy` en `package.json` (no son globs) y verificar en el CI del PR que los pasos «Tests de las utilidades de scripts/» y «Tests de deploy/desplegar.sh» ejecutan los archivos nuevos (contarlos en la salida), no solo que terminan en verde.
- [ ] 3.6 Workflow programado (semanal) que ejecuta la comprobación de rangos y falla con las altas y bajas; verificar con `actionlint` (job de lint de CI) y disparándolo a mano una vez.
- [ ] 3.4 Actualizar los comentarios de `deploy/Caddyfile` y de `deploy/docker-compose.prod.yml` (hoy dicen que Caddy ve «la IP real del cliente») y verificar con una lectura que ninguno afirma algo que ya no es cierto.

## 4. Documentación

- [ ] 4.1 `docs/despliegue.md`: §6 (reemplazar «Pendiente (otro change)» por lo hecho; procedimiento para actualizar los rangos, altas y bajas, y el de la regla del grupo de seguridad, que se actualizan juntas) y las secciones §2, §7, §9 y §11 que suponen 80/443 abiertos a `0.0.0.0/0` o acceso directo a la IP (en la etapa transitoria en HTTP, §11, Cloudflare no está delante). Verificar que cada comando documentado se probó.
- [ ] 4.2 Correr `openspec validate ip-real-detras-de-cloudflare --strict`, `npx eslint .`, `npm run test:deploy` y `npm run test:scripts`, y verificar que están en verde.

## 5. Después del despliegue (verificaciones posteriores)

- [ ] 5.1 Tras el despliegue del `Caddyfile`, confirmar en Actions que `verificar` queda en verde y que `curl` a `/version` devuelve el SHA desplegado.
- [ ] 5.2 Prueba de contadores en producción (D5): registrar el `CF-RAY` de cada pedido y la IP que ve el backend para cada salida; verificar que dos orígenes con IP distinta en el backend no se afectan entre sí y que uno solo supera el límite al sexto intento. Si las dos salidas caen en el mismo borde, la prueba no distingue y no vale: repetir desde otra salida. Registrar el resultado en el PR.
- [ ] 5.3 Restringir 80 y 443 del grupo de seguridad a los rangos de Cloudflare (lo hace una persona) y verificar que el sitio sigue respondiendo por Cloudflare y que la conexión directa a la IP elástica por esos puertos no se establece.
- [ ] 5.4 Confirmar que la renovación de certificados sigue funcionando tras cerrar el origen (revisar el log de Caddy o forzar una renovación en una ventana controlada).
- [ ] 5.5 Archivar el change con `openspec archive ip-real-detras-de-cloudflare` en su propio PR.
