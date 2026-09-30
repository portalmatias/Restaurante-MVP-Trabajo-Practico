## Context

Ver `proposal.md` (Why) para la motivación. Hechos verificados el 2026-09-30 contra el
código y el sistema corriendo, que condicionan el enfoque:

- **Qué recibe el backend a través de `/api`** (medido con un servidor eco en lugar del
  backend): la IP de origen es siempre la del servidor de Next (`::1`), venga el pedido de
  `localhost` o de la IP de red; Next **no** agrega `X-Forwarded-For` en las reescrituras
  externas, y si el cliente manda uno, lo reenvía **tal cual** (`6.6.6.6` llegó intacto).
- **Por qué Next no puede resolverlo solo**: `node_modules/next/dist/server/base-server.js`
  completa `x-forwarded-for` con `??=` (conserva el del cliente si existe), y ninguna API de
  Next 16 expone la IP del socket a la aplicación (`request.ip` se eliminó en Next 15). La IP
  real solo puede venir de un salto confiable **delante** de Next, que sobrescriba el
  encabezado.
- **Impacto medido**: con el backend real, 5 intentos fallidos de login desde `localhost` por
  `/api` dejaron con `429` el primer intento desde la IP de red por `/api`; el mismo intento
  directo al backend respondió `401` (su propio cupo).
- **Escucha**: `next dev`/`next start` usan `0.0.0.0` por defecto (docs de la CLI en
  `node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md`); `app.listen(PORT)`
  de Nest, sin host, escucha en todas las interfaces; `docker-compose.yml` publica
  `'5432:5432'`, que Docker expone en todas las interfaces (Postgres visto escuchando en `::`).
  Que un equipo de la red llegue efectivamente depende del firewall de Windows y de las
  reglas que agrega Docker Desktop: no se probó desde otra máquina.
- `main.ts` no configura `trust proxy`: Express ignora hoy `X-Forwarded-For` para `req.ip`,
  que es lo que usa `@nestjs/throttler` en su clave. Ese comportamiento es el correcto en esta
  topología y no está fijado por ningún test.
- Topología decidida por el equipo: **solo local para la demo**.

## Goals / Non-Goals

**Goals:**
- Que ningún tercero de la red local pueda alcanzar frontend, backend ni Postgres con la
  configuración por defecto, y por lo tanto no pueda agotar los límites compartidos.
- Fijar con un test que el origen no se puede falsificar con encabezados.
- Dejar preparado (apagado) y acotado el camino de un despliegue futuro detrás de un proxy.

