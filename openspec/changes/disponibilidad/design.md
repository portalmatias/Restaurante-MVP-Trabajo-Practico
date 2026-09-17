## Context

Ver `proposal.md` (sección Why) para la motivación y `specs/disponibilidad/spec.md` para el
comportamiento esperado. Este documento resuelve cómo se construye el validador compartido y
qué trampas de fechas y de concurrencia hay que evitar.

Estado del que se parte, en la rama `origin/feature/modelo-dominio` (PR #12, sin mergear):

- `schema.prisma` define `Turno.diaSemana` como enum `DiaSemana` (`LUNES`…`DOMINGO`),
  `Turno.horaInicio` como `@db.Time`, `Reserva.fecha` como `@db.Date`, la zona de una reserva
  **a través de su mesa** (`Reserva` no tiene `zonaId`) y `ConfiguracionNegocio` como fila
  única con `aforoGlobal`. No hay campo de zona horaria ni se va a agregar: el equipo fijó que
  `horaInicio`/`horaFin` son hora local de Argentina, UTC-3 fijo (§7 cuando se mergee #12).
- `backend/src/common/timezone.ts` (de #12) exporta `ARGENTINA_OFFSET_MS`,
  `horaLocalArgentinaAUtc` (solo la hora, sin fecha) y `diaSemanaDeFecha` (`getUTCDay()`).
- `ReservasService.crearReserva` valida inline turno activo, zona de la mesa, capacidad y
  aforo de zona dentro de `$transaction`, y ya usa `$executeRawUnsafe` para los `SAVEPOINT`.
  Este change no lo toca (ver proposal, Fuera de alcance).
- No hay `class-validator`, `class-transformer` ni `ValidationPipe` global en `backend/`.
- Node 20 como piso (§10), Prisma 6.19 y ninguna librería de fechas en el lockfile.
- `npm run openapi:check` compara literalmente `paths` y `components.schemas` del YAML escrito
  a mano contra lo que genera `@nestjs/swagger` (D1/D2 de `fundacion-repo`).
- La máquina de desarrollo corre en `America/Argentina/Buenos_Aires` y CI en UTC, así que
  cualquier cálculo que dependa de la zona horaria del proceso da resultados distintos en
  cada lado.

## Goals / Non-Goals

**Goals:**
- Separar el validador en piezas que `reservas-crear` pueda reusar sin copiar código, con las
  reglas como función pura testeable sin base y sin reloj.
- Fijar cómo se pasa de "fecha local + hora local del turno" a un instante UTC sin agregar
  dependencias.
- Fijar el mecanismo que impide que dos creaciones concurrentes superen el aforo, aunque lo
  use recién `reservas-crear`.
- Dejar escrito el contrato OpenAPI del endpoint sin romper el chequeo de deriva de CI.

**Non-Goals:**
- No define el cuerpo del `409` de `POST /reservas` (si informa el primer motivo o todos): lo
  decide `reservas-crear`.
- No define best fit, generación de código de reserva ni el `INSERT`.
- No agrega caché ni rate limiting a `GET /disponibilidad`. §5 exige throttling para las rutas
  con código de reserva, y esta consulta no expone datos personales.
- No cambia el seed de `modelo-dominio`.

## Decisions

### D1: Arquitectura del validador compartido

Módulo `backend/src/disponibilidad/`, con cinco piezas:

```
   GET /disponibilidad                           POST /reservas
   (este change, sin transaccion ni lock)        (change reservas-crear)
            |                                             |
            v                                             v
 +--------------------------+           +----------------------------------+
 | DisponibilidadController |           | ReservasService (futuro)         |
 |  DTO invalido -> 400     |           |  prisma.$transaction(tx):        |
 +------------+-------------+           |   1. bloquearTurnoFecha(tx)      |
              |                         |   2. cargarContexto(tx)          |
              v                         |   3. evaluarReglas -> motivos    |
 +--------------------------+           |      hay motivos -> 409          |
 | DisponibilidadService    |           |   4. best fit + INSERT           |
 |  consultar(query):       |           +----------------+-----------------+
 |   cargarContexto(prisma) |                            |
 |   evaluarReglas(ahora)   |                            |
 |   lugaresRestantes       |                            |
 +------------+-------------+                            |
              |     las dos usan las mismas piezas       |
              +--------------------+---------------------+
                                   |
 ..................................|......................................
 : backend/src/disponibilidad/     v   (el modulo exporta estas piezas)   :
 :  +--------------------+  +------------------------+  +--------------+ :
 :  | cargarContexto     |  | evaluarReglas          |  | bloquear-    | :
 :  |  (db o tx)         |  |  PURA: sin base y con  |  | TurnoFecha   | :
 :  |  unico acceso a la |  |  ahora inyectado       |  |  (solo tx)   | :
 :  |  base; 404 si no   |  |  usa inicioTurnoUtc    |  |              | :
 :  |  existe turno/zona |  |  (PURA, UTC-3 fijo)    |  |              | :
 :  +---------+----------+  +------------------------+  +------+-------+ :
 :............|.................................................|.........:
              v                                                 v
 +-------------------------------------------------------------------------+
 | PostgreSQL via Prisma: API tipada para leer, $executeRaw para el lock   |
 +-------------------------------------------------------------------------+
```

- **`cargarContexto(db: PrismaService | Prisma.TransactionClient, solicitud)`** devuelve un
  `ContextoReserva` de datos planos: turno (`activo`, `diaSemana`, `horaInicio`), zona
  (rango de comensales, anticipaciones, `aforoMaximo`), `aforoGlobal`, `ocupadosZona`, `ocupadosGlobal` y las capacidades de las mesas de la zona sin reserva
  activa en ese turno y esa fecha. Es el **único** punto que lee la base, siempre con la API
  tipada de Prisma (`findUnique`, `aggregate` con `estado in [PENDIENTE, CONFIRMADA]` y
  `mesa: { zonaId }` para la zona, `findMany` de mesas con `reservas: { none: ... }`). Si el
  turno o la zona no existen lanza `NotFoundException` (404). Recibe `db` o `tx` para que la
  misma función sirva fuera y dentro de una transacción.
- **`evaluarReglas(contexto, solicitud, ahora: Date): MotivoNoDisponible[]`** es una función
  pura. Aplica las ocho reglas en el orden fijo de la spec y devuelve todos los motivos. El
  reloj entra como parámetro, así que los bordes exactos (2 h, 1 h 59 min, 30 días) se
  prueban sin mocks ni timers falsos. El mismo archivo exporta un cálculo puro de
  `lugaresRestantes = max(0, min(aforoMaximo - ocupadosZona, aforoGlobal - ocupadosGlobal))`.
- **`inicioTurnoUtc(fecha, horaInicio): Date`** es un helper puro en
  `backend/src/common/timezone.ts` (D5).
- **`bloquearTurnoFecha(tx, turnoId, fecha)`** ejecuta
  `` tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${turnoId} || ':' || ${fechaISO}))` ``.
  Vive en este módulo para que la clave del lock exista en un solo lugar. Lo usa
  `reservas-crear` como **primera** sentencia de su transacción (D6).
- **`DisponibilidadService.consultar(query)`** hace `cargarContexto(prisma)`, luego
  `evaluarReglas(contexto, solicitud, new Date())` y calcula `lugaresRestantes`. No abre
  transacción ni toma el lock: la consulta es una foto del momento (§6).

`DisponibilidadModule` exporta el service y las funciones. `reservas-crear` importa el módulo
y no reimplementa ninguna regla. Así la regla de `diseno-general-app` ("`disponibilidad`
reutiliza el mismo validador que `reservas`") queda del lado correcto: el validador nace acá
y `reservas` depende de él, no al revés.

**Alternativa considerada:** poner las reglas dentro de `DisponibilidadService` como métodos
que consultan la base cada uno por su cuenta. Se descarta porque cada test de borde
necesitaría una base o un mock de Prisma (§9 pide base real para integración, no mocks), y
porque `reservas-crear` tendría que llamar al service fuera de su transacción o duplicar las
consultas con `tx`.

### D2: Informar todos los motivos, no solo el primero

`evaluarReglas` evalúa siempre las ocho reglas y devuelve todas las que fallan, en orden fijo.
**Alternativa considerada:** cortar en la primera regla que falla, como hace hoy
`crearReserva` con sus `throw`. Se descarta porque el formulario en vivo (RF-22) necesita
mostrar todo lo que hay que corregir a la vez (por ejemplo "cambiá la fecha" y "bajá la
cantidad de comensales"), y porque probar el orden fijo detecta reglas que dependen sin querer
del resultado de otra. El costo es mínimo: las reglas trabajan sobre datos ya cargados. El
orden fijo sirve para que `reservas-crear` elija, si quiere, el "primer" motivo sin
ambigüedad.

### D3: `200` en la consulta, `409` solo al crear

Una consulta válida responde `200` haya lugar o no. **Alternativa considerada:** responder
`409 Conflict` cuando no hay disponibilidad, reusando la semántica de RF-13. Se descarta:
`409` indica que el pedido choca con el estado del recurso y no se pudo aplicar, y una
consulta no aplica nada. "No hay lugar" es la respuesta a la pregunta, no un error. Con `409`
el frontend tendría que leer los motivos desde el camino de errores, y un monitoreo lo
contaría como falla. `422` también se descarta: la query mal formada ya es `400` por
convención de `ValidationPipe`, y tener dos códigos para input inválido no suma nada (la
convención 400/404/409 queda escrita en §7).

### D4: `fecha` como `YYYY-MM-DD` y no como instante ISO

`fecha` es la fecha de calendario local del restaurante, validada con
`^\d{4}-\d{2}-\d{2}$` más una comprobación de que existe, y se convierte con
`new Date(Date.UTC(y, m - 1, d))`, que es la misma forma en que Prisma devuelve `@db.Date`.
**Alternativa considerada:** aceptar un instante ISO 8601 con hora (por ejemplo
`2026-09-19T00:00:00-03:00`), leyendo RNF-06 al pie de la letra. Se descarta porque el
cliente no reserva un instante, reserva "el sábado 19" y un turno. Un instante obliga a elegir
una hora arbitraria, y según la zona horaria del navegador esa hora puede caer en otro día
UTC. Con eso la pregunta de qué día de la semana es pasa a depender de quién consulta.
`YYYY-MM-DD` es igual un formato ISO 8601 (fecha sin hora), así que no contradice RNF-06. La
aclaración va en §7.

### D5: Zona horaria: offset fijo UTC-3 (decisión del equipo en #12)

#12 fija que `Turno.horaInicio`/`horaFin` son hora local de Argentina
(`America/Argentina/Buenos_Aires`), UTC-3 fijo. Argentina no usa horario de verano desde 2009,
así que el offset no cambia. `inicioTurnoUtc(fecha, horaInicio): Date` es una función pura en
`backend/src/common/timezone.ts`, el archivo que crea #12:

```ts
new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate(),
  horaInicio.getUTCHours(), horaInicio.getUTCMinutes()) + 3 * 60 * 60 * 1000)
