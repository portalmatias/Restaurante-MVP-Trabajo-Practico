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
- **AWS en el Tier gratuito** (propuesta de la docente; ver `proposal.md`). El único tipo de
  instancia elegible tanto en cuentas anteriores al 15 de julio de 2025 como en las del plan
  Free es `t3.micro`: 2 vCPU con ráfagas y **1 GB de RAM**. En el plan Free, todo consumo
  descuenta créditos y la cuenta se cierra a los 6 meses.

## Goals / Non-Goals

**Goals:**
- Que nada que viva en GitHub (código, imágenes, logs o configuración del workflow) alcance
  para acceder a la cuenta de AWS, a la instancia o a los datos.
- Que el rol del despliegue pueda hacer **una sola cosa**: correr el procedimiento versionado
  de despliegue con un SHA.
- Que el paso a HTTPS no requiera tocar código de la aplicación.

**Non-Goals:**
- Despliegue sin cortes: con una sola instancia hay unos segundos de corte por despliegue, y se
  acepta.
- Rollback de migraciones: la vuelta atrás automática revierte imágenes, no el schema (ver
  Risks).
- Backups gestionados fuera de la instancia: el runbook configura snapshots del disco. Una
  política de backups más completa queda para otro change.

## Decisions

### D1: Topología: una instancia, Docker Compose y un único puerto público

```
internet ──:80──> [caddy] ──> [frontend :3000] ──/api──> [backend :3001] ──> [postgres :5432]
                     red "borde"           red "interna" (sin salida a puertos del host)
```

- `deploy/docker-compose.prod.yml` define cuatro servicios. **Solo `caddy` publica un puerto**
  (`80:80`). Los demás no tienen `ports:`, así que no se pueden alcanzar desde el host ni desde
  internet.
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
al implementar) y un `deploy/Caddyfile` versionado. La dirección del sitio sale de una variable
(`SITE_ADDRESS`, hoy `:80`).