**Non-Goals:**
- No se obtiene la IP real detrás de `/api` en local: no hay salto confiable que la provea.
- No se cambian los valores de los límites (eso es `throttle-rutas-admin`, #60).
- No se agrega un proxy de borde (nginx/Caddy) al repositorio: sería infraestructura de un
  despliegue que el equipo decidió no hacer.

## Decisions

### D1: Escuchar en loopback por defecto, exponer en red solo con un opt-in explícito

**Decisión:**
- Frontend: los scripts `dev` y `start` de `frontend/package.json` pasan
  `--hostname 127.0.0.1`. Se agrega `dev:lan` (`--hostname 0.0.0.0`) para probar desde otro
  dispositivo; el README lo documenta con la advertencia de que expone la app a toda la red.
- Backend: `app.listen(PORT, HOST || '127.0.0.1')` con `HOST` de entorno y `127.0.0.1` como
  default. Se usa `||` y no `??` a propósito: un `HOST=` vacío (lo que queda al copiar
  `.env.example` sin completar la variable) llega como `''`, y Node interpreta el host vacío
  como "todas las interfaces", es decir, expondría el backend justo en el caso por defecto.
- Postgres: `docker-compose.yml` publica `'127.0.0.1:5432:5432'`.

**Por qué `127.0.0.1` y no `localhost`:** `localhost` puede resolver a `::1` o a `127.0.0.1`
según el sistema; atar el servidor a una dirección literal hace el default predecible.

**Alternativa considerada — firewall del sistema operativo:** depende de cada máquina del
equipo y de reglas que Docker Desktop agrega por su cuenta; no queda en el repositorio ni se
puede verificar en un PR. Se descarta como mecanismo principal (sigue sumando como defensa en
profundidad).

**Alternativa considerada — hostname por variable de entorno también en el frontend:**
expandir una variable dentro de un script de npm no es portable entre `cmd`, PowerShell y
bash sin sumar una dependencia (`cross-env`). Dos scripts con el hostname literal resuelven lo
mismo sin dependencias.

### D2: El backend no confía en encabezados de reenvío por defecto, y un test lo fija

**Decisión:** se mantiene el comportamiento actual de Express (sin `trust proxy`), pero ahora
explícito en una función de configuración compartida por `main.ts` y los tests e2e, y fijado
por un e2e que varía `X-Forwarded-For` en cada intento de login y en cada consulta pública y
espera el `429` en el mismo punto que sin el encabezado.

**Por qué un test, si ya se comporta así:** el arreglo "obvio" al síntoma medido (todos
comparten cupo) es activar `trust proxy`, y con Next reenviando el encabezado del cliente tal
cual, eso habilitaría saltear el límite contra la fuerza bruta del login. El test hace que ese
arreglo falle en CI en vez de llegar a `main`.

**Alternativa considerada — `trust proxy` apuntando a loopback (confiar en Next):** en local,
Next es el único salto, pero no es confiable como fuente de la IP: reenvía el
`X-Forwarded-For` del cliente sin tocarlo. Confiar en él equivale a confiar en el cliente.

**Alternativa considerada — reemplazar el rewrite por un Route Handler que arme
`X-Forwarded-For`:** el handler tampoco tiene la IP del socket; solo recibe el
`x-forwarded-for` que completó `base-server` con `??=`, es decir, el del cliente si lo mandó.
No resuelve la falsificación y agrega un proxy HTTP propio que mantener.

**Alternativa considerada — límites por identidad (email en login, `sub` del JWT en admin)
en vez de por IP:** evita depender de la IP, pero cambia requisitos ya aprobados ("por
origen"), habilita bloquear a propósito la cuenta del admin por email, y no sirve para la
consulta pública (la enumeración prueba códigos distintos). Queda fuera de alcance.

### D3: Confianza en proxies configurable, explícita y nunca total

**Decisión:** variable `TRUST_PROXY` (vacía por defecto → sin confianza). Si se define, se
pasa a `app.set('trust proxy', ...)` como **lista de direcciones o subredes** separadas por
coma (por ejemplo `10.0.0.5` o `loopback, 10.0.0.0/8`). La validación se aplica a **cada
elemento** de la lista, ya recortado: si cualquiera de ellos equivale a confiar en todos
(`true`, `*`, `0.0.0.0/0`, `::/0`) o es un número de saltos, el backend **no arranca**, con un
mensaje que pide declarar los saltos. Validar solo el valor completo no alcanza: Express
aceptaría `10.0.0.5,0.0.0.0/0` o `loopback, ::/0` y el catch-all escondido en la lista haría
confiable a cualquier salto.

**Por qué rechazar un número de saltos:** con `trust proxy = N`, un cliente que agrega sus
propias entradas a `X-Forwarded-For` corre la posición de la que Express toma la IP si la
topología cambia; una lista de direcciones confía en saltos concretos, que es lo que un
despliegue sabe de antemano.

**Por qué existe, si el sistema es solo local:** sin este camino, quien despliegue el
sistema más adelante va a llegar al mismo síntoma y la solución a mano más corta es
`trust proxy = true`. Dejarlo preparado, validado y documentado cuesta poco y evita ese
error.

### D4: Documentar la limitación y la condición de despliegue

**Decisión:** el README suma una sección "Red y límites de solicitudes" con: por qué los
servicios escuchan en loopback, cómo usar `dev:lan` y su riesgo, que detrás de `/api` los
límites por cliente son por máquina, y qué hace falta para desplegar (proxy de borde que
**sobrescriba** `X-Forwarded-For` + `TRUST_PROXY` con su dirección). `config.yaml` §10 suma
`HOST` y `TRUST_PROXY` a las variables de entorno.

## Risks / Trade-offs

- **[Riesgo]** Alguien del equipo prueba la app desde el celular y "deja de andar" →
  **Mitigación:** `dev:lan` documentado en el README, con la advertencia de exposición.
- **[Riesgo]** El frontend (Server Components y el rewrite de `/api`) llama al backend por
  `NEXT_PUBLIC_API_URL=http://localhost:3001`, que podría resolver a `::1` mientras el backend
  escucha solo en `127.0.0.1` → **Mitigación:** Node 20 intenta ambas familias
  (`autoSelectFamily`); igual se verifica en las tareas con el flujo real y, si falla, se
  cambia el default de `.env.example` a `http://127.0.0.1:3001`.
- **[Riesgo]** Una persona con una base existente sigue con Postgres expuesto hasta recrear
  el contenedor → **Mitigación:** el README indica `docker compose up -d --force-recreate`
  (los datos viven en el volumen y se conservan).
- **[Trade-off]** En local, todos los pedidos del navegador siguen compartiendo el cupo de la
  máquina. Es aceptable porque, con D1, esa máquina es el único cliente posible.

## Migration Plan

1. Merge del PR: cambian defaults de escucha; sin migraciones de base.
2. Cada integrante recrea el contenedor de Postgres (`docker compose up -d --force-recreate`)
   y agrega `HOST`/`TRUST_PROXY` a su `.env` solo si necesita cambiar el default.
3. Rollback: revertir el PR; los servicios vuelven a escuchar en todas las interfaces.
