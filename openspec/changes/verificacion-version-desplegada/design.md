## Context

La motivación está en `proposal.md`. El enfoque parte de estos hechos del repositorio
(verificados el 2026-10-26 sobre `main` en `c980980`):

- **El CD identifica las imágenes por SHA.** `cd.yml` construye `reservas-frontend:<sha>` con la
  etiqueta `org.opencontainers.image.revision=<sha>` y despliega por digest. Un tag ya
  publicado se reutiliza solo si declara ese mismo `revision` (D3 de `despliegue-continuo-ec2`).
- **`desplegar.sh` ya comprueba la salud local** del frontend y del backend tras levantar, y
  vuelve atrás si fallan. No comprueba qué versión sirve ni lo que ve el público.
- **El público entra por Cloudflare con proxy.** El subdominio (variable de repositorio
  `SUBDOMINIO`) resuelve a IPs de Cloudflare, no a la instancia (`docs/despliegue.md`, «El
  subdominio pasa por Cloudflare»). El frontend responde la landing con
  `Cache-Control: s-maxage=31536000` y hoy Cloudflare contesta `cf-cache-status: DYNAMIC`.
- **El frontend no tiene middleware ni `proxy.ts`.** Solo reescribe `/api/:path*` hacia el
  backend (`next.config.ts`); cualquier otra ruta la resuelve Next. Caddy manda todo al
  frontend (`deploy/Caddyfile`), así que una ruta nueva del frontend queda publicada sin tocar
  el proxy.
- **`desplegar.sh` sale con 0 en dos casos distintos:** versión desplegada y versión superada
  (código 3 del script, que `cd.yml` traduce a éxito sin desplegar). El job `desplegar` hoy no
  distingue los dos hacia afuera.
- **Repositorio público:** el SHA de cualquier commit es público.

## Goals / Non-Goals

**Goals:**
- Que cada despliegue que cambia producción termine con una comprobación automática de que el
  sitio público, el que ven los usuarios, sirve el commit desplegado.
- Que esa comprobación no requiera ninguna credencial ni dé permisos nuevos a nadie.
- Que un resultado en verde signifique algo: la comprobación no se saltea en silencio, y cuando
  no se puede hacer lo dice.

**Non-Goals:**
- Verificar el backend ni la base (ver D8).
- Reaccionar a una falla: el job falla y avisa; no vuelve atrás ni purga cachés.
- Vigilar el sitio entre despliegues.

## Decisions

### D1: Un `GET /version` en el frontend

Se agrega `frontend/app/version/route.ts`, un *route handler* con `dynamic = "force-dynamic"`
que responde `200` con:

```json
{ "sha": "<40 caracteres hexadecimales en minúscula>" }
```

El valor sale de `process.env.BUILD_SHA`, leído **en cada pedido**. Si la variable no existe o
no tiene el formato de un SHA completo, responde `{ "sha": "desconocido" }`: es lo que ve quien
levanta el frontend en desarrollo, y lo que delata una imagen construida sin el argumento. La
respuesta lleva `Cache-Control: no-store` y no incluye ningún otro campo. Solo admite `GET` y
`HEAD`.

**Alternativas descartadas:**
- *Una etiqueta `<meta>` o un encabezado en todas las páginas:* viaja en HTML que Next puede
  cachear y que Cloudflare puede conservar, justo lo que se quiere detectar; además toca cada
  página.
- *`/version` en el backend:* ver D8.
- *Mirar la instancia por SSH (`docker inspect`):* prueba lo que corre en el servidor, no lo que
  sirve el público, y no pasa por Cloudflare, que es donde puede estar la copia vieja.
- *Un `curl` local desde `desplegar.sh` a `localhost`:* sirve para la salud, que ya se hace,
  pero tampoco atraviesa Cloudflare.

### D2: El SHA se hornea en la imagen del frontend

