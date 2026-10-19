## Context

La motivación está en `proposal.md`. El enfoque depende de estos hechos del repositorio
(verificados el 2026-10-05 sobre `main` en `625f8f3`):

- **No hay contenedores de la aplicación.** `docker-compose.yml` levanta solo PostgreSQL de
  desarrollo (`postgres:16.4-alpine`, publicado en `127.0.0.1:5432`). Ni el backend ni el
  frontend tienen `Dockerfile`.
- **El navegador nunca llama directo al backend.** Usa `/api/...` del mismo origen, que el
  frontend reescribe hacia `NEXT_PUBLIC_API_URL` (`frontend/next.config.ts`, D6 de
  `frontend-base`). Los Server Components llaman al backend directamente por esa misma URL. Next
  arma las reescrituras **en el build**, así que la URL del backend queda fija en la imagen del
  frontend. `next.config.ts` corta el build si falta.
- **Identificación del cliente** (`exposicion-red-local`, D2 y D3): Next completa
  `X-Forwarded-For` con `??=`, es decir, conserva el del cliente si existe. El backend ya
  admite `TRUST_PROXY` con una lista validada de IPv4 y subredes, y por defecto no confía en
  nadie. Ese change dejó escrito que un despliegue necesita un proxy de borde que
  **sobrescriba** el encabezado.
- **Escucha:** el backend usa `HOST || '127.0.0.1'`. El script `start` del frontend fija
  `--hostname 127.0.0.1`. Dentro de un contenedor, los dos tienen que escuchar en la interfaz de
  la red de Docker.
- **Seed:** `backend/prisma/seed.ts` crea un admin con `admin@restaurante-mvp.local` y una
  contraseña documentada en el README, además de reservas de ejemplo. Se ejecuta con `ts-node`,
  que es devDependency. `prisma` y `@prisma/client` son dependencias de producción.
- **CI** (`ci.yml`): corre en cada PR y en cada push a `main`, y no ejecuta los tests del
  frontend.
- **Repositorio público:** todo lo versionado, y los logs de Actions, los puede leer
  cualquiera.
- **AWS en el Tier gratuito** (propuesta de la docente; ver `proposal.md`). En la práctica, el
  Tier gratuito disponible es el de una cuenta nueva: todo consumo descuenta créditos y, en el
  plan Free, la cuenta se cierra a los 6 meses o al agotarlos. Se elige `t3.micro` (2 vCPU con
  ráfagas y **1 GB de RAM**), el tipo elegible que menos créditos consume en x86 (ver D3,
  "Arquitectura `amd64`").

## Goals / Non-Goals

**Goals:**
- Que nada que viva en GitHub (código, imágenes, logs o configuración del workflow) alcance
  para acceder a la cuenta de AWS ni a los datos, y que **no haya ninguna credencial de AWS en
  GitHub**.
- Que la clave SSH del despliegue pueda hacer **una sola cosa**: correr el procedimiento
  versionado de despliegue con un SHA y dos digests validados. Nada de shell, de reenvío de
  puertos ni de comandos arbitrarios.
- Que activar HTTPS con el subdominio de la docente no requiera tocar código de la aplicación.

**Non-Goals:**
- Despliegue sin cortes: con una sola instancia hay unos segundos de corte por despliegue, y se
  acepta.
- Rollback de migraciones: la vuelta atrás automática revierte imágenes, no el schema (ver
  Risks).
- Backups gestionados fuera de la instancia: el runbook configura snapshots del disco. Una
  política de backups más completa queda para otro change.

## Decisions

### D1: Topología: una instancia, Docker Compose y un único servicio público

```
internet ──:80/:443──> [caddy] ──> [frontend :3000] ──/api──> [backend :3001] ──> [postgres :5432]
                          red "borde"           red "interna" (sin salida a puertos del host)
```

- `deploy/docker-compose.prod.yml` define cuatro servicios. **Solo `caddy` publica puertos**
  (`80:80` y `443:443`, en las dos etapas). Los demás no tienen `ports:`: no se publican en la
  interfaz de la instancia, así que no se pueden alcanzar desde internet. El propio host sí
  llega a ellos por la red de Docker, lo que se acepta: al host solo se entra por SSH, con las
  restricciones de D4.
- Caddy guarda certificados y claves en un volumen con nombre (`caddy_data`), que se conserva
  entre despliegues y reinicios. Sin él, cada despliegue pediría un certificado nuevo y
  chocaría con los límites de emisión de Let's Encrypt.
- La red `interna` tiene una subred fija (`172.30.0.0/24`) y el frontend una IP fija
  (`172.30.0.10`). Es la única dirección que el backend declara en `TRUST_PROXY` (ver D5).
- Caddy reenvía **todo** al frontend; el backend no tiene ruta propia en el proxy. Esto
  reproduce exactamente la topología de desarrollo (mismo origen, `/api` reescrito por Next), y
  así no hace falta CORS ni cambiar el cliente.
- PostgreSQL usa la misma imagen que el desarrollo y CI (`postgres:16.4-alpine`), con un volumen
  con nombre y sin `init-databases.sql`: en producción no hay base `_test`.
- Todos los servicios usan `restart: unless-stopped`, para que la aplicación vuelva sola tras un
  reinicio de la instancia. Además tienen healthcheck y logs `json-file` con rotación
  (`max-size: 10m`, `max-file: 3`), para que los logs no llenen el disco.
- Los contenedores corren como usuario no root (`node` en las imágenes propias) y con
  `read_only` donde la imagen lo permite.
- **Memoria (1 GB en `t3.micro`):** cada servicio tiene `mem_limit`, como valor inicial:
  - PostgreSQL: 256 MB, con `shared_buffers=64MB` y `max_connections=20`;
  - backend: 256 MB, con `NODE_OPTIONS=--max-old-space-size=192`;
  - frontend: 320 MB, con `--max-old-space-size=256`;
  - Caddy: 64 MB.

  La instancia tiene además un *swapfile* de 2 GB. Así, un pico se resuelve con swap o
  reiniciando un solo contenedor, en lugar de que el kernel mate PostgreSQL. Los límites se
  ajustan con las mediciones de la tarea 6.2. Nada se compila en la instancia (D3), y eso es
  lo que permite que entre en 1 GB.

**Alternativa considerada: RDS para la base.** El equipo decidió un despliegue monolítico.
RDS además suma costo y una superficie de red más que configurar.

**Alternativa considerada: exponer el backend por Caddy en `/api`.** Saltearía la reescritura
de Next, pero la cadena de `X-Forwarded-For` quedaría distinta según la ruta, y aparecería una
diferencia con desarrollo que no está probada. Se descarta.