**Por qué Caddy y no nginx:**
- **`X-Forwarded-For`:** desde la versión 2.5, `reverse_proxy` ignora los `X-Forwarded-*`
  entrantes de clientes que no figuran en `trusted_proxies` y escribe la IP de la conexión.
  Por defecto ya hace lo que exige `exposicion-red` ("un proxy de borde que **sobrescriba**
  `X-Forwarded-For`"). En nginx hay que acordarse de configurarlo, y el error típico
  (`$proxy_add_x_forwarded_for`) **agrega** el valor en lugar de reemplazarlo.
- **HTTPS:** cambiar `SITE_ADDRESS` por un nombre de dominio hace que Caddy pida y renueve solo
  el certificado de Let's Encrypt. Es exactamente el "un cambio de configuración" que pide la
  spec.

Es una imagen nueva, no una dependencia npm. Se justifica según §2 de `config.yaml`.

**Encabezados** (en el `Caddyfile`, porque no dependen de HTTPS):
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` y `Content-Security-Policy: frame-ancestors 'none'`
- `Referrer-Policy: strict-origin-when-cross-origin`
- quitar `Server` y `X-Powered-By`

HSTS **no** se envía sobre HTTP; se agrega al pasar a HTTPS.

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
- **Tags:** `ghcr.io/<owner>/reservas-backend:<sha>` y `reservas-frontend:<sha>`, sin `latest`.
  El despliegue siempre nombra el SHA (spec: "Versiones trazables e inmutables").
- **Paquetes públicos en GHCR:** el repositorio es público y las imágenes no contienen
  secretos, así que la instancia las descarga sin credenciales de registro. Publicarlas como
  privadas obligaría a guardar un token de GitHub en la instancia, y eso sí sería un secreto
  más.

**Alternativa considerada: construir en la instancia** (`git pull` + `docker compose build`).
El build de Next necesita más memoria que la que usa la aplicación, y no entra en el 1 GB de
una `t3.micro` del Tier gratuito. Además no deja versiones anteriores listas para una vuelta
atrás. Se descarta (decisión del equipo).

**Arquitectura `amd64`:** `t3.micro` es x86. Las instancias `t4g` (ARM) serían más baratas en
créditos, pero solo son elegibles en el plan Free, y construir imágenes `arm64` en los
runners de GitHub requiere emulación. Se descarta.

### D4: Workflow de CD, OIDC y SSM con un documento propio

**Disparo:** `.github/workflows/cd.yml` con `on: workflow_run` (workflow `CI`, tipo
`completed`). El job corre solo si se cumplen las tres condiciones:
- `conclusion == 'success'`
- `event == 'push'`
- `head_branch == 'main'`

El SHA se toma de `workflow_run.head_sha`, no de `github.sha`: la variable apunta al commit que
validó el CI.

**Jobs:**
1. `imagenes`: checkout de ese SHA y `docker/build-push-action` de las dos imágenes a GHCR, con
   `permissions: packages: write` y el `GITHUB_TOKEN`.
2. `desplegar`: `environment: produccion`, `permissions: id-token: write, contents: read`, y
   `aws-actions/configure-aws-credentials` con `role-to-assume`. Llama a `aws ssm send-command`
   con el documento `reservas-desplegar` y el parámetro `sha`, espera el resultado y lo muestra.

- `concurrency: { group: despliegue-produccion, cancel-in-progress: false }` hace que los
  despliegues corran de a uno sin cortar uno a la mitad.
- Las acciones de terceros se fijan por **SHA de commit**, no por tag: el workflow maneja
  credenciales de producción.

**Confianza de IAM (OIDC):** el rol `reservas-github-despliegue` solo confía en
`token.actions.githubusercontent.com` con `aud = sts.amazonaws.com` y
`sub = repo:<owner>/Restaurante-MVP-Trabajo-Practico:environment:produccion`. Además, el
environment `produccion` de GitHub admite **solo la rama `main`**. Un PR, una rama o un fork no
consiguen un token con ese `sub`. Así se cumple "Credenciales de despliegue temporales y
acotadas" sin claves permanentes.

**Permisos del rol** (los mínimos):
- `ssm:SendCommand` sobre **dos** recursos: el ARN de la instancia y el ARN del documento
  `reservas-desplegar`. **No** se permite `AWS-RunShellScript`, así que el rol no puede
  ejecutar comandos arbitrarios.
- `ssm:GetCommandInvocation` y `ssm:ListCommandInvocations`, para leer el resultado.
- Nada más: sin `ssm:GetParameter*`, sin EC2 y sin IAM.

**Documento SSM `reservas-desplegar`** (versionado en `deploy/ssm-desplegar.json`; el runbook
lo crea y lo actualiza):
- Recibe `sha` con `allowedPattern: ^[0-9a-f]{40}$`, así que un valor inválido se rechaza antes
  de llegar a la instancia (spec: "Despliegue con un identificador inválido").
- Ejecuta `/opt/reservas/repo/deploy/desplegar.sh "<sha>"`.

**Alternativa considerada: SSH con una clave en un secreto de GitHub.** Los runners de GitHub no
tienen IP fija, así que el puerto 22 quedaría abierto a internet. Además, la clave sería una
credencial permanente. Se descarta (decisión del equipo).

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

### D6: Secretos en SSM Parameter Store y `.env` generado en la instancia

**Parámetros** `SecureString` bajo `/reservas/prod/` (cifrados con la clave administrada
`aws/ssm`):
- `JWT_SECRET`: 64 bytes aleatorios.
- `POSTGRES_PASSWORD`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

El runbook indica cómo generarlos sin que pasen por el historial del shell.

- **Perfil de la instancia:** `AmazonSSMManagedInstanceCore` (para recibir comandos), más una
  política propia con `ssm:GetParametersByPath` sobre `/reservas/prod/*` y `kms:Decrypt`
  condicionado a `kms:ViaService = ssm.<región>.amazonaws.com`. El rol de GitHub **no** puede
  leer secretos; la instancia sí.
- `desplegar.sh` escribe `/opt/reservas/.env` con `umask 077`, dueño `root` y modo `600`, y lo
  pasa a Compose con `--env-file`. Ningún secreto se imprime: el script corre sin `set -x`.
- **Valores no secretos:** `JWT_EXPIRES_IN=60m`, `THROTTLE_*`, `TRUST_PROXY`, `HOST`, `PORT`,
  `SITE_ADDRESS` y los tags de las imágenes. Van fijos en `docker-compose.prod.yml` o los arma el
  script.
- `DATABASE_URL` lo arma Compose con `POSTGRES_PASSWORD`; no es un parámetro aparte.

**Alternativa considerada: secretos de GitHub enviados en el `send-command`.** Los parámetros de
SSM Run Command quedan visibles en el historial de comandos de la consola y de la API. Además,
el rol de GitHub tendría que manejar los secretos. Se descarta.

### D7: Procedimiento en la instancia (`deploy/desplegar.sh`)

El script corre como root vía SSM, con `set -euo pipefail` y un lock (`flock`) como segunda
barrera contra despliegues simultáneos.

1. Valida el formato del SHA otra vez (defensa en profundidad).
2. `git -C /opt/reservas/repo fetch origin main` y `git checkout --detach <sha>`. El clon es del
   repositorio público, sin credenciales. Así, `docker-compose.prod.yml`, el `Caddyfile` y el
   propio script salen del mismo commit que las imágenes.
3. Genera `.env` (D6) con los tags `<sha>`.
4. `docker compose pull`.
5. Levanta `postgres` y espera su healthcheck.
6. **Migraciones:** `docker compose run --rm backend npx prisma migrate deploy`. Si falla, corta:
   los contenedores viejos siguen arriba.
7. **Datos iniciales:** `docker compose run --rm backend node dist-seed/seed-produccion.js`
   (D8). Si falla, corta.
8. `docker compose up -d --remove-orphans`.
9. **Comprobación:** hasta 90 s de reintentos contra `http://127.0.0.1/` (espera `200`) y
   `http://127.0.0.1/api/zonas` (espera `200` y un JSON).
10. Si la comprobación pasa, escribe `<sha>` en `/opt/reservas/VERSION_ACTUAL` y la anterior en
    `VERSION_ANTERIOR`. Termina en 0.
11. Si falla, hace `checkout` de `VERSION_ANTERIOR`, regenera `.env` con esos tags y repite los
    pasos 8 y 9. Termina en 1 con el mensaje `VUELTA ATRÁS a <sha-anterior>`, que el workflow
    muestra.

**Vuelta atrás manual:** se relanza el workflow de CD con `workflow_dispatch` y un SHA. El input
se valida con la misma expresión y solo se acepta un SHA que tenga imágenes publicadas. No se
reconstruye nada.

**Primer despliegue:** sin `VERSION_ANTERIOR` no hay a dónde volver. El script lo informa y
termina en 1.

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
- **Instancia:** Amazon Linux 2023 (trae el agente de SSM), **`t3.micro`**, con
  **especificación de créditos de CPU `standard`**. En `unlimited`, el valor por defecto de las
  `t3`, el uso sostenido por encima de la línea base se cobra aparte. En `standard`, la
  instancia se ralentiza, pero no genera cargos. Más el *swapfile* de 2 GB (D1).
- **Disco:** EBS `gp3` cifrado de 20 GB, dentro de los 30 GB del Tier gratuito para cuentas
  anteriores.
- **Metadatos:** IMDSv2 obligatorio (`HttpTokens=required`), para que un SSRF no pueda leer las
  credenciales del perfil.
- **IP elástica**, para que la URL no cambie al reiniciar.
- **Security group:** entrada **solo TCP 80 desde `0.0.0.0/0`**. Sin 22, sin 5432, sin 3000 ni
  3001. Salida abierta, necesaria para descargar imágenes y paquetes.
- **Docker, Compose y git** instalados, y clon del repositorio en `/opt/reservas/repo`.
- **IAM:**
  - el proveedor OIDC de GitHub;
  - el rol de GitHub (D4);
  - el perfil de la instancia (D6).
- **Parámetros** de `/reservas/prod/`, el documento SSM y el environment `produccion` de GitHub
  (solo `main`), con las variables no secretas `AWS_ROLE_ARN`, `AWS_REGION` e
  `INSTANCE_ID`. No son secretos, pero tampoco hace falta publicarlos fuera del environment.
- **Backups:**
  - snapshot diario del volumen con Data Lifecycle Manager, con retención de 3 días (los
    snapshots son incrementales, pero consumen créditos);
  - un procedimiento para exportar la base con `pg_dump` y descargarla vía SSM, que se usa
    sí o sí **antes del vencimiento del plan Free**.
- **Paso a HTTPS:** registrar un dominio, apuntarlo a la IP elástica, abrir 443 (y mantener 80
  para el desafío ACME y la redirección), cambiar `SITE_ADDRESS` y agregar HSTS.
- **Riesgo aceptado de HTTP** y su alcance, según la spec.

### D10: Tests del frontend en CI

Se agrega `npm run test:frontend` al job de tests de `ci.yml`. El CD depende del CI en verde, y
hoy un PR podría romper el frontend sin que nada lo frene antes de producción. Es un cambio de
una línea en un workflow, dentro de un change que justamente trata del pipeline (§14 de
`config.yaml`).

## Risks / Trade-offs

- **[Riesgo aceptado] HTTP sin cifrar:** las credenciales del admin, el JWT y los datos de
  contacto viajan en claro, y alguien en la misma red del cliente (por ejemplo, un Wi-Fi
  público) puede leerlos o robar una sesión de admin.
  → **Mitigación:** contraseña de admin única de 16 caracteres o más, que no se reutiliza en
  ningún otro lado; JWT de 60 minutos; el admin evita loguearse desde redes públicas; no se
  cargan datos reales de clientes hasta tener HTTPS; y el paso a HTTPS ya está preparado (D2 y
  D9).
- **[Riesgo] Migración incompatible con la versión anterior:** la vuelta atrás automática
  levanta imágenes viejas sobre un schema ya migrado.
  → **Mitigación:** las migraciones se escriben compatibles hacia atrás (agregar antes que
  renombrar o borrar). Si una no puede serlo, el PR lo declara y se despliega con vuelta atrás
  manual planificada. El snapshot diario es la última red.
- **[Riesgo] Corte de unos segundos en cada despliegue** (recreación de contenedores).
  → Se acepta para el MVP.
- **[Riesgo] Disco o memoria agotados** (imágenes viejas, logs).
  → **Mitigación:** rotación de logs (D1) y `docker image prune` en `desplegar.sh`, que conserva
  las imágenes de `VERSION_ACTUAL` y `VERSION_ANTERIOR`.
- **[Riesgo] Una acción de terceros comprometida** en el workflow de CD.
  → **Mitigación:** acciones fijadas por SHA, permisos mínimos por job, y un rol que no puede
  leer secretos ni ejecutar comandos arbitrarios.
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
   que exista la infraestructura: sin `INSTANCE_ID` en el environment, el job `desplegar`
   termina en error con un mensaje claro y no afecta al CI.
2. Crear la infraestructura siguiendo `docs/despliegue.md` y cargar los parámetros.
3. Primer despliegue manual con `workflow_dispatch` usando el SHA de `main`, y verificación de
   la tarea 6.
4. Desde ahí, cada merge a `main` se despliega solo.
5. **Rollback del change completo:** deshabilitar el workflow de CD desde GitHub (la instancia
   sigue sirviendo la última versión) y, si hace falta, detener la instancia.

## Open Questions

- **Tags exactos de las imágenes base** (`caddy`, `node:20-alpine`): se fijan a la última
  versión de parche disponible al implementar. No cambia el diseño.
- **Nombre del owner en GHCR:** depende de si el repositorio sigue bajo `portalmatias` o pasa a
  una organización. Es una variable del workflow.
