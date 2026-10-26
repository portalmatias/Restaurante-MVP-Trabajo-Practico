## Why

El CD (`despliegue-continuo-ec2`) construye las imágenes de un commit y las despliega, y su
vuelta atrás protege contra una versión que no arranca. Pero **nada comprueba que el sitio
público sirva la versión que se acaba de desplegar**. Para el frontend, que es lo que ven los
usuarios, un despliegue puede terminar en verde y aun así quedar publicado el código anterior:

- la instancia levantó otro contenedor del que se creía (digest equivocado, `compose` que no
  recreó el servicio);
- la capa de borde (el subdominio pasa por Cloudflare con proxy) sirve una copia vieja. La
  landing sale de Next con `Cache-Control: s-maxage=31536000` y hoy Cloudflare responde
  `DYNAMIC`, pero un cambio en la zona de la docente (una regla de caché, *Cache Everything*)
  dejaría HTML viejo sin que ningún chequeo del repositorio lo note.

El equipo necesita poder afirmar «este cambio del frontend llegó a producción» con una prueba
automática en cada despliegue, no con una mirada a mano.

## What Changes

- **`GET /version` en el frontend:** una ruta pública que responde `{"sha": "<40 hex>"}` con el
  commit del que se construyó la imagen, o `{"sha": "desconocido"}` si la imagen no lo trae
  (desarrollo). No cachea (`Cache-Control: no-store`) y no devuelve ningún otro dato.
- **El SHA se hornea en la imagen:** `frontend/Dockerfile` recibe `BUILD_SHA` como argumento de
  build y lo deja en una variable de entorno de la imagen final. `cd.yml` se lo pasa al
  construir, con el mismo SHA que ya usa para el tag y la etiqueta `revision`.
- **Verificación post-despliegue en `cd.yml`:** un job nuevo, `verificar`, corre después de
  `desplegar` cuando el despliegue cambió producción. Consulta
  `https://<subdominio>/version` con un parámetro que evita cachés, reintenta hasta 5 minutos y
  **falla** si el sitio no sirve el SHA esperado. No usa credenciales ni el environment
  `produccion`.
- **Lógica pura con tests:** la decisión (¿coincide, se reintenta, está superada, no se puede
  verificar?) vive en `scripts/cd/verificar-version.mjs`, con tests en el CI.
- **Runbook:** una sección corta con cómo comprobar a mano que un cambio llegó y qué hacer si el
  SHA no coincide.

### Riesgo aceptado: `/version` es público

La ruta le dice a cualquiera qué commit sirve el sitio. El repositorio es público, así que el
SHA no es un secreto, pero sí permite saber si producción corre una versión con una
vulnerabilidad conocida. Se acepta por el valor de poder comprobar el despliegue desde fuera,
sin credenciales; el análisis está en D7 de `design.md`.

### Fuera de alcance

- Comprobar el backend o la base. El backend ya lo cubre `desplegar.sh` (healthcheck con vuelta
  atrás) y la imagen se identifica por digest. Ver D8.
- Purgar cachés de Cloudflare automáticamente (exigiría una credencial de Cloudflare en
  GitHub).
- Monitoreo continuo: la comprobación corre una vez por despliegue, no vigila el sitio después.

## Capabilities

### New Capabilities
- Ninguna.

### Modified Capabilities
- `despliegue`: se agregan dos requisitos, que el sitio publicado informe qué versión sirve y
  que el CD compruebe ese dato después de cada despliegue que cambia producción. La capability
  la crea `despliegue-continuo-ec2`; este change se archiva después de aquel.

## Impact

- **Código:** `frontend/app/version/route.ts` (nuevo), `frontend/Dockerfile`,
  `.github/workflows/cd.yml`, `scripts/cd/verificar-version.mjs` (nuevo), `package.json`
  (lista de `test:scripts`), `docs/despliegue.md`.
- **Contrato de API (`openapi/openapi.yaml`):** sin cambios. `/version` es una ruta del
  frontend (Next), no del backend, y `openapi:check` compara solo el backend.
- **Variables y secrets:** se usa la variable de repositorio `SUBDOMINIO`, que ya existe. No se
  agregan secrets ni dependencias.
- **Superficie de red:** una ruta pública más en el frontend, de solo lectura y sin entrada.