### D2: Caddy como proxy de borde

**Decisión:** imagen oficial de Caddy con versión fija (`caddy:2.10-alpine`; se confirma el tag
al implementar) y un `deploy/Caddyfile` versionado. La dirección del sitio sale de una variable,
`SITE_ADDRESS`, que define la etapa:

- **Etapa HTTP (transitoria):** `SITE_ADDRESS=:80`, mientras el subdominio no apunte a la IP
  elástica.
- **Etapa HTTPS:** `SITE_ADDRESS=<subdominio>`. Caddy obtiene el certificado de Let's Encrypt
  con el desafío HTTP-01 por el puerto 80, lo renueva solo, redirige HTTP a HTTPS y sirve por
  443.

`SITE_ADDRESS` no es secreto: va en el `.env` del servidor (D6), para que activar HTTPS sea
cambiar ese valor y redesplegar, sin tocar el repositorio.

**Control del certificado:** Let's Encrypt dejó de mandar avisos de vencimiento por mail el 4
de junio de 2025, así que no alcanza con configurar un correo. Un workflow programado
(`.github/workflows/certificado.yml`, diario) se conecta a `https://<subdominio>`, verifica que
el certificado sea válido para ese nombre y que le queden 21 días o más, y **falla** si no; la
falla le llega al equipo como notificación de GitHub. Se activa solo cuando existe la variable
`SUBDOMINIO` del repositorio (etapa HTTPS); no usa credenciales. Caddy renueva a los 30 días del
vencimiento, así que un aviso a los 21 días indica que la renovación falló al menos una vez.

