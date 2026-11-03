## 1. Medir la cadena real

- [x] 1.1 Levantar en local la cadena del compose de producción (Caddy, frontend y backend) y registrar qué `req.ip` ve el backend para: un cliente sin encabezados, un cliente que inventa `X-Forwarded-For` y un cliente que simula a Cloudflare con `CF-Connecting-IP`. Guardar la salida en el PR, junto con una forma de medir la IP que ve el backend por pedido (diagnóstico temporal, que no se despliega). Verificar que el resultado actual reproduce el síntoma (el origen no es el del visitante detrás de un proxy declarado); si no lo reproduce, ajustar proposal.md y design.md antes de seguir.
      Resultado (02/11/2026): cadena de producción reproducida en local con Compose (Caddy 2.11.7
      fijado, imagen del frontend `reservas-frontend:local` y un «backend» de diagnóstico, temporal
      y NO versionado, que calcula `req.ip` con el mismo `trust proxy` (172.30.0.10) sobre el
      Express 5.2.1 de la imagen del backend). Con el `Caddyfile` de `main`: sin encabezados,
      `req.ip` es la IP del par que se conecta a Caddy (`172.26.0.1`; en producción, el borde de
      Cloudflare) y `X-Forwarded-For` llega con ese único valor; con un `X-Forwarded-For: 1.2.3.4`
      inventado, `req.ip` sigue siendo el del par (se ignora); `CF-Connecting-IP`, `X-Real-IP` y
      `Forwarded` llegan hasta el backend pero no se usan. **Síntoma reproducido:** los límites se
      cuentan por la IP del par que ve Caddy, o sea por el borde de Cloudflare, no por visitante.
      Next (el frontend) no agrega ni cambia `X-Forwarded-For`: el backend recibe exactamente lo
      que escribe Caddy. Con el `Caddyfile` nuevo y el par simulado como Cloudflare,
      `CF-Connecting-IP: 5.6.7.8` da `req.ip` = `5.6.7.8` y un `X-Forwarded-For` inventado se
      ignora, con `TRUST_PROXY` sin cambios. Límites de la medición: imágenes locales del 06/10
      (no las de producción) y el borde de Cloudflare simulado con el gateway de Docker, no con
      Cloudflare real.

- [x] 1.2 Obtener las listas oficiales (`ips-v4` e `ips-v6`), guardarlas en `deploy/cloudflare-ips.txt` con fecha y fuente, y verificar con un chequeo de formato CIDR que no hay líneas vacías ni rangos inválidos.
      Resultado (02/11/2026): 15 rangos IPv4 y 7 IPv6 descargados de las dos URLs oficiales (no
      escritos de memoria) en `deploy/cloudflare-ips.txt`, con fuente y fecha; los 22 son CIDR
      válidos (prueba en `verificar-rangos-cloudflare.test.mjs`) y el script contra la lista real
      de Cloudflare termina en 0.

## 2. Pruebas primero

- [x] 2.1 Escribir primero una prueba de integración de la lógica de confianza (sin Docker de producción: `caddy validate` más un Caddy efímero en CI, o un servidor local que simule las conexiones) para los escenarios del spec: dos visitantes con dos contadores, un mismo visitante por bordes distintos con un solo contador, y `CF-Connecting-IP` o `X-Forwarded-For` inventados desde un origen no confiable ignorados. Verificar que fallan con el `Caddyfile` actual los escenarios de contadores (dos visitantes y mismo visitante por bordes distintos, con tres IP distintas para los visitantes); el de encabezados inventados y el de la conexión de Cloudflare sin `CF-Connecting-IP` ya se cumplen hoy y se escriben como guardas de regresión que deben seguir en verde.
      Resultado (02/11/2026): `deploy/test/cloudflare-caddy.test.sh` (Caddy real de la imagen
      fijada delante de un eco, en una red temporal con IP conocidas; 8 comprobaciones). Con el
      `Caddyfile` de `main` fallan 6 de 8: origen = IP del visitante, tres visitantes por el mismo
      borde con tres orígenes, mismo visitante por dos bordes con un origen, `X-Real-IP`/
      `Forwarded` inventados que hoy llegan, `X-Forwarded-For` inventado con `CF-Connecting-IP`
      válido, y lo que inventa un cliente que no es Cloudflare; pasan en `main` las dos guardas de
      regresión (un cliente que no es Cloudflare se cuenta por su IP; una conexión de Cloudflare
      sin `CF-Connecting-IP` se cuenta por su IP). Con el `Caddyfile` nuevo pasan las 8. Se
      ejecuta con Docker y falla si no hay Docker (`SALTAR_CADDY=1` para omitirla).

- [x] 2.2 Escribir una prueba de coherencia: el bloque `trusted_proxies` del `Caddyfile` debe coincidir con `deploy/cloudflare-ips.txt`; verificar que falla si se altera un rango en cualquiera de los dos.
      Resultado (02/11/2026): en `verificar-rangos-cloudflare.test.mjs`. Con el `Caddyfile` de
      `main` (sin `trusted_proxies`) fallan 4 de los 40 tests; con el nuevo pasan los 40, y hay
      tests que fallan si se agrega un rango al `Caddyfile` o se quita uno del archivo.

- [x] 2.3 Escribir una prueba del script de comprobación de rangos (diferencia entre la lista local y una lista de ejemplo) y verificar que detecta altas y bajas.
      Resultado (02/11/2026): altas, bajas, orden y repetidos, error de red, HTTP de error,
      respuesta que no es una lista (HTML) y archivo vacío o con un rango inválido: en todos los
      casos de falla el script termina en 1.

