# Despliegue en producción (AWS EC2)

Runbook del change `despliegue-continuo-ec2` (decisiones en
[`openspec/changes/despliegue-continuo-ec2/design.md`](../openspec/changes/despliegue-continuo-ec2/design.md)).
Todo lo que sigue se hace **una sola vez**, a mano, desde la consola de AWS o la AWS CLI. Después,
cada commit verde de `main` se despliega solo.

> Este repositorio es **público**. Acá no se anota ningún identificador de la cuenta (ID de
> cuenta, ARN completos, IP elástica, ID de instancia): se escriben como `<...>` y los valores
> reales viven en las variables del environment `produccion` de GitHub y en AWS.

## Estado actual

| Dato | Valor |
|---|---|
| Etapa | **HTTP** (sin subdominio todavía). Cuando se active HTTPS, cambiar esta fila a **HTTPS** y completar el nombre. |
| Región | `us-east-1` (ver [Región](#región)) |
| Vencimiento del plan Free | _a completar con la fecha de la cuenta (tarea 1.3)_ |
| Fecha de entrega del TP | _a completar_ |

## Cómo funciona (resumen)

```
push a main ─> CI en verde ─> cd.yml ─┬─ decidir   (¿se despliega este SHA?)
                                      ├─ imagenes  (build y push a GHCR; salen los digests)
                                      └─ desplegar (OIDC ─> SSM SendCommand "reservas-desplegar")
                                                          │
                                  instancia EC2 (sin SSH) ▼
                       /opt/reservas/repo/deploy/desplegar.sh <sha> <digests> <modo>
                                  └─ lee /reservas/prod/* de SSM, escribe /opt/reservas/.env,
                                     migra, carga el seed, levanta Compose y comprueba
                                     (si falla, vuelve a la versión que estaba sirviendo)
```

- **Un solo servicio público:** Caddy, en los puertos 80 y 443. PostgreSQL, backend y frontend
  corren en la misma instancia y no publican puertos.
- **Sin claves de AWS en GitHub:** el workflow obtiene credenciales temporales por OIDC y el rol
  solo puede ejecutar el documento SSM `reservas-desplegar` sobre esta instancia. No lee secretos.
- **Los secretos viven en SSM Parameter Store** y los lee la instancia (no GitHub).

## 1. Cuenta y control de costos

1. **Root:** se usa solo para crear la cuenta. Activarle **MFA** y no crearle claves de acceso.
2. **Usuarios IAM:** cada integrante usa su propio usuario IAM, **con MFA**. Sin claves de acceso
   permanentes si se puede evitar (consola web o CloudShell).
3. **No usar AWS Organizations ni IAM Identity Center.** Unirse a Organizations pasa una cuenta
   del plan Free al plan pago de forma automática.
4. **Presupuesto (Budgets):** crear un presupuesto mensual bajo (por ejemplo, USD 5) con aviso
   por correo al **50 %** y al **80 %** del monto. Consola → Billing → Budgets.
5. **Plan Free:** anotar arriba el **saldo de créditos** y la **fecha de vencimiento del plan**, y
   compararla con la fecha de entrega del TP. Cuando el plan vence, la cuenta se cierra y a los
   90 días se borran los datos: **antes de esa fecha hay que exportar la base**
   (ver [Backups](#9-backups-y-exportación-de-la-base)).
6. Estimar el consumo mensual con la AWS Pricing Calculator: `t3.micro` + EBS `gp3` de 20 GB +
   IPv4 pública + snapshots. Si no entra en los créditos o en los límites gratuitos hasta el fin
   de la cursada, **frenar y decidirlo con el equipo** (tarea 1.3).

### Región

`us-east-1`: es de las de menor precio, así que rinde más los créditos. Desde Argentina tiene
más latencia que `sa-east-1` (São Paulo), pero alcanza para un MVP. Si la estimación muestra que
`sa-east-1` también entra en el presupuesto, se puede usar esa sin cambiar nada más. En los
comandos de abajo, reemplazar `us-east-1` si se elige otra.

## 2. Red: security group e IP elástica

**Security group** `reservas-prod` (en la VPC por defecto):

| Sentido | Protocolo y puerto | Origen | Cuándo |
|---|---|---|---|
| Entrada | TCP 80 | IPs públicas del equipo (`/32` cada una) | Etapa HTTP |
| Entrada | TCP 443 | IPs públicas del equipo (`/32` cada una) | Etapa HTTP |
| Entrada | TCP 80 y 443 | `0.0.0.0/0` | Etapa HTTPS |
| Salida | todo | `0.0.0.0/0` | Siempre (imágenes, paquetes, Let's Encrypt, SSM) |

**Sin** entrada al 22 (no hay SSH), 5432, 3000 ni 3001. El despliegue no necesita ninguna
entrada: llega por SSM, que es una conexión que abre la propia instancia hacia AWS.

```bash
SG=$(aws ec2 create-security-group --region us-east-1 --group-name reservas-prod \
  --description "Sistema de reservas: HTTP y HTTPS" --query GroupId --output text)

# Etapa HTTP: una línea por cada IP del equipo (consultar la propia en https://checkip.amazonaws.com).
for puerto in 80 443; do
  aws ec2 authorize-security-group-ingress --region us-east-1 --group-id "$SG" \
    --protocol tcp --port "$puerto" --cidr <IP-DEL-INTEGRANTE>/32
done
```

**Actualizar las IPs del equipo** (las IPs domésticas cambian): agregar la nueva con el mismo
`authorize-security-group-ingress` y quitar la vieja con `revoke-security-group-ingress`
(mismos parámetros).

**IP elástica**, para que la URL no cambie al reiniciar la instancia:

```bash
aws ec2 allocate-address --region us-east-1 --domain vpc   # anotar AllocationId
# después de lanzar la instancia (sección 4):
aws ec2 associate-address --region us-east-1 --instance-id <INSTANCE_ID> --allocation-id <ALLOCATION_ID>
```

## 3. IAM

### 3.1 Proveedor OIDC de GitHub

Consola → IAM → Proveedores de identidad → Agregar:

- Tipo: OpenID Connect
- URL del proveedor: `https://token.actions.githubusercontent.com`
- Audiencia: `sts.amazonaws.com`

### 3.2 Rol de GitHub: `reservas-github-despliegue`

**Política de confianza.** Solo el environment `produccion` de este repositorio puede asumirlo.
Un PR, una rama o un fork no obtienen un token con este `sub`.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ID-DE-CUENTA>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:<OWNER>/Restaurante-MVP-Trabajo-Practico:environment:produccion"
        }
      }
    }
  ]
}
```

**Política de permisos** (`reservas-github-despliegue-permisos`). Los mínimos: ejecutar **solo**
el documento `reservas-desplegar` **solo** sobre esta instancia y leer el resultado. No incluye
`AWS-RunShellScript`, ni `ssm:GetParameter*`, ni EC2, ni IAM.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EjecutarSoloElDocumentoDeDespliegue",
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": [
        "arn:aws:ec2:us-east-1:<ID-DE-CUENTA>:instance/<INSTANCE_ID>",
        "arn:aws:ssm:us-east-1:<ID-DE-CUENTA>:document/reservas-desplegar"
      ]
    },
    {
      "Sid": "LeerElResultado",
      "Effect": "Allow",
      "Action": [
        "ssm:GetCommandInvocation",
        "ssm:ListCommandInvocations"
      ],
      "Resource": "*"
    }
  ]
}
```