`frontend/Dockerfile` declara `ARG BUILD_SHA=desconocido` y `ENV BUILD_SHA=${BUILD_SHA}` **en la
etapa final**, después de los `COPY`. Así, cambiar el SHA invalida solo la última capa y no la
caché del `npm ci` ni de `next build`. La ruta lee la variable de entorno por pedido, de modo
que no depende de lo que Next resuelva en el build.

`cd.yml` pasa `BUILD_SHA=${{ needs.decidir.outputs.sha }}` en `build-args` del frontend, el
mismo valor que ya usa para el tag y para la etiqueta `revision`: no hay dos fuentes del SHA.

**Interacción con la reutilización de tags (D3 de `despliegue-continuo-ec2`).** Un tag
`reservas-frontend:<sha>` ya publicado se reutiliza solo si su etiqueta `revision` coincide, y
esa imagen la construyó este mismo workflow con el mismo `BUILD_SHA`. La excepción son imágenes
publicadas **antes** de este change: no tienen `/version`. `desplegar.sh` permite volver a desplegar el **mismo SHA** en modo `despliegue` (un redespliegue).
Un SHA **anterior**, ya contenido en la versión en servicio, no se despliega: se saltea como
«versión superada» (código 3) y este job no verifica nada. Un SHA anterior solo llega a producción
por la vuelta atrás, que lo toma del historial (se contempla en D5).

### D3: La comprobación es un job aparte, sin credenciales

Un job nuevo, `verificar`, con `needs: [decidir, desplegar]`, `permissions: contents: read` y
**sin** `environment`: no recibe la clave SSH ni ningún secret. Solo hace pedidos HTTPS al sitio
público y, de ser necesario, una consulta de solo lectura a la API de GitHub (D6).

Para saber si hay algo que verificar, el job `desplegar` expone una salida `resultado` con dos
valores: `desplegado` cuando `desplegar.sh` terminó en 0, y `superada` cuando terminó en 3. El
job `verificar` corre solo si `desplegar` terminó en éxito y `resultado == 'desplegado'`.

**Por qué un job y no un paso de `desplegar`:** ese job tiene la clave SSH y el known_hosts. La
comprobación no los necesita, y separarla mantiene el mínimo privilegio y deja un check propio,
«Verificar versión publicada», en rojo cuando lo que falla es la versión visible y no el
despliegue.

### D4: Cómo se consulta

La lógica está en `scripts/cd/verificar-version.mjs`, con la parte de decisión como funciones
puras (mismo patrón que `decidir-despliegue.mjs`) y tests en el CI.

- **URL:** `https://<SUBDOMINIO>/version?cb=<run_id>-<run_attempt>`. El parámetro cambia en cada
  ejecución y evita que una caché intermedia devuelva una respuesta anterior; el pedido lleva
  además `Cache-Control: no-cache`. `SUBDOMINIO` se valida con un patrón de nombre de dominio
  antes de armar la URL.
- **Siempre HTTPS, con el certificado verificado.** No hay equivalente de `curl -k`: si el
  certificado no es válido, la comprobación falla. **No sigue redirecciones**: una respuesta
  `3xx` cuenta como observación inválida, para no terminar leyendo otro host.
- **Reintentos:** el plazo total es **hasta 5 minutos desde el primer intento**, con pedidos de
  espera acotada (intervalo entre intentos acotado y tiempo por pedido acotado), no un número
  fijo de intentos. Así se garantiza que no se supera ese plazo total. Absorben el reinicio del
  contenedor y un corte breve de Cloudflare. Es el mismo orden de magnitud que la espera de
  `desplegar.sh` para un cambio de etapa.
- **Qué se acepta:** `200`, cuerpo JSON y un único campo `sha`. Cualquier otra cosa es una
  observación inválida y se reintenta.