```

Solo usa getters `getUTC*`, así que no depende de la zona del proceso. Ejemplo: la cena del
sábado 2026-09-19 a las 22:00 local es `2026-09-20T01:00:00Z`. El instante UTC cae al día
siguiente y está bien: la fecha de la reserva sigue siendo el sábado. Hoy #12 trae
`horaLocalArgentinaAUtc`, que convierte solo la hora (sin fecha), y no alcanza; si al
implementar ya existe una función equivalente de fecha más hora se reusa, y si no, este change
la agrega a ese archivo (puede expresar el `+ 3 h` con `ARGENTINA_OFFSET_MS`).
`diaSemanaDeFecha` de #12 se reusa tal cual para el día de la semana.

**Alternativa considerada (librería):** `date-fns-tz` o `luxon`. Se descarta: §2 obliga a
justificar dependencias nuevas, y con un offset fijo no hay nada que resolver en tiempo de
ejecución. `Temporal` no existe en Node 20 sin flag ni polyfill, y el polyfill es otra
dependencia.

**Alternativa considerada (zona IANA configurable):** un campo
`ConfiguracionNegocio.zonaHoraria` (seed `America/Argentina/Buenos_Aires`) y el offset
calculado en cada instante con `Intl.DateTimeFormat(...).formatToParts`. Se descarta porque el
equipo decidió la zona fija, el restaurante es uno solo, está en Argentina y no hay horario de
verano. Queda como camino si alguna vez hay que soportar DST u otra sede: cambiaría solo el
helper (y de dónde sale la zona), no la spec ni las reglas.

### D6: Lock advisory por `(turno, fecha)` para la creación

`bloquearTurnoFecha` toma `pg_advisory_xact_lock(hashtext(turnoId || ':' || fecha))` como
primera sentencia de la transacción de creación. El lock se libera solo con el `COMMIT` o el
`ROLLBACK`. En `READ COMMITTED`, cada sentencia ve lo confirmado antes de empezar, así que el
`aggregate` que corre después de obtener el lock ya ve la reserva que insertó quien lo tenía
antes. La clave no incluye la zona a propósito: dos creaciones en zonas distintas del mismo
turno y fecha también compiten por el aforo global. El índice único parcial de
`modelo-dominio` sigue siendo la garantía de base contra dos reservas en la misma mesa.

**Alternativa considerada:** transacción `Serializable` con reintento ante `P2034`. Se
descarta porque obliga a escribir un bucle de reintentos, y con tablas chicas Postgres aborta
por falsos positivos (predicate locks que escalan a la página o a la relación), así que los
reintentos serían frecuentes justo en el caso que se quiere testear. Además, el manejo de
niveles de aislamiento y de los códigos `P` cambia en Prisma 8.

**Alternativa considerada:** `SELECT ... FOR UPDATE` sobre una fila existente. Se descarta
porque no hay una fila natural de `(fecha, turno)`. `Turno` es por día de la semana, así que
bloquear el turno serializa todos los sábados juntos. `Zona` no cubre el aforo global. Y la
fila singleton de `ConfiguracionNegocio` serializa todas las creaciones del sistema. Crear
una tabla de cupos solo para bloquear agrega una migración y datos a mantener.

### D7: `$executeRaw` no viola §2

§2 prohíbe "acceso SQL directo por fuera de Prisma". `$executeRaw` **es** API de Prisma: pasa
por su conexión y su transacción (`tx`) y parametriza los valores del template, así que no
hay concatenación ni riesgo de inyección. El SQL es una sola llamada a una función del
motor que la API tipada no expone. Hay antecedente en el repo: `ReservasService` de #12 usa
`$executeRawUnsafe` para `SAVEPOINT`. Se usa `$executeRaw` y **no** `$queryRaw` porque
`pg_advisory_xact_lock` devuelve `void` y Prisma falla al deserializar esa columna. Toda la
lectura de datos (`cargarContexto`) sigue con la API tipada.

### D8: Validación de la query y códigos de error

Un DTO `ConsultarDisponibilidadDto` con `class-validator`: `@Matches` más un validador de
fecha existente para `fecha`, `@IsUUID()` para los ids, y `@Type(() => Number)`, `@IsInt()` y
`@Min(1)` para `comensales`. Con `ValidationPipe` (`transform: true`) el cuerpo del `400` es
el que Nest genera por defecto (`message: string[]`), sin filtros de excepción propios. El
`404` sale de `cargarContexto` con `NotFoundException` (primero se busca el turno y después la
zona). Si `class-validator`, `class-transformer` y el `ValidationPipe` global no existen todavía
cuando se implemente (ni #12 ni `auth-admin` los agregaron), se suman en este PR: §2 y §7 ya
los nombran como la validación del proyecto, así que no son una librería a justificar.

### D9: Cómo se prueban el reloj y la zona horaria

Los bordes exactos se prueban en los tests unitarios de `evaluarReglas` y de `inicioTurnoUtc`,
con `ahora` inyectado, y corren dos veces: con `TZ=UTC` y con
`TZ=America/Argentina/Buenos_Aires`. Como el offset es fijo, correr dos veces no prueba reglas
de zona sino que ningún cálculo use getters locales: el escenario "mismo resultado con el
servidor en UTC o en Buenos Aires" se cumple por construcción. Los e2e con Supertest usan el reloj real
(`consultar` hace `new Date()`), fechas lejos de los bordes y datos propios, y cubren solo
400, 404 y la forma del 200.

## Trampas de fechas

- **`getDay()`/`getHours()` en vez de `getUTC*`.** `@db.Date` llega como
  `2026-09-19T00:00:00Z`. En un proceso con zona Buenos Aires eso es viernes 18 a las 21:00, y
  `getDay()` da 5 (viernes) en la máquina local y 6 (sábado) en CI. Regla: `fecha` y
  `horaInicio` se leen **siempre** con `getUTCFullYear/Month/Date/Day/Hours/Minutes`. El día de
  la semana sale de `DIAS[diaSemanaDeFecha(fecha)]` (que es `getUTCDay()`), con `DIAS` empezando en `DOMINGO` para respetar
  el índice de JavaScript.
- **`@db.Date` trunca en UTC.** Prisma guarda la parte de fecha **UTC** del `Date` que recibe.
  Si en un filtro o en un `INSERT` se pasa un instante con hora (por ejemplo `inicioTurno`, o
  `new Date(2026, 8, 19)` en un proceso con offset positivo), la fecha puede correrse un día.
  Regla: a Prisma solo se le pasa la fecha construida con `Date.UTC(y, m - 1, d)`, nunca
  `inicioTurno`.
- **`Date.UTC` con años de dos dígitos.** `Date.UTC(99, 0, 1)` devuelve 1999. La validación de
  "fecha existente" compara ida y vuelta (`getUTCFullYear() === y`, mes y día), lo que también
  rechaza `2026-02-30`.
- **El fin del turno cruza medianoche UTC.** La cena 20:00–23:30 local es 23:00Z–02:30Z. Nada
  del cálculo usa el fin del turno ni la fecha UTC del inicio: la ocupación se filtra por la
  `fecha` local tal como se guardó.

## Contrato OpenAPI

El fragmento de abajo **no** se agrega a `openapi/openapi.yaml` en este PR de spec.
`npm run openapi:check` (parte del job requerido "Especificación") compara literalmente `paths`
y `components.schemas` del YAML contra lo que genera `@nestjs/swagger` desde los controllers.
Un path sin controller pone CI en rojo y bloquea el merge de una spec que no tiene código. Por
eso el contrato queda escrito acá y se copia al YAML en el PR de implementación
(`feature/disponibilidad`), en el orden de D2 de `fundacion-repo`: primero el YAML, después
los decoradores del controller hasta que `openapi:check` pase, y por último la implementación.

Nombres fijos, porque el diff es literal: schemas `DisponibilidadRespuesta`,
`MotivoNoDisponible`, `CodigoMotivo` y `ErrorRespuesta`; `operationId`
`DisponibilidadController_consultar`; tag `disponibilidad`. `@nestjs/swagger` nombra cada
schema con el nombre de la clase del DTO, así que las clases de respuesta se tienen que llamar
igual, y el enum se declara con `enumName: 'CodigoMotivo'`.

```yaml
paths:
  /disponibilidad:
    get:
      summary: Consultar disponibilidad
      description: >-
        Indica si hay lugar para una cantidad de comensales en una fecha, un turno y una zona.
        Consulta una sola combinación y es una foto del momento: no reserva ni bloquea nada, y
        la validación real ocurre al crear la reserva. Evalúa siempre todas las reglas y
        devuelve todas las que fallan. Que no haya lugar no es un error: la respuesta es `200`
        con `disponible` en `false`. Es una ruta pública, sin autenticación.
      operationId: DisponibilidadController_consultar
      tags:
        - disponibilidad
      parameters:
        - name: fecha
          required: true
          in: query
          description: >-
            Fecha de calendario local del restaurante, sin hora (`YYYY-MM-DD`). Un instante con
            hora (por ejemplo `2026-09-15T12:00:00Z`) o una fecha inexistente se rechazan con
            `400`.
          schema:
            type: string
            format: date
            pattern: ^\d{4}-\d{2}-\d{2}$
            example: '2026-09-15'
        - name: turnoId
          required: true
          in: query
          description: Id del turno a consultar.
          schema:
            type: string
            format: uuid
            example: 3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73
        - name: zonaId
          required: true
          in: query
          description: Id de la zona a consultar.
          schema:
            type: string
            format: uuid
            example: b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19
        - name: comensales
          required: true
          in: query
          description: Cantidad de comensales de la reserva que se quiere hacer. Entero, mínimo 1.
          schema:
            type: integer
            minimum: 1
            example: 1
      responses:
        '200':
          description: >-
            La consulta es válida. Informa si hay lugar, cuántos comensales entran todavía y,
            si no hay lugar, todos los motivos.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DisponibilidadRespuesta'
              examples:
                disponible:
                  summary: Hay lugar (STANDARD, 4 comensales, pasado mañana)
                  value:
                    disponible: true
                    lugaresRestantes: 40
                    motivos: []
                noDisponible:
                  summary: No hay lugar (VIP, 1 comensal, almuerzo de mañana)
                  value:
                    disponible: false
                    lugaresRestantes: 20
                    motivos:
                      - codigo: ANTICIPACION_MINIMA
                        mensaje: En la zona VIP se reserva con al menos 24 horas de anticipación.
                      - codigo: COMENSALES_FUERA_DE_RANGO
                        mensaje: La zona VIP admite de 2 a 12 comensales por reserva.
        '400':
          description: >-
            La consulta está mal formada: falta un parámetro, la fecha no es `YYYY-MM-DD` o no
            existe, un id no es UUID, o `comensales` no es un entero mayor o igual a 1.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorRespuesta'
              examples:
                parametrosInvalidos:
                  summary: Fecha con hora y comensales en cero
                  value:
                    statusCode: 400
                    message:
                      - fecha debe ser una fecha de calendario con formato YYYY-MM-DD, sin hora
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
                zonaInexistente:
                  summary: La zona no existe
                  value:
                    statusCode: 404
                    message: No existe una zona con id b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19
                    error: Not Found
