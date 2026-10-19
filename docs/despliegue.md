# Despliegue en producción (AWS EC2)

Runbook del change `despliegue-continuo-ec2` (decisiones en
[`openspec/changes/despliegue-continuo-ec2/design.md`](../openspec/changes/despliegue-continuo-ec2/design.md)).
Sigue la *Guía Orientadora: Despliegue Continuo (CD) en Monorepo con GitHub Actions, SSH, Docker
Compose y Caddy* de la cátedra. Todo lo que sigue se hace **una sola vez**, a mano. Después, cada
commit verde de `main` se despliega solo.

> Este repositorio es **público**. Acá no se anota ningún identificador de la cuenta (ID de
> cuenta, IP elástica, ID de instancia, claves): se escriben como `<...>` y los valores reales
> viven en AWS, en el `.env` del servidor y en los secrets del environment `produccion` de GitHub.

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
                                      └─ desplegar (ssh deploy@servidor "<sha> <digests> <modo>")
                                                          │
                                       servidor Ubuntu   ▼
                  clave con comando forzado ─> /opt/reservas/deploy/ssh-entrada.sh
                    (valida el pedido) ─> sudo /opt/reservas/deploy/desplegar.sh
                                  └─ lee /opt/reservas/.env, migra, carga el seed, levanta
                                     Compose y comprueba (si falla, vuelve a la versión
                                     que estaba sirviendo)
```

- **Un solo servicio público:** Caddy, en los puertos 80 y 443. PostgreSQL, backend y frontend
  corren en el mismo servidor y no publican puertos. Caddy está **dentro del Compose**: no se
  instala Nginx ni Certbot en el sistema operativo.
- **Imágenes construidas en Actions** y publicadas en GHCR por digest: el servidor solo las
  descarga (una `t3.micro` con 1 GB no alcanza para compilar Next.js).
- **SSH expuesto, pero acotado.** El puerto 22 está abierto a internet porque los runners de
  GitHub no tienen IP fija. Lo compensan: solo claves (sin contraseña), sin `root`, una clave
  **dedicada** cuyo único permiso es el comando forzado `ssh-entrada.sh` (sin shell, sin pty, sin
  reenvíos), un pedido validado con expresiones regulares, y un `sudo` limitado a un único script.
- **Los secretos viven en `/opt/reservas/.env`** del servidor (de root, modo 600), no en GitHub.
  En GitHub solo está la clave privada de despliegue y los datos de conexión.

## 1. Cuenta y control de costos

1. **Root:** se usa solo para crear la cuenta. Activarle **MFA** y no crearle claves de acceso.
2. **Usuarios IAM:** cada integrante usa su propio usuario IAM, **con MFA**.
3. **No usar AWS Organizations ni IAM Identity Center.** Unirse a Organizations pasa una cuenta
   del plan Free al plan pago de forma automática.
4. **Presupuesto (Budgets):** crear un presupuesto mensual bajo (por ejemplo, USD 5) con aviso
   por correo al **50 %** y al **80 %** del monto. Consola → Billing → Budgets.
5. **Plan Free:** anotar arriba el **saldo de créditos** y la **fecha de vencimiento del plan**, y
   compararla con la fecha de entrega del TP. Cuando el plan vence, la cuenta se cierra y a los
   90 días se borran los datos: **antes de esa fecha hay que exportar la base**
   (ver [Backups](#8-backups-y-exportación-de-la-base)).
6. Estimar el consumo mensual con la AWS Pricing Calculator: `t3.micro` + EBS `gp3` de 20 GB +
   IPv4 pública + snapshots. Si no entra en los créditos o en los límites gratuitos hasta el fin
   de la cursada, **frenar y decidirlo con el equipo** (tarea 1.3).

### Región

`us-east-1`: es de las de menor precio, así que rinde más los créditos. Desde Argentina tiene
más latencia que `sa-east-1` (São Paulo), pero alcanza para un MVP. En los comandos de abajo,
reemplazar `us-east-1` si se elige otra.

## 2. Red: security group e IP elástica

**Security group** `reservas-prod` (en la VPC por defecto):

| Sentido | Protocolo y puerto | Origen | Cuándo |
|---|---|---|---|
| Entrada | TCP 22 | `0.0.0.0/0` | Siempre (despliegue desde Actions y administración) |
| Entrada | TCP 80 y 443 | IPs públicas del equipo (`/32` cada una) | Etapa HTTP |
| Entrada | TCP 80 y 443 | `0.0.0.0/0` | Etapa HTTPS |
| Salida | todo | `0.0.0.0/0` | Siempre (imágenes, paquetes, Let's Encrypt) |

**Sin** entrada al 5432, 3000 ni 3001.

**Por qué el 22 está abierto a todos:** los runners de GitHub Actions salen de rangos que cambian
y suman miles de bloques CIDR (más que el límite de reglas de un security group), así que no se
puede listar su origen. El riesgo se acota en el servidor (sección 4.5): autenticación solo por
clave, sin `root`, clave de despliegue con comando forzado y `fail2ban`. Si el equipo prefiere
cerrar el 22 fuera de las ventanas de despliegue, se puede abrir y cerrar a mano, pero el CD
automático dejaría de andar mientras esté cerrado.

```bash
SG=$(aws ec2 create-security-group --region us-east-1 --group-name reservas-prod \
  --description "Sistema de reservas: SSH, HTTP y HTTPS" --query GroupId --output text)

