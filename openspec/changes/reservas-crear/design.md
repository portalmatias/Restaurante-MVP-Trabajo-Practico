## Context

Ver `proposal.md` (sección Why) para la motivación y `specs/reservas-crear/spec.md` para el
comportamiento esperado. Este documento resuelve cómo se arma la creación sobre el validador
compartido de `disponibilidad`, cómo se garantiza el aforo bajo concurrencia sin reintentos y
qué errores de Prisma se traducen a qué respuesta.

Estado del que se parte:

- **PR #12 (`origin/feature/modelo-dominio`, sin mergear).** `schema.prisma` tiene `Reserva`
  con `mesaId`, `turnoId`, `fecha` (`@db.Date`), `comensales`, `estado` (default `PENDIENTE`),
  `nombreCliente`, `emailCliente`, `telefonoCliente` y `codigoReserva @unique`. La zona de una
  reserva sale **de su mesa** (`Reserva` no tiene `zonaId`). `Mesa.etiqueta` es `@unique`.
  `Zona.requiereConfirmacionAdmin` es `true` en VIP y `false` en STANDARD en el seed. El
  índice único parcial `(mesaId, turnoId, fecha) WHERE estado IN ('PENDIENTE','CONFIRMADA')`
  está editado a mano en la migración.
- **`ReservasService.crearReserva` de #12** recibe `mesaId` y `zonaSolicitadaId` ya elegidos,
  valida inline turno activo, día de la semana, capacidad, aforo de zona y aforo global con
  `throw` que cortan en el primero, **no** valida anticipación ni rango de comensales, corre
  con `isolationLevel: Serializable` y reintenta hasta 3 veces ante `P2034`. En el último
  intento vuelve a lanzar el `P2034` crudo, que Nest convierte en `500`. Genera el código con
  `randomInt` sobre el alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sin `0/O`, `1/I/L`) y
  reintenta la colisión de `codigoReserva` con `SAVEPOINT` hasta 5 veces. Un `P2002` sobre
  `mesaId` lo traduce a `409`.
- **`transicionarEstado` de #12** es el único punto que cambia `estado`. Lo usan
  `cancelacion-turnos` y `reserva-vip`. Este change no lo toca.
- **`backend/test/reservas-invariantes.integration-spec.ts` de #12** prueba los invariantes
  llamando a `crearReserva({ mesaId, zonaSolicitadaId, ... })` y espía el método privado
  `generarCodigoReserva` para forzar una colisión.
- **`disponibilidad` (spec en `main`, implementación pendiente)** define en
  `backend/src/disponibilidad/`: `cargarContexto(db | tx, solicitud)` (único acceso a la base,
  `NotFoundException` si falta turno o zona), `evaluarReglas(contexto, solicitud, ahora)`
  (pura, ocho `CodigoMotivo` en orden fijo), `calcularLugaresRestantes`,
  `bloquearTurnoFecha(tx, turnoId, fecha)` (`pg_advisory_xact_lock`, D6) e `inicioTurnoUtc`
  en `common/timezone.ts`. Su D1 ya dibuja el flujo que usa este change, y su Open Question le
  deja a este change el cuerpo del `409`.
- `ContextoReserva`, tal como lo describe `disponibilidad`, trae las **capacidades** de las
  mesas libres, pero no su `id` ni su `etiqueta`, y de la zona trae rango, anticipaciones y
  aforo, pero no `requiereConfirmacionAdmin`. Este change necesita esos tres datos (D3, D4).
- `cancelacion-turnos` (en `main`) ya fija para el mismo controller el tag `Reservas`, el
  `operationId` `ReservasController_cancelar` y el patrón `^[A-Za-z0-9]{8}$` para el código.
- Las rutas de admin se protegen por ruta con `JwtAuthGuard` + `RolesGuard` (`auth-admin`), no
  con un guard global. `POST /reservas` no lleva guard.

## Goals / Non-Goals

**Goals:**
- Que la creación y la consulta evalúen exactamente las mismas reglas, con el mismo código,
  sin una sola regla duplicada en `reservas/`.
- Garantizar los invariantes 1 a 4 de §6 bajo creaciones concurrentes, sin bucles de
  reintento y sin responder nunca `500` por un choque.
- Asignar la mesa de forma determinista, para que los tests y el admin puedan predecir cuál
  toca.
- Dejar escrito el contrato OpenAPI sin romper el chequeo de deriva de CI.

**Non-Goals:**
- No cambia ninguna regla ni ningún escenario de `disponibilidad`, ni la clave del lock.
- No define la búsqueda por código + email ni su throttling (`reserva-consultar`).
- No define reasignación manual de mesa. Si un change futuro la agrega, tiene que tomar
  `bloquearTurnoFecha` (riesgo ya anotado en `disponibilidad`).
- No cambia el seed de `modelo-dominio`.

## Decisions