components:
  schemas:
    DisponibilidadRespuesta:
      type: object
      description: Resultado de consultar la disponibilidad de una fecha, un turno y una zona.
      properties:
        disponible:
          type: boolean
          description: '`true` si y solo si `motivos` está vacío.'
          example: false
        lugaresRestantes:
          type: integer
          description: >-
            Comensales (no mesas) que todavía entran en ese turno y esa fecha: el mínimo entre
            lo que queda del aforo de la zona y lo que queda del aforo global, sin descontar los
            comensales pedidos. Nunca es negativo.
          minimum: 0
          example: 20
        motivos:
          description: >-
            Todas las reglas que impiden la reserva, en el orden fijo de `CodigoMotivo`. Vacío
            si hay lugar.
          type: array
          items:
            $ref: '#/components/schemas/MotivoNoDisponible'
      required:
        - disponible
        - lugaresRestantes
        - motivos
    MotivoNoDisponible:
      type: object
      description: Una regla de negocio que impide la reserva pedida.
      properties:
        codigo:
          description: >-
            Código estable de la regla que falla. El frontend arma el texto para el usuario a
            partir de este código. Los valores se evalúan y se listan en este orden:
            `TURNO_INACTIVO` (el turno está inactivo), `TURNO_NO_CORRESPONDE_A_FECHA` (el día de
            la semana de la fecha no es el del turno), `ANTICIPACION_MINIMA` (falta menos que la
            anticipación mínima de la zona, o el turno ya pasó), `ANTICIPACION_MAXIMA` (falta
            más que la anticipación máxima de la zona), `COMENSALES_FUERA_DE_RANGO` (fuera del
            mínimo o máximo de comensales de la zona), `AFORO_ZONA` (se supera el aforo de la
            zona), `AFORO_GLOBAL` (se supera el aforo global) y `SIN_MESA_DISPONIBLE` (no queda
            una mesa libre de la zona con capacidad suficiente).
          allOf:
            - $ref: '#/components/schemas/CodigoMotivo'
        mensaje:
          type: string
          description: Explicación en español para humanos. No se usa para lógica.
          example: La zona VIP admite de 2 a 12 comensales por reserva.
      required:
        - codigo
        - mensaje
    CodigoMotivo:
      type: string
      description: >-
        Código estable de la regla que falla. El frontend arma el texto para el usuario a
        partir de este código. Los valores se evalúan y se listan en este orden:
        `TURNO_INACTIVO` (el turno está inactivo), `TURNO_NO_CORRESPONDE_A_FECHA` (el día de
        la semana de la fecha no es el del turno), `ANTICIPACION_MINIMA` (falta menos que la
        anticipación mínima de la zona, o el turno ya pasó), `ANTICIPACION_MAXIMA` (falta
        más que la anticipación máxima de la zona), `COMENSALES_FUERA_DE_RANGO` (fuera del
        mínimo o máximo de comensales de la zona), `AFORO_ZONA` (se supera el aforo de la
        zona), `AFORO_GLOBAL` (se supera el aforo global) y `SIN_MESA_DISPONIBLE` (no queda
        una mesa libre de la zona con capacidad suficiente).
      enum:
        - TURNO_INACTIVO
        - TURNO_NO_CORRESPONDE_A_FECHA
        - ANTICIPACION_MINIMA
        - ANTICIPACION_MAXIMA
        - COMENSALES_FUERA_DE_RANGO
        - AFORO_ZONA
        - AFORO_GLOBAL
        - SIN_MESA_DISPONIBLE
    ErrorRespuesta:
      type: object
      description: >-
        Cuerpo de error por defecto de NestJS. En un `400` del `ValidationPipe`, `message` es la
        lista de problemas encontrados; en un `404`, es un único texto.
      properties:
        statusCode:
          type: integer
          description: Código HTTP de la respuesta.
          example: 404
        message:
          description: Detalle del error. Un texto, o una lista de textos si son varios.
          oneOf:
            - type: string
            - type: array
              items:
                type: string
        error:
          type: string
          description: Nombre estándar del código HTTP.
          example: Not Found
      required:
        - statusCode
        - message
        - error