aws ec2 authorize-security-group-ingress --region us-east-1 --group-id "$SG" \
  --protocol tcp --port 22 --cidr 0.0.0.0/0

# Etapa HTTP: una pasada por cada IP del equipo (consultar la propia en https://checkip.amazonaws.com).
for puerto in 80 443; do
  aws ec2 authorize-security-group-ingress --region us-east-1 --group-id "$SG" \
    --protocol tcp --port "$puerto" --cidr <IP-DEL-INTEGRANTE>/32
done
```

**Actualizar las IPs del equipo** (las IPs domésticas cambian): agregar la nueva con el mismo
`authorize-security-group-ingress` y quitar la vieja con `revoke-security-group-ingress`.

**IP elástica**, para que la URL no cambie al reiniciar la instancia:

```bash
aws ec2 allocate-address --region us-east-1 --domain vpc   # anotar AllocationId
# después de lanzar la instancia (sección 3):
aws ec2 associate-address --region us-east-1 --instance-id <INSTANCE_ID> --allocation-id <ALLOCATION_ID>
```

## 3. La instancia

Consola → EC2 → Lanzar instancia (o `run-instances`):

| Parámetro | Valor |
|---|---|
| AMI | **Ubuntu Server 24.04 LTS** (amd64) |
| Tipo | `t3.micro` |
| Par de claves | uno nuevo de AWS (`.pem`), solo para la administración; guardarlo en el gestor del equipo |
| Créditos de CPU | **`standard`** (en `unlimited`, el uso sostenido por encima de la línea base se cobra aparte) |
| Disco | EBS `gp3` de 20 GB, **cifrado** |
| Security group | `reservas-prod` |
| Perfil de instancia | **ninguno** (el servidor no usa la API de AWS) |
| Metadatos | IMDSv2 **obligatorio** |
| Etiqueta | `Backup=reservas` (la usa la política de snapshots) |

```bash
aws ec2 run-instances --region us-east-1 \
  --image-id <AMI-UBUNTU-24.04> --instance-type t3.micro --key-name <PAR-DE-CLAVES> \
  --security-group-ids "$SG" \
  --credit-specification CpuCredits=standard \
  --metadata-options HttpTokens=required,HttpEndpoint=enabled \
  --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=20,VolumeType=gp3,Encrypted=true}' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=reservas-prod},{Key=Backup,Value=reservas}]'
