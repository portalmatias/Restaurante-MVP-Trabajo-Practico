## Context

Ver `proposal.md` (sección Why) para la motivación y `specs/throttle-rutas-admin/spec.md`
para el comportamiento esperado. Este documento decide cómo se aplica el límite a las rutas de
admin, con qué valor, y por qué no se cambia el criterio de rastreo.

Estado del que se parte (`main` al 2026-09-30, commit `d2abb22`):

- `AppModule` registra `ThrottlerModule.forRootAsync` con **un solo throttler**, `default`
  (`ttl = THROTTLE_TTL * 1000`, `limit = THROTTLE_LIMIT`; `.env.example`: 60 y 10), y
  `ThrottlerGuard` como `APP_GUARD`. Un guard global corre **antes** que los guards de
  controller (`JwtAuthGuard`, `RolesGuard`) y que los pipes: cuando el throttler decide,
  `req.user` todavía no existe y el body todavía no se validó.
- Límites propios vigentes:

  | Ruta | Límite | Dónde |
  |---|---|---|
  | `POST /auth/login` | 5 / 60 s | `@Throttle` en `AuthController.login` |
  | `GET /admin/reservas` | 60 / 60 s | `@SkipThrottle({ default: false })` + `@Throttle` en `ReservasAdminController.listar` |
  | `POST /reservas/consultar`, `POST /reservas/:codigo/cancelar` | global (10 / 60 s) | `@SkipThrottle({ default: false })` sobre un controller con `@SkipThrottle()` |
  | `GET /disponibilidad`, `POST /reservas`, `GET /zonas`, `GET /turnos` | sin límite | `@SkipThrottle()` |
  | **resto de `/admin/...`** (12 operaciones) | **global (10 / 60 s)** | nada: heredan el default |

- **Clave del throttler, verificada en el código instalado.** `package.json` pide
  `@nestjs/throttler ^6.5.0` y `package-lock.json` resuelve **6.7.0**. En
  `node_modules/@nestjs/throttler/dist/throttler.guard.js`:
  - `getTracker(req)` devuelve `normalizeIp(req.ip, ipv6SubnetPrefix)`: se rastrea por IP.
  - `generateKey(context, suffix, name)` arma
    `sha256(`${context.getClass().name}-${context.getHandler().name}-${name}-${suffix}`)`.

  O sea, el contador es **por clase + método del controller + nombre del throttler + IP**: cada
  operación tiene su propio cupo por IP; **no** es un cupo global por IP compartido entre
  rutas. Consecuencia para el análisis: entrar a `/admin/salon` (`GET` zonas + mesas + turnos)
  consume 1 de tres cupos distintos, no 3 de uno. El `429` aparece al repetir **la misma**
  operación más de 10 veces en un minuto: confirmar o rechazar en ráfaga, editar varias Mesas
  o Turnos seguidos (`PATCH` de la misma ruta), o volver varias veces a una pantalla que
  recarga el mismo catálogo (`GET /admin/zonas` lo piden el dashboard de aforo, el listado de
  reservas y el salón). El reflector usa `getAllAndOverride([handler, classRef])`, así que un
  `@Throttle` puesto en la **clase** vale para todos sus métodos y uno puesto en un método lo
  pisa.