### 3.3 Perfil de la instancia: `reservas-instancia`

Rol de EC2 (confianza en `ec2.amazonaws.com`) con dos políticas:

1. La administrada **`AmazonSSMManagedInstanceCore`**, para recibir comandos de SSM.
2. Una propia, `reservas-instancia-parametros`, para leer los parámetros de `/reservas/prod/` y
   descifrarlos. La instancia puede leer los secretos; el rol de GitHub no.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "LeerParametrosDeProduccion",
      "Effect": "Allow",
      "Action": "ssm:GetParametersByPath",
      "Resource": [
        "arn:aws:ssm:us-east-1:<ID-DE-CUENTA>:parameter/reservas/prod",
        "arn:aws:ssm:us-east-1:<ID-DE-CUENTA>:parameter/reservas/prod/*"
      ]
    },
    {
      "Sid": "DescifrarSoloATravesDeSSM",
      "Effect": "Allow",
      "Action": "kms:Decrypt",
      "Resource": "*",
      "Condition": {
        "StringEquals": { "kms:ViaService": "ssm.us-east-1.amazonaws.com" }
      }
    }
  ]
}
```

Crear el **perfil de instancia** `reservas-instancia` con ese rol (la consola lo hace sola al
crear el rol para EC2; con la CLI: `aws iam create-instance-profile` y `add-role-to-instance-profile`).

## 4. La instancia

| Parámetro | Valor |
|---|---|
| AMI | Amazon Linux 2023 (trae el agente de SSM) |
| Tipo | `t3.micro` |
| Créditos de CPU | **`standard`** (ver abajo) |
| Disco | EBS `gp3` de 20 GB, **cifrado** |
| Security group | `reservas-prod` |
| Perfil de instancia | `reservas-instancia` |
| Metadatos | IMDSv2 **obligatorio**, límite de saltos **1** (ver abajo) |
| Etiqueta | `Backup=reservas` (la usa la política de snapshots) |

- **Créditos `standard`:** en `unlimited`, el valor por defecto de las `t3`, el uso sostenido por
  encima de la línea base se cobra aparte. En `standard` la instancia se ralentiza, pero no
  genera cargos.
- **IMDSv2 obligatorio y límite de saltos 1:** con `HttpTokens=required` un SSRF no puede leer
  las credenciales del perfil. Un contenedor en la red *bridge* de Docker está a un salto más que
  el host; con límite 1, la respuesta del token de IMDSv2 no le llega y no puede obtener las
  credenciales del rol (que lee todos los secretos). Algunas configuraciones de AL2023 usan 2 para
  que los contenedores sí lleguen, así que se fija de forma explícita. Ningún contenedor necesita
  IMDS: los secretos los lee `desplegar.sh` en el host.

```bash
aws ec2 run-instances --region us-east-1 \
  --image-id <AMI-AL2023> --instance-type t3.micro \
  --iam-instance-profile Name=reservas-instancia \
  --security-group-ids "$SG" \
  --credit-specification CpuCredits=standard \
  --metadata-options HttpTokens=required,HttpPutResponseHopLimit=1,HttpEndpoint=enabled \
  --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=20,VolumeType=gp3,Encrypted=true}' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=reservas-prod},{Key=Backup,Value=reservas}]'