## 3. Implementación

- [x] 3.1 `deploy/Caddyfile`: `trusted_proxies static` con los rangos, `client_ip_headers CF-Connecting-IP` y `header_up X-Forwarded-For {client_ip}` con el descarte de los demás encabezados. Verificar con `caddy validate` en la imagen fijada y con las pruebas de 2.1 en verde.
      Resultado (02/11/2026): `caddy validate` con la imagen fijada da «Valid configuration» en
      las dos etapas (`SITE_ADDRESS=:80` y con el subdominio); `cloudflare-caddy.test.sh` 8 de 8
      y la prueba de coherencia, en verde.

- [x] 3.2 Si la tarea 1.1 lo exige, ajustar `TRUST_PROXY` en el compose (sin cambiar código del backend) y verificar que pasan las pruebas de `exposicion-red` existentes y las de 2.1.
      Resultado (02/11/2026): no hizo falta. La medición de 1.1 muestra que, con el `Caddyfile`
      nuevo, el backend ve la IP del visitante con `TRUST_PROXY=172.30.0.10` tal cual (el
      frontend no agrega nada a `X-Forwarded-For`). Sin cambios en `backend/` ni en el compose,
      salvo el comentario de 3.4.

- [x] 3.3 Escribir el script de comprobación de rangos (D2) y verificar con las pruebas de 2.3 y ejecutándolo contra la lista oficial real.
      Resultado (02/11/2026): `scripts/cd/verificar-rangos-cloudflare.mjs`; contra la lista real
      de Cloudflare («Los 22 rangos … coinciden», código 0) y 40 tests propios en verde.

- [x] 3.4 Actualizar los comentarios de `deploy/Caddyfile` y de `deploy/docker-compose.prod.yml` (hoy dicen que Caddy ve «la IP real del cliente») y verificar con una lectura que ninguno afirma algo que ya no es cierto.
      Resultado (02/11/2026): comentarios de `deploy/Caddyfile` y del encabezado de
      `deploy/docker-compose.prod.yml` reescritos (ya no dicen que Caddy ve «la IP real del
      cliente» sin Cloudflare); `desplegar.test.sh` sigue en 79 de 79.

- [ ] 3.5 Agregar las pruebas de 2.1, 2.2 y 2.3 a las listas fijas de `test:scripts` y `test:deploy` en `package.json` (no son globs) y verificar en el CI del PR que los pasos «Tests de las utilidades de scripts/» y «Tests de deploy/desplegar.sh» ejecutan los archivos nuevos (contarlos en la salida), no solo que terminan en verde.
      Hecho en `package.json`; falta ver en el CI del PR cuántos tests ejecutan los pasos
      (ver abajo la evidencia cuando termine).

- [ ] 3.6 Workflow programado (semanal) que ejecuta la comprobación de rangos y falla con las altas y bajas; verificar con `actionlint` (job de lint de CI) y disparándolo a mano una vez.
      Hecho `.github/workflows/rangos-cloudflare.yml` (semanal, abre un issue si falla, acciones
      fijadas por SHA). Falta: `actionlint` en el CI del PR y dispararlo a mano una vez, que solo
      se puede después de mergear (un `workflow_dispatch` necesita el workflow en la rama por
      defecto).

## 4. Documentación

- [ ] 4.1 `docs/despliegue.md`: §6 (reemplazar «Pendiente (otro change)» por lo hecho; procedimiento para actualizar los rangos, altas y bajas, y el de la regla del grupo de seguridad, que se actualizan juntas) y las secciones §2, §7, §9 y §11 que suponen 80/443 abiertos a `0.0.0.0/0` o acceso directo a la IP (en la etapa transitoria en HTTP, §11, Cloudflare no está delante). Verificar que cada comando documentado se probó.
      Hecho en §2, §6, §7, §9 y §11. **Sin verificar:** los comandos de AWS (lista de prefijos
      administrada y reglas del security group) no se probaron contra la cuenta; el runbook lo
      dice. Se prueban con la tarea 5.3.

- [ ] 4.2 Correr `openspec validate ip-real-detras-de-cloudflare --strict`, `npx eslint .`, `npm run test:deploy` y `npm run test:scripts`, y verificar que están en verde.

## 5. Después del despliegue (verificaciones posteriores)

- [ ] 5.1 Tras el despliegue del `Caddyfile`, confirmar en Actions que `verificar` queda en verde y que `curl` a `/version` devuelve el SHA desplegado.

- [ ] 5.2 Prueba de contadores en producción (D5): registrar el `CF-RAY` de cada pedido y la IP que ve el backend para cada salida; verificar que dos orígenes con IP distinta en el backend no se afectan entre sí y que uno solo supera el límite al sexto intento. Si las dos salidas caen en el mismo borde, la prueba no distingue y no vale: repetir desde otra salida. Registrar el resultado en el PR.

- [ ] 5.3 Restringir 80 y 443 del grupo de seguridad a los rangos de Cloudflare (lo hace una persona) y verificar que el sitio sigue respondiendo por Cloudflare y que la conexión directa a la IP elástica por esos puertos no se establece.

- [ ] 5.4 Confirmar que la renovación de certificados sigue funcionando tras cerrar el origen (revisar el log de Caddy o forzar una renovación en una ventana controlada).

- [ ] 5.5 Archivar el change con `openspec archive ip-real-detras-de-cloudflare` en su propio PR.