### D1: Flujo de creación sobre el validador compartido

`ReservasController.crear` valida el body con `CrearReservaDto` y delega en
`ReservasService.crearReserva(input)`. El método conserva el nombre de #12, pero su entrada
cambia: ya no recibe `mesaId` ni `zonaSolicitadaId`, recibe `zonaId` y la mesa la elige el
service.

```
 POST /reservas (publico)
        |
        v
 +-----------------------------+
 | ReservasController.crear    |  CrearReservaDto invalido -> 400 (ValidationPipe)
 +--------------+--------------+
                |  CrearReservaInput (fecha ya como Date.UTC)
                v
 +-------------------------------------------------------------------------------+
 | ReservasService.crearReserva(input)                                           |
 |  prisma.$transaction(async tx => { ... })      <- READ COMMITTED (default)    |
 |                                                                               |
 |   1. bloquearTurnoFecha(tx, turnoId, fecha)     primera sentencia (D2)        |
 |   2. contexto = cargarContexto(tx, solicitud)   turno/zona inexistente -> 404 |
 |   3. motivos  = evaluarReglas(contexto, solicitud, new Date())                |
 |        motivos.length > 0 -> 409 con TODOS los motivos (D8)                   |
 |   4. mesa     = elegirMesaBestFit(contexto.mesasLibres, comensales)  (D3)     |
 |   5. estado   = contexto.zona.requiereConfirmacionAdmin                       |
 |                   ? PENDIENTE : CONFIRMADA                           (D4)     |
 |   6. SAVEPOINT + tx.reserva.create(...) con codigo nuevo             (D5)     |
 |        P2002 codigoReserva -> ROLLBACK TO SAVEPOINT y otro codigo             |
 |        P2002 mesaId        -> 409 SIN_MESA_DISPONIBLE                (D9)     |
 |  })                                                                           |
 |  P2028 / P2024 al abrir o por timeout -> 409 sin motivos             (D9)     |
 +---------------+---------------------------------------------------------------+
                 |  importa funciones, no reimplementa
                 v
 backend/src/disponibilidad/: bloquearTurnoFecha, cargarContexto, evaluarReglas,
                              CodigoMotivo, MotivoNoDisponible
```

- `ReservasModule` importa `DisponibilidadModule` y usa sus funciones exportadas. En
  `reservas/` no queda ninguna comparación de turno activo, día de la semana, anticipación,
  rango, aforo ni capacidad: todas las validaciones inline de `ejecutarCreacionReserva` de
  #12 se borran.
- `ahora` se toma **después** de obtener el lock (paso 3), no al entrar al endpoint. Una
  creación que esperó el lock evalúa la anticipación con la hora real en que decide.
- `elegirMesaBestFit` es una función pura de `reservas/`. Nunca devuelve `undefined` cuando
  `evaluarReglas` no informó `SIN_MESA_DISPONIBLE`, porque las dos leen la misma lista del
  mismo contexto. Si igual pasa, es un bug y se lanza un error interno, no un `409`.
- Los invariantes quedan cubiertos así: el 1, por el lock más el índice único parcial; el 2,
  porque best fit solo elige mesas con `capacidad >= comensales`; el 3, por
  `TURNO_INACTIVO` y porque la mesa sale de la lista de la zona pedida; el 4, por
  `AFORO_ZONA` y `AFORO_GLOBAL` evaluados bajo el lock.

**Alternativa considerada (llamar a `DisponibilidadService.consultar` antes de crear):** se
descarta porque la consulta corre fuera de la transacción y sin lock, y entre la consulta y
el `INSERT` otra creación puede tomar el último lugar. Además obligaría a volver a leer
contexto dentro de la transacción para elegir mesa.

**Alternativa considerada (conservar las validaciones inline de #12 y sumar las que
faltan):** se descarta. Es justo la duplicación que `docs/roadmap-mvp.md` §7 marca como el
mayor riesgo del proyecto, y los mensajes y el orden ya difieren hoy de los de
`disponibilidad`: #12 corta en el primer `throw` y no informa `CodigoMotivo`.

### D2: `READ COMMITTED` más lock como primera sentencia, sin `Serializable` ni reintentos

La transacción usa el aislamiento por defecto de Postgres (`READ COMMITTED`) y su primera
sentencia es `bloquearTurnoFecha`. Se **borran** `isolationLevel: Serializable`,
`SERIALIZACION_MAX_INTENTOS` y el bucle que reintenta ante `P2034`.

Por qué el lock solo funciona con `READ COMMITTED`: en ese nivel cada **sentencia** toma su
propio snapshot al empezar. La creación B que esperó en `pg_advisory_xact_lock` hasta que A
hizo `COMMIT` corre su `aggregate` después, así que ve la reserva de A y evalúa el aforo con
ella sumada.