```

Asociar la IP elástica (sección 2) y anotar la IP: es `SERVER_HOST`.

## 4. Preparar el servidor (una vez)

Conectarse con el par de claves de AWS: `ssh -i clave.pem ubuntu@<IP-ELASTICA>`.

### 4.1 Sistema y Docker

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip ca-certificates

# Docker con el script oficial (incluye el plugin de Compose)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh && rm get-docker.sh
sudo usermod -aG docker ubuntu          # solo el usuario administrador; ver nota
docker --version && docker compose version   # (reconectarse para que tome el grupo)

# Swap de 2 GB: un pico de memoria se resuelve con swap y no matando PostgreSQL
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

> **Nota:** pertenecer al grupo `docker` equivale a ser `root`. Por eso lo tiene `ubuntu`
> (administración) y **no** el usuario `deploy` de abajo, que solo puede ejecutar un script.

### 4.2 Clonar el repositorio en `/opt/reservas`

Se clona **con el punto final**, para que los archivos queden directamente en `/opt/reservas` y
no en `/opt/reservas/Restaurante-MVP-Trabajo-Practico`. Lo clona root: así el repositorio y los
scripts son de root y el usuario `deploy` puede ejecutarlos pero no modificarlos.

```bash
sudo mkdir -p /opt/reservas && cd /opt/reservas
sudo git clone https://github.com/<OWNER>/Restaurante-MVP-Trabajo-Practico.git .
sudo chmod 755 /opt/reservas
ls /opt/reservas/deploy/desplegar.sh /opt/reservas/deploy/ssh-entrada.sh   # existen y son ejecutables
```

### 4.3 Variables de entorno: `/opt/reservas/.env`

Es el equivalente de `.env.production` de la guía. Lo lee `desplegar.sh` en cada despliegue y
**exige** que sea de root y de modo 600. Se genera sin que los secretos pasen por el historial del
shell ni se impriman:

```bash
sudo bash -c '
umask 077
read -rp "Email del admin de producción: " ADMIN_MAIL
read -rsp "Contraseña del admin (16+ caracteres, única): " ADMIN_PW; echo
{
  echo "JWT_SECRET=$(openssl rand -base64 48 | tr "+/" "-_" | tr -d "=\n")"
  echo "POSTGRES_PASSWORD=$(openssl rand -base64 48 | tr "+/" "-_" | tr -d "=\n")"
  echo "ADMIN_EMAIL=$ADMIN_MAIL"
  echo "ADMIN_PASSWORD=$ADMIN_PW"
  echo "SITE_ADDRESS=:80"
} > /opt/reservas/.env
'
sudo chown root:root /opt/reservas/.env && sudo chmod 600 /opt/reservas/.env
sudo ls -l /opt/reservas/.env      # -rw------- root root
```

| Variable | Formato |
|---|---|
| `JWT_SECRET` | 32 caracteres o más, solo `A-Za-z0-9_-` |
| `POSTGRES_PASSWORD` | 24 caracteres o más, solo `A-Za-z0-9_-` (va dentro de una URL) |
| `ADMIN_EMAIL` | email del admin de producción (no el del README) |
| `ADMIN_PASSWORD` | 16 caracteres o más, única, no la del README |
| `SITE_ADDRESS` | `:80` en la etapa HTTP; el subdominio en la etapa HTTPS (sección 9) |

Hay una plantilla de referencia en [`deploy/env.produccion.example`](../deploy/env.produccion.example).
`desplegar.sh` valida estos formatos y corta con un mensaje claro si algo falta. **Guardar la
contraseña del admin en el gestor de contraseñas del equipo.**

### 4.4 Usuario `deploy`, clave SSH y `sudo`

**La clave se genera en tu computadora, no en el servidor**, así la clave privada nunca queda
guardada en el servidor (la guía la genera en el servidor; esto es equivalente y más estricto).

En tu computadora (Git Bash, WSL o Linux/macOS):

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ./github_actions_cd -N ""
cat ./github_actions_cd.pub       # clave PÚBLICA: va al servidor (paso siguiente)
# La clave PRIVADA (./github_actions_cd) va al secret SSH_PRIVATE_KEY (sección 5) y después se borra.
```

