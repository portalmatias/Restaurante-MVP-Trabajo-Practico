## Why

Una prueba contra el backend real mostró que, detrás del proxy `/api` de Next, el backend ve
a **todos** los clientes con la misma IP de origen (la del servidor de Next): cinco intentos
fallidos de login desde un cliente dejaron con `429` el primer intento de otro cliente, con
otra IP. Cualquiera que llegue a la página pública puede bloquear el login del administrador
—y agotar los límites de la consulta y cancelación públicas— sin ninguna credencial.

La solución de manual (que el backend confíe en `X-Forwarded-For`) empeora las cosas en la
topología actual: Next reenvía ese encabezado **tal cual lo manda el cliente**, así que
confiar en él permitiría inventar una IP por pedido y saltear el límite que frena la fuerza
bruta del login. Y Next 16 no expone a la aplicación una IP de cliente confiable: esa IP solo
puede ponerla un salto confiable delante de Next, que este proyecto no tiene.

El sistema corre **solo en local para la demo** (decisión del equipo). En esa topología, el
problema real es de **exposición**: `next dev`/`next start` y el backend escuchan en todas las
interfaces (`0.0.0.0`) y `docker-compose.yml` publica Postgres, con credenciales de desarrollo
conocidas, también en todas las interfaces. Cualquier equipo de la misma red (el Wi-Fi de la
facultad durante la demo) puede llegar a los tres, sujeto solo al firewall del sistema
operativo. Si nadie más que la propia máquina llega a los servicios, el límite compartido deja
de ser explotable por terceros.

## What Changes

- **Frontend, backend y Postgres escuchan solo en loopback (`127.0.0.1`) por defecto.** La
  exposición en la red local pasa a ser una decisión explícita (un script aparte para el
  frontend, una variable de entorno para el backend), documentada, nunca el default.
- **El backend no confía en `X-Forwarded-For` por defecto**, y un test e2e lo fija: seis
  intentos de login con un `X-Forwarded-For` distinto cada uno siguen terminando en `429`.
- **Confianza en proxy configurable para un despliegue futuro**: una variable de entorno con
  la lista explícita de saltos confiables (nunca "confiar en todos"), apagada por defecto.
- **Limitación documentada**: detrás de `/api`, los límites por cliente son por máquina;
  desplegar el sistema exige un proxy de borde que sobrescriba `X-Forwarded-For` y configurar
  la confianza en ese salto.
- **BREAKING (solo desarrollo local)**: abrir la app desde otro dispositivo de la red (por
  ejemplo, un celular para probar el responsive) deja de funcionar con `npm run dev`; hay que
  usar el script explícito de red local.

### Fuera de alcance

- Obtener la IP real del cliente detrás del proxy `/api` en la topología local: no hay un
  salto confiable que la provea, y armarlo (un proxy de borde) es infraestructura de
  despliegue, que el equipo decidió no tener.
- Cambiar los límites en sí (valores por ruta): los trata `throttle-rutas-admin` (#60).
- Contar límites por usuario/cuenta en vez de por IP.

## Capabilities

### New Capabilities
- `exposicion-red`: en qué interfaces de red escuchan los servicios del sistema, cuándo el
  backend confía en encabezados de reenvío para identificar al cliente, y qué queda
  documentado como condición para desplegar.

### Modified Capabilities
_Ninguna._ `auth-admin` y `reserva-consultar` ya exigen límites "por origen"/"por cliente";
este change no cambia esos requisitos, sino que evita que un tercero pueda abusar de ellos y
fija que el origen no se pueda falsificar con un encabezado.

## Impact

- **Backend:** `backend/src/main.ts` (host de escucha y `trust proxy` configurables, aplicados
  desde una función compartida con los tests e2e), `.env.example` (variables nuevas `HOST` y
  `TRUST_PROXY`), un e2e nuevo para `X-Forwarded-For` falsificado.
- **Frontend:** scripts `dev`/`start` de `frontend/package.json` con `--hostname 127.0.0.1` y
  un script `dev:lan` explícito. Sin cambios de código de la app.
- **Infraestructura local:** `docker-compose.yml` publica Postgres en `127.0.0.1:5432`.
- **Documentación:** README (sección de ejecución local y de seguridad) y `config.yaml` §10.
- **CI:** sin cambios; el workflow usa su propio servicio de Postgres y no depende de estos
  defaults.
- **API / `openapi.yaml` / base de datos:** sin cambios.
- **Dependencias npm:** ninguna nueva.