```

Para corregir una instancia ya creada:

```bash
aws ec2 modify-instance-metadata-options --region us-east-1 --instance-id <INSTANCE_ID> \
  --http-tokens required --http-put-response-hop-limit 1
aws ec2 modify-instance-credit-specification --region us-east-1 \
  --instance-credit-specifications InstanceId=<INSTANCE_ID>,CpuCredits=standard
```

### 4.1 Preparar la instancia (una vez)

Entrar por **Session Manager** (consola → EC2 → Conectar → Administrador de sesiones; no hay SSH)
y, como root (`sudo -i`):

```bash
# Docker, git y la CLI de AWS (ya viene en AL2023)
dnf install -y docker git
systemctl enable --now docker

# Plugin de Docker Compose (AL2023 no lo trae en el repositorio)
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
docker compose version

# Swap de 2 GB: un pico de memoria se resuelve con swap y no matando PostgreSQL
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Clon del repositorio (público) donde lo espera el documento SSM
mkdir -p /opt/reservas && chmod 700 /opt/reservas
git clone https://github.com/<OWNER>/Restaurante-MVP-Trabajo-Practico.git /opt/reservas/repo
```

> La versión del plugin de Compose (`v2.29.7`) es la que se usó al escribir este runbook; si hace
> falta otra, usar una versión estable y revisar que `docker compose version` responda.

Verificar: `free -m` muestra el swap de 2 GB, `docker info` responde y
`ls /opt/reservas/repo/deploy/desplegar.sh` existe y es ejecutable.

## 5. Parámetros de SSM (`/reservas/prod/`)

| Parámetro | Tipo | Contenido |
|---|---|---|
| `/reservas/prod/JWT_SECRET` | `SecureString` | 32 caracteres o más, solo `A-Za-z0-9_-` |
| `/reservas/prod/POSTGRES_PASSWORD` | `SecureString` | 24 caracteres o más, solo `A-Za-z0-9_-` (va dentro de una URL) |
| `/reservas/prod/ADMIN_EMAIL` | `SecureString` | email del admin de producción (no el del README) |
| `/reservas/prod/ADMIN_PASSWORD` | `SecureString` | 16 caracteres o más, única, sin tabulaciones; no la del README |
| `/reservas/prod/config/SITE_ADDRESS` | `String` | `:80` en la etapa HTTP; el subdominio en la etapa HTTPS |

`desplegar.sh` valida esos formatos antes de escribir nada y corta con un mensaje claro si algo
falta o no cumple.

**Cargarlos sin que el valor pase por el historial del shell** (usar CloudShell o una terminal
propia; ninguna línea de abajo contiene el valor):

```bash
# Secretos generados al azar: el valor nunca se imprime ni queda en el historial.
for nombre in JWT_SECRET POSTGRES_PASSWORD; do
  aws ssm put-parameter --region us-east-1 --name "/reservas/prod/$nombre" --type SecureString \
    --value "$(openssl rand -base64 48 | tr '+/' '-_' | tr -d '=\n')"