En el servidor:

```bash
# Usuario sin contraseña y sin grupo docker
sudo adduser --disabled-password --gecos "" deploy
sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh

# Autorizar la clave pública con comando forzado. UNA sola línea; pegar la clave pública real
sudo tee /home/deploy/.ssh/authorized_keys > /dev/null <<'EOF'
command="/opt/reservas/deploy/ssh-entrada.sh",restrict ssh-ed25519 AAAA...pegar-la-clave-publica... github-actions-deploy
EOF
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys

# sudo: solo desplegar.sh, sin contraseña
echo 'deploy ALL=(root) NOPASSWD: /opt/reservas/deploy/desplegar.sh' | sudo tee /etc/sudoers.d/reservas-deploy
sudo chmod 440 /etc/sudoers.d/reservas-deploy
sudo visudo -cf /etc/sudoers.d/reservas-deploy      # tiene que decir "parsed OK"
```

`restrict` desactiva pty, reenvío de puertos, de agente y de X11. Con `command=` el servidor
ignora lo que el cliente pida ejecutar: solo corre `ssh-entrada.sh`, que valida el pedido.

### 4.5 Endurecer SSH

```bash
sudo tee /etc/ssh/sshd_config.d/60-reservas.conf > /dev/null <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
X11Forwarding no
AllowUsers ubuntu deploy
MaxAuthTries 3
LoginGraceTime 20
EOF
sudo sshd -t && sudo systemctl reload ssh     # SIN cerrar la sesión actual hasta probar otra

sudo apt install -y fail2ban && sudo systemctl enable --now fail2ban
```

Abrir **otra** terminal y comprobar que `ssh -i clave.pem ubuntu@<IP>` sigue entrando antes de
cerrar la primera. Comprobar también que con contraseña no se puede
(`ssh -o PubkeyAuthentication=no ubuntu@<IP>` → `Permission denied (publickey)`).

### 4.6 Probar la clave de despliegue

Desde tu computadora (todavía con `github_actions_cd` a mano):

```bash
ssh -i ./github_actions_cd deploy@<IP-ELASTICA> "uno dos"     # rechazado: "pedido rechazado", código 2
ssh -i ./github_actions_cd deploy@<IP-ELASTICA>               # rechazado: no llegó ningún pedido
ssh -i ./github_actions_cd deploy@<IP-ELASTICA> bash          # rechazado: nunca abre una shell
```

Si abre una shell, el comando forzado no quedó bien en `authorized_keys`: **no seguir**.

## 5. GitHub: environment `produccion` y secrets

Settings → Environments → **New environment** → `produccion`:

- **Deployment branches:** *Selected branches* → solo `main`. Así ninguna otra rama puede usar
  este environment ni sus secrets.
- **Environment secrets** (Settings → Environments → produccion → Add secret):

| Secret | Valor |
|---|---|
| `SERVER_HOST` | IP elástica del servidor (o el subdominio, cuando exista) |
| `SERVER_USER` | `deploy` |
| `SERVER_PORT` | `22` |
| `SSH_PRIVATE_KEY` | contenido completo de `github_actions_cd` (la clave **privada**, con las líneas `BEGIN` y `END`) |
| `SSH_KNOWN_HOSTS` | salida de `ssh-keyscan` (abajo) |

`SSH_KNOWN_HOSTS` hace que el workflow verifique la identidad del servidor
(`StrictHostKeyChecking=yes`) en lugar de confiar en la primera conexión. Obtenerlo así, y
**comparar la huella** con la del servidor antes de guardarlo, para no registrar la clave de un
intermediario:

