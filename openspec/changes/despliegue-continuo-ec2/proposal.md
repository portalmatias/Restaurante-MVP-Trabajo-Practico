## Why

Hoy el sistema solo corre en la máquina de cada integrante: no hay un entorno accesible para
la docente ni para probar con usuarios reales, y cada merge a `main` termina en el CI sin
llegar a ningún lado. El equipo decidió sumar **despliegue continuo (CD)** a una instancia
**EC2 de AWS**, con todo el sistema en esa única máquina, para que cada cambio aprobado y con
CI en verde quede publicado sin pasos manuales.

Desplegar cambia el modelo de amenazas del proyecto. Hasta ahora, por decisión de
`exposicion-red-local`, todo escuchaba en loopback y los límites de solicitudes se contaban por
máquina. En internet aparecen cuatro riesgos que este change tiene que cerrar desde el diseño:

- credenciales que dan acceso a la cuenta de AWS o a la instancia;
- secretos de producción (JWT, base de datos, admin) que podrían terminar en el repositorio
  público o en las imágenes;
- el admin del seed, cuya contraseña figura en el README;
- límites de solicitudes que, sin un proxy de borde confiable, cualquiera podría agotar o
  saltear.

## What Changes

- **Despliegue monolítico en una EC2:** PostgreSQL, backend, frontend y un proxy de borde
  corren en la misma instancia, orquestados con Docker Compose. Solo el proxy publica un
  puerto (`80`). Base, backend y frontend quedan en una red interna de Docker.
- **Imágenes de contenedor versionadas:** GitHub Actions construye las imágenes de backend y
  frontend en cada push a `main`, las etiqueta con el SHA del commit y las publica en GitHub
  Container Registry. Las imágenes no contienen secretos.
- **Workflow de CD** (`.github/workflows/cd.yml`): corre solo cuando el CI terminó en verde
  sobre un push a `main`. Se autentica en AWS por OIDC, sin claves permanentes, con un rol que
  solo puede ejecutar el procedimiento de despliegue en esa instancia, vía SSM. No hay SSH.
- **Despliegue verificado con vuelta atrás:** la instancia descarga las imágenes del commit,
  aplica las migraciones, levanta la versión nueva y comprueba que responda. Si la
  comprobación falla, vuelve sola a la versión anterior.
- **Secretos en AWS SSM Parameter Store:** la instancia los lee con su propio rol al
  desplegar; nunca pasan por el repositorio, las imágenes ni los logs del workflow.
- **Seed de producción aparte:** carga zonas, mesas, turnos y configuración, pero no reservas
  de ejemplo. El admin se crea con email y contraseña de producción tomados de los secretos,
  **nunca** con las credenciales públicas del README.
- **IP real del cliente para los límites:** el proxy de borde sobrescribe `X-Forwarded-For` y
  el backend confía solo en el salto del frontend, usando el `TRUST_PROXY` que ya dejó
  preparado `exposicion-red-local`.
- **CI:** se suman los tests del frontend, porque ahora un merge a `main` llega a producción.
- **Runbook** para crear la infraestructura de AWS a mano, documentado en el repositorio con
  los permisos exactos.

### Riesgo aceptado: HTTP sin cifrar

El equipo no tiene todavía dominio ni certificado, y decidió desplegar en **HTTP plano**,
aceptando el riesgo. Con eso, el email y la contraseña del login de admin, el JWT y los datos
de contacto de las reservas viajan sin cifrar y pueden interceptarse en la red. El change
documenta el riesgo, lo mitiga en lo posible (contraseña de admin única y fuerte, JWT de vida
corta, encabezados de seguridad) y deja el paso a HTTPS en un único cambio de configuración.
**Antes de usar el sistema con datos reales de clientes hay que habilitar HTTPS.**

### AWS en el Tier gratuito (propuesta de la docente)

La docente propuso AWS dentro del **Tier gratuito**, así que el despliegue tiene que entrar en
sus límites. Desde el 15 de julio de 2025 hay dos regímenes, según la fecha de creación de la
cuenta:

