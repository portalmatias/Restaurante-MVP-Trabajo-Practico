## Context

Ver `proposal.md` (sección Why) para la motivación y `specs/frontend-admin/spec.md` para el
comportamiento esperado. Este documento resuelve cómo el frontend maneja un JWT por primera
vez (ni `frontend-base` ni `frontend-cliente` lo necesitaban), cómo se protege `/admin/...`,
cómo se calcula el dashboard de aforo sin un endpoint nuevo, y cómo se coordina con
`frontend-cliente` para no chocar en los mismos archivos compartidos.

Estado del que se parte (`main` al 2026-09-29):

- `frontend-base` (#43, mergeado) da el layout, las primitivas (`Button`, `Field`, `Input`,
  `Select`, `Card`, `Alert`, `Label`), `apiClient`/`toApiResult` (`frontend/src/lib/api/client.ts`)
  y el mapeo de errores `ErrorApi` (`errors.ts`). `apiClient` es un **singleton exportado**,
  sin ningún mecanismo de autenticación: ninguna llamada agrega el header `Authorization`.
- `frontend-cliente` (spec mergeada en #45, **sin implementación**) tiene su propio
  `design.md` con dos decisiones que rozan a este change: D5 agrega una primitiva `Dialog`
  nueva sobre `<dialog>`, y D7 migra los mensajes de `errors.ts`/`client.ts` a voseo
  coloquial. Como todavía no se implementó, ninguna de las dos existe en el código — pero
  cuando se implemente, van a existir.
- `/admin` (`frontend/app/admin/page.tsx`) es hoy un placeholder de `Card` sin lógica, sin
  layout propio bajo `/admin`.
- El backend expone `POST /auth/login` (`auth-admin`), `GET`/`PATCH /admin/zonas`,
  `POST`/`GET`/`PATCH`/`DELETE /admin/mesas`, `POST`/`GET`/`PATCH /admin/turnos`
  (`gestion-salon`), y `GET /admin/reservas` (`reserva-consultar`), todos con
  `Authorization: Bearer <token>` (`JwtAuthGuard` + `RolesGuard(ADMIN)`). `PATCH
  /admin/reservas/:id/confirmar`/`.../rechazar` (`reserva-vip`) y `.../no-show`
  (`cancelacion-turnos`) están fijados en el `design.md` de esos changes, sin implementar.

## Goals / Non-Goals

**Goals:**
- Manejar la sesión del administrador sin agregar dependencias ni tocar el backend.
- Que ninguna llamada pública (cliente sin cuenta) lleve por error un header
  `Authorization`, y que ninguna llamada de admin llegue sin él.
- Que el dashboard de aforo sea consistente con la regla de negocio real (`config.yaml` §6):
  misma definición de "ocupación" que usa el backend para su propio tope duro.
- Dejar escrito el comportamiento completo de confirmar/rechazar VIP y marcar `NO_SHOW`
  aunque su backend no exista todavía, sin bloquear los grupos que sí se pueden construir
  ahora.
- No introducir un conflicto de archivo ni de contenido con `frontend-cliente`, que todavía
  no se implementó pero ya tiene decisiones de diseño aprobadas que tocan los mismos
  archivos compartidos de `frontend-base`.

**Non-Goals:**
- No define refresh tokens ni recuperación de contraseña (`config.yaml` §5: no existen).
- No agrega un endpoint de aforo al backend: D5 lo calcula en el cliente con datos que la
  API ya expone.
- No decide el diseño visual pantalla por pantalla con el nivel de detalle de D3 de
  `frontend-cliente` (esta audiencia es interna, no una persona con dificultad motriz
  reservando desde el celular); alcanza con las primitivas de `frontend-base` tal como
  están.

## Decisions

### D1: La sesión vive en `sessionStorage`, no en una cookie

**Decisión:** al loguearse, el frontend guarda `{ accessToken, exp }` en
`sessionStorage.setItem('admin-session', ...)`. `exp` sale de decodificar el JWT (payload
en base64, sin verificar la firma en el cliente: la verificación real la hace el backend en
cada request) y se usa solo para decidir si vale la pena mostrar la sesión como activa antes
de la primera llamada, no como control de seguridad.

**Alternativa considerada:** cookie `httpOnly` seteada por un Route Handler de Next, con un
`middleware.ts` que proteja `/admin/...` en el servidor. Es más robusto (protege incluso
antes de que cargue JavaScript) pero exige: un Route Handler que reciba el JWT y lo
reenvíe como `Set-Cookie`, lógica para adjuntarlo de vuelta como header `Authorization` en
cada llamada a la API (las cookies no viajan solas hacia otro origen, y `NEXT_PUBLIC_API_URL`
es otro origen para las llamadas de Server Component), y un `middleware.ts` nuevo — tres
piezas nuevas para un JWT sin refresh que ya vence en 60 minutos. Se descarta para el MVP:
`config.yaml` §5 no pide protección contra JavaScript deshabilitado, y la superficie de
`/admin` no es sensible a SEO ni necesita renderizarse sin JS.
**Alternativa considerada:** `localStorage`. Sobrevive al cierre del navegador, lo que exigiría
un mecanismo de "recordarme" que nadie pidió y que alarga la ventana de exposición de un
token robado (XSS) más allá de lo que dura la pestaña. `sessionStorage` alcanza para el uso
real (un turno de trabajo del administrador).

Consecuencia: como `sessionStorage` no es legible desde el servidor, todo lo que dependa de
la sesión (el guard de rutas, D4; las llamadas a la API, D2) corre en el cliente.

### D2: Cliente HTTP de admin aparte, no una extensión del `apiClient` público

**Decisión:** `frontend/src/lib/api/admin-client.ts` crea **su propia instancia**
(`createClient<paths>({ baseUrl: urlBaseApi() })`, la misma función de `frontend-base`) y le
agrega un middleware de `openapi-fetch` (`.use({ onRequest })`) que lee el token de
`sessionStorage` y lo agrega como header `Authorization: Bearer <token>` a cada request.
Expone `toAdminApiResult`, un envoltorio idéntico a `toApiResult` de `frontend-base` pero
sobre este cliente, para no romper el chequeo de tipos por path que ya resolvió D6.7 de
`frontend-base`.

**Por qué no extender `apiClient`:** es un singleton exportado que ya usan (o van a usar)
`frontend-cliente` y las páginas públicas. Agregarle un middleware de autenticación ahí
haría que **toda** llamada pública intente leer `sessionStorage` y mandar un header que esas
rutas ni necesitan ni deben recibir por error, y acoplaría un módulo de `frontend-base` a
una decisión de `frontend-admin`. Un cliente aparte es la separación real de responsabilidad
enunciada en `config.yaml` §7 ("frontend"): admin y cliente son públicos distintos.

**Alternativa considerada:** pasar el header a mano en cada llamada
(`apiClient.GET(path, { headers: { Authorization: ... } })`). Se descarta: es fácil olvidarlo
en una llamada nueva, y el middleware lo hace una sola vez, en un solo lugar.

### D3: Copy en voseo formal, sin tocar los mensajes compartidos de `errors.ts`

**Decisión:** todo el copy propio de las pantallas de `/admin/...` (títulos, botones,
mensajes de confirmación, errores de campo específicos de un formulario) se escribe en
voseo formal ("Confirmá el rechazo", "Revisá el email"), consistente con la preferencia de
comunicación del equipo (español rioplatense formal, sin lunfardo). Es un registro
más profesional que el voseo coloquial que usa `frontend-cliente` para el cliente final
("Reservá tu mesa"), porque la audiencia es personal del restaurante en un panel de
trabajo, no alguien reservando desde el celular.

Los mensajes **genéricos y compartidos** de `ErrorApi` (`errors.ts`, D7 de `frontend-base`:
por ejemplo el de `5xx`/red, "El servicio no está disponible...") se muestran tal cual los
devuelve `mapErrorApi`, sin traducirlos ni parafrasearlos en este change. Ese archivo no se
toca acá.

**Riesgo de coordinación:** el `design.md` de `frontend-cliente` (D7, ya aprobado, sin
implementar) migra esos mismos mensajes genéricos a voseo coloquial ("Intente" →
"Intentá"). El día que `frontend-cliente` implemente esa migración, los pocos mensajes
genéricos que este change también muestra (5xx, red) van a aparecer en voseo coloquial en
una pantalla de admin en voseo formal — una inconsistencia menor de tono, no de
comportamiento. No se resuelve acá evitando el choque de antemano (por ejemplo,
duplicando esos mensajes en una copia propia) porque `errors.ts` es justamente el lugar
pensado para no duplicar el mapeo de errores; se deja anotado en Riesgos para quien
implemente el que llegue segundo.

### D4: Protección de rutas con un layout de cliente, no `middleware.ts`

**Decisión:** el guard de sesión vive **únicamente** en
`frontend/app/admin/(protegido)/layout.tsx` — el layout del grupo de rutas que agrupa
todas las pantallas protegidas (`(protegido)/page.tsx` el dashboard,
`(protegido)/salon/page.tsx`, `(protegido)/reservas/page.tsx`), sin agregar el segmento
`(protegido)` a la URL. `frontend/app/admin/login/page.tsx` queda **fuera** de ese grupo,
como hermano, así que ningún layout con guard lo envuelve. **No existe** un
`frontend/app/admin/layout.tsx` a nivel de todo `/admin/...`: en Next.js, un layout de
segmento envuelve a *todos* sus hijos, incluidos los de otros grupos de rutas debajo suyo
— un `admin/layout.tsx` que redirigiera sin sesión envolvería también a `login/page.tsx` y
generaría un bucle de redirección (`/admin/login` → sin sesión → redirige a
`/admin/login`). Es un error de la primera versión de este documento, que describía el
guard como si viviera en `admin/layout.tsx`; `tasks.md` (4.1/4.2) ya lo tenía bien planteado
con `(protegido)/layout.tsx`, esta sección solo lo alineaba mal en la prosa.

El layout de `(protegido)` es un Client Component: al montarse, lee la sesión de
`sessionStorage` y, si no hay una vigente, redirige a `/admin/login` antes de renderizar
sus hijos. `toAdminApiResult` (D2), al recibir un `401` de cualquier llamada, descarta la
sesión guardada y dispara la misma redirección.

**Alternativa considerada:** `middleware.ts` de Next, que corre en el servidor y podría
bloquear el acceso antes de que se envíe ningún HTML. Se descarta por lo mismo que en D1:
el middleware no puede leer `sessionStorage` (vive en el navegador), así que necesitaría la
cookie `httpOnly` que D1 ya descartó. Sin esa cookie, un `middleware.ts` no aporta nada que
el layout de cliente no cubra igual.

### D5: Dashboard de aforo calculado en el cliente, sin endpoint nuevo

**Decisión:** `/admin` pide `GET /admin/zonas` (aforo máximo por Zona) una vez, y **dos**
llamadas a `GET /admin/reservas` por la fecha y el turno elegidos — una por cada estado
activo, `?fecha=<fecha>&turnoId=<turno>&estado=CONFIRMADA&limit=100` y
`...&estado=PENDIENTE&limit=100` — en vez de una sola llamada sin filtrar por `estado`.

**Por qué dos llamadas filtradas y no una sola con `limit=100` (corrección durante la
revisión del PR de spec):** `GET /admin/reservas` sin `estado` devuelve **todas** las
Reservas de esa fecha y ese turno, incluidas `CANCELADA`/`NO_SHOW` acumuladas con el tiempo
— nada garantiza que el total quede bajo 100 filas. Filtrando por `estado`, en cambio, la
cota sí es real: cada Reserva activa suma al menos 1 comensal al aforo de su Zona, así que
la cantidad de filas `CONFIRMADA` más `PENDIENTE` de una fecha y un turno nunca supera la
suma de `aforoMaximo` de las Zonas (60 en el seed) — muy por debajo de 100. Sin este
filtro, una consulta silenciosamente truncada en 100 filas podía omitir Reservas activas y
mostrar un aforo menor al real.

Con esas respuestas, calcula en el cliente:

```
ocupacionPorZona[zona] = suma(comensales de las Reservas de esa Zona, uniendo ambas llamadas)
ocupacionGlobal        = suma(ocupacionPorZona de todas las Zonas)
```

Es la misma regla de `config.yaml` §6 ("Las reservas CANCELADA y NO_SHOW no cuentan para el
aforo") que ya aplica el backend como tope duro al crear una Reserva (`disponibilidad`,
`reservas-crear`): el dashboard no inventa una definición de ocupación propia, lee la fuente
de verdad (las Reservas reales) y reproduce el mismo cálculo, en vez de pedirle al backend
un número ya agregado.

**El aforo *máximo* global (`ConfiguracionNegocio.aforoGlobal`) no tiene de dónde salir
hoy** (hallazgo de la revisión del PR de spec): `GET /admin/zonas` solo devuelve el
`aforoMaximo` de cada Zona, nunca el de `ConfiguracionNegocio`; `aforoGlobal` hoy es interno
del validador de `disponibilidad` (`cargarContexto`) y ningún endpoint lo expone. Sumar los
`aforoMaximo` de las Zonas **no** es equivalente al `aforoGlobal` real: son dos topes
independientes (`config.yaml` §6: "se validan los dos topes... no solo el de la zona"), y
hoy 40 + 20 = 60 coincide con el `aforoGlobal` del seed por casualidad, no por relación
lógica entre ambos. Con estos datos, este change **muestra la ocupación global calculada,
sin un máximo global de referencia** (sí muestra máximo por Zona, que si está disponible).
Mostrar "X / 60" a nivel global exige que un change de backend exponga `aforoGlobal` (por
ejemplo, agregándolo a la respuesta de `GET /admin/zonas` o a un endpoint nuevo chico) —
alcance fuera de este change, que es frontend-only. Queda en Open Questions.

**Alternativa considerada:** un endpoint nuevo `GET /admin/aforo` que devuelva la ocupación
ya calculada, con el aforo global incluido. Se descarta por ahora: agregar un endpoint es
alcance de un change de backend, y las dos llamadas filtradas de arriba ya alcanzan para
el número que sí se puede mostrar (ocupación, y el máximo por Zona) sin ese endpoint. Si el
equipo decide resolver el aforo global, ese change de backend puede reemplazar las dos
llamadas de este `design.md` por una sola, sin cambiar la forma en que la pantalla
presenta el resultado.

### D6: Confirmación de acciones irreversibles con un patrón de dos pasos en línea, no un `Dialog` nuevo

**Decisión:** las tres acciones irreversibles de este change (baja de Mesa, rechazar una
Reserva VIP, marcar `NO_SHOW`) confirman con un patrón de dos pasos **en el mismo lugar del
control**, sin abrir una ventana modal: el botón de la acción cambia a mostrar "¿Confirmar
[acción]?" con dos botones (confirmar / cancelar) en su lugar, y vuelve a su estado
original si se hace clic afuera o se cancela.

**Por qué no una ventana modal:** el `design.md` de `frontend-cliente` (D5, ya aprobado,
sin implementar) va a agregar una primitiva `Dialog` nueva sobre `<dialog>` para su propio
paso de confirmar cancelación. Como ninguno de los dos changes está implementado todavía,
agregar acá una segunda primitiva `Dialog` (aunque fuera idéntica) sería la misma clase de
colisión que ya le pasó a este proyecto con dos controllers registrando `AuthModule` en
paralelo (#27/#33) o con dos búsquedas de código+email: quien implemente segundo pisaría o
duplicaría el trabajo del primero. El patrón en línea no necesita ninguna primitiva nueva,
así que evita la colisión sin depender de coordinar quién implementa primero.

**Alternativa considerada:** esperar a que `frontend-cliente` implemente `Dialog` y
reutilizarlo. Se descarta: acoplaría el orden de implementación de dos changes de dueños
distintos sin necesidad — el patrón en línea cumple el mismo requisito (confirmación
explícita antes de una acción irreversible) sin esa dependencia.

### D7: Grupos de trabajo por prerrequisito de backend

Mismo criterio que D10 de `frontend-cliente`: los grupos A (login), B (dashboard), C (CRUD
de salón) y D (listado de Reservas) tienen su backend mergeado hoy y se implementan en ese
orden. Los grupos E (confirmar/rechazar VIP) y F (marcar `NO_SHOW`) quedan bloqueados hasta
que `reserva-vip` y `cancelacion-turnos` mergeen sus endpoints — sin escribir esos tipos a
mano ni agregar paths ficticios a `openapi/openapi.yaml` (`config.yaml` §3).

### D8: Manejo de errores reutilizando `ErrorApi`, sin extenderlo

**Decisión:** cada pantalla mapea el `ErrorApi` que ya devuelve `toAdminApiResult` (D2) a su
propia UI (errores de campo para `validacion`, un mensaje junto al control para
`conflicto`/`no-encontrado`, un banner para `desconocido`), igual que ya hace
`frontend-cliente` para el cliente sin cuenta (D8 de su `design.md`, para los errores de
campo del `400`). No se agrega ningún tipo ni caso nuevo a `ErrorApi`: los códigos que este
change consume (`400`, `404`, `409`, `429`, `5xx`) ya están cubiertos.

### D9: Sin dependencias nuevas

Sesión: `sessionStorage` nativo. Decodificar el JWT para leer `exp`: `atob()` sobre la
segunda parte del token (nunca se verifica la firma en el cliente, así que no hace falta
una librería de JWT). Formularios: los mismos `Field`/`Input`/`Select` de `frontend-base`,
sin una librería de manejo de formularios. Tablas: HTML semántico (`<table>`), sin una
librería de grillas.

## Risks / Trade-offs

- **[Riesgo]** D3: cuando `frontend-cliente` implemente su migración a voseo coloquial de
  `errors.ts`, los mensajes genéricos compartidos (5xx, red) van a mostrarse en un tono
  distinto del resto de la pantalla de admin → **Mitigación:** es una inconsistencia de
  tono, no de comportamiento; se puede corregir después con un ajuste puntual si molesta en
  la práctica, sin rehacer nada de este change.
- **[Riesgo]** D6: si `frontend-cliente` implementa `Dialog` primero, dos patrones de
  confirmación distintos (modal en el cliente, en línea en el admin) conviven en el
  producto → **Mitigación:** son públicos distintos (cliente sin cuenta vs. panel interno)
  con expectativas de uso distintas; no hace falta que luzcan igual. Si el equipo prefiere
  unificarlos más adelante, es un cambio de UI aislado, no un rediseño.
- **[Riesgo]** D1/D4: un token en `sessionStorage` es legible por cualquier script que
  logre ejecutar JavaScript en la página (XSS) → **Mitigación:** mismo nivel de exposición
  que ya acepta el MVP para el JWT (`config.yaml` §5 no pide `httpOnly`); la vida corta del
  token (60 minutos) acota la ventana. No hay HTML generado desde datos sin sanitizar en
  las pantallas de este change que abra una superficie de XSS nueva.
- **[Riesgo]** D5: calcular el aforo en el cliente asume que `GET /admin/reservas` devuelve
  todas las Reservas del turno en una sola página (`limit=100`) → **Mitigación:** ya
  anotado como asunción explícita, no un bug oculto; un turno con más de 100 Reservas
  activas no es realista para el aforo máximo de 40/20 que fija el seed.
- **[Trade-off]** El guard de rutas de D4 corre después de la primera pintada (el layout
  necesita montarse en el cliente para leer `sessionStorage`), así que una persona sin
  sesión puede ver un parpadeo breve antes de la redirección. Aceptable para un panel
  interno; no es la clase de requisito de SEO o de primera carga que justificaría la cookie
  `httpOnly` de la alternativa descartada en D1.

## Migration Plan

1. Sin cambios de backend, de schema ni de `openapi/openapi.yaml`.
2. Sin variables de entorno nuevas: reutiliza `NEXT_PUBLIC_API_URL` de `frontend-base`.
3. Rollback: revertir el PR. `/admin` vuelve al placeholder; ningún otro change depende del
   código de este.

## Open Questions

- **Tono final de los mensajes genéricos compartidos** (D3): si al implementarse
  `frontend-cliente` la inconsistencia de tono molesta en la práctica, decidir si
  `errors.ts` necesita mensajes por audiencia (parámetro) en vez de un texto fijo. No
  bloquea la implementación de ninguno de los dos changes.
- **Unificar el patrón de confirmación** (D6) con el `Dialog` de `frontend-cliente` una vez
  que ambos estén implementados, si el equipo lo prefiere visualmente. No es parte de este
  change.
- **Exponer `ConfiguracionNegocio.aforoGlobal` por API** (D5, hallazgo de la revisión del
  PR de spec): sin esto, el dashboard no puede mostrar un máximo de referencia para la
  ocupación global, solo el número ocupado. Es un change de backend chico (agregar el
  campo a la respuesta de `GET /admin/zonas`, o un endpoint nuevo), fuera de alcance de
  este change frontend-only. Si el equipo lo prioriza, un PR de seguimiento lo agrega y
  este change solo necesita leer el campo nuevo, sin rehacer la pantalla.