```bash
ssh-keyscan -t ed25519 -p 22 <IP-ELASTICA> 2>/dev/null | tee known_hosts.txt
ssh-keygen -lf known_hosts.txt                                       # huella que ve el cliente
ssh -i clave.pem ubuntu@<IP-ELASTICA> 'ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub'   # huella del servidor: tienen que coincidir
```

Cuando los cinco secrets estén cargados, **borrar la clave privada de tu computadora**
(`shred -u github_actions_cd` o borrarla y vaciar la papelera). Sin los secrets, el job
`desplegar` termina en error con un mensaje claro y el CI no se ve afectado.

Los paquetes de GHCR (`reservas-backend` y `reservas-frontend`) se crean con el primer
despliegue. Las imágenes no llevan secretos y el código ya es público, así que se pueden dejar
públicas: de lo contrario, el servidor necesitaría credenciales para descargarlas. Después del
primer despliegue: perfil de la organización o usuario → Packages → cada paquete → *Package
settings* → *Change visibility* → Public.

## 6. Dominio

Pedirle a la docente (Ivana) un **subdominio** y que lo apunte a la IP elástica (registro `A`).
Mientras tanto, producción corre en la etapa HTTP (sección 11). La activación de HTTPS es la
sección 9.

## 7. Primer despliegue y pruebas

Precondición: el PR de implementación está mergeado en `main` (así `cd.yml` y los scripts existen
en `main`).

1. Actions → **CD** → *Run workflow* → `sha` = SHA completo de `main` (40 caracteres en
   minúscula), `modo` = `despliegue`.
2. Esperar el verde. El resumen del job muestra el modo, el SHA y los digests desplegados.
3. Abrir `http://<IP-elástica>/` **desde una IP del equipo**: se ve la aplicación.
4. Hacer las verificaciones de las tareas 6.2 a 6.5 del change (superficie desde afuera,
   credenciales, despliegue automático y reinicio).
5. **Probar el despliegue automático:** mergear un cambio chico a `main`, esperar el CI y mirar
   la corrida de **CD** en la pestaña Actions.

Desde ahí, cada commit verde de `main` se despliega solo. Si llegan varios seguidos, GitHub deja
una sola ejecución en espera y se despliega el más reciente (no cada commit intermedio).

### Qué hace el despliegue si algo falla

`desplegar.sh` toma nota de la versión que está sirviendo y, ante cualquier fallo, vuelve a ella:

- falla la descarga de imágenes, la base o una migración → **no se levanta la versión nueva** y
  la anterior sigue atendiendo, sin reiniciar contenedores;
- la versión nueva no responde (`/` y `/api/zonas`, durante 90 s) → se vuelve a la versión
  anterior y el workflow termina en rojo con `VUELTA ATRÁS` en el log.

Errores de conexión en el job `desplegar`: «No se pudo conectar o la clave del servidor no
coincide» → revisar el security group (puerto 22), `SERVER_HOST` y `SSH_KNOWN_HOSTS` (si se
recreó la instancia cambió su clave de host); «El servidor rechazó el pedido» → el formato del
pedido no es el esperado (versión de `cd.yml` distinta de la de `ssh-entrada.sh`).

Las migraciones se escriben **compatibles hacia atrás** (agregar antes que renombrar o borrar):
la vuelta atrás levanta imágenes viejas sobre un esquema ya migrado.

### Vuelta atrás manual

Actions → **CD** → *Run workflow* → `sha` = SHA de una versión **que ya se desplegó con éxito**,
`modo` = `vuelta-atras`. No se reconstruye nada: el servidor usa los digests que registró en
`/opt/reservas/.despliegue/historial`, aunque el tag de GHCR se haya vuelto a publicar con otra
imagen. Un SHA que no figure en ese historial se rechaza.

Para ver qué versiones se pueden elegir y cuál está sirviendo (como `ubuntu`):