done

# Valores que elige una persona: se leen sin eco.
read -rsp "Contraseña del admin (16+ caracteres): " ADMIN_PW; echo
aws ssm put-parameter --region us-east-1 --name /reservas/prod/ADMIN_PASSWORD --type SecureString --value "$ADMIN_PW"
unset ADMIN_PW

read -rp "Email del admin: " ADMIN_MAIL
aws ssm put-parameter --region us-east-1 --name /reservas/prod/ADMIN_EMAIL --type SecureString --value "$ADMIN_MAIL"
unset ADMIN_MAIL

aws ssm put-parameter --region us-east-1 --name /reservas/prod/config/SITE_ADDRESS --type String --value ':80'
```

Guardar la contraseña del admin en un gestor de contraseñas del equipo. Para cambiar un valor
más adelante se agrega `--overwrite`.

## 6. Documento SSM `reservas-desplegar`

El documento está versionado en [`deploy/ssm-desplegar.json`](../deploy/ssm-desplegar.json). Valida
cada parámetro (`sha`, `digestBackend`, `digestFrontend`, `modo`) **antes** de que lleguen a la
instancia y ejecuta únicamente `/opt/reservas/repo/deploy/desplegar.sh` con esos cuatro valores.

```bash
# Crear
aws ssm create-document --region us-east-1 --name reservas-desplegar \
  --document-type Command --document-format JSON --content file://deploy/ssm-desplegar.json

# Actualizar (solo si cambia deploy/ssm-desplegar.json en el repositorio)
aws ssm update-document --region us-east-1 --name reservas-desplegar \
  --document-format JSON --content file://deploy/ssm-desplegar.json --document-version '$LATEST'
aws ssm update-document-default-version --region us-east-1 --name reservas-desplegar \
  --document-version <NUEVA-VERSION>