```

## Risks / Trade-offs

- **[Riesgo]** La consulta dice "disponible" y la creación, segundos después, responde `409`
  → **Mitigación:** es el comportamiento que define §6 (foto del momento). El lock y la
  reevaluación dentro de la transacción garantizan que el `409` sea correcto. El frontend
  tiene que mostrar los motivos del `409` igual que los de la consulta.
- **[Riesgo]** El lock solo protege si **todas** las escrituras que aumentan la ocupación de un
  `(turno, fecha)` lo toman. Una reasignación de mesa del admin o un cambio de estado que
  vuelva a activar cupo, si lo saltean, puede pasar el aforo → **Mitigación:** la clave vive
  en una sola función exportada. `reservas-crear` y cualquier change futuro que escriba
  `Reserva` la usan, y la revisión de esos PRs lo verifica. Cancelar y marcar `NO_SHOW` solo
  liberan cupo y no lo necesitan.
- **[Riesgo]** Con N creaciones encoladas sobre el mismo lock, la transacción interactiva de
  Prisma (por defecto `maxWait` 2 s y `timeout` 5 s) puede abortar con `P2028` → **Mitigación:**
  cada transacción que toma el lock es corta (un par de lecturas y un `INSERT`). El test de
  integración con `Promise.all` lo mide, y si hace falta `reservas-crear` sube `timeout`.
- **[Trade-off]** La clave sin zona serializa las creaciones de todas las zonas de un mismo
  turno y fecha. Con el volumen de un restaurante no se nota, y es lo que cubre el aforo
  global.
- **[Trade-off]** `hashtext` devuelve 32 bits y dos `(turno, fecha)` distintos pueden
  compartir clave. El único efecto es serializar de más en ese caso, no un resultado
  incorrecto.
- **[Riesgo]** Postgres puede no inferir el tipo de los parámetros en `$1 || ':' || $2` y
  fallar al preparar la sentencia → **Mitigación:** el test de integración del lock lo
  detecta. Si pasa, se castean los parámetros con `::text` dentro de la misma función, sin
  cambiar la clave.
- **[Riesgo]** Con las mesas del seed (STANDARD suma 22 lugares, VIP 24 y el total 46), el
  aforo STANDARD de 40 y el global de 60 no se alcanzan nunca, así que `AFORO_GLOBAL` no se
  puede ver con los datos del seed → **Mitigación:** los escenarios y los tests configuran
  aforos menores de forma explícita. Si hace falta verlo en la UI es un tema del seed, fuera de
  este change (ver Open Questions).
- **[Riesgo]** Las reservas de ejemplo del seed usan fechas relativas ("el próximo sábado") y
  pueden coincidir con las fechas de un test → **Mitigación:** los e2e y el test del lock crean
  sus propios datos y limpian `Reserva` antes de cada suite (§9: cada test es independiente).
- **[Riesgo]** `openapi:check` da un **falso rojo** con enums. Se probó el fragmento contra
  `@nestjs/swagger` 11.4.7 con un controller de prueba (fuera del repo) y `diffSpecs` de
  `scripts/openapi-diff.mjs`: la única diferencia es `components.schemas.CodigoMotivo.x-enumNames`,
  que Nest deja con valor `undefined` en el documento en memoria. Normalizándolo con
  `JSON.parse(JSON.stringify(doc))` antes de comparar, el diff queda vacío. Afecta a cualquier
  enum con `enumName`, no solo a este change → **Mitigación:** normalizar en
  `scripts/openapi-check.mjs`, en un PR `fix:` propio antes del de implementación. Es un
  `scripts/`, no `.github/workflows/`, así que §14 no lo impide. La otra opción, declarar
  `x-enumNames` en el decorador y en el YAML, ensucia el contrato por un detalle del generador.
- **[Trade-off]** El offset UTC-3 queda fijo en el código. Si Argentina volviera a usar horario
  de verano o hubiera otra sede, las horas darían corridas una hora. Es la decisión del equipo
  en #12 para el MVP, y el cambio quedaría acotado a `timezone.ts` (D5).

## Migration Plan

1. Sin migraciones: este change solo lee tablas existentes de #12.
2. Rollback: revertir el PR.

## Open Questions

- **Cuerpo del `409` de `POST /reservas`** (el primer motivo o todos): lo decide
  `reservas-crear`. Los dos casos salen del mismo `MotivoNoDisponible[]` ordenado.
- **Seed sin forma de alcanzar `AFORO_GLOBAL`.** Si el equipo quiere verlo en la UI con datos
  del seed, hay que bajar `aforoGlobal` o sumar mesas en un change que toque el seed. No afecta
  la spec, que usa aforos configurados explícitamente.
- **Zonas y mesas desactivables.** RF-04/05 hablan de desactivar zonas y mesas, pero el schema
  de #12 no tiene ese campo. Si `gestion-salon` lo agrega, `cargarContexto` tiene que filtrar
  mesas inactivas y decidir qué responde una zona inactiva. Va en ese change.
