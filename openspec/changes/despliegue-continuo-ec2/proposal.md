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
  corren en la misma instancia, orquestados con Docker Compose. Solo el proxy publica puertos
  (`80` y `443`, siempre). El `443` empieza a servir HTTPS cuando el subdominio apunta a la
  instancia. Base, backend y frontend quedan en una red interna de Docker, sin puertos
  publicados.
- **Imágenes de contenedor versionadas:** GitHub Actions construye las imágenes de backend y
  frontend en cada push a `main`, las etiqueta con el SHA del commit y las publica en GitHub
  Container Registry. Se despliegan por digest, así que una versión no cambia aunque alguien
  vuelva a publicar su tag. Las imágenes no contienen secretos.
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

### HTTPS con un subdominio de la docente (HTTP solo como etapa transitoria)

La docente va a proveer un **subdominio** que apuntará a la IP elástica de la instancia, en
cuanto se la pasemos. Con el nombre apuntado, el proxy de borde obtiene y renueva solo un
certificado de Let's Encrypt, y producción se sirve **por HTTPS**: HTTP queda solo para
redirigir y para el desafío de validación del certificado.

Entre que existe la instancia y la docente configura el DNS, producción responde por **HTTP
plano en la IP**. El equipo acepta ese riesgo **solo durante esa etapa transitoria**: el email
y la contraseña del login de admin, el JWT y los datos de contacto de las reservas viajarían
sin cifrar. Por eso, en esa etapa no se carga ningún dato real ni se usa el login de admin
fuera de pruebas, y el paso a HTTPS es un cambio de configuración, sin tocar código.

### AWS en el Tier gratuito (propuesta de la docente)

La docente propuso AWS dentro del **Tier gratuito**, así que el despliegue tiene que entrar en
sus límites. Desde el 15 de julio de 2025, una cuenta nueva elige entre el plan Free y el pago,
y en los dos recibe créditos (USD 100, más hasta USD 100 por actividades). Las cuentas creadas
antes de esa fecha tenían 12 meses de Tier gratuito, que al 2026-10-06 ya vencieron. **En la
práctica, el Tier gratuito disponible es el de una cuenta nueva:**

- los créditos **se consumen** con la instancia, el disco, la IP pública y los snapshots;
- en el **plan Free**, el plan dura 6 meses o hasta agotar los créditos, lo que ocurra primero.
  Al terminar, **la cuenta se cierra sola**; AWS conserva los datos 90 días y después los borra,
  salvo que se pase al plan pago.

Por eso el change elige recursos mínimos en consumo (`t3.micro`), desactiva lo que puede
generar cargos inesperados (modo *unlimited* de CPU de las instancias `t3`) y suma una alerta de
presupuesto. Además documenta la fecha de vencimiento del plan, la compara con la fecha de
entrega del TP y explica cómo exportar los datos antes. **Nada de este change puede requerir
pasar al plan pago.** Por ejemplo, no se usa AWS Organizations ni IAM Identity Center, porque
unirse a Organizations pasa la cuenta al plan pago de forma automática.

### Excepción a config.yaml §2

§2 prohíbe "servicios externos de pago". AWS se usa a propuesta de la docente, dentro del Tier
gratuito, y como infraestructura de despliegue, no como dependencia de la aplicación: el
sistema se sigue levantando en local sin AWS ni ninguna API key, y el repositorio no contiene
credenciales. Este mismo PR actualiza `config.yaml` §2 para registrar la excepción, de modo que
aprobar la spec y escribirla en la constitución vayan juntos.

### Fuera de alcance

- Dominio propio: se usa el subdominio que provee la docente. Su DNS lo administra ella.
- Infraestructura como código (Terraform, CloudFormation): la infraestructura se crea a mano
  siguiendo el runbook.
- Alta disponibilidad, balanceador, autoescalado o RDS: el despliegue es de una sola instancia
  por decisión del equipo, y esos servicios agotarían el Tier gratuito.
- Mantener producción más allá del plazo del Tier gratuito: queda documentado qué hacer, pero
  la continuidad es una decisión del equipo para ese momento.
- Entornos de staging o de vista previa por PR.
- Monitoreo y alertas operativas de la aplicación (disponibilidad, errores, latencia) más allá
  de los logs de los contenedores. La alerta de costos de AWS Budgets sí está incluida.

## Capabilities

### New Capabilities
- `despliegue`: cuándo y cómo una versión de `main` llega a producción; qué superficie de red
  expone el servidor; dónde viven y cómo circulan los secretos; con qué datos iniciales y con
  qué credenciales de admin arranca producción; cómo se identifica al cliente para los límites
  de solicitudes; y cómo se vuelve a una versión anterior.

### Modified Capabilities
- `exposicion-red`: se precisan dos requisitos, a partir de las observaciones de la revisión
  de #69.
  - **"Confianza en proxies solo explícita y acotada"**: el salto que se declara confiable es
    el que se conecta al backend (detrás de `/api`, el frontend), no el proxy de borde. Las
    subredes IPv4 admitidas tienen prefijo `/8` o mayor, como ya valida el backend.
  - **"Condición de despliegue documentada"**: exige además que el frontend no sea accesible
    salteando el proxy de borde.

  Las dos precisiones no cambian el comportamiento implementado ni el README, que ya
  describían así la cadena de confianza. Solo alinean el texto de la spec.

`auth-admin` y `reserva-consultar` mantienen sus límites "por origen", que en producción pasan
a contarse por la IP real.

## Impact

- **Contenedores:** `backend/Dockerfile` y `frontend/Dockerfile` nuevos, junto con
  `.dockerignore`. `frontend/next.config.ts` suma `output: "standalone"`.
- **Despliegue:** `deploy/docker-compose.prod.yml`, `deploy/Caddyfile` y
  `deploy/desplegar.sh` (script que corre en la instancia), además de un documento de SSM
  versionado en `deploy/`.
- **Backend:** seed de producción (`backend/prisma/seed-produccion.ts`) y extracción del
  catálogo compartido con el seed de desarrollo. La API, `openapi.yaml` y el schema de Prisma
  no cambian.
- **CI/CD:** `.github/workflows/cd.yml` y `certificado.yml` nuevos, y `scripts/cd/` con la decisión de despliegue y sus tests. `ci.yml` suma los tests del frontend.
- **Variables de entorno:** `.env.example` documenta `ADMIN_EMAIL` y `ADMIN_PASSWORD`, que
  solo usa el seed de producción.
- **Documentación:** `docs/despliegue.md` (runbook de AWS, rollback, activación de HTTPS con
  el subdominio y riesgo de la etapa en HTTP), README y `config.yaml` (§2, §4, §10, §12).
- **Dependencias npm:** ninguna nueva. **Imagen nueva:** Caddy como proxy de borde
  (justificado en `design.md`).
- **Costos:** dentro del Tier gratuito. En una cuenta del plan Free, la instancia, el disco,
  la IP pública y los snapshots consumen créditos; el consumo estimado se calcula antes de
  crear nada (tarea 1.3).