```bash
sudo cat /opt/reservas/.despliegue/VERSION_ACTUAL      # sirve ahora: sha, digest backend, digest frontend
sudo cut -c1-40 /opt/reservas/.despliegue/historial    # SHAs desplegados con éxito, del más viejo al más nuevo
```

## 8. Backups y exportación de la base

**Snapshot diario del volumen** con Data Lifecycle Manager, con retención de **3 días**:

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

> La etiqueta `Backup=reservas` tiene que estar en el **volumen**, no solo en la instancia: la
> consola la copia si se marca al crear la instancia; si no, etiquetar el volumen a mano.

**Exportar la base con `pg_dump`** (**sí o sí antes del vencimiento del plan Free**, y antes de
cualquier cambio riesgoso). Desde tu computadora, por SSH como `ubuntu`:

```bash
ssh -i clave.pem ubuntu@<IP-ELASTICA> \
  'cd /opt/reservas && sudo docker compose -f deploy/docker-compose.prod.yml --env-file .despliegue/compose.env exec -T postgres pg_dump -U reservas reservas | gzip' \
  > respaldo.sql.gz
gunzip -t respaldo.sql.gz && echo "respaldo OK"
```

Guardar `respaldo.sql.gz` fuera del repositorio (contiene datos de contacto de las reservas).
Para restaurarlo en una base vacía: `gunzip -c respaldo.sql.gz | docker compose ... exec -T postgres psql -U reservas reservas`.

## 9. Activar HTTPS con el subdominio

1. Pasarle a la docente la **IP elástica** para que cree el registro `A` del subdominio.
2. Esperar a que resuelva: `dig +short <subdominio>` tiene que devolver esa IP.
3. **Abrir el security group** a `0.0.0.0/0` en 80 y 443. Let's Encrypt valida desde direcciones
   que no se publican, así que el 80 tiene que estar abierto a todos para emitir y renovar el
   certificado (también sirve para la redirección a HTTPS).
4. En el servidor, cambiar `SITE_ADDRESS` en `/opt/reservas/.env` (sin perder modo ni dueño):
   ```bash
   sudo sed -i 's/^SITE_ADDRESS=.*/SITE_ADDRESS=<subdominio>/' /opt/reservas/.env
   sudo ls -l /opt/reservas/.env      # sigue -rw------- root root
   ```
   Después, redesplegar la versión que ya está sirviendo para que se relea el archivo: Actions →
   **CD** → *Run workflow* con ese mismo SHA (`sudo cat /opt/reservas/.despliegue/VERSION_ACTUAL`)
   y `modo=vuelta-atras`. En `modo=despliegue` el script lo descarta como "versión superada" y
   no cambia nada; la vuelta atrás al mismo SHA sí rehace el env de Compose con el
   `SITE_ADDRESS` nuevo y recrea Caddy. (Cualquier merge nuevo a `main` también lo aplica.)
5. **Rotar la contraseña del admin** (sección 10): pudo haber viajado en claro en la etapa HTTP.
6. Opcional: usar el subdominio como `SERVER_HOST`, pero entonces regenerar `SSH_KNOWN_HOSTS`
   con `ssh-keyscan` sobre el nombre.
7. Crear la variable de **repositorio** `SUBDOMINIO` (Settings → Secrets and variables → Actions →
   Variables) con el nombre del subdominio, y correr una vez **Certificado** a mano: con ella, el
   workflow `certificado.yml` revisa todos los días que el certificado sea válido y tenga 21 días
   o más.
8. Verificar:
   ```bash
   curl -I https://<subdominio>/            # 200, certificado válido (sin -k) y Strict-Transport-Security
   curl -I http://<subdominio>/reservas     # redirección permanente a https
   ```
9. Actualizar la tabla **Estado actual** de este documento a **HTTPS**.

Caddy guarda el certificado en el volumen `caddy_data`, que se conserva entre despliegues y
reinicios: no pide uno nuevo cada vez.