```

El script `desplegar.sh` no necesita actualizarse a mano: cada despliegue hace `git fetch` y
`checkout` del commit que se despliega.

## 7. GitHub: environment `produccion`

Settings → Environments → **New environment** → `produccion`:

- **Deployment branches:** *Selected branches* → solo `main`. Así ninguna otra rama puede usar
  este environment (y, por la política de confianza, tampoco asumir el rol).
- **Variables** (no son secretos, pero tampoco hace falta publicarlas fuera del environment):

| Variable | Valor |
|---|---|
| `AWS_ROLE_ARN` | ARN del rol `reservas-github-despliegue` |
| `AWS_REGION` | `us-east-1` |
| `INSTANCE_ID` | ID de la instancia (`i-...`) |

Sin estas variables, el job `desplegar` termina en error con un mensaje claro y el CI no se ve
afectado.

Los paquetes de GHCR (`reservas-backend` y `reservas-frontend`) se crean con el primer
despliegue. Las imágenes no llevan secretos y el código ya es público, así que se pueden dejar
públicas: de lo contrario, la instancia necesitaría credenciales para descargarlas. Después del
primer despliegue: perfil de la organización o usuario → Packages → cada paquete → *Package
settings* → *Change visibility* → Public.

## 8. Primer despliegue

Precondición: el PR de implementación está mergeado en `main` (así `cd.yml` y `desplegar.sh`
existen en `main`).

1. Actions → **CD** → *Run workflow* → `sha` = SHA completo de `main` (40 caracteres en
   minúscula), `modo` = `despliegue`.
2. Esperar el verde. El resumen del job muestra el modo, el SHA y los digests desplegados.
3. Abrir `http://<IP-elástica>/` **desde una IP del equipo**: se ve la aplicación.
4. Hacer las verificaciones de las tareas 6.2 a 6.5 del change (superficie desde afuera,
   credenciales, límites del rol, despliegue automático y reinicio).

Desde ahí, cada commit verde de `main` se despliega solo. Si llegan varios seguidos, GitHub deja
una sola ejecución en espera y se despliega el más reciente (no cada commit intermedio).

### Qué hace el despliegue si algo falla

`desplegar.sh` toma nota de la versión que está sirviendo y, ante cualquier fallo, vuelve a ella:

- falla la descarga de imágenes, la base o una migración → **no se levanta la versión nueva** y
  la anterior sigue atendiendo, sin reiniciar contenedores;
- la versión nueva no responde (`/` y `/api/zonas`, durante 90 s) → se vuelve a la versión
  anterior y el workflow termina en rojo con `VUELTA ATRÁS` en el log.

Las migraciones se escriben **compatibles hacia atrás** (agregar antes que renombrar o borrar):
la vuelta atrás levanta imágenes viejas sobre un esquema ya migrado. Si una migración no puede
serlo, el PR lo declara y se despliega con una vuelta atrás manual planificada.

### Vuelta atrás manual

Actions → **CD** → *Run workflow* → `sha` = SHA de una versión **que ya se desplegó con éxito**,
`modo` = `vuelta-atras`. No se reconstruye nada: la instancia usa los digests que registró en
`/opt/reservas/historial`, aunque el tag de GHCR se haya vuelto a publicar con otra imagen. Un SHA
que no figure en ese historial se rechaza.

Para ver qué versiones se pueden elegir y cuál está sirviendo (Session Manager, como root):

```bash
cat /opt/reservas/VERSION_ACTUAL      # versión que sirve ahora: sha, digest backend, digest frontend
cut -c1-40 /opt/reservas/historial    # SHAs desplegados con éxito, del más viejo al más nuevo
```

## 9. Backups y exportación de la base

**Snapshot diario del volumen** con Data Lifecycle Manager, con retención de **3 días** (son
incrementales, pero consumen créditos):

```bash
aws dlm create-default-role --resource-type snapshot   # una vez
aws dlm create-lifecycle-policy --region us-east-1 \
  --description "Snapshot diario de reservas-prod (3 dias)" \
  --state ENABLED \
  --execution-role-arn arn:aws:iam::<ID-DE-CUENTA>:role/AWSDataLifecycleManagerDefaultRole \
  --policy-details '{
    "PolicyType": "EBS_SNAPSHOT_MANAGEMENT",
    "ResourceTypes": ["VOLUME"],
    "TargetTags": [{"Key": "Backup", "Value": "reservas"}],
    "Schedules": [{
      "Name": "diario",
      "CreateRule": {"Interval": 24, "IntervalUnit": "HOURS", "Times": ["06:00"]},
      "RetainRule": {"Count": 3},
      "CopyTags": true
    }]
  }'
```