**Por qué Caddy y no nginx:**
- **`X-Forwarded-For`:** desde la versión 2.5, `reverse_proxy` ignora los `X-Forwarded-*`
  entrantes de clientes que no figuran en `trusted_proxies` y escribe la IP de la conexión.
  Por defecto ya hace lo que exige `exposicion-red` ("un proxy de borde que **sobrescriba**
  `X-Forwarded-For`"). En nginx hay que acordarse de configurarlo, y el error típico
  (`$proxy_add_x_forwarded_for`) **agrega** el valor en lugar de reemplazarlo.
- **HTTPS:** con `SITE_ADDRESS` igual a un nombre de dominio, Caddy pide y renueva solo el
  certificado de Let's Encrypt. Es exactamente el "un cambio de configuración" que pide la
  spec, y no hace falta ningún cliente ACME aparte ni una tarea programada de renovación.

Es una imagen nueva, no una dependencia npm. Se justifica según §2 de `config.yaml`.

**Encabezados** (en el `Caddyfile`, porque no dependen de HTTPS):
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` y `Content-Security-Policy: frame-ancestors 'none'`
- `Referrer-Policy: strict-origin-when-cross-origin`
- quitar `Server` y `X-Powered-By`

En la etapa HTTPS se agrega `Strict-Transport-Security: max-age=31536000` (sin
`includeSubDomains` ni `preload`: el dominio padre es de la docente y no le corresponde a este
proyecto fijar política para sus otros subdominios). Sobre HTTP no se envía HSTS.

### D3: Imágenes construidas en Actions y publicadas en GHCR con el SHA

- `backend/Dockerfile` (multi-stage):
  - `npm ci` de los workspaces, `prisma generate` y `nest build`.
  - Compila `prisma/seed-produccion.ts` a JS con `tsc`, porque en runtime no hay `ts-node`.
  - `npm prune --omit=dev`.
  - Etapa final `node:20-alpine` (con versión fija), usuario `node`, `HOST=0.0.0.0`.
  - Incluye `prisma/` (migraciones y schema) y el CLI de Prisma, que ya es dependencia de
    producción, para `migrate deploy`.
- `frontend/Dockerfile`: `next.config.ts` suma `output: "standalone"` y el build recibe
  `NEXT_PUBLIC_API_URL=http://backend:3001` como build-arg. Ese valor es el nombre interno del
  servicio, no un secreto; queda fijo en la imagen, como exige Next. La etapa final copia
  `.next/standalone` y `.next/static`, corre como `node` con `HOSTNAME=0.0.0.0` y no usa el
  script `start` (que fija loopback para desarrollo).
- `.dockerignore` excluye `.env*`, `node_modules`, `.git`, `openspec/` y los tests. Ningún
  `ARG` ni `ENV` lleva secretos: los secretos llegan solo en runtime (D6).
- **Tags y digests:** las imágenes se publican como `ghcr.io/<owner>/reservas-backend:<sha>` y
  `reservas-frontend:<sha>`, sin `latest`. Pero un tag de GHCR **se puede volver a publicar**, así
  que la inmutabilidad no puede depender de él:
  - el job de imágenes **no sobrescribe** un tag existente: si `:<sha>` ya está publicado, toma
    su digest y no reconstruye;
  - el despliegue usa siempre la imagen **por digest** (`image@sha256:...`), nunca por tag;
  - la instancia guarda cada versión como la terna SHA + digest del backend + digest del
    frontend (ver D7), y una vuelta atrás vuelve a esa terna exacta.

  Así, desplegar dos veces la misma versión ejecuta lo mismo, aunque alguien vuelva a
  publicar el tag (spec: "Versiones trazables e inmutables").
- **Paquetes públicos en GHCR:** el repositorio es público y las imágenes no contienen
  secretos, así que la instancia las descarga sin credenciales de registro. Publicarlas como
  privadas obligaría a guardar un token de GitHub en la instancia, y eso sí sería un secreto
  más.

**Alternativa considerada: construir en la instancia** (`git pull` + `docker compose build`).
El build de Next necesita más memoria que la que usa la aplicación, y no entra en el 1 GB de
una `t3.micro` del Tier gratuito. Además no deja versiones anteriores listas para una vuelta
atrás. Se descarta (decisión del equipo).

**Arquitectura `amd64`:** `t3.micro` es x86. Las instancias `t4g` (ARM) consumirían algo menos
de créditos, y desde agosto de 2025 GitHub ofrece runners `ubuntu-24.04-arm` nativos y gratuitos
para repositorios públicos, así que construir imágenes `arm64` **ya no requiere emulación** (esa
fue la razón original para descartarlas y dejó de valer). Se mantiene `amd64` por otros motivos:

- **Las imágenes de producción tienen que poder correrse en local.** El equipo desarrolla en
  Windows y x86, y la verificación de este change (tareas 4.2, 4.3 y 5.2) levanta la composición
  de producción en una máquina local. Con `arm64` esa prueba pasaría por emulación en cada
  equipo, o se perdería.
- **Cambia lo que ya está definido y probado:** el job `imagenes` (runner y plataforma), el tipo
  de instancia del runbook, y la validación de los digests por plataforma.
- **La diferencia de créditos no decide:** lo que decide si el Tier gratuito alcanza es la
  estimación de la tarea 1.3. Si esa estimación muestra que `t3.micro` no entra en los créditos
  hasta el fin de la cursada, se reabre esta decisión y se evalúa `t4g.micro` con el runner
  ARM64 (el resto del diseño no cambia).

Se descarta `t4g` en este change.

### D4: Workflow de CD por SSH con una clave de comando forzado

**Disparo:** `.github/workflows/cd.yml` con `on: workflow_run` (workflow `CI`, tipo
`completed`). El job corre solo si se cumplen las tres condiciones:
- `conclusion == 'success'`
- `event == 'push'`
- `head_branch == 'main'`

El SHA se toma de `workflow_run.head_sha`, no de `github.sha`: la variable apunta al commit que
validó el CI.

**Jobs:**
1. `decidir`: decide si el SHA se despliega, con una función pura
   (`scripts/cd/decidir-despliegue.mjs`) que recibe los datos de la API de GitHub y tiene tests
   propios (D10). Las reglas son estas:
   - **Por `workflow_run`:** si **otro commit posterior de `main` tiene el CI en verde**, termina
     **en verde, sin desplegar**, con el aviso "versión superada por `<sha>`". Si el posterior
     está en rojo o todavía corriendo, despliega: un commit verde nunca se queda sin desplegar
     por un posterior que falla. Esto evita que un CI viejo que termina después de uno nuevo
     redespliegue una versión anterior (`workflow_run` conserva el `head_sha` de cada
     ejecución).
   - **Por `workflow_dispatch` con `modo=despliegue`:** exige que el SHA esté en la historia de
     `main`, que su CI de push haya terminado en verde y que no exista un commit posterior
     verde. Si no se cumple, rechaza y el workflow termina en error. Así, el despacho manual
     tiene los mismos controles que el automático.
   - **Por `workflow_dispatch` con `modo=vuelta-atras`:** no aplica la regla de "superada" (una
     vuelta atrás es, por definición, a una versión anterior). Exige que el SHA esté en la
     historia de `main`; la instancia exige además que figure en `historial` (D7).

   La ancestría se resuelve con la API `compare` de GitHub, y el estado del CI con las
   ejecuciones del workflow `CI` de evento `push` sobre `main`.
2. `imagenes`: checkout de ese SHA y `docker/build-push-action` de las dos imágenes a GHCR, con
   `permissions: packages: write` y el `GITHUB_TOKEN`. Si el tag ya existe, no se reconstruye
   (D3). Expone como salida los dos digests.
3. `desplegar`: `environment: produccion`, `permissions: contents: read` (sin `id-token`: no hay
   credenciales de AWS). Usa el cliente `ssh` que ya trae el runner, **sin acciones de
   terceros para la conexión**: una acción comprometida que maneje la clave sería la peor
   pieza de la cadena. El paso:
   - valida los secrets antes de usarlos: que existan los cinco, `SERVER_PORT` con
     `^[0-9]{1,5}$`, `SERVER_USER` con `^[a-z_][a-z0-9_-]*$` (que no pueda empezar con `-` ni
     inyectar opciones de `ssh`) y `SERVER_HOST` con `^[A-Za-z0-9]([A-Za-z0-9.:-]*[A-Za-z0-9])?$`
     (una IP o un nombre de dominio, sin espacios);
   - escribe `SSH_PRIVATE_KEY` y `SSH_KNOWN_HOSTS` en un directorio temporal de `$RUNNER_TEMP`
     (`mktemp -d`, con `umask 077`) y lo borra con un `trap` al salir del paso, también si
     falla;
   - se conecta con `-o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes
     -o UserKnownHostsFile=<archivo> -o ConnectTimeout=30 -o ServerAliveInterval=30
     -o ServerAliveCountMax=10`. Con
     `StrictHostKeyChecking=yes` y la huella fijada, `ssh` aborta **antes de autenticarse** si
     el servidor no es el esperado: la clave privada nunca se le presenta a un impostor;
   - pasa los valores por variables de entorno, nunca interpolados en el código del `run`, y
     el paso corre sin `set -x`. GitHub enmascara los secrets en los logs;
   - el comando remoto es una sola línea con un formato fijo, que `ssh-entrada.sh` valida (ver
     abajo), y el código de salida de `desplegar.sh` llega como código de salida de `ssh`;
   - envuelve `ssh` en `timeout 30m`. La salida de `desplegar.sh` se ve en vivo en el log, y
     el paso traduce el código de salida de `ssh` a un mensaje: `255` (no se pudo conectar o la
     huella no coincide), `124` (pasaron 30 minutos), `2` (el servidor rechazó el pedido) u
     otro (falló `desplegar.sh`; si dice `VUELTA ATRÁS`, producción sigue en la versión
     anterior).

   El comando es **siempre una línea de cuatro campos separados por un espacio**:
   `<sha> <digestBackend> <digestFrontend> <modo>`. Un digest vacío viaja como `-`, porque un
   campo vacío no se distingue de un espacio de más; `ssh-entrada.sh` lo traduce a la cadena
   vacía que espera `desplegar.sh`. Según el modo:
   - **`modo=despliegue`** (automático o manual): los dos digests que expone `imagenes`;
   - **`modo=vuelta-atras`** (solo manual): el job `imagenes` **no corre** (condición sobre el
     input `modo`) y los dos digests viajan como `-`. `desplegar.sh` toma los digests de
     `historial`, nunca del workflow ni del tag.

- `concurrency: { group: despliegue-produccion, cancel-in-progress: false }` hace que los
  despliegues corran de a uno sin cortar uno a la mitad. GitHub deja **una sola ejecución en
  espera** por grupo: si llegan varias, la más nueva reemplaza a la que esperaba. Por eso la spec
  garantiza que se despliegue **el commit verde más reciente**, no cada commit intermedio.
- **Segunda barrera en la instancia:** `desplegar.sh` rechaza en modo `despliegue` un SHA que
  sea ancestro de la versión actual (D7).
- Las acciones de terceros se fijan por **SHA de commit**, no por tag: el workflow maneja
  credenciales de producción.

**Quién puede usar la clave:** `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`, `SERVER_HOST`,
`SERVER_USER` y `SERVER_PORT` son **secrets del environment `produccion`**, no del repositorio
(la guía los pone como secrets del repositorio; el environment es más estricto). El environment
admite **solo la rama `main`**: un PR, una rama o un fork no reciben la clave.

**Clave dedicada** (guía, 2.1): un par `ed25519` sin frase de paso, para este único uso. A
diferencia de la guía, que lo genera en el servidor, el runbook lo **genera en la computadora
del operador**: la clave privada pasa solo a GitHub y se borra de la computadora, así que
**nunca está guardada en el servidor** (donde no cumple ninguna función). Es una desviación
consciente de la guía, equivalente y más estricta. La pública se autoriza con restricciones
(guía, 2.3, endurecida) en `~deploy/.ssh/authorized_keys`:

```
command="/opt/reservas/deploy/ssh-entrada.sh",restrict ssh-ed25519 AAAA... github-actions-deploy
```

- `command=` fuerza ese programa para **cualquier** conexión con la clave, sin importar qué
  pida el cliente; lo que el cliente pidió llega en `SSH_ORIGINAL_COMMAND`.
- `restrict` desactiva el pty, el reenvío de puertos, de agente y de X11 y el `~/.ssh/rc`.

**`deploy/ssh-entrada.sh`** hace de puerta, con el mismo propósito que el documento SSM del
diseño anterior (que el pedido no pueda ser un comando arbitrario):
- si `SSH_ORIGINAL_COMMAND` está vacío (intento de shell interactiva), lo rechaza;
- acepta **solo** una línea de exactamente cuatro campos separados por un espacio, que primero
  pasa por una expresión regular anclada (`[a-z0-9:-]+` en los tres primeros campos y
  `[a-z-]+` en el último: ningún metacaracter de shell, salto de línea, tabulación ni espacio
  de más) y después se valida campo por campo:
  - `sha` de `^[0-9a-f]{40}$`;
  - `digestBackend` y `digestFrontend` de `^sha256:[0-9a-f]{64}$`, o `-` (vacío);
  - `modo` de `^(despliegue|vuelta-atras)$`;
- cualquier otra cosa termina en `2` sin ejecutar nada ni interpretar el texto en una shell;
- traduce `-` a la cadena vacía e invoca `sudo -n /opt/reservas/deploy/desplegar.sh <sha>
  <digestBackend> <digestFrontend> <modo>` pasando cada valor como argumento separado (sin
  `eval` ni `sh -c`), que es el contrato de `desplegar.sh`; sin imprimir nada de `.env`.

Para probarlo sin servidor, `ssh-entrada.sh` acepta `RESERVAS_DESPLEGAR` (la ruta de otro
script, que se ejecuta sin `sudo`): solo para pruebas; en el servidor no se define.

**Usuario `deploy`:** sin contraseña, **fuera del grupo `docker`** (pertenecer a él equivale a
ser `root`) y con una única regla de `sudoers`:

```
deploy ALL=(root) NOPASSWD: /opt/reservas/deploy/desplegar.sh
```

**Dueño del código:** `/opt/reservas` y todo su contenido son de `root`. Si `deploy` pudiera
escribir `desplegar.sh`, la regla de `sudoers` le daría `root` a cualquiera que tenga la clave.
`deploy` solo lee `ssh-entrada.sh`; el administrador entra con su propio usuario (`ubuntu` y su
`.pem`) para mantenimiento.

**Endurecimiento de `sshd`** (`/etc/ssh/sshd_config.d/60-reservas.conf`):
`PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `PermitRootLogin no`,
`PubkeyAuthentication yes`, `X11Forwarding no`, `AllowUsers ubuntu deploy`, `MaxAuthTries 3` y
`LoginGraceTime 20`. `fail2ban` es opcional: frena el ruido de
escaneos, pero con solo clave no es una barrera de seguridad.

**Decisión: SSH en lugar de SSM (cambio del 2026-10-19).** La primera versión de este change
descartaba SSH y desplegaba con OIDC y SSM, sin puerto 22 y sin claves permanentes. La
consigna de la docente (su guía de CD) pide SSH, y el equipo decidió seguirla. Lo que se
acepta, de forma explícita:
- **El puerto 22 queda abierto a internet (`0.0.0.0/0`) en las dos etapas.** Los runners de
  GitHub no tienen una IP fija y el rango de IPs de GitHub cambia, así que no se puede
  restringir el origen. Cualquiera puede intentar conectarse, y habrá escaneos y fuerza bruta.
- **La clave es una credencial permanente** guardada en GitHub. No vence sola como las
  credenciales de OIDC.

Lo que lo compensa:
- **Una superficie menor que un SSH típico.** Sin contraseñas, sin `root`, y con la clave de
  despliegue limitada a un comando forzado con validación estricta: quien la robe no consigue
  shell, ni reenvío de puertos, ni lectura de `.env`.
- **Qué puede hacer igual quien robe la clave:** pedir un despliegue de un SHA de `main` con
  digests del registro de este repositorio, o una vuelta atrás a una versión ya desplegada.
  No puede ejecutar código arbitrario en la instancia, salvo el que ya está en `main`.
- **Se pueden rotar:** el runbook explica cómo generar una clave nueva, reemplazarla en
  `authorized_keys` y en el secret, y revocar la anterior.
- **Menos piezas de AWS.** Sin proveedor OIDC, sin rol de GitHub, sin documento SSM, sin perfil
  IAM en la instancia ni parámetros: nada de AWS en GitHub.

**Alternativa considerada: mantener SSM con OIDC.** Es la opción más segura (sin puerto 22 y
con credenciales que vencen), y por eso era la del diseño original. Se descarta únicamente
porque la consigna pide SSH.

**Alternativa considerada: SSH sin comando forzado** (la clave a secas, como en la guía). Daría
una shell completa a quien robe la clave desde GitHub. Se descarta: el comando forzado cuesta
un script corto y quita esa posibilidad.

**Alternativa considerada: restringir el puerto 22 a los rangos de GitHub Actions.** El rango
publicado en `api.github.com/meta` es amplio (miles de direcciones), cambia, y habría que
actualizar el security group con un proceso propio. Se descarta.

**Alternativa considerada: Infraestructura como código (Terraform).** Suma una herramienta y un
estado que manejar, y el equipo crea la infraestructura una sola vez. El runbook (D8) lista
cada recurso y cada política tal como quedan, para que se puedan revisar en el PR.

### D5: IP real del cliente: Caddy sobrescribe y el backend confía solo en el frontend

La cadena en producción queda así:

1. **Cliente → Caddy:** Caddy descarta el `X-Forwarded-For` del cliente y escribe la IP de la
   conexión (D2).
2. **Caddy → Next:** como el encabezado ya existe, el `??=` de Next lo conserva tal cual.
3. **Next → backend:** la conexión sale desde `172.30.0.10`, con `X-Forwarded-For: <IP real>`.
4. **Backend:** `TRUST_PROXY=172.30.0.10`. Express confía solo en ese salto y toma la IP real
   como `req.ip`.

Es el escenario "Confianza declarada en un salto" de `exposicion-red`, sin cambios de código en
el backend.

**Por qué el frontend y no `uniquelocal`:** `uniquelocal` confiaría en toda la red privada, y
también en cualquier otro contenedor. Una IP fija confía en un único salto.

**Condición:** el frontend no es accesible si no es a través de Caddy (D1, sin `ports:`). Si
alguien publicara su puerto, un cliente podría mandarle un `X-Forwarded-For` inventado. Por eso
la verificación de la tarea 6 prueba los puertos internos desde afuera.

**Límite conocido:** las llamadas de los Server Components al backend salen de Next sin
`X-Forwarded-For`, así que cuentan con la IP del frontend. Hoy son lecturas públicas del
catálogo. Si alguna ruta con límite empezara a llamarse desde el servidor, compartiría cupo
entre clientes. Queda documentado en Risks.

### D6: Secretos en un `.env` del servidor, copiado a mano

Como indica la guía (4.2), el `.env` de producción lo crea el administrador en
`/opt/reservas/.env`, en la raíz del proyecto. Nunca pasa por GitHub, por las imágenes ni por
el workflow.

**Variables del `.env`:**
- `JWT_SECRET`: 32 caracteres o más, solo `A-Za-z0-9_-` (el runbook lo genera con
  `openssl rand -base64 48`).
- `POSTGRES_PASSWORD`: 24 caracteres o más, solo `A-Za-z0-9_-`, porque va dentro de la URL de
  conexión.
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `SITE_ADDRESS` (no es secreto): `:80` o el subdominio, ver D2. Vive en el `.env` y no en el
  repositorio, porque cambia según la etapa y no con el código.

**Cómo se crea:** el runbook indica cómo generar los valores en el propio servidor, con
`umask 077` y sin que pasen por el historial del shell (`openssl rand` y un editor, no
`echo ... >> .env`). `/opt/reservas/.env` es de `root`, modo `600`, y `.gitignore` ya lo
excluye (`.env*`), así que `git checkout` no lo toca. El disco es un volumen EBS cifrado (D9).
Hay una plantilla sin valores en `deploy/env.produccion.example`.

**Cómo lo usa el despliegue:** `desplegar.sh` **valida y nunca modifica** el `.env`: comprueba
que exista, que sea de quien corre el script (`root`) con modo `600` o `400`, y que estén
todas las variables requeridas con valor y con el formato de arriba (`SITE_ADDRESS`, `:80` o un
dominio en minúsculas). Lo lee línea por línea **sin ejecutarlo** (no hace `source`), así que
un valor con `$(...)` o `;` es solo texto. Si algo falla, termina en error **antes del
`checkout`**, sin imprimir ningún valor. Para Compose genera aparte, en cada despliegue,
`/opt/reservas/.despliegue/compose.env` (`root`, modo `600`, reemplazo atómico) con los dos
secretos que usa Compose, `SITE_ADDRESS` y las imágenes **por digest**, y se lo pasa con
`--env-file`. `ADMIN_EMAIL` y `ADMIN_PASSWORD` no se escriben en ningún archivo propio: llegan
por entorno solo al contenedor del seed. Ningún secreto se imprime: el script corre sin
`set -x`.

- **Valores no secretos:** `JWT_EXPIRES_IN=60m`, `THROTTLE_*`, `TRUST_PROXY`, `HOST` y `PORT`.
  Van fijos en `docker-compose.prod.yml`.
- `DATABASE_URL` lo arma Compose con `POSTGRES_PASSWORD`; no es una variable aparte.
- **Sin perfil IAM en la instancia:** nada en el servidor necesita llamar a AWS, así que la
  instancia **no tiene un rol asociado** y no hay credenciales que un contenedor pueda robar
  por el servicio de metadatos. El IMDSv2 obligatorio y el límite de saltos 1 de D9 quedan
  igual, como segunda capa.

**Alternativa considerada: AWS SSM Parameter Store** (el diseño original). Los secretos
vivían cifrados en AWS y la instancia los leía con su rol. Es más cómodo de rotar, y mantiene
los secretos fuera del disco. Se descarta porque exige un perfil IAM en la instancia y una
política propia, y porque la guía de la docente indica el `.env` a mano. El costo es que los
secretos quedan en un archivo del servidor: protegido por permisos y por el disco cifrado, pero
legible por cualquiera con acceso de `root` a la instancia.

**Alternativa considerada: secretos de GitHub enviados en el comando SSH.** Los pondría en la
línea de comandos, visible en la tabla de procesos del servidor y en los logs de `sshd`, y
obligaría al workflow a manejar los secretos de producción. Se descarta.

### D7: Procedimiento en la instancia (`deploy/desplegar.sh`)

El script corre como `root`, invocado por `ssh-entrada.sh` con `sudo` (D4), con
`set -euo pipefail` y un lock (`flock`) como segunda barrera contra despliegues simultáneos.
Vive en `/opt/reservas/deploy/desplegar.sh`: el repositorio se clona directo en `/opt/reservas`
(con el punto final de `git clone <repo> .`, como indica la guía, 4.1), sin un nivel `repo/`.

**Conexión cortada:** con SSH, si se cae la conexión del runner, `sshd` manda `SIGHUP` al
proceso, y un despliegue cortado a la mitad (por ejemplo, después de migrar y antes de levantar)
sería peor que uno fallido. Por eso `desplegar.sh` ignora `SIGHUP` y `SIGPIPE`, escribe su
salida **también** en `/var/log/reservas-despliegue.log` (con `tee`, tolerando que la salida
estándar ya no exista) y termina el despliegue igual. El resultado queda en ese log, y el
`flock` evita que un reintento del workflow se superponga.

Cada versión se registra como una línea `<sha> <digestBackend> <digestFrontend>`. El estado
vive en `/opt/reservas/.despliegue/`: `VERSION_ACTUAL` guarda la que está sirviendo,
`historial` todas las que se desplegaron con éxito, en orden, `compose.env` el env de Compose
de D6 y `desplegar.lock` el `flock`. El directorio está en `.gitignore` (`/.despliegue/`), así
que nunca se versiona ni lo toca `git checkout`.

1. Valida el formato de los parámetros otra vez (defensa en profundidad, después de
   `ssh-entrada.sh`; en modo `despliegue` exige además los dos digests). Si algo falla,
   termina con `2` sin tocar nada, ni siquiera el lock. Después toma el lock y, antes del
   `checkout` (paso 3), valida el `.env` (D6): existe, es de `root` con modo `600` y tiene
   todas las variables con su formato.
2. Lee `VERSION_ACTUAL` y la guarda como **`version_previa`**. Esa es la versión que está
   sirviendo y a la que se vuelve si algo falla.
3. `git -C /opt/reservas fetch origin main`. En los dos modos exige que `<sha>` esté en la
   historia de `main`. En modo `despliegue`, si `<sha>` es ancestro del SHA de
   `version_previa` (`git merge-base --is-ancestor`), termina en 0 sin tocar nada: la versión
   está superada. En modo `vuelta-atras` busca `<sha>` en `historial` y toma de ahí sus
   digests. Después valida el `.env` y hace `git checkout --detach <sha>`. El clon es del repositorio
   público, sin credenciales. Así, `docker-compose.prod.yml`, el `Caddyfile` y el propio script
   salen del mismo commit que las imágenes.
4. Escribe `.despliegue/compose.env` (D6) con las imágenes **por digest**. El `.env` no se
   modifica.
5. `docker compose pull`.
6. Levanta `postgres` y espera su healthcheck.
7. **Migraciones:** `docker compose run --rm -T backend prisma migrate deploy`. Si falla,
   corta (y restaura el `checkout` y el `compose.env` de la versión previa): los contenedores
   viejos siguen arriba.
8. **Datos iniciales:** `docker compose run --rm -T backend node dist-seed/seed-produccion.js`
   (D8), con `ADMIN_EMAIL` y `ADMIN_PASSWORD` pasados por entorno. Si falla, corta del mismo
   modo.
9. `docker compose up -d --remove-orphans`.
10. **Comprobación:** hasta 90 s de reintentos contra el proxy de borde: la página principal
    (espera `200`) y `/api/zonas` (espera `200` y un JSON).
11. Si la comprobación pasa, escribe la versión nueva en `VERSION_ACTUAL`, la agrega a
    `historial` y hace la limpieza de imágenes (abajo). Termina en 0.
12. Si falla, vuelve a **`version_previa`**: hace su `checkout`, reescribe `compose.env` con
    sus digests y repite los pasos 9 y 10. `VERSION_ACTUAL` no cambia. Termina en 1 con el mensaje
    `VUELTA ATRÁS a <sha-previo>`, que el workflow muestra.

**Limpieza de imágenes:** `docker image prune` sin `-a` solo borra imágenes sin tag, y las
anteriores conservan su tag `<sha>`. El script borra explícitamente las imágenes de
`reservas-backend` y `reservas-frontend` cuyo digest no sea el de `VERSION_ACTUAL` ni el de la
versión inmediatamente anterior en `historial`. Así siempre queda lista una vuelta atrás sin
descargar nada.

**Vuelta atrás manual:** se relanza el workflow de CD con `workflow_dispatch`, un SHA y
`modo=vuelta-atras`. El SHA debe figurar en `historial`. El workflow no reconstruye nada:
`desplegar.sh` toma los digests registrados en `historial` para ese SHA, no los del tag, y
rechaza un SHA que no esté ahí. En este modo no se aplica el chequeo de ancestro del paso 3.

**Primer despliegue:** sin `VERSION_ACTUAL` no hay a dónde volver. Si la comprobación falla, el
script lo informa, deja los contenedores detenidos y termina en 1.

### D8: Seed de producción

- Se extraen de `seed.ts` las funciones del catálogo (configuración global, zonas, mesas y
  turnos) a `backend/prisma/catalogo.ts`. `seed.ts` sigue igual en comportamiento: catálogo,
  admin del README y reservas de ejemplo.
- `backend/prisma/seed-produccion.ts`:
  1. Carga el catálogo (idempotente, como hoy).
  2. Lee `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
  3. Corta con un error si falta alguna, si la contraseña tiene menos de 16 caracteres o si
     coincide con la contraseña o el email de desarrollo. El script importa esas constantes, en
     lugar de copiarlas, para que la comparación no quede desactualizada.
  4. Si no existe un usuario con ese email, lo crea con bcrypt. Si existe, **no toca** su
     contraseña.
  5. No crea reservas.
- Rotar la contraseña del admin en producción queda fuera de este script: el runbook explica
  cómo hacerlo a mano. Así, un despliegue nunca cambia credenciales sin aviso.

### D9: Runbook de AWS (`docs/despliegue.md`)

Pasos manuales que deja documentados, con las políticas JSON completas:

- **Cuenta:**
  - el root solo se usa para crear la cuenta y tiene MFA;
  - cada integrante usa su **usuario IAM con MFA**;
  - **no** se usa AWS Organizations ni IAM Identity Center: unirse a Organizations pasa una
    cuenta del plan Free al plan pago de forma automática.
- **Control de costos:**
  - una alerta de AWS Budgets (presupuesto mensual bajo, con aviso por mail al 50 % y al
    80 %);
  - en el plan Free, revisar el saldo de créditos y anotar en el runbook la **fecha de
    vencimiento del plan**.
- **Región:** `us-east-1`. Es de las de menor precio, así que rinde más los créditos o el
  margen. La latencia desde Argentina es mayor que con `sa-east-1` (São Paulo), pero alcanza
  para un MVP. Si la tarea 1.3 muestra que `sa-east-1` también entra en el presupuesto, se
  puede elegir esa sin cambiar nada más.
- **Instancia:** Ubuntu Server 24.04 LTS (amd64), como pide la guía, **`t3.micro`**, con
  **especificación de créditos de CPU `standard`**. En `unlimited`, el valor por defecto de las
  `t3`, el uso sostenido por encima de la línea base se cobra aparte. En `standard`, la
  instancia se ralentiza, pero no genera cargos. Más el *swapfile* de 2 GB (D1).
- **Disco:** EBS `gp3` cifrado de 20 GB.
- **Metadatos:** la instancia **no tiene un rol IAM asociado** (D6), así que el servicio de
  metadatos no entrega credenciales. Como segunda capa, IMDSv2 obligatorio
  (`HttpTokens=required`) y **límite de saltos en 1** (`HttpPutResponseHopLimit=1`): un
  contenedor en la red bridge de Docker está a un salto más que el host, y con límite 1 ni
  siquiera recibe el token. Ningún contenedor necesita IMDS.
- **IP elástica**, para que la URL no cambie al reiniciar.
- **Security group:** entrada **solo TCP 22, 80 y 443**. Sin 5432, sin 3000 ni 3001.
  - **22 (SSH):** `0.0.0.0/0` **en las dos etapas** (D4): los runners de GitHub no tienen IP
    fija. Es el riesgo aceptado del cambio a SSH; lo acotan las restricciones de D4.
  - **80 y 443:** el origen depende de la etapa:
  - **etapa HTTP:** solo las IPs públicas del equipo (`/32` cada una). Así, el login del admin en
    claro no queda expuesto a internet. Como las IPs domésticas pueden cambiar, el runbook
    indica cómo actualizarlas;
  - **etapa HTTPS:** `0.0.0.0/0` en los dos puertos. Let's Encrypt valida desde direcciones que
    no se publican, así que el 80 tiene que estar abierto a todos para emitir y renovar el
    certificado, y también sirve para la redirección.

  Salida abierta, necesaria para descargar imágenes y paquetes, y para hablar con Let's
  Encrypt.
- **Preparación del servidor**, siguiendo la guía (secciones 1 a 4):
  - actualizar el sistema e instalar `curl`, `wget`, `git`, `unzip` y `ca-certificates`
    (sin Nginx ni Certbot: Caddy está en el Compose);
  - instalar Docker y Compose con el script oficial (`get.docker.com`) y sumar al usuario de
    administración (`ubuntu`) al grupo `docker`. **El usuario `deploy` no va en ese grupo**;
  - clonar el repositorio **directo en `/opt/reservas`** con `sudo git clone <repo> .` (el
    punto final es parte del comando: sin él queda `/opt/reservas/<repo>`), de modo que todo
    sea de `root`;
  - crear el usuario `deploy` (sin contraseña), la regla de `sudoers` y el endurecimiento de
    `sshd` de D4;
  - generar el par de claves del despliegue **en la computadora del operador** (D4), autorizar
    la pública en el servidor con `command=` y `restrict`, copiar la privada a GitHub y
    borrarla de la computadora;
  - crear `/opt/reservas/.env` (D6); el estado de `.despliegue/` ya está en `.gitignore`.
- **Environment `produccion` de GitHub** (solo `main`), con los secrets `SERVER_HOST`,
  `SERVER_USER` (`deploy`), `SERVER_PORT` (`22`), `SSH_PRIVATE_KEY` y `SSH_KNOWN_HOSTS`. Este
  último sale de `ssh-keyscan`, y antes de cargarlo se **compara su huella** con la que informa
  el propio servidor (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`, por la sesión de
  administración), para no registrar la clave de un intermediario.
- **Rotación de la clave de despliegue:** generar un par nuevo, reemplazar la línea de
  `authorized_keys` y el secret, y confirmar que la clave anterior ya no entra.
- **Sin IAM:** no hay proveedor OIDC, rol de GitHub, perfil de instancia, parámetros ni
  documento SSM.
- **Backups:**
  - snapshot diario del volumen con Data Lifecycle Manager, con retención de 3 días (los
    snapshots son incrementales, pero consumen créditos);
  - un procedimiento para exportar la base con `pg_dump` y descargarla por `scp` con el usuario
    de administración (no con la clave de despliegue, que no abre una shell), que se usa sí o
    sí **antes del vencimiento del plan Free**.
- **Activar HTTPS con el subdominio:**
  1. pasarle a la docente la IP elástica;
  2. esperar a que el registro `A` del subdominio resuelva a esa IP (`dig +short <subdominio>`);
  3. abrir el security group a `0.0.0.0/0` en 80 y 443, cambiar `SITE_ADDRESS` en
     `/opt/reservas/.env` al subdominio y redesplegar;
  4. verificar el certificado, la redirección y HSTS (tarea 6.6).

  Si Caddy no logra emitir el certificado (DNS todavía no propagado), sigue reintentando y el
  sitio no responde por HTTPS hasta lograrlo. En ese caso se vuelve a la etapa HTTP **completa**:
  primero se restringe otra vez el security group a las IPs del equipo, después se vuelve a
  `SITE_ADDRESS=:80` y se redespliega. Volver a `:80` sin restringir el security group dejaría
  el login en claro abierto a internet. Se reintenta cuando el DNS resuelva.
  (El puerto 22 no cambia entre etapas.)
- **Riesgo aceptado de la etapa HTTP** y su alcance, según la spec.

### D10: Tests del frontend y de la decisión de despliegue en CI

Se agrega `npm run test:frontend` al job de tests de `ci.yml`. El CD depende del CI en verde, y
hoy un PR podría romper el frontend sin que nada lo frene antes de producción. Es un cambio de
una línea en un workflow, dentro de un change que justamente trata del pipeline (§14 de
`config.yaml`).

La función de decisión del job `decidir` (D4) vive en `scripts/cd/` con sus tests de
`node --test`, que ya corre el paso `test:scripts` del CI. Sus tests cubren los escenarios del
requisito "Despliegue automático solo desde main con CI en verde" que no se pueden provocar a
mano en `main` sin romperlo: CI en rojo, dos merges seguidos, CI viejo que termina tarde, commit
posterior en rojo o corriendo, y despacho manual inválido.

## Risks / Trade-offs

- **[Riesgo aceptado, transitorio] HTTP sin cifrar** hasta que el subdominio apunte a la
  instancia: las credenciales del admin, el JWT y los datos de contacto viajan en claro.
  → **Mitigación:** la etapa dura solo hasta que la docente configure el DNS; en ella el
  security group admite solo las IPs del equipo, no se cargan datos reales y el admin no se
  loguea desde redes públicas; la contraseña del admin es
  única, de 16 caracteres o más; el JWT dura 60 minutos; y activar HTTPS es un cambio de
  configuración (D2 y D9). Conviene **rotar la contraseña del admin al pasar a HTTPS**, porque
  pudo haber viajado en claro.
- **[Riesgo] El subdominio depende de la docente:** si el registro DNS cambia o se borra, el
  certificado deja de renovarse y el sitio deja de responder por el nombre.
  → **Mitigación:** el control diario del certificado (D2) avisa con 21 días de margen, y el
  runbook indica cómo volver temporalmente a la IP.
- **[Riesgo] Migración incompatible con la versión anterior:** la vuelta atrás automática
  levanta imágenes viejas sobre un schema ya migrado.
  → **Mitigación:** las migraciones se escriben compatibles hacia atrás (agregar antes que
  renombrar o borrar). Si una no puede serlo, el PR lo declara y se despliega con vuelta atrás
  manual planificada. El snapshot diario es la última red.
- **[Riesgo] Corte de unos segundos en cada despliegue** (recreación de contenedores).
  → Se acepta para el MVP.
- **[Riesgo] Disco o memoria agotados** (imágenes viejas, logs).
  → **Mitigación:** rotación de logs (D1) y la limpieza explícita de imágenes de D7, que solo
  conserva la versión actual y la inmediatamente anterior.
- **[Riesgo aceptado] SSH abierto a internet** (puerto 22 en `0.0.0.0/0`, D4): habrá escaneos
  y fuerza bruta, y un fallo de `sshd` o de configuración quedaría expuesto.
  → **Mitigación:** solo clave, sin contraseñas ni `root`, `AllowUsers`, `MaxAuthTries 3`,
  `sshd` al día con las actualizaciones de seguridad de Ubuntu (`unattended-upgrades`),
  `fail2ban` opcional, y la clave de despliegue con
  comando forzado y `restrict`. Lo que **no** cubre: una vulnerabilidad de `sshd` aún sin
  parche.
- **[Riesgo] La clave de despliegue es permanente** y vive en los secrets de GitHub.
  → **Mitigación:** secret de un environment que admite solo `main`, comando forzado que no
  da shell ni lectura de `.env`, validación estricta de cada valor, rotación documentada y
  huella del servidor fijada. Quien la robe solo puede pedir despliegues de versiones de
  `main` o vueltas atrás a versiones ya desplegadas (D4).
- **[Riesgo] Escalada de `deploy` a `root`** si `deploy` pudiera escribir lo que `sudo`
  ejecuta, o si perteneciera al grupo `docker`.
  → **Mitigación:** `/opt/reservas` es de `root`, `deploy` fuera del grupo `docker` y una
  única regla de `sudoers`. La tarea 6.4 lo verifica.
- **[Riesgo] Man-in-the-middle del despliegue.**
  → **Mitigación:** `StrictHostKeyChecking=yes` con `SSH_KNOWN_HOSTS`: `ssh` aborta antes de
  autenticarse si la huella no coincide.
- **[Riesgo] Una acción de terceros comprometida** en el workflow de CD.
  → **Mitigación:** acciones fijadas por SHA, permisos mínimos por job, la conexión hecha con
  el cliente `ssh` del runner (sin acción de terceros que maneje la clave) y una clave que no
  puede ejecutar comandos arbitrarios.
- **[Riesgo] Secretos en un archivo del servidor** (`/opt/reservas/.env`).
  → **Mitigación:** dueño `root` y modo `600` (el script lo exige), disco EBS cifrado,
  la clave de despliegue no los puede leer y la instancia no tiene credenciales de AWS. El
  riesgo residual es el acceso de `root` a la instancia.
- **[Riesgo] Despliegue cortado a la mitad** si se cae la conexión SSH.
  → **Mitigación:** `desplegar.sh` ignora `SIGHUP` y `SIGPIPE` y escribe su propio log (D7).
- **[Riesgo] Alguien publica el puerto del frontend o del backend** en
  `docker-compose.prod.yml`. Eso habilita falsificar la IP (D5) o saltear el proxy.
  → **Mitigación:** la verificación de la tarea 6 prueba los puertos desde afuera, y un
  comentario en el compose explica por qué no tienen `ports:`.
- **[Trade-off] Llamadas desde Server Components** con la IP del frontend (D5).
  → Se documenta; hoy no afecta rutas con límites.
- **[Trade-off] Imágenes públicas:** cualquiera puede descargarlas. No contienen secretos y el
  código ya es público.
- **[Riesgo] Memoria insuficiente en `t3.micro`** (1 GB para cuatro servicios).
  → **Mitigación:** `mem_limit` por servicio, swap de 2 GB y nada de builds en la instancia
  (D1 y D3). La tarea 6.2 mide el consumo real. Si no alcanza, la salida es una `t3.small`, que
  solo es elegible en el plan Free y consume el doble de créditos: es una decisión del equipo,
  no del script.
- **[Riesgo] Créditos agotados o fin del plan Free:** la cuenta se cierra sola y producción
  desaparece; a los 90 días se borran los datos.
  → **Mitigación:** alerta de presupuesto, fecha de vencimiento anotada en el runbook,
  exportación con `pg_dump` antes de esa fecha, y la estimación de consumo de la tarea 1.3.
- **[Riesgo] Cargos inesperados en una cuenta anterior al 15 de julio de 2025** (por ejemplo,
  modo *unlimited*, una segunda instancia olvidada o snapshots acumulados).
  → **Mitigación:** créditos de CPU en `standard`, una sola instancia, retención de 3 días y
  alerta de presupuesto. El runbook indica cómo detener o eliminar todo al terminar la
  cursada.

## Migration Plan

1. Mergear el PR de spec y después el de implementación. El CD no tiene a dónde desplegar hasta
   que exista la infraestructura: sin los secrets `SERVER_*` y `SSH_*` en el environment, el
   job `desplegar` termina en error con un mensaje claro y no afecta al CI.
2. Crear la infraestructura y preparar el servidor siguiendo `docs/despliegue.md`: instancia,
   security group, IP elástica, Docker, clon en `/opt/reservas`, usuario `deploy`, clave SSH,
   `.env` y secrets de GitHub. Pedirle el subdominio a la docente cuando exista la IP.
3. Primer despliegue manual con `workflow_dispatch` usando el SHA de `main`, en la etapa HTTP, y
   verificación de la tarea 6.
4. Pasarle a la docente la IP elástica y, cuando el subdominio resuelva, activar HTTPS (D9).
5. Desde ahí, el commit verde más reciente de `main` se despliega solo.
6. **Rollback del change completo:** deshabilitar el workflow de CD desde GitHub, **borrar la
   línea de `authorized_keys` y el secret `SSH_PRIVATE_KEY`** (la instancia sigue sirviendo la
   última versión) y, si hace falta, detener la instancia.

## Open Questions

- **Tags exactos de las imágenes base** (`caddy`, `node:20-alpine`): se fijan a la última
  versión de parche disponible al implementar. No cambia el diseño.
- **Nombre del owner en GHCR:** depende de si el repositorio sigue bajo `portalmatias` o pasa a
  una organización. Es una variable del workflow.