### Si el DNS falla o el subdominio deja de resolver

Caddy sigue reintentando la emisión y el sitio no responde por HTTPS hasta lograrlo. Para volver
a la IP **sin dejar el login en claro abierto a internet**, en este orden:

1. **Primero** restringir otra vez el security group a las IPs del equipo en 80 y 443 (revocar
   `0.0.0.0/0` y volver a autorizar las IPs `/32`).
2. Después volver a `SITE_ADDRESS=:80` en `/opt/reservas/.env` y redesplegar la versión actual con
   `modo=vuelta-atras`, como en el paso 4.
3. Reintentar la activación cuando el DNS resuelva.

## 10. Rotación de secretos

En todos los casos, el valor se pide con `read -rs` para que no pase por el historial.

**Contraseña del admin.** El seed de producción **no pisa** la contraseña de un admin que ya
existe: un despliegue nunca cambia credenciales sin aviso. Se rota a mano, como `ubuntu`:

```bash
cd /opt/reservas
read -rsp "Nueva contraseña (16+ caracteres): " NUEVA_PASSWORD; echo; export NUEVA_PASSWORD
ADMIN_EMAIL=$(sudo sed -n 's/^ADMIN_EMAIL=//p' .env); export ADMIN_EMAIL

sudo -E docker compose -f deploy/docker-compose.prod.yml --env-file .despliegue/compose.env run --rm -T \
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

# Dejar el .env coherente con la base (el seed lo ignora si el admin existe)
sudo NUEVA_PASSWORD="$NUEVA_PASSWORD" bash -c 'sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$NUEVA_PASSWORD|" /opt/reservas/.env'
unset NUEVA_PASSWORD ADMIN_EMAIL
sudo ls -l /opt/reservas/.env      # sigue -rw------- root root
```

La contraseña nueva no puede llevar `|`, `&` ni `` (rompen el `sed` del paso anterior).

Verificar: login con la contraseña vieja → `401`; con la nueva → `200`. Los tokens ya emitidos
siguen valiendo hasta que vencen (60 minutos). Guardar la contraseña nueva en el gestor del equipo.

**`JWT_SECRET`.** Reemplazar la línea en `/opt/reservas/.env` por un valor nuevo
(`openssl rand -base64 48 | tr '+/' '-_' | tr -d '=\n'`) y redesplegar con `modo=vuelta-atras`
al mismo SHA: invalida de inmediato todas las sesiones.

**Clave SSH de despliegue.** Si se sospecha que se filtró: borrar la línea de
`/home/deploy/.ssh/authorized_keys` y el secret `SSH_PRIVATE_KEY` de inmediato; después generar un
par nuevo (sección 4.4) y cargar los dos lados.

**Contraseña de PostgreSQL.** No alcanza con cambiar el `.env`: la base ya fue inicializada con la
anterior. Cambiarla primero con `ALTER USER reservas PASSWORD '...'` desde `psql` dentro del
contenedor y recién después actualizar `POSTGRES_PASSWORD` y redesplegar.

## 11. Etapa transitoria en HTTP

> **Riesgo aceptado, transitorio.** Mientras el subdominio no apunte al servidor, producción
> se sirve por **HTTP** en la IP elástica. En esa etapa viajan **sin cifrar** las credenciales
> del admin, el JWT y los datos de contacto de las reservas.

Alcance y mitigaciones:

- **No se cargan datos reales** de clientes: solo datos de prueba.
- El security group admite **solo las IPs del equipo** en 80 y 443; un tercero fuera de ellas no
  llega al sitio. (El 22 sí está abierto: ver sección 2.)
- El admin **no inicia sesión desde redes públicas** (Wi-Fi de bares, datos compartidos, etc.).
- La contraseña del admin es única y de 16 caracteres o más; el JWT dura 60 minutos.
- La etapa dura solo hasta que la docente configure el DNS. Activar HTTPS es un cambio de
  configuración (sección 9) y obliga a rotar la contraseña del admin.