> La etiqueta `Backup=reservas` tiene que estar en el **volumen**, no solo en la instancia:
> la consola la copia a los volúmenes si se marca al crear la instancia; si no, etiquetar el
> volumen a mano.

**Exportar la base con `pg_dump`** (se usa **sí o sí antes del vencimiento del plan Free**, y
antes de cualquier cambio riesgoso). La base de un MVP es chica, así que se baja por SSM en
tramos. Desde una terminal con permisos de administrador (no el rol de GitHub):

```bash
INSTANCIA=<INSTANCE_ID>; REGION=us-east-1

ejecutar() {   # ejecutar "<comando>" -> imprime la salida estándar
  local id
  id=$(aws ssm send-command --region "$REGION" --instance-ids "$INSTANCIA" \
    --document-name AWS-RunShellScript --parameters "commands=[\"$1\"]" \
    --query Command.CommandId --output text)
  aws ssm wait command-executed --region "$REGION" --command-id "$id" --instance-id "$INSTANCIA"
  aws ssm get-command-invocation --region "$REGION" --command-id "$id" --instance-id "$INSTANCIA" \
    --query StandardOutputContent --output text
}

# 1. Generar el volcado comprimido en la instancia y ver cuánto pesa en base64
ejecutar "cd /opt/reservas && docker compose -f repo/deploy/docker-compose.prod.yml --env-file .env exec -T postgres pg_dump -U reservas reservas | gzip > /root/respaldo.sql.gz && base64 -w0 /root/respaldo.sql.gz > /root/respaldo.b64 && wc -c < /root/respaldo.b64"

# 2. Bajarlo en tramos de 20000 caracteres (SSM recorta la salida a ~24000)
TOTAL=<bytes que mostró el paso 1>; : > respaldo.b64
for ((desde = 1; desde <= TOTAL; desde += 20000)); do
  ejecutar "cut -c${desde}-$((desde + 19999)) /root/respaldo.b64" | tr -d '\n' >> respaldo.b64
done
base64 -d respaldo.b64 > respaldo.sql.gz && gunzip -t respaldo.sql.gz && echo "respaldo OK"

# 3. Borrar los archivos temporales de la instancia
ejecutar "shred -u /root/respaldo.sql.gz /root/respaldo.b64"
```

Guardar `respaldo.sql.gz` fuera del repositorio (contiene datos de contacto de las reservas).
Para restaurarlo en una base vacía: `gunzip -c respaldo.sql.gz | docker compose ... exec -T postgres psql -U reservas reservas`.

## 10. Activar HTTPS con el subdominio de la docente

1. Pasarle a la docente la **IP elástica** para que cree el registro `A` del subdominio.
2. Esperar a que resuelva: `dig +short <subdominio>` tiene que devolver esa IP.
3. **Abrir el security group** a `0.0.0.0/0` en 80 y 443. Let's Encrypt valida desde direcciones
   que no se publican, así que el 80 tiene que estar abierto a todos para emitir y renovar el
   certificado (también sirve para la redirección a HTTPS).
4. Cambiar el parámetro y redesplegar:
   ```bash
   aws ssm put-parameter --region us-east-1 --name /reservas/prod/config/SITE_ADDRESS \
     --type String --value '<subdominio>' --overwrite
   ```
   Después, redesplegar la versión que ya está sirviendo para que se relea el parámetro: Actions →
   **CD** → *Run workflow* con ese mismo SHA (`cat /opt/reservas/VERSION_ACTUAL`) y
   `modo=vuelta-atras`. En `modo=despliegue` el script lo descarta como "versión superada" y no
   cambia nada; la vuelta atrás al mismo SHA sí rehace el `.env` con el `SITE_ADDRESS` nuevo y
   recrea Caddy. (Cualquier merge nuevo a `main` también lo aplica.)
5. **Rotar la contraseña del admin** (sección 11): pudo haber viajado en claro en la etapa HTTP.
6. Crear la variable de **repositorio** `SUBDOMINIO` (Settings → Secrets and variables → Actions →
   Variables) con el nombre del subdominio, y correr una vez **Certificado** a mano: con ella, el
   workflow `certificado.yml` revisa todos los días que el certificado sea válido y tenga 21 días
   o más.