**Etapa HTTP.** La comprobación **asume HTTPS** y exige la variable `SUBDOMINIO`. Producción ya
está en la etapa HTTPS (D9 de `despliegue-continuo-ec2`), y la etapa HTTP era transitoria, con
el security group abierto solo a las direcciones del equipo: un runner de GitHub no podría
llegar. Si la variable falta, el job **falla** con un mensaje claro, en lugar de saltearse: un
verde silencioso sería exactamente el hueco que este change quiere cerrar. El mensaje aclara
que el despliegue anterior terminó bien y lo que falta es la comprobación.

### D5: Qué se concluye de cada observación

| Observación | En modo `despliegue` | En modo `vuelta-atras` |
|---|---|---|
| `sha` igual al esperado | Éxito | Éxito |
| `sha` distinto, un commit anterior o desconocido para GitHub | Se reintenta; a los 5 minutos, falla | igual |
| `sha` distinto, un commit **posterior** del esperado en `main` | Éxito con aviso: otro despliegue más nuevo ya quedó sirviendo (D6) | Se reintenta; a los 5 minutos, falla |
| `desconocido` | Falla de inmediato: la imagen se construyó sin `BUILD_SHA`, reintentar no lo arregla | Falla de inmediato |
| `404` en `/version` | Se reintenta; al alcanzar el plazo total de hasta 5 minutos desde el primer intento, falla | Se reintenta; al alcanzar el plazo total de hasta 5 minutos desde el primer intento, **no verificable** (aviso, job en verde) — riesgo aceptado (D5 nota) |
| Error de red, `5xx`, cuerpo inválido, `3xx` | Se reintenta; al alcanzar el plazo total de hasta 5 minutos desde el primer intento, falla | igual |

La fila del `404` en vuelta atrás existe porque se puede volver a una versión construida antes
de este change, que no tiene la ruta. Esto se deja como **riesgo aceptado**: no se sabe de
forma confiable si el SHA destino contiene el commit que agrega la ruta, por lo que no se
especifica un mecanismo para distinguirlo salvo que se encontrara una forma confiable con
`git merge-base --is-ancestor` sin ampliar el alcance. Es la única situación en la que se acepta
no poder verificar, y queda escrita en el resumen del job.

**Casos en los que `verificar` no corre:**
- *El despliegue falló o volvió atrás solo* (`desplegar.sh` termina en 1, ya con la vuelta
  atrás hecha): el job `desplegar` está en rojo y `verificar` no corre. Producción sigue en la
  versión anterior y el error ya está informado.
- *Versión superada* (código 3): no se desplegó nada, no hay nada que comprobar.
- *Nadie desplegó* (`decidir` omitió o rechazó): `desplegar` no corre y `verificar` tampoco.

### D6: Un despliegue más nuevo puede haber pasado por encima

Los despliegues se serializan en el servidor con `flock`, no en GitHub (D4 de
`despliegue-continuo-ec2`), así que dos ejecuciones pueden solaparse: mientras `verificar` del
commit A espera, el despliegue del commit B (posterior) puede terminar y dejar a B sirviendo.
Sin tenerlo en cuenta, A fallaría por una causa que no es un error.

Cuando el `sha` observado no es el esperado y el modo es `despliegue`, el job pregunta a la
API de GitHub (`GET /repos/{repo}/compare/{esperado}...{observado}`). Si el observado es
posterior al esperado en la historia (`status: ahead`), concluye que una versión más nueva ya
quedó sirviendo y termina en verde con un aviso. En la vuelta atrás **no** se acepta, porque una
versión posterior a la que se pidió volver significa que la vuelta atrás no se aplicó. La
consulta usa el `GITHUB_TOKEN` del workflow con `contents: read` (permitido explícitamente).

### D7: Análisis de seguridad de `/version`

- **Qué expone:** el SHA del commit desplegado, un dato que ya es público (repositorio público)
  y que además figura en las etiquetas de la imagen publicada en GHCR, que también es pública.
  No expone versión de Node, de Next, rutas internas, variables de entorno ni la fecha.
- **Qué permite a un atacante:** saber si producción corre un commit con una falla conocida.
  Es una ayuda marginal frente a un sitio ya público y sin datos sensibles accesibles sin
  autenticación. Se acepta.