- En esta etapa Caddy **no** envía `Strict-Transport-Security`.

## 12. Apagar y eliminar todo al terminar la cursada

Antes: **exportar la base** (sección 8) si hace falta conservarla.

```bash
# Detener (la instancia deja de cobrar cómputo; el disco y la IP sí siguen contando)
aws ec2 stop-instances --region us-east-1 --instance-ids <INSTANCE_ID>

# Eliminar todo
aws ec2 terminate-instances --region us-east-1 --instance-ids <INSTANCE_ID>
aws ec2 release-address --region us-east-1 --allocation-id <ALLOCATION_ID>   # una IP elástica suelta se cobra
aws dlm delete-lifecycle-policy --region us-east-1 --policy-id <POLICY_ID>
aws ec2 describe-snapshots --region us-east-1 --owner-ids self                # borrar cada uno con delete-snapshot
aws ec2 delete-security-group --region us-east-1 --group-id "$SG"
aws ec2 delete-key-pair --region us-east-1 --key-name <PAR-DE-CLAVES>
```

Después, en GitHub: borrar el environment `produccion` (con sus secrets) y la variable
`SUBDOMINIO`; en Budgets: dejar la alerta hasta confirmar que el gasto es cero. Avisarle a la
docente que el registro DNS del subdominio ya no se usa.

Para pausar sin borrar, también se puede deshabilitar el workflow **CD** desde GitHub: el
servidor sigue sirviendo la última versión.

## 13. Probar `desplegar.sh` y `ssh-entrada.sh` sin AWS (tarea 5.2)

`desplegar.sh` acepta dos variables solo para pruebas locales: `RESERVAS_RAIZ` (en lugar de
`/opt/reservas`) y `RESERVAS_REGISTRO` (en lugar de `ghcr.io/<owner>`). Con una máquina o una VM
con Docker, un clon de prueba en `$RESERVAS_RAIZ`, un `.env` de root con modo 600 y un remoto de
prueba, se puede ejercitar el flujo completo: despliegue sano, vuelta atrás automática, versión
superada, vuelta atrás manual y migración rota.

`ssh-entrada.sh` acepta `RESERVAS_DESPLEGAR` (ruta de otro script) para probar la validación del
pedido sin `sudo`: con `SSH_ORIGINAL_COMMAND="<sha> - - vuelta-atras"` ejecuta ese script con los
cuatro argumentos, y con cualquier pedido mal formado sale con código 2 sin ejecutar nada. En el
servidor **ninguna de las dos variables se define**.

## Referencia: recursos que usa el sistema

| Recurso | Lo usa | Sección |
|---|---|---|
| Usuario `deploy`, `authorized_keys` con comando forzado, `/etc/sudoers.d/reservas-deploy` | `cd.yml` (job `desplegar`) | 4.4 |
| `deploy/ssh-entrada.sh` | comando forzado de la clave de despliegue | 4.4 |
| `/opt/reservas` (clon del repositorio, de root) | `desplegar.sh` | 4.2 |
| `/opt/reservas/.env` | `desplegar.sh` | 4.3 |
| `/opt/reservas/.despliegue/` (`compose.env`, `VERSION_ACTUAL`, `historial`, `desplegar.lock`) | `desplegar.sh` | 7 |
| Environment `produccion` y sus secrets (`SERVER_HOST`, `SERVER_USER`, `SERVER_PORT`, `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`) | `cd.yml`, job `desplegar` | 5 |
| Variable de repositorio `SUBDOMINIO` | `certificado.yml` | 9 |
| Paquetes `reservas-backend` y `reservas-frontend` en GHCR | job `imagenes` y `docker-compose.prod.yml` | 5 |
| Security group `reservas-prod`, IP elástica | SSH, Caddy (80 y 443) | 2 |
| Política de snapshots (DLM) | respaldo del volumen | 8 |