7. Verificar:
   ```bash
   curl -I https://<subdominio>/            # 200, certificado válido (sin -k) y Strict-Transport-Security
   curl -I http://<subdominio>/reservas     # redirección permanente a https
   ```
8. Actualizar la tabla **Estado actual** de este documento a **HTTPS** y quitar la restricción de
   IPs del security group de la etapa HTTP (ya hecho en el paso 3).

Caddy guarda el certificado en el volumen `caddy_data`, que se conserva entre despliegues y
reinicios: no pide uno nuevo cada vez.

### Si el DNS falla o el subdominio deja de resolver

Caddy sigue reintentando la emisión y el sitio no responde por HTTPS hasta lograrlo. Para volver
a la IP **sin dejar el login en claro abierto a internet**, en este orden:

1. **Primero** restringir otra vez el security group a las IPs del equipo (revocar `0.0.0.0/0` en
   80 y 443 y volver a autorizar las IPs `/32`).
2. Después volver a `SITE_ADDRESS=:80` (`put-parameter ... --value ':80' --overwrite`) y
   redesplegar la versión actual con `modo=vuelta-atras`, como en el paso 4.
3. Reintentar la activación cuando el DNS resuelva.

Volver a `:80` sin restringir antes el security group dejaría el login del admin en claro
expuesto a toda internet.

## 11. Rotar la contraseña del admin

El seed de producción **no pisa** la contraseña de un admin que ya existe: un despliegue nunca
cambia credenciales sin aviso. Rotarla es un procedimiento manual. En Session Manager, como root:

```bash
cd /opt/reservas
read -rsp "Nueva contraseña (16+ caracteres): " NUEVA_PASSWORD; echo; export NUEVA_PASSWORD
ADMIN_EMAIL=$(aws ssm get-parameter --region us-east-1 --name /reservas/prod/ADMIN_EMAIL \
  --with-decryption --query Parameter.Value --output text); export ADMIN_EMAIL

docker compose -f repo/deploy/docker-compose.prod.yml --env-file .env run --rm -T \
  -e NUEVA_PASSWORD -e ADMIN_EMAIL backend node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
(async () => {
  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash(process.env.NUEVA_PASSWORD, 10);
  await prisma.usuario.update({ where: { email: process.env.ADMIN_EMAIL }, data: { passwordHash } });
  await prisma.\$disconnect();
  console.log('Contraseña del admin actualizada.');
})().catch((e) => { console.error(e.message); process.exit(1); });
"

# Dejar el parámetro de SSM coherente con la base (el seed lo ignora si el admin existe)
aws ssm put-parameter --region us-east-1 --name /reservas/prod/ADMIN_PASSWORD --type SecureString \
  --value "$NUEVA_PASSWORD" --overwrite
unset NUEVA_PASSWORD ADMIN_EMAIL
```

Verificar: login con la contraseña vieja → `401`; con la nueva → `200`. Los tokens ya emitidos
siguen valiendo hasta que vencen (60 minutos); rotar también `JWT_SECRET` (con `--overwrite` y un
redespliegue) los invalida de inmediato. Guardar la contraseña nueva en el gestor del equipo.

## 12. Etapa transitoria en HTTP

> **Riesgo aceptado, transitorio.** Mientras el subdominio no apunte a la instancia, producción
> se sirve por **HTTP** en la IP elástica. En esa etapa viajan **sin cifrar** las credenciales
> del admin, el JWT y los datos de contacto de las reservas.

Alcance y mitigaciones:

- **No se cargan datos reales** de clientes: solo datos de prueba.
- El security group admite **solo las IPs del equipo**; un tercero fuera de ellas no llega ni al
  puerto 80.
- El admin **no inicia sesión desde redes públicas** (Wi-Fi de bares, datos compartidos, etc.).
- La contraseña del admin es única y de 16 caracteres o más; el JWT dura 60 minutos.
- La etapa dura solo hasta que la docente configure el DNS. Activar HTTPS es un cambio de
  configuración (sección 10) y obliga a rotar la contraseña del admin.