- **Cuentas nuevas (plan Free):** reciben créditos (USD 100, más hasta USD 100 por actividades)
  que **se consumen** con la instancia, el disco, la IP pública y los snapshots. El plan dura 6
  meses o hasta agotar los créditos, lo que ocurra primero. Al terminar, **la cuenta se cierra
  sola**; AWS conserva los datos 90 días y después los borra, salvo que se pase al plan pago.
- **Cuentas anteriores:** tienen 750 horas por mes de `t2.micro`/`t3.micro` durante 12 meses.
  Lo que exceda esos límites se cobra al precio normal.

Para que sirva en los dos casos, el change elige recursos elegibles en ambos (`t3.micro`) y
mínimos en consumo, desactiva lo que puede generar cargos inesperados (modo *unlimited* de CPU
de las instancias `t3`) y suma una alerta de presupuesto. Además documenta la fecha de
vencimiento del plan y cómo exportar los datos antes. **Nada de este change puede requerir
pasar al plan pago.** Por ejemplo, no se usa AWS Organizations ni IAM Identity Center, porque
unirse a Organizations pasa la cuenta al plan pago de forma automática.

### Excepción a config.yaml §2

§2 prohíbe "servicios externos de pago". AWS se usa a propuesta de la docente, dentro del Tier
gratuito, y como infraestructura de despliegue, no como dependencia de la aplicación: el
sistema se sigue levantando en local sin AWS ni ninguna API key, y el repositorio no contiene
credenciales. El change actualiza `config.yaml` para registrar la excepción.

### Fuera de alcance

- HTTPS y dominio propio (queda preparado y documentado, no habilitado).
- Infraestructura como código (Terraform, CloudFormation): la infraestructura se crea a mano
  siguiendo el runbook.
- Alta disponibilidad, balanceador, autoescalado o RDS: el despliegue es de una sola instancia
  por decisión del equipo, y esos servicios agotarían el Tier gratuito.
- Mantener producción más allá del plazo del Tier gratuito: queda documentado qué hacer, pero
  la continuidad es una decisión del equipo para ese momento.
- Entornos de staging o de vista previa por PR.
- Monitoreo y alertas más allá de los logs de los contenedores.

## Capabilities

### New Capabilities
- `despliegue`: cuándo y cómo una versión de `main` llega a producción; qué superficie de red
  expone el servidor; dónde viven y cómo circulan los secretos; con qué datos iniciales y con
  qué credenciales de admin arranca producción; cómo se identifica al cliente para los límites
  de solicitudes; y cómo se vuelve a una versión anterior.

### Modified Capabilities
_Ninguna._ `exposicion-red` (todavía en el change `exposicion-red-local`, sin archivar) ya
prevé la confianza explícita en un proxy de borde. Este change la usa sin cambiar sus
requisitos. `auth-admin` y `reserva-consultar` mantienen sus límites "por origen", que en
producción pasan a contarse por la IP real.

## Impact

- **Contenedores:** `backend/Dockerfile` y `frontend/Dockerfile` nuevos, junto con
  `.dockerignore`. `frontend/next.config.ts` suma `output: "standalone"`.
- **Despliegue:** `deploy/docker-compose.prod.yml`, `deploy/Caddyfile` y
  `deploy/desplegar.sh` (script que corre en la instancia), además de un documento de SSM
  versionado en `deploy/`.
- **Backend:** seed de producción (`backend/prisma/seed-produccion.ts`) y extracción del
  catálogo compartido con el seed de desarrollo. La API, `openapi.yaml` y el schema de Prisma
  no cambian.
- **CI/CD:** `.github/workflows/cd.yml` nuevo. `ci.yml` suma los tests del frontend.
- **Variables de entorno:** `.env.example` documenta `ADMIN_EMAIL` y `ADMIN_PASSWORD`, que
  solo usa el seed de producción.
- **Documentación:** `docs/despliegue.md` (runbook de AWS, rollback, paso a HTTPS y riesgo de
  HTTP), README y `config.yaml` (§2, §4, §10, §12).
- **Dependencias npm:** ninguna nueva. **Imagen nueva:** Caddy como proxy de borde
  (justificado en `design.md`).
- **Costos:** dentro del Tier gratuito. En una cuenta del plan Free, la instancia, el disco,
  la IP pública y los snapshots consumen créditos; el consumo estimado se calcula antes de
  crear nada (tarea 1.3).