- **Entrada:** ninguna. La ruta ignora la query y el cuerpo, así que no refleja nada del pedido
  (sin XSS ni inyección de encabezados) y el parámetro `cb` no llega a ninguna parte.
- **Abuso:** es una respuesta mínima, calculada de una variable de entorno, sin base de datos
  ni llamadas al backend. Un volumen anómalo tiene el mismo costo que pedir cualquier otra
  página; el límite de solicitudes por IP del backend no la alcanza porque no pasa por él.
- **Autenticarla** (un token en un encabezado) exigiría un secret compartido entre GitHub y el
  servidor para proteger un dato que ya es público, y rompería la propiedad de «comprobar desde
  fuera, sin credenciales». Se descarta.
- **Caché:** `no-store`, para que ni el navegador ni Cloudflare la reutilicen. Si alguna regla
  de la zona la cachea igual, la comprobación lo detecta: es justamente el caso para el que
  existe.

### D8: Solo el frontend

Se evaluó un `/version` también en el backend y se descarta por ahora:

- Los usuarios ven el frontend; es donde un despliegue «silenciosamente viejo» se nota.
- El backend lo cubre `desplegar.sh`: levanta la imagen por digest, ejecuta las migraciones y
  comprueba su salud local con vuelta atrás. El riesgo de capa de borde que motiva este change
  no existe para él: no se sirve cacheable al público.
- Un endpoint del backend es parte del contrato: exige OpenAPI, `openapi:check` y la decisión
  de dónde vive en el prefijo `/api`. Es bastante más superficie que una ruta del frontend.

Queda anotado como limitación: esta comprobación no prueba la versión del backend ni el estado
de la base. Si más adelante se quisiera, el mismo `scripts/cd/verificar-version.mjs` sirve con
otra URL.

## Risks / Trade-offs

- **Falso rojo si la caché de Cloudflare conserva una copia vieja de `/version`.** El
  `no-store` y el parámetro `cb` lo evitan; si aun así pasa, el job falla con un mensaje que
  nombra el SHA que se ve, y es justamente la situación a investigar (runbook).
- **Falso rojo por una caída de Cloudflare o del DNS** que no tiene que ver con el despliegue.
  El mensaje dice que el despliegue terminó y que lo que no se pudo confirmar es lo que ve el
  público; relanzar el job de verificación alcanza.
- **Cinco minutos de espera en el peor caso**, que se pagan solo cuando algo falla.
- **Nueva dependencia de que `SUBDOMINIO` exista.** Es una variable de repositorio ya usada por
  `certificado.yml`.
- **Una imagen publicada antes de este change** no tiene la ruta (ver D2 y D5).
- **El `/version` del frontend prueba el frontend.** No prueba que el backend esté en la
  versión del commit; esa garantía queda en el digest y en `desplegar.sh` (D8).

## Migration Plan

1. Mergear este change con su implementación. El primer despliegue después del merge construye
   el frontend con `BUILD_SHA` y lo verifica por primera vez: es la prueba de extremo a extremo.
2. Si ese primer despliegue falla en `verificar` por algo ajeno a la lógica (por ejemplo, un
   nombre de `SUBDOMINIO` mal cargado), corregir la variable y relanzar el workflow con
   `workflow_dispatch` en modo `despliegue` del mismo SHA, que es un redespliegue permitido.
3. Para sacar la comprobación hace falta revertir el job `verificar`; el `/version` y el
   `BUILD_SHA` pueden quedar, son inocuos.

## Open Questions

- **`/version` también en el backend** (D8): se descarta ahora. ¿Lo quiere el equipo para la
  demostración final?
- **Aviso al equipo cuando `verificar` falla:** hoy el job en rojo notifica a quien dispara el
  workflow, como cualquier otra falla de Actions. Un issue automático (como el de
  `certificado.yml`) sería una mejora, pero amplía el alcance.