Por qué `Serializable` (o `REPEATABLE READ`) con el lock es incorrecto: en esos niveles el
snapshot se toma en la **primera sentencia** de la transacción y se mantiene hasta el final.
La primera sentencia es la llamada al lock, así que B queda con un snapshot de **antes** del
`COMMIT` de A. Cuando por fin obtiene el lock, el `aggregate` no ve la reserva de A. En
`REPEATABLE READ` eso deja pasar el sobrecupo. En `Serializable` Postgres detecta el ciclo y
aborta B con un error de serialización (`P2034`). El lock no sirvió para nada: siguen los
abortos y hacen falta los reintentos que se querían eliminar.

Por qué no alcanza `Serializable` sin lock (lo que hace #12 hoy): con tablas chicas los
predicate locks de Postgres escalan a página o relación y abortan transacciones que no
chocaban de verdad, así que con creaciones simultáneas los `P2034` son esperables aunque no
haya sobrecupo real. Si una creación agota los 3 intentos, #12 relanza el `P2034`, que llega
al cliente como `500`. Subir el número de intentos no lo garantiza, solo
lo hace menos probable.

**Alternativa considerada:** mantener `Serializable` y sumar el lock "por las dudas". Se
descarta por lo explicado arriba: es la combinación que aborta siempre que hay espera.

**Alternativa considerada:** `SELECT ... FOR UPDATE` sobre una fila. Ya descartada en D6 de
`disponibilidad`: no hay una fila natural de `(turno, fecha)`.

### D3: Best fit con desempate por `etiqueta`, sobre la lista del contexto

`elegirMesaBestFit(mesasLibres, comensales)` filtra las mesas con
`capacidad >= comensales`, ordena por `capacidad` ascendente y después por `etiqueta`
ascendente (orden lexicográfico de string), y devuelve la primera. Es pura y se prueba sin
base. Con el seed, 2 comensales en STANDARD van a `S1` y, si `S1` está ocupada, a `S2`; 3
comensales van a `S3` (capacidad 4) y 5 a `S4` (capacidad 6).

Para eso `ContextoReserva` tiene que exponer las mesas libres como
`mesasLibres: { id, etiqueta, capacidad }[]` y no solo como capacidades. Es una **extensión
explícita** del cargador de `disponibilidad`: la consulta `findMany` de mesas con
`reservas: { none: ... }` ya lee esas filas, así que solo cambia el `select`. `evaluarReglas`
sigue usando únicamente la capacidad. No cambian el nombre ni la firma de `cargarContexto`,
ni ninguna regla. Si la implementación de `disponibilidad` ya la incluye, no hay nada que
hacer; si no, se agrega en el PR de este change con un test del cargador.

**Alternativa considerada (query propia en `reservas/`, ordenada por capacidad):** es lo que
sugiere literalmente el roadmap. Se descarta porque duplicaría la definición de "mesa libre"
(qué estados cuentan, qué fecha y qué turno) en dos lugares. Si divergen, `evaluarReglas` puede
decir que hay mesa y la query no encontrar ninguna, o al revés. El orden por capacidad
ascendente del roadmap se conserva, solo que se aplica sobre la lista ya cargada.

**Alternativa considerada (desempate por `id`):** se descarta porque `id` es un UUID
aleatorio, así que el resultado es determinista pero impredecible para un test o para el
admin. `etiqueta` es única (`@unique` en #12) y legible.

### D4: Estado inicial según `requiereConfirmacionAdmin`, no según el nombre de la zona

`estado = zona.requiereConfirmacionAdmin ? PENDIENTE : CONFIRMADA`. El dato viaja en
`ContextoReserva.zona`, con la misma extensión explícita de D3 (el cargador ya lee la zona
completa con `findUnique`).

**Alternativa considerada:** `zona.nombre === 'VIP'`. Se descarta porque §6 lo define como
una propiedad de la zona ("Requiere confirmación del admin") y porque `reserva-vip` decidió
que su gate es el estado `PENDIENTE` y no el nombre de la zona, apoyándose en que
`reservas-crear` solo crea `PENDIENTE` en zonas con `requiereConfirmacionAdmin = true`. Este
change da esa garantía por construcción.

### D5: Código de reserva: se reusa el generador de #12

Se conserva `generarCodigoReserva` de #12 (8 caracteres con `randomInt` de `node:crypto` sobre
un alfabeto de 32 símbolos sin ambiguos, unas 2^40 combinaciones) y su reintento: cada intento
de `INSERT` corre dentro de un `SAVEPOINT` y, ante `P2002` sobre `codigoReserva`, hace
`ROLLBACK TO SAVEPOINT` y prueba otro código, hasta 5 veces. El `SAVEPOINT` es necesario porque
en Postgres una sentencia fallida aborta el resto de la transacción, y hay que conservar el
lock y el contexto ya evaluado. Se mantiene el nombre del método privado para que el test de
colisión de #12 siga valiendo.

Agotar los 5 intentos es prácticamente imposible (con 10.000 reservas, la probabilidad de una
colisión es del orden de 10^-8 por intento). Si pasa, responde `409` sin motivos (D9), no `500`.

**Alternativa considerada:** derivar el código de una secuencia o del `id`. Se descarta porque
un código predecible facilita la enumeración, que es justo lo que §5 quiere evitar.

El formato exacto que ve el cliente (mayúsculas, alfabeto) no está fijado por ninguna spec más
allá de "alfanumérico de 8 caracteres": ver Open Questions.

### D6: Entrada: body JSON con `CrearReservaDto`

| Campo | Validación | Motivo |
|---|---|---|
| `fecha` | el mismo validador de `fecha` de `ConsultarDisponibilidadDto` (patrón `YYYY-MM-DD` y fecha existente) | una sola definición de fecha de calendario (D4 de `disponibilidad`) |
| `turnoId`, `zonaId` | `@IsUUID()` | igual que la consulta |
| `comensales` | `@IsInt()`, `@Min(1)` | en JSON llega como número, sin `@Type` |
| `nombreCliente` | `@IsString()`, no vacío tras `trim`, `@MaxLength(100)` | |
| `emailCliente` | `@IsEmail()`, `@MaxLength(254)` | lo usan `reserva-consultar` y `cancelacion-turnos` para identificar |
| `telefonoCliente` | `@IsString()`, no vacío tras `trim`, `@MaxLength(30)` | formato libre, ver Open Questions |

Los nombres de campo son los del modelo de #12, para no tener un mapeo campo a campo entre el
DTO y el `create`. El service arma el `data` del `INSERT` campo por campo desde el input, así
que `mesaId`, `estado`, `codigoReserva` o `id` **no llegan nunca** a la base aunque el pipe
global cambie.

**Campos de más: `400`.** El `ValidationPipe` global de `main.ts` ya tiene `whitelist: true` y
`forbidNonWhitelisted: true` (los incorporó `auth-admin`, y `disponibilidad` los usa en sus
tests). Por eso un body con `mesaId`, `estado`, `codigoReserva` o cualquier otro campo fuera de
los siete del DTO se rechaza con `400` antes de llegar al controller. La garantía que importa
(el cliente no elige mesa, estado ni código) se cumple con más fuerza que ignorando el campo.

**Alternativa descartada:** ignorar los campos de más y responder `201`, como proponía la
primera versión de este diseño. Obligaría a quitar `forbidNonWhitelisted` del pipe global, que
es una decisión de `auth-admin` y cambia el comportamiento de `disponibilidad` y de las rutas
de admin. Un pipe por ruta no alcanza: el global corre antes y ya rechaza el body.

### D7: Respuesta `201` mínima

`ReservaCreadaRespuesta` tiene `codigoReserva`, `estado`, `fecha` (`YYYY-MM-DD`, armada con
`getUTC*`), `turnoId`, `zonaId` y `comensales`. **No** incluye el `id` interno (lo usan las
rutas de admin de `reserva-vip` y `cancelacion-turnos`), la mesa (no es un concepto del
cliente y el admin la puede reasignar) ni los datos de contacto (el cliente ya los tiene).

**Alternativa considerada:** devolver la entidad `Reserva` completa. Se descarta porque expone
el `id` y la `mesaId` en una ruta pública y acopla el contrato al schema de Prisma.

### D8: El `409` informa todos los motivos

Cuando `evaluarReglas` devuelve motivos, el service lanza
`new ConflictException({ statusCode: 409, message, error: 'Conflict', motivos })`. Nest usa
ese objeto como cuerpo tal cual. `message` es un texto fijo en español ("No se pudo crear la
reserva") y `motivos` es la lista completa en el orden fijo de `CodigoMotivo`. Esto cierra la
Open Question de `disponibilidad`.

**Alternativa considerada (solo el primer motivo):** se descarta porque el formulario muestra
los motivos de la consulta y los del `409` con el mismo componente (riesgo 1 de
`disponibilidad`). Si la creación informara menos que la consulta, el usuario corrige un
problema, reintenta y recién ahí se entera del siguiente.

**Alternativa considerada (`409` con `message` como texto y sin `motivos`):** se descarta
porque el frontend tendría que parsear texto para saber qué corregir.

### D9: Traducción de errores y orden de las respuestas

Orden: `400` (pipe, antes del service), después `404` (`cargarContexto`, turno primero y zona
después), después `409` de reglas y por último `409` por choques al escribir.

| Error | Dónde | Respuesta |
|---|---|---|
| `NotFoundException` | `cargarContexto` | `404` tal cual |
| motivos no vacíos | `evaluarReglas` | `409` con `motivos` (D8) |
| `P2002` con `target` sobre `codigoReserva` | `create` | reintento con otro código (D5) |
| `P2002` con `target` sobre `mesaId` | `create` | `409` con `motivos: [SIN_MESA_DISPONIBLE]` |
| códigos agotados | `create` | `409` con `motivos: []` |
| `P2028` (timeout o no se pudo abrir la transacción) o `P2024` (sin conexión libre en el pool) | `$transaction` | `409` con `motivos: []` y un `message` que pide reintentar |
| cualquier otro error | | se propaga (`500` legítimo, es un bug o la base caída) |

Con el lock, el `P2002` sobre `mesaId` no debería ocurrir: solo aparece si otra escritura
saltea `bloquearTurnoFecha`. Se traduce igual, como defensa, porque el índice parcial es la
garantía de base del invariante 1. `P2028` y `P2024` aparecen si muchas creaciones del mismo
`(turno, fecha)` se encolan en el lock más tiempo que el `timeout` de la transacción o agotan
el pool. No son un error del servidor, son "había demasiada gente reservando a la vez".

**Alternativa considerada (`503` para `P2028`/`P2024`):** se descarta porque §7 fija
400/404/409 para este tipo de casos y no lista `503`, y porque para el frontend el tratamiento
es el mismo que cualquier `409`: mostrar el mensaje y dejar reintentar.

### D10: Cómo se prueba

- **Unitarios** (`reservas/elegir-mesa-best-fit.spec.ts`): best fit y desempate, sin base.
  Las reglas ya las prueba `disponibilidad` con `ahora` inyectado y no se vuelven a probar
  acá.
- **Integración del service** (`backend/test/reservas-invariantes.integration-spec.ts` de #12,
  adaptado): los invariantes 1 a 4 pasando por `crearReserva` sin `mesaId`, con zonas y mesas
  propias para controlar qué mesa elige best fit, más el estado inicial por
  `requiereConfirmacionAdmin`.
- **Concurrencia** (`backend/test/reservas-concurrencia.integration-spec.ts`), sin mocks de
  Prisma:
  - Aforo: con `Promise.all`, 4 creaciones de 3 comensales con aforo VIP 8 dan exactamente 2
    `201` y 2 `409 AFORO_ZONA`. Se repite 10 veces.
  - Mesa: 2 creaciones de 7 comensales en STANDARD, con la mesa de 8 como única que alcanza,
    dan 1 `201` y 1 `409 SIN_MESA_DISPONIBLE`.
  - Aforo global: dos zonas distintas compitiendo por el aforo global.
  - En todos los casos se afirma que ningún resultado es un error distinto de
    `ConflictException`.
- **Choque que devuelve 409 y no 500**, con errores reales de la base:
  - `P2002` de mesa: se inserta a mano una reserva activa en `S1` y se espía
    `elegirMesaBestFit` para que devuelva `S1`. El índice parcial real rechaza el `INSERT` y
    el resultado tiene que ser `ConflictException` con `SIN_MESA_DISPONIBLE`.
  - `P2028`: una transacción auxiliar toma `bloquearTurnoFecha` para el mismo `(turno, fecha)`
    y lo retiene más que el `timeout` de la creación. El resultado tiene que ser
    `ConflictException` y no un error de Prisma.
- **e2e HTTP** (`backend/test/reservas-crear.e2e-spec.ts`, Supertest): `201` sin
  `Authorization` con la forma de la respuesta, `400` (incluidos `mesaId`/`estado` en el
  body), `404`, `409` con `motivos` y un `Promise.all` HTTP donde todos los status están en
  `{201, 409}`. Usa el reloj real con fechas lejos de los bordes (D9 de `disponibilidad`).

Los unitarios corren con `TZ=UTC` y con `TZ=America/Argentina/Buenos_Aires`, igual que en
`disponibilidad`.

## Trampas

- **`fecha` a Prisma siempre como `Date.UTC(y, m - 1, d)`**, la misma que usa
  `cargarContexto`. Si se pasa `inicioTurnoUtc` u otro instante con hora, `@db.Date` trunca en
  UTC y la cena de las 22:00 local se guarda con fecha del día siguiente. La respuesta arma
  `fecha` con `getUTCFullYear/Month/Date`, nunca con `toISOString().slice(0, 10)` sobre un
  instante con hora.
- **El lock va antes de cualquier lectura.** Si `cargarContexto` corre antes que
  `bloquearTurnoFecha`, en `READ COMMITTED` igual lee datos viejos y decide con ellos. El
  orden es parte del contrato de D2 y tiene un test (el de aforo concurrente falla si se
  invierte).
- **`SAVEPOINT` con `$executeRawUnsafe`.** Se conserva el patrón de #12, con strings fijos sin
  interpolación. Si el `create` falla sin `ROLLBACK TO SAVEPOINT`, la siguiente sentencia de la
  transacción falla con "current transaction is aborted" y el error real se pierde.
- **`P2002.meta.target` con un índice editado a mano.** Según la versión de Prisma y del
  driver, `target` puede traer los nombres de campo o el nombre del índice
  (`reserva_mesa_turno_fecha_activa_key`). `esColisionDeCampo` de #12 busca `'mesaId'` en el
  `target`. El test de `P2002` de mesa (D10) lo verifica contra la base real, y si falla se
  compara también contra el nombre del índice.
- **Timeout de la transacción interactiva.** La espera por el lock ocurre **dentro** de la
  transacción, así que cuenta para `timeout` (5 s por defecto) y no para `maxWait`. Mientras
  espera, cada creación retiene una conexión del pool.

## Contrato OpenAPI

El fragmento de abajo **no** se agrega a `openapi/openapi.yaml` en este PR de spec, por el mismo
motivo que en `disponibilidad`: `npm run openapi:check` compara literalmente `paths` y
`components.schemas` contra lo que genera `@nestjs/swagger`, y un path sin controller pone CI en
rojo. Se copia al YAML en el PR de implementación (`feature/reservas-crear`), en el orden de D2
de `fundacion-repo`.

Nombres fijos, porque el diff es literal: schemas `CrearReservaDto`, `ReservaCreadaRespuesta` y
`ReservaRechazadaRespuesta`; `operationId` `ReservasController_crear`; tag `Reservas`, el mismo
que ya fijó `cancelacion-turnos` para este controller. Se reusan sin redefinir
`MotivoNoDisponible`, `CodigoMotivo` y `ErrorRespuesta` de `disponibilidad`. El `estado` de la
respuesta se declara como enum **inline** (sin `enumName`) con solo `PENDIENTE` y
`CONFIRMADA`, porque una reserva recién creada no puede tener otro estado. Así no se genera un
schema `EstadoReserva` que choque con el que definan los changes de admin, y no le aplica el
falso rojo de `x-enumNames` que `disponibilidad` anotó en sus riesgos.

```yaml
paths:
  /reservas:
    post:
      summary: Crear una reserva
      description: >-
        Crea una reserva sin cuenta para una fecha, un turno, una zona y una cantidad de
        comensales. Evalúa las mismas reglas que la consulta de disponibilidad en el momento de
        crear, asigna automáticamente la mesa libre más chica que alcance y genera el código de
        reserva. Queda `PENDIENTE` si la zona requiere confirmación del admin y `CONFIRMADA` si
        no. El cliente no elige mesa, estado ni código: si los manda, se responde 400. Es una ruta
        pública, sin autenticación.
      operationId: ReservasController_crear
      tags:
        - Reservas
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CrearReservaDto'
      responses:
        '201':
          description: Reserva creada. Devuelve el código que el cliente usa para consultarla o cancelarla.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ReservaCreadaRespuesta'
              examples:
                standard:
                  summary: STANDARD, queda confirmada
                  value:
                    codigoReserva: K7PM3QXA
                    estado: CONFIRMADA
                    fecha: '2026-09-19'
                    turnoId: 3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73
                    zonaId: b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19
                    comensales: 4
                vip:
                  summary: VIP, queda pendiente de confirmación
                  value:
                    codigoReserva: R2WN8HDE
                    estado: PENDIENTE
                    fecha: '2026-09-19'
                    turnoId: 3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73
                    zonaId: 5d2a9c41-7e3b-4f6a-a1d8-0c9b2e7f4a63
                    comensales: 6
        '400':
          description: >-
            El body está mal formado: falta un campo, la fecha no es `YYYY-MM-DD` o no existe, un
            id no es UUID, `comensales` no es un entero mayor o igual a 1, el email no es válido
            o el nombre o el teléfono están vacíos o son demasiado largos, o el body trae un campo
            que no es de los siete (por ejemplo `mesaId` o `estado`).
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorRespuesta'
              examples:
                bodyInvalido:
                  summary: Email inválido y comensales en cero
                  value:
                    statusCode: 400
                    message:
                      - emailCliente debe ser un email válido
                      - comensales debe ser un número entero mayor o igual a 1
                    error: Bad Request
        '404':
          description: El turno o la zona indicados no existen.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorRespuesta'
              examples:
                turnoInexistente:
                  summary: El turno no existe
                  value:
                    statusCode: 404
                    message: No existe un turno con id 3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73
                    error: Not Found
        '409':
          description: >-
            No se pudo crear la reserva. Si alguna regla de negocio lo impide, `motivos` trae
            todas las que fallan, en el mismo orden y con los mismos códigos que la consulta de
            disponibilidad. Si el problema fue un choque con otras reservas hechas al mismo
            tiempo, `motivos` puede venir vacío y conviene reintentar.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ReservaRechazadaRespuesta'
              examples:
                reglas:
                  summary: Anticipación y comensales fuera de rango en VIP
                  value:
                    statusCode: 409
                    message: No se pudo crear la reserva
                    error: Conflict
                    motivos:
                      - codigo: ANTICIPACION_MINIMA
                        mensaje: En la zona VIP se reserva con al menos 24 horas de anticipación.
                      - codigo: COMENSALES_FUERA_DE_RANGO
                        mensaje: La zona VIP admite de 2 a 12 comensales por reserva.
                concurrencia:
                  summary: Demasiadas reservas simultáneas para ese turno
                  value:
                    statusCode: 409
                    message: >-
                      Hay muchas reservas en curso para ese turno y esa fecha. Intentá de nuevo en
                      unos segundos.
                    error: Conflict
                    motivos: []
components:
  schemas:
    CrearReservaDto:
      type: object
      description: Datos para crear una reserva sin cuenta.
      properties:
        fecha:
          type: string
          format: date
          pattern: ^\d{4}-\d{2}-\d{2}$
          description: Fecha de calendario local del restaurante, sin hora (`YYYY-MM-DD`).
          example: '2026-09-19'
        turnoId:
          type: string
          format: uuid
          description: Id del turno.
          example: 3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73
        zonaId:
          type: string
          format: uuid
          description: Id de la zona.
          example: b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19
        comensales:
          type: integer
          minimum: 1
          description: Cantidad de comensales. Entero, mínimo 1.
          example: 4
        nombreCliente:
          type: string
          minLength: 1
          maxLength: 100
          description: Nombre de quien reserva.
          example: Ana Pérez
        emailCliente:
          type: string
          format: email
          maxLength: 254
          description: Email de quien reserva. Junto con el código, sirve para consultar o cancelar.
          example: ana.perez@example.com
        telefonoCliente:
          type: string
          minLength: 1
          maxLength: 30
          description: Teléfono de contacto, en formato libre.
          example: +54 9 11 5555-1234
      required:
        - fecha
        - turnoId
        - zonaId
        - comensales
        - nombreCliente
        - emailCliente
        - telefonoCliente
    ReservaCreadaRespuesta:
      type: object
      description: Reserva recién creada, sin datos internos ni de contacto.
      properties:
        codigoReserva:
          type: string
          pattern: ^[A-Za-z0-9]{8}$
          description: Código alfanumérico de 8 caracteres, único. Junto con el email, identifica la reserva.
          example: K7PM3QXA
        estado:
          type: string
          enum:
            - PENDIENTE
            - CONFIRMADA
          description: >-
            `PENDIENTE` si la zona requiere confirmación del admin, `CONFIRMADA` si no. Una
            reserva recién creada nunca está `CANCELADA` ni `NO_SHOW`.
          example: CONFIRMADA
        fecha:
          type: string
          format: date
          description: La misma fecha de calendario local enviada (`YYYY-MM-DD`).
          example: '2026-09-19'
        turnoId:
          type: string
          format: uuid
          description: Id del turno reservado.
          example: 3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73
        zonaId:
          type: string
          format: uuid
          description: Id de la zona reservada.
          example: b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19
        comensales:
          type: integer
          minimum: 1
          description: Cantidad de comensales reservados.
          example: 4
      required:
        - codigoReserva
        - estado
        - fecha
        - turnoId
        - zonaId
        - comensales
    ReservaRechazadaRespuesta:
      type: object
      description: Cuerpo del `409` de la creación de reservas.
      properties:
        statusCode:
          type: integer
          description: Siempre 409.
          example: 409
        message:
          type: string
          description: Explicación general en español.
          example: No se pudo crear la reserva
        error:
          type: string
          description: Nombre estándar del código HTTP.
          example: Conflict
        motivos:
          description: >-
            Todas las reglas que impiden la reserva, en el orden fijo de `CodigoMotivo`. Vacío
            solo cuando el rechazo se debe a un choque con reservas simultáneas.
          type: array
          items:
            $ref: '#/components/schemas/MotivoNoDisponible'
      required:
        - statusCode
        - message
        - error
        - motivos
```

## Risks / Trade-offs

- **[Riesgo]** La implementación de `disponibilidad` no expone `mesasLibres` con `id` y
  `etiqueta` ni `requiereConfirmacionAdmin` → **Mitigación:** D3 y D4 lo anotan como extensión
  explícita del `select` del cargador, sin cambiar firma ni reglas. La tarea 1.3 lo verifica
  antes de empezar y, si falta, se suma con su test en este PR. Conviene avisarle a quien
  implementa `disponibilidad` para que lo incluya directamente.
- **[Riesgo]** El `timeout` por defecto de la transacción (5 s) puede no alcanzar si muchas
  creaciones del mismo `(turno, fecha)` se encolan en el lock, y cada una retiene una conexión
  del pool mientras espera → **Mitigación:** cada transacción es corta (lock, tres o cuatro
  lecturas y un `INSERT`), y el volumen de un restaurante no se acerca a eso. Si pasa, D9 lo
  traduce a `409` y no a `500`. El test concurrente mide tiempos, y si hace falta se sube
  `timeout` explícitamente en `$transaction`.
- **[Riesgo]** Cambiar la entrada de `crearReserva` rompe los tests de invariantes de #12, que
  pasan `mesaId` → **Mitigación:** la tarea 3.1 los adapta **antes** de reescribir el service,
  así que primero quedan en rojo por el cambio de firma y después en verde. Cada invariante
  sigue teniendo al menos un test (§9).
- **[Riesgo]** Otra escritura que aumente ocupación sin tomar `bloquearTurnoFecha` (por ejemplo
  una reasignación de mesa futura) rompe la garantía de aforo → **Mitigación:** ya anotado en
  `disponibilidad`. Del lado de la mesa, el índice parcial sigue siendo la red de seguridad, y
  este change traduce ese choque a `409`.
- **[Trade-off]** El orden lexicográfico de `etiqueta` pone `S10` antes que `S2`. Solo afecta
  el desempate entre mesas de igual capacidad, y el resultado sigue siendo determinista.
- **[Trade-off]** Un `409` con `motivos: []` obliga al frontend a contemplar un rechazo sin
  motivo de negocio. Es el precio de no devolver `500` ni inventar un `CodigoMotivo` nuevo que
  la consulta nunca podría informar.
- **[Riesgo]** El doble clic o un reintento del navegador crean dos reservas iguales con códigos
  distintos → **Mitigación parcial:** el frontend deshabilita el botón mientras espera. La
  idempotencia del lado del servidor queda en Open Questions.
- **[Riesgo]** `POST /reservas` es público y sin rate limiting: un script puede llenar el aforo
  con reservas falsas → **Mitigación:** fuera del mínimo de §5, que exige throttling solo en
  consulta y cancelación. Queda en Open Questions. El admin puede rechazar las `PENDIENTE` de
  VIP.
- **[Riesgo]** Las reservas de ejemplo del seed de #12 usan códigos de 9 caracteres
  (`SEEDPND01`) que no cumplen el formato de 8 → **Mitigación:** no afecta a esta creación, que
  genera sus propios códigos, pero sí a `cancelacion-turnos`, que valida
  `^[A-Za-z0-9]{8}$` y no podría cancelarlas. Se corrige en #12 o en un `fix:` del seed (fuera
  de esta carpeta).

## Migration Plan

1. Sin migraciones: todos los campos que se escriben ya existen en el schema de #12.
2. Rollback: revertir el PR. `crearReserva` vuelve a la versión de #12 y `POST /reservas`
   desaparece. No quedan datos incompatibles, porque las reservas creadas tienen la misma forma.

## Open Questions

- **Formato visible del código de reserva.** Las specs fijan "alfanumérico de 8 caracteres,
  único", y `cancelacion-turnos` acepta `^[A-Za-z0-9]{8}$`. No está decidido si el alfabeto de
  #12 (solo mayúsculas, sin ambiguos) es parte del contrato ni si la búsqueda por código ignora
  mayúsculas y minúsculas. Lo resuelven juntos `reserva-consultar` y `cancelacion-turnos`. Este
  change genera siempre mayúsculas del alfabeto de #12, que es compatible con cualquiera de las
  dos respuestas.
- **Normalización del email.** No está decidido si `emailCliente` se guarda con `trim` y en
  minúsculas o tal cual llega, ni si la comparación de `reserva-consultar` y
  `cancelacion-turnos` ignora mayúsculas y minúsculas. Hasta que se decida, se persiste tal cual
  pasó la validación.
- **Envío de email con el código.** Ni §5 ni el roadmap lo piden, y no hay proveedor de email ni
  variables de entorno para uno. Hoy el único canal es la respuesta `201`, y el frontend tiene
  que mostrar el código de forma destacada.
- **Idempotencia de `POST /reservas`** (header `Idempotency-Key` o detección de duplicados por
  email, turno y fecha): no está pedida. Sin ella, un doble envío crea dos reservas.
- **Rate limiting de `POST /reservas`.** §5 lo exige para consulta y cancelación, no para
  crear. Si el equipo lo quiere, se reusa el `ThrottlerModule` que registre `auth-admin`.
- **RN-10 (máximo de reservas activas por cliente).** `disponibilidad` lo delegó a este change,
  pero el schema de #12 no tiene `maxReservasActivas` (el docx lo ponía en
  `ConfiguracionNegocio`), §6 no lo menciona y el roadmap no lo incluye en el alcance. Si se
  adopta, hace falta una migración, contar por email y definir su código de rechazo, que no
  sería un `CodigoMotivo` porque la consulta no conoce al cliente. Se decide antes del PR de
  implementación. Este change no lo implementa.
- **Validación del teléfono.** Queda en formato libre de hasta 30 caracteres. Si el frontend o
  el admin necesitan un formato (por ejemplo E.164), se ajusta el DTO sin cambiar el flujo.