- **Origen detrás del proxy de Next.** El frontend llama a `/api/...` y Next lo reescribe al
  backend (D6 de `frontend-base`, `frontend/next.config.ts`). El proxy de Next 16.3
  (`next/dist/server/lib/router-utils/proxy-request.js`, `httpxy` sin `xfwd`) no agrega
  `X-Forwarded-For`, y `backend/src/main.ts` no configura `trust proxy`. Por lo tanto, en el
  despliegue actual `req.ip` es la dirección del servidor de Next para **todo** el tráfico del
  navegador: todos los usuarios comparten el cupo de cada ruta. Este change lo había verificado
  solo leyendo el código; `exposicion-red-local` (#62) lo confirmó después contra el backend
  real (5 logins fallidos desde `localhost` por `/api` dejaron con `429` a un cliente con otra
  IP) y midió además que, si el cliente manda su propio `X-Forwarded-For`, Next lo reenvía tal
  cual.
- `frontend-admin` (PR #58) ya muestra un mensaje fijo ante un `429`; no hace falta tocarlo.

## Goals / Non-Goals

**Goals:**
- Un único límite para todo el panel de admin, declarado en un solo lugar, con el mismo valor
  que ya se justificó para `GET /admin/reservas`.
- Que una ruta de admin nueva quede cubierta sin que su autor tenga que acordarse de agregar
  un decorador por método.
- Contrato OpenAPI alineado con lo que el backend ya hace (hoy el `429` de esas rutas existe
  pero no está documentado).

**Non-Goals:**
- No cambia `POST /auth/login` (5 / 60 s): su límite defiende contra fuerza bruta de
  credenciales y tiene que seguir siendo el más estricto del sistema.
- No cambia el límite de `POST /reservas/consultar` ni de `POST /reservas/:codigo/cancelar`
  (D5 de `reserva-consultar`, `config.yaml` §5), ni de ninguna otra ruta pública.
- No cambia `THROTTLE_TTL`/`THROTTLE_LIMIT` ni agrega variables de entorno.
- No resuelve el origen real detrás del proxy de Next (`trust proxy` / `X-Forwarded-For`):
  afecta también a las rutas públicas y al login, y lo trata su propio change,
  `exposicion-red-local` (#62; ver Open Questions).
- No cambia el almacenamiento del throttler (sigue en memoria, por instancia).

## Decisions

### D1: `@Throttle` a nivel de clase en los cuatro controllers de admin, con un decorador compartido

**Decisión:** un decorador compuesto `LimiteAdmin()` en
`backend/src/auth/decorators/limite-admin.decorator.ts` (al lado de `roles.decorator.ts`),
armado con `applyDecorators(SkipThrottle({ default: false }), Throttle({ default: { limit: 60,
ttl: 60_000 } }))`, aplicado **a nivel de clase** en `ZonasController`, `MesasController`,
`HorariosController` y `ReservasAdminController`, junto a `@UseGuards(JwtAuthGuard,
RolesGuard)` y `@Roles(RolUsuario.ADMIN)`. En `ReservasAdminController.listar` se quitan el
`@SkipThrottle({ default: false })` y el `@Throttle(...)` de método: el valor es el mismo y
pasa a venir de la clase. El `SkipThrottle({ default: false })` dentro del decorador deja
explícita la intención, igual que el comentario de `listar` hoy.

Es la variante más chica que resuelve el problema: no toca `AppModule`, no agrega throttlers ni
guards, y reutiliza el mecanismo que el proyecto ya usa en dos lugares.

**Alternativas consideradas:**

1. **`@Throttle` por método** (extender lo que hoy tiene `listar` a los otros 12 métodos).
   Mismo efecto, pero repite el valor 13 veces y una ruta de admin nueva queda con el límite
   global si su autor se olvida el decorador — que es exactamente lo que pasó con las 12
   operaciones de hoy. Se descarta.
2. **Un throttler con nombre para rutas autenticadas** (por ejemplo `admin`, registrado en
   `ThrottlerModule` junto a `default`). En `@nestjs/throttler` 6 cada throttler registrado se
   evalúa en **todas** las rutas (el guard recorre `this.throttlers`), así que habría que
   agregar `@SkipThrottle({ admin: true })` a cada controller público y al login, o un
   `skipIf` global que decida por metadatos, y apagar `default` en las rutas de admin. Suma
   configuración en `AppModule`, probablemente una variable de entorno más y dos contadores por
   solicitud, sin ganar nada sobre D1: la clave ya separa por controller y método. Se descarta.
3. **Rastrear por usuario (`sub` del JWT) en vez de por IP** en las rutas de admin. Es la
   opción conceptualmente más correcta (el límite acota a un token, no a una red) y la que
   mejor esquiva el origen compartido del proxy de Next. Pero el guard global corre antes que
   `JwtAuthGuard`, así que `req.user` no existe cuando se calcula la clave. Las formas de
   obtener el `sub` a esa altura son:
   - decodificar el header `Authorization` **sin verificar** la firma: cualquiera fabrica un
     `sub` arbitrario, sea para agotar el cupo de otro admin o para rotar `sub` y evadir el
     límite. Inaceptable;
   - **verificar** el JWT dentro del tracker (una subclase de `ThrottlerGuard` con
     `JwtService` inyectado que reemplace al `APP_GUARD`): duplica la validación de
     autenticación en un segundo lugar y cambia el guard de todas las rutas de la app, no solo
     las de admin;
   - mover el throttling de admin a un guard de controller que corra **después** de
     `JwtAuthGuard`: requiere que el guard global lo saltee con `@SkipThrottle()`, pero ese
     mismo metadato también apaga al guard de controller (ambos leen `THROTTLER:SKIP`), así que
     haría falta una subclase que ignore ese metadato.

   Cualquiera de las tres variantes seguras es bastante más código y superficie de revisión
   que D1, para un MVP con un solo rol y un solo usuario admin sembrado. Se descarta **para
   este change**. `exposicion-red-local` (#62) concluyó que detrás del proxy no hay una IP de
   cliente confiable y lo mitigó por exposición (servicios solo en loopback), dejando el
   rastreo por identidad fuera de su alcance: sigue siendo la candidata natural si el sistema
   se despliega sin un proxy de borde que provea la IP real.
4. **`@SkipThrottle()` en las rutas de admin.** Ya descartada por D7 de `reserva-consultar`:
   el JWT protege el acceso, no la extracción ni el abuso con un token comprometido.
5. **Subir `THROTTLE_LIMIT` global.** Resolvería el panel, pero relajaría también la consulta
   y la cancelación públicas, que dependen de ese límite contra la enumeración del código de
   reserva. Contradice un no-objetivo explícito. Se descarta.

### D2: Valor: 60 solicitudes por 60 segundos, por ruta y por origen

**Decisión:** el mismo valor que D7 de `reserva-consultar` ya fijó para `GET /admin/reservas`.
Como la clave es por operación (Context), son 60 por minuto **para cada** ruta de admin, que
alcanza para una persona trabajando rápido: una acción por segundo sostenida sobre la misma
ruta durante un minuto entero. El uso más intenso observado en `frontend-admin` (dos
`GET /admin/reservas` por cada cambio de fecha o turno del dashboard, un `GET` por cada cambio
de filtro o página del listado, un `PATCH` por cada confirmación) queda lejos.

**Por qué no más alto:** en estas rutas el límite no es una defensa contra fuerza bruta (el
atacante necesita un JWT válido de rol `ADMIN` para llegar al handler), sino una cota al daño de
un token robado o de un cliente defectuoso en loop: con 60 por minuto, un token robado puede
confirmar, rechazar o marcar ausentes a lo sumo 60 Reservas por minuto por acción, y el
listado sigue acotado como ya lo aceptó D7. Subirlo más amplía ese daño sin necesidad
observada.

**Por qué no configurable por entorno:** mismo criterio que D7 de `reserva-consultar` y que el
`5` del login: son números del sitio de llamada, no reglas de negocio del §6. Agregar
`THROTTLE_ADMIN_LIMIT` obligaría a tocar `.env.example`, CI y los tests, y el spec dejaría de
poder fijar un número verificable. Si el panel lo supera, se ajusta con un change.

### D3: El límite cuenta por ruta, no hay un cupo global de admin

**Decisión:** se mantiene la clave por controller + método que genera `@nestjs/throttler` 6.7
(Context). No se agrega un cupo compartido entre todas las rutas de admin.

**Alternativa considerada:** una clave común a todas las rutas de admin (`generateKey`
propio) con un cupo total más alto. Modela mejor "cuánto puede hacer un token por minuto",
pero obliga a estimar un total para operaciones de peso muy distinto (un `GET` de catálogo
frente a un `DELETE`) y a sobrescribir `generateKey`, que es detalle interno de la librería.
Se descarta; el escenario "El límite de una ruta no consume el de otra" del spec deja
documentado el comportamiento elegido.

### D4: Tests e2e sin efectos secundarios, contra `AppModule` y Postgres real

Cada test levanta su propia app a partir de `AppModule` (un `ThrottlerStorage` en memoria
propio), igual que `reserva-consultar-listado.e2e-spec.ts` y `auth.e2e-spec.ts`, con el admin
del seed y la base de test de CI.

Para agotar el cupo de una operación que escribe sin modificar datos se aprovecha que el guard
global corre antes que pipes y handler: las 60 solicitudes permitidas y la 61 usan un UUID
inexistente (`PATCH`/`DELETE` → `404`) o un body vacío (`POST` → `400`); el throttler las
cuenta igual. Solo el escenario "Una operación rechazada por el límite no modifica datos" usa
una Reserva `PENDIENTE` real, creada por el test, para comprobar que la solicitud 61 no la
confirma.

## Contrato OpenAPI

Solo se agrega una respuesta `'429'`, con descripción y sin `content`, igual que las cuatro
que ya existen (`auth-admin`, `reserva-consultar`): el cuerpo lo genera `@nestjs/throttler` y su
forma no es parte del contrato. No cambian paths, parámetros ni schemas. En el backend, cada
método suma `@ApiTooManyRequestsResponse({ description })` con el mismo texto, para que
`openapi:check` (que compara `paths` literalmente) siga en verde.

Operaciones que la agregan (12):

| Path | Método | `operationId` |
|---|---|---|
| `/admin/zonas` | `get` | `ZonasController_listar` |
| `/admin/zonas/{id}` | `patch` | `ZonasController_actualizar` |
| `/admin/mesas` | `post` | `MesasController_crear` |
| `/admin/mesas` | `get` | `MesasController_listar` |
| `/admin/mesas/{id}` | `patch` | `MesasController_actualizar` |
| `/admin/mesas/{id}` | `delete` | `MesasController_eliminar` |
| `/admin/turnos` | `post` | `HorariosController_crear` |
| `/admin/turnos` | `get` | `HorariosController_listar` |
| `/admin/turnos/{id}` | `patch` | `HorariosController_actualizar` |
| `/admin/reservas/{id}/no-show` | `patch` | `ReservasController_marcarNoShow` |
| `/admin/reservas/{id}/confirmar` | `patch` | `ReservasController_confirmar` |
| `/admin/reservas/{id}/rechazar` | `patch` | `ReservasController_rechazar` |

Fragmento (se repite en cada una, después de la última respuesta existente):

```yaml
        '429':
          description: >-
            Se superó el límite de solicitudes a esta ruta en la ventana configurada. Se
            rechaza antes de validar el token y el body.
```

`GET /admin/reservas` ya declara su `'429'` y no cambia. Después de editar el YAML hay que
regenerar `frontend/src/lib/api/schema.d.ts` con `npm run api:types -w frontend`
(`api:types:check` lo exige).

## Risks / Trade-offs

- **[Riesgo]** Relajar un límite siempre agranda la superficie de abuso → **Mitigación:** solo
  se relaja en rutas que exigen JWT + rol `ADMIN`; el valor es el mismo ya aceptado para el
  listado, que es la ruta de admin que más datos personales expone. Ninguna ruta accesible sin
  token gana margen, y un test de regresión lo verifica para el login y la consulta pública.
- **[Riesgo]** El throttler corre antes que `JwtAuthGuard`, así que las solicitudes **sin
  token** a una ruta de admin también consumen el cupo de esa ruta para ese origen. Detrás del
  proxy de Next todos comparten origen: un tercero sin credenciales podría agotar, por
  ejemplo, el cupo de `GET /admin/mesas` y dejar al admin con `429` durante un minuto →
  **Mitigación:** este change no lo empeora (pasar de 10 a 60 lo encarece seis veces); en la
  topología local de la demo, `exposicion-red-local` (#62) impide que un tercero de la red
  llegue a los servicios, y para un despliegue la solución de fondo es el origen real o el
  rastreo por usuario, fuera de alcance de este change (Open Questions). El mismo problema, más grave, ya afecta hoy al login: su cupo de 5 por minuto
  es compartido por todo el tráfico que llega por el proxy.
- **[Riesgo]** Un controller de admin nuevo que no use `LimiteAdmin()` volvería al límite
  global → **Mitigación:** el decorador vive al lado de `@Roles` y se aplica en la misma línea
  que los guards; el comentario del decorador lo indica y el escenario "Toda operación de
  admin declara la respuesta 429" obliga a documentar el `429`, lo que en la revisión hace
  visible el faltante.
- **[Trade-off]** Contar por ruta (D3) permite que un token robado haga 60 operaciones por
  minuto **en cada** ruta de admin a la vez. Se acepta: el daño por ruta queda acotado, y un
  cupo total obligaría a sobrescribir detalles internos de la librería.
- **[Trade-off]** El almacenamiento del throttler es en memoria y por instancia: con más de una
  instancia del backend el límite efectivo se multiplica. No aplica al MVP (una instancia).
- **[Riesgo]** `frontend-admin` (PR #58) también regenera `frontend/src/lib/api/schema.d.ts`
  → **Mitigación:** conflicto de rebase, no de diseño; se resuelve regenerando el archivo desde
  el YAML de `main` después de mergear el que llegue primero.

## Migration Plan

1. Sin migraciones de Prisma ni variables de entorno nuevas.
2. Despliegue: el cambio entra con el deploy del backend. El almacenamiento en memoria se
   reinicia con cada arranque, así que no quedan contadores viejos con el límite anterior.
3. Rollback: revertir el PR completo. Las rutas de admin vuelven al límite global de 10 por
   minuto, salvo `GET /admin/reservas`, que recupera su decorador de método con 60, y el
   contrato pierde las 12 respuestas `429`. Revertir solo el decorador de clase sin restaurar
   el de método dejaría el listado en 10 por minuto: el revert tiene que ser del PR entero.

## Open Questions

- **Origen real detrás del proxy de Next: resuelta en `exposicion-red-local` (#62).** Quedó
  verificado que detrás de `/api` todos los clientes comparten el cupo de cada ruta (`req.ip`
  es la del servidor de Next) y que confiar en `X-Forwarded-For` no sirve: Next lo reenvía tal
  cual lo manda el cliente, así que habilitaría inventar un origen por pedido. Ese change
  mantiene el backend sin `trust proxy`, lo fija con un e2e y hace que los servicios escuchen
  solo en loopback, de modo que en la demo local ningún tercero pueda agotar los cupos
  compartidos. No cambia el spec ni las tareas de este change. Si en el futuro se despliega
  sin un proxy de borde confiable, es el momento de retomar el rastreo por `sub` (D1,
  alternativa 3).
- **Valor definitivo.** 60 por minuto sale del mismo razonamiento que D7 de
  `reserva-consultar`, no de una medición. Si al usar el panel con datos reales aparece un
  `429`, se ajusta el número en `LimiteAdmin()` y en el spec con un change chico.