- En esta etapa Caddy **no** envía `Strict-Transport-Security`.

Para saber en qué etapa está producción, mirar la tabla **Estado actual** al principio de este
documento.

## 13. Apagar y eliminar todo al terminar la cursada

Antes: **exportar la base** (sección 9) si hace falta conservarla.

```bash
# Detener (la instancia deja de cobrar cómputo; el disco y la IP sí siguen contando)
aws ec2 stop-instances --region us-east-1 --instance-ids <INSTANCE_ID>

# Eliminar todo
aws ec2 terminate-instances --region us-east-1 --instance-ids <INSTANCE_ID>
aws ec2 release-address --region us-east-1 --allocation-id <ALLOCATION_ID>   # una IP elástica suelta se cobra
aws dlm delete-lifecycle-policy --region us-east-1 --policy-id <POLICY_ID>
aws ec2 describe-snapshots --region us-east-1 --owner-ids self                # borrar cada uno con delete-snapshot
aws ec2 delete-security-group --region us-east-1 --group-id "$SG"
aws ssm delete-document --region us-east-1 --name reservas-desplegar
aws ssm delete-parameters --region us-east-1 --names /reservas/prod/JWT_SECRET \
  /reservas/prod/POSTGRES_PASSWORD /reservas/prod/ADMIN_EMAIL /reservas/prod/ADMIN_PASSWORD \
  /reservas/prod/config/SITE_ADDRESS
```

Después, en IAM: borrar el rol `reservas-github-despliegue`, el rol y el perfil `reservas-instancia`
y el proveedor OIDC de GitHub; en GitHub: borrar el environment `produccion` y la variable
`SUBDOMINIO`; en Budgets: dejar la alerta hasta confirmar que el gasto es cero. Avisarle a la
docente que el registro DNS del subdominio ya no se usa.

Para pausar sin borrar, también se puede deshabilitar el workflow **CD** desde GitHub: la
instancia sigue sirviendo la última versión.

## 14. Probar `desplegar.sh` sin AWS (tarea 5.2)

El script acepta dos variables solo para pruebas locales: `RESERVAS_RAIZ` (en lugar de
`/opt/reservas`) y `RESERVAS_REGISTRO` (en lugar de `ghcr.io/<owner>`). Con una máquina o una VM
con Docker, un clon de prueba en `$RESERVAS_RAIZ/repo` y un remoto de prueba, se puede ejercitar
el flujo completo: despliegue sano, vuelta atrás automática, versión superada, vuelta atrás
manual y migración rota. En la instancia **no se definen**.

## Referencia: recursos que usa el sistema

| Recurso | Lo usa | Sección |
|---|---|---|
| Proveedor OIDC de GitHub, rol `reservas-github-despliegue` | `cd.yml` (`configure-aws-credentials`) | 3.1, 3.2 |
| Perfil `reservas-instancia` | `desplegar.sh` (lee `/reservas/prod/*`) y el agente de SSM | 3.3 |
| Documento SSM `reservas-desplegar` | `cd.yml` (`aws ssm send-command`) | 6 |
| Parámetros `/reservas/prod/*` | `desplegar.sh` (`get-parameters-by-path`) | 5 |
| Environment `produccion` y sus variables (`AWS_ROLE_ARN`, `AWS_REGION`, `INSTANCE_ID`) | `cd.yml`, job `desplegar` | 7 |
| Variable de repositorio `SUBDOMINIO` | `certificado.yml` | 10 |
| `/opt/reservas/repo`, `.env`, `VERSION_ACTUAL`, `historial`, `desplegar.lock` | `desplegar.sh` | 4.1, 8 |
| Paquetes `reservas-backend` y `reservas-frontend` en GHCR | job `imagenes` y `docker-compose.prod.yml` | 7 |
| Security group `reservas-prod`, IP elástica | Caddy (80 y 443) | 2 |
| Política de snapshots (DLM) | respaldo del volumen | 9 |
