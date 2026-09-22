## Context

Ver `proposal.md` (sección Why) para la motivación y `specs/reserva-consultar/spec.md` para
el comportamiento esperado. Este documento resuelve cómo se comparan el código y el email,
qué devuelve cada ruta a cada rol, cómo se limita la consulta pública y cómo se arma el
contrato OpenAPI sin romper el chequeo de deriva de CI.

Estado del que se parte (`main` al 2026-09-21):

- `backend/src/reservas/` tiene solo `reservas.module.ts` y `reservas.service.ts` (de #12,
  `crearReserva` y `transicionarEstado`). **No hay `ReservasController`**: lo introduce
  `reservas-crear`, y este change agrega sus rutas sobre el mismo controller y service. Por
  eso la implementación está bloqueada por `reservas-crear`, no la spec.
- `Reserva` guarda `codigoReserva` (`@unique`), `emailCliente` tal cual lo recibió, `fecha`
  (`@db.Date`), `estado`, `comensales`, `mesaId` y `turnoId`. **No tiene `zonaId`**: la zona
  sale de `mesa.zona`. `Turno.horaInicio`/`horaFin` son `@db.Time` (hora local, sin fecha ni
  offset, ver `config.yaml` §7).
- `AppModule` ya registra `ThrottlerModule` (`THROTTLE_TTL`/`THROTTLE_LIMIT`, con defaults
  de 60 s y 10 solicitudes) y `ThrottlerGuard` como `APP_GUARD` global. Un guard global corre
  antes que los guards de ruta y que los pipes: el `429` llega antes de validar el body y
  antes de tocar la base. `POST /auth/login` lo sobreescribe con un `@Throttle()` propio.
- `AuthModule` (`JwtAuthGuard`, `RolesGuard`, decorador `@Roles`) está mergeado (#25) pero
  **no registrado en `AppModule`** hasta que se integre el PR de registro del módulo.
  `POST /reservas` y la cancelación pública no llevan guard; las rutas de admin se protegen
  por ruta con `JwtAuthGuard` + `RolesGuard`, no con un guard global (`reservas-crear`).
- `main.ts` en `main` construye el `ValidationPipe` global con `whitelist` y
  `forbidNonWhitelisted`, **sin** `transform`. La rama de `disponibilidad` lo construye con
  `transform: true` y sin `whitelist`. Hay que reconciliarlos: ver Riesgos.
- `cancelacion-turnos` (en `main`) ya fija para el mismo controller el tag `Reservas`, el
  patrón `^[A-Za-z0-9]{8}$` para el código y un `404` genérico que no distingue código
  inexistente de email incorrecto. `reservas-crear` (en `main`) dejó abiertas, en sus Open
  Questions, la sensibilidad a mayúsculas del código y la normalización del email, y las
  delegó a este change y a `cancelacion-turnos`.

## Goals / Non-Goals

**Goals:**
- Que la consulta pública no permita enumerar Reservas ni averiguar si un código existe, ni
  por el cuerpo, ni por el código HTTP, ni por un camino de código distinto.
- Que la búsqueda por código + email exista **una sola vez** y la usen consulta y cancelación.
- Que el listado del admin devuelva el `id` que necesitan `reserva-vip` y
  `cancelacion-turnos`, con un orden que no repita ni omita filas entre páginas.
- Dejar escrito el contrato OpenAPI sin agregar paths al YAML ejecutable en este PR.

**Non-Goals:**
- No define cancelación, confirmación ni rechazo: los transiciona `transicionarEstado`, que
  este change no toca.
- No agrega columnas, índices ni migraciones. La búsqueda apoya el filtro por código en el
  índice único existente; el volumen de un restaurante no justifica un índice sobre el email.
- No decide si la consulta le informa al cliente hasta cuándo puede cancelar (lo resuelve
  `cancelacion-turnos` o el frontend, con `ventanaCancelacionHoras`).
- No cambia el formato del código que genera `reservas-crear` (8 caracteres en mayúsculas
  sobre su alfabeto de 32 símbolos): solo acepta mayúsculas y minúsculas al consultar.

## Decisions

### D1: `POST /reservas/consultar` con código y email en el body

**Decisión:** la consulta pública es un `POST` con `{ codigo, email }` en el body JSON, en
`ReservasController`, con `operationId` `ReservasController_consultar` y tag `Reservas`. No
lleva guard (ruta pública) y responde `200`, no `201`: no crea nada.

**Por qué se aparta del roadmap:** `docs/roadmap-mvp.md` (Fase 4) describe un `GET` público con
código + email. Un `GET` obliga a poner el email en la URL o en un header. El email es un
dato personal y las URLs quedan en logs de acceso, proxies, historial del navegador y
herramientas de monitoreo. `cancelacion-turnos` ya descartó exactamente ese diseño
(`DELETE /reservas/:codigo?email=...`) por la misma razón; tener la consulta con email en la
query y la cancelación con email en el body sería inconsistente. Fue decisión confirmada de
FedeWerk el 2026-09-21.

**Alternativa considerada:** `GET /reservas/:codigo?email=...`. Es REST puro y coincide con
la letra del roadmap, pero deja el email en la URL. Se descarta por la exposición.
**Alternativa considerada:** `GET /reservas/:codigo` con el email en un header
(`X-Email-Cliente`). Evita la URL, pero es poco habitual, Swagger UI y el cliente generado
desde OpenAPI lo manejan peor y los caches intermedios distinguen mal las respuestas.
**Alternativa considerada:** `POST /reservas/:codigo/consultar`, para espejar la ruta de
cancelación. Se descarta porque el par código + email es la credencial completa: un solo DTO
en el body lo trata como una unidad. La ruta no choca con `POST /reservas` ni con
`POST /reservas/:codigo/cancelar` porque tienen distinta cantidad de segmentos.

### D2: Comparación sin distinguir mayúsculas, en una sola consulta

**Decisión:** el service normaliza el código con `toUpperCase()` (el alfabeto de
`reservas-crear` y el del seed son solo mayúsculas, así que sigue usando el índice único) y
compara el email sin distinguir mayúsculas con Prisma (`mode: 'insensitive'`), en **una sola**
consulta con ambos criterios:

```
prisma.reserva.findFirst({
  where: { codigoReserva: codigo.toUpperCase(), emailCliente: { equals: email, mode: 'insensitive' } },
  include: { turno: true, mesa: { include: { zona: true } } },
})
```

Con una sola consulta, "código inexistente" y "email incorrecto" son el mismo camino de
código: ambos devuelven `null` de la misma sentencia, sin una rama que compare el email solo
cuando el código existe. Así no hay diferencia de tiempo atribuible a la lógica de la
aplicación (`auth-admin` tuvo observaciones de revisión por diferencias de tiempo al validar
credenciales).

El email **se sigue guardando tal cual** llegó: este change no toca `reservas-crear` ni migra
datos. Esto cierra las dos Open Questions de `reservas-crear` y define lo que
`cancelacion-turnos` debe usar. No hace `trim` del email: `@IsEmail()` rechaza los espacios
con `400`, y el frontend es quien recorta.

**Alternativa considerada:** guardar el email en minúsculas al crear y comparar por igualdad
exacta. Sería más simple, pero obliga a tocar `reservas-crear` y a migrar reservas
existentes, y cambia lo que el cliente ve guardado. Se descarta para este MVP.
**Alternativa considerada:** `findUnique` por código y comparar `email.toLowerCase()` en la
aplicación. Es el plan B si `mode: 'insensitive'` no se comporta como texto literal (ver
Riesgos). Tiene la desventaja de dos ramas (código inexistente vs. email incorrecto), que
habría que igualar con una comparación ficticia.
**Alternativa considerada:** exigir el código exacto (con mayúsculas). Se descarta: un
cliente que copia el código de un mensaje y lo tipea en minúsculas no debería recibir un
`404` que además no le explica por qué.

### D3: Un único punto de búsqueda, compartido con `cancelacion-turnos`

**Decisión:** `ReservasService.buscarPorCodigoYEmail(codigo, email, db = this.prisma)` ejecuta
la consulta de D2 y devuelve la Reserva con su turno y su mesa/zona, o `null`. Acepta un
cliente de Prisma o una transacción como tercer parámetro para que `cancelacion-turnos`
pueda usarla dentro de su propia transacción. El `404` lo arma un helper exportado que usa
un texto fijo ("No se encontró una reserva con ese código y email"), de modo que consulta y
cancelación produzcan el mismo cuerpo, que es lo que exigen las dos specs.

`cancelacion-turnos` (tarea 1.2) ya prevé reutilizar una búsqueda existente si `reserva-consultar`
está implementado. Este change fija la firma para que la coordinación sea explícita.

**Alternativa considerada:** que cada change escriba su propia búsqueda. Se descarta: es la
duplicación que el roadmap evita y dejaría dos criterios de comparación posibles.

### D4: Respuesta pública mínima

`ReservaConsultadaRespuesta`: `codigoReserva`, `estado`, `fecha`, `comensales`, `turno`
(`id`, `horaInicio`, `horaFin`) y `zona` (`id`, `nombre`).

- **No** incluye el `id` interno (las rutas de admin lo usan; un cliente no lo necesita y
  no debe poder enumerarlo), la mesa (no es un concepto del cliente y el admin puede
  reasignarla), ni el nombre, email o teléfono (el cliente ya los tiene, y `config.yaml` §5
  prohíbe exponer datos personales), ni `createdAt`/`updatedAt`. Es el mismo criterio de D7
  de `reservas-crear`.
- `fecha` se arma con `getUTC*` como `YYYY-MM-DD` (§7). `horaInicio`/`horaFin` salen como
  `HH:mm` desde `getUTCHours`/`getUTCMinutes` de la fecha 1970 que Prisma devuelve para
  `@db.Time`: son horas locales del restaurante y **no se convierten** (la conversión a la
  hora del navegador, si hiciera falta, es del frontend). Hay que probar el mapeo con
  `TZ=UTC` y `TZ=America/Argentina/Buenos_Aires`.
- `estado` y `zona.nombre` se declaran como enums **inline** (sin `enumName`) para no
  generar un schema `EstadoReserva` que choque con el de otros changes ni el falso rojo de
  `x-enumNames` de `openapi:check`. Ver el contrato.
- Una Reserva `CANCELADA` o `NO_SHOW` se devuelve igual, con su estado: el cliente necesita
  comprobar que su cancelación quedó registrada.

**Alternativa considerada:** devolver la entidad completa. Se descarta por acoplar el
contrato al schema de Prisma y exponer `id` y `mesaId` en una ruta pública.
**Alternativa considerada:** devolver solo `turnoId` y `zonaId`, como `201` de `reservas-crear`.
Se descarta: quien consulta días después necesita ver el horario y la zona sin llamar a
otra ruta, y esos dos datos no son sensibles.

### D5: Rate limiting de la consulta pública con el límite global

**Decisión:** la consulta reutiliza el límite global (`THROTTLE_TTL`/`THROTTLE_LIMIT`), sin
`@Throttle()` propio, igual que `cancelacion-turnos`. Como el guard global corre antes que
pipes y handler, el `429` se produce antes de validar y antes de buscar, y un cliente que ya
superó el límite recibe `429` aunque acierte código y email.

Con 32 símbolos y 8 posiciones hay unas 2^40 combinaciones, y el atacante además debe
acertar el email de esa misma Reserva. A 10 intentos por minuto por IP la enumeración no es
viable, y el mínimo que exige `config.yaml` §5 queda cubierto. No hay una razón de riesgo
diferencial (como sí la había en el login del admin, que entrega un token) que justifique una
configuración aparte.

**Alternativa considerada:** un `@Throttle()` más estricto, como el del login (5/60 s).
Encarece el uso legítimo (un cliente que se equivoca de email dos veces) sin agregar una
protección que el espacio de códigos no necesite.

### D6: Listado de admin: `GET /admin/reservas`

Método `listar` de `ReservasController` (`operationId` `ReservasController_listar`), con
`@UseGuards(JwtAuthGuard, RolesGuard)` y `@Roles(RolUsuario.ADMIN)` por ruta.

**Filtros** (todos opcionales, se combinan con AND): `fecha` (`YYYY-MM-DD`), `estado`
(`PENDIENTE|CONFIRMADA|CANCELADA|NO_SHOW`), `zonaId` (UUID, se traduce a `mesa: { zonaId }`
porque `Reserva` no tiene `zonaId`) y `turnoId` (UUID). **Paginación:** `limit` (entero,
1 a 100, por defecto 20) y `offset` (entero, mínimo 0, por defecto 0).

- Un `zonaId` o `turnoId` con formato válido pero inexistente responde `200` con lista
  vacía, **no** `404`: es un filtro, no una referencia a un recurso (a diferencia de
  `disponibilidad` y `reservas-crear`, donde el turno o la zona son el objeto de la
  operación). Un formato inválido sí es `400`.
- `fecha` reutiliza el validador de fecha de calendario de `disponibilidad` (D4 de ese
  change: patrón `YYYY-MM-DD` **y** fecha existente), y se convierte a `Date.UTC` para
  comparar contra la columna `@db.Date`.
- **Orden total:** `fecha`, `turno.horaInicio`, `createdAt` e `id`, todos ascendentes. El
  `id` desempata para que la paginación por `offset` sea determinista.
- **Respuesta:** `{ items, total, limit, offset }`. `total` cuenta las filas que cumplen los
  filtros, sin paginar; `items` y `total` se leen con `prisma.$transaction([findMany, count])`.
- Cada ítem (`ReservaAdminRespuesta`) incluye `id`, `codigoReserva`, `estado`, `fecha`,
  `comensales`, `nombreCliente`, `emailCliente`, `telefonoCliente`, `turno`, `zona`, `mesa`
  (`id`, `etiqueta`) y `createdAt`. Es la única ruta que devuelve datos de contacto, y solo
  al rol `ADMIN`.
- **`limit` y `offset` llegan como texto** en la query. Se convierten con `@Type(() => Number)`,
  lo que exige `transform: true` en el `ValidationPipe` global (D8 de `disponibilidad`).
- Un parámetro no declarado es `400` (con `forbidNonWhitelisted`): un `estdo=PENDIENTE`
  mal escrito no puede devolver todo el listado como si el filtro hubiera funcionado.

**Alternativa considerada:** paginación por cursor. Se descarta: el volumen de un
restaurante es chico, el panel necesita saltar a una página y el total, y `offset` con
orden total ya es determinista.
**Alternativa considerada:** rango de fechas (`desde`/`hasta`). Se deja afuera (Open
Questions): el caso de `reserva-vip` se resuelve con `estado` sin fecha, y el del panel del
día con `fecha`.
**Alternativa considerada:** `GET /admin/reservas/:id` para el detalle. Se deja afuera: el
listado ya incluye todo el contenido y ningún change lo pide.
**Alternativa considerada:** un `ReservasAdminController` separado con los guards a nivel de
clase. Se descarta por ahora para mantener las operaciones de `Reservas` en un solo
controller, como ya hace `cancelacion-turnos` con su ruta `PATCH /admin/reservas/:id/no-show`.

### D7: Rate limiting del listado de admin

El límite global (10 solicitudes por 60 s por IP) es demasiado bajo para un panel con
filtros: cambiar dos veces un filtro y paginar ya lo agota. Pero dejarlo sin límite permite
extraer todas las Reservas, con nombre, email y teléfono, con un token robado.

**Decisión:** `@Throttle({ default: { limit: 60, ttl: 60000 } })` en `listar`: un valor
propio, como el del login, con un tope por minuto que el uso normal no alcanza. Son los
números del sitio de llamada, no de §6, y los ajusta el equipo si el panel los supera.

**Alternativa considerada:** `@SkipThrottle()` en la ruta. Se descarta: el JWT ya protege el
acceso, pero no la extracción con un token comprometido.

### D8: Qué expone cada ruta a cada rol

| Ruta | Anónimo | Cliente con código + email de su Reserva | `ADMIN` |
|---|---|---|---|
| `POST /reservas/consultar` | vista mínima de **su** Reserva o `404`; nunca datos de otra | igual | igual |
| `GET /admin/reservas` | `401` | `401` | listado completo con `id` y contacto |

- El `404` de la consulta tiene siempre el mismo cuerpo, sin eco del código ni del email
  recibidos (el mensaje no los repite).
- El service no registra en logs el body de la consulta ni el email. NestJS no lo hace por
  defecto; los tests no deben agregarlo.
- Ningún error de esta capability incluye datos de una Reserva.

## Contrato OpenAPI

El fragmento de abajo **no** se agrega a `openapi/openapi.yaml` en este PR de spec: el chequeo
`npm run openapi:check` compara literalmente `paths` y `components.schemas` contra lo que
genera `@nestjs/swagger`, y un path sin controller pone CI en rojo. Se copia al YAML en el PR
de implementación, junto con los controllers (`config.yaml` §3).

Nombres fijos, porque el diff es literal: schemas `ConsultarReservaDto`,
`ReservaConsultadaRespuesta`, `ReservaAdminRespuesta`, `ListadoReservasRespuesta`,
`TurnoReservaRespuesta`, `ZonaReservaRespuesta` y `MesaReservaRespuesta`; `operationId`
`ReservasController_consultar` y `ReservasController_listar`; tag `Reservas`. Se reusa sin
redefinir `ErrorRespuesta` de `disponibilidad` (no se suma un tercer schema de error al de
`disponibilidad` y `ErrorCancelacionDto`). Los `429` se documentan solo con descripción, como
en `auth-admin`: el cuerpo lo genera `@nestjs/throttler` y su forma exacta no es parte del
contrato. `bearerAuth` ya existe en el contrato raíz.

Los enums de `estado` y de `zona.nombre` son **inline**, sin `enumName`, por lo mismo que en
`reservas-crear`: evitan un schema global `EstadoReserva` que choque con otros changes y el
falso rojo de `x-enumNames`. `ListarReservasDto` no genera schema: al usarse como `@Query()`,
`@nestjs/swagger` lo expande en `parameters`, que es lo que se declara acá.

```yaml
paths:
  /reservas/consultar:
    post:
      summary: Consultar una reserva por código y email
      description: >-
        Devuelve el estado de una reserva sin cuenta. Exige el código y el email de la misma
        reserva; el código y el email se comparan sin distinguir mayúsculas y minúsculas. Si el
        código no existe o el email no coincide, responde el mismo `404`, para que no se
        pueda averiguar si un código existe. Devuelve solo una vista mínima: no incluye la mesa
        ni los datos de contacto. Es una ruta pública, sin autenticación, con límite de
        solicitudes por cliente.
      operationId: ReservasController_consultar
      tags:
        - Reservas
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ConsultarReservaDto'
      responses:
        '200':
          description: El código y el email corresponden a una misma reserva, en cualquier estado.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ReservaConsultadaRespuesta'
              examples:
                confirmada:
                  summary: Reserva STANDARD confirmada
                  value:
                    codigoReserva: K7PM3QXA
                    estado: CONFIRMADA
                    fecha: '2026-09-19'
                    comensales: 4
                    turno:
                      id: 3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73
                      horaInicio: '20:00'
                      horaFin: '23:30'
                    zona:
                      id: b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19
                      nombre: STANDARD
                pendiente:
                  summary: Reserva VIP pendiente de confirmación
                  value:
                    codigoReserva: R2WN8HDE
                    estado: PENDIENTE
                    fecha: '2026-09-19'
                    comensales: 6
                    turno:
                      id: 3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73
                      horaInicio: '20:00'
                      horaFin: '23:30'
                    zona:
                      id: 5d2a9c41-7e3b-4f6a-a1d8-0c9b2e7f4a63
                      nombre: VIP
        '400':
          description: >-
            El body está mal formado: falta `codigo` o `email`, el código no es alfanumérico de
            8 caracteres, el email no es válido o hay campos no declarados.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorRespuesta'
              examples:
                bodyInvalido:
                  summary: Código corto y email inválido
                  value:
                    statusCode: 400
                    message:
                      - codigo debe ser alfanumérico de 8 caracteres
                      - email debe ser un email válido
                    error: Bad Request
        '404':
          description: >-
            No existe una reserva con ese código y email. Es la misma respuesta si el código no
            existe y si el email no coincide, sin indicar cuál dato falló.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorRespuesta'
              examples:
                noEncontrada:
                  summary: Código inexistente o email incorrecto
                  value:
                    statusCode: 404
                    message: No se encontró una reserva con ese código y email
                    error: Not Found
        '429':
          description: >-
            Se superó el límite de consultas permitidas en la ventana configurada. Se rechaza
            antes de validar el body y de buscar la reserva.
  /admin/reservas:
    get:
      summary: Listar reservas
      description: >-
        Lista las reservas con sus datos de contacto, la mesa y el identificador que usan las
        demás rutas de admin. Se puede filtrar por fecha, estado, zona y turno; los filtros se
        combinan todos juntos. El orden es cronológico (fecha, hora de inicio del turno, fecha
        de creación, identificador) y está paginado. Un filtro con un identificador inexistente
        devuelve una lista vacía. Requiere un JWT de rol `ADMIN` y tiene un límite de
        solicitudes por cliente.
      operationId: ReservasController_listar
      tags:
        - Reservas
      security:
        - bearerAuth: []
      parameters:
        - name: fecha
          in: query
          required: false
          description: Fecha de calendario local del restaurante, sin hora (`YYYY-MM-DD`).
          schema:
            type: string
            format: date
            pattern: ^\d{4}-\d{2}-\d{2}$
            example: '2026-09-19'
        - name: estado
          in: query
          required: false
          description: Estado de la reserva.
          schema:
            type: string
            enum:
              - PENDIENTE
              - CONFIRMADA
              - CANCELADA
              - NO_SHOW
            example: PENDIENTE
        - name: zonaId
          in: query
          required: false
          description: Id de la zona. Un id inexistente devuelve una lista vacía.
          schema:
            type: string
            format: uuid
            example: 5d2a9c41-7e3b-4f6a-a1d8-0c9b2e7f4a63
        - name: turnoId
          in: query
          required: false
          description: Id del turno. Un id inexistente devuelve una lista vacía.
          schema:
            type: string
            format: uuid
            example: 3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73
        - name: limit
          in: query
          required: false
          description: Cantidad máxima de reservas por página.
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
        - name: offset
          in: query
          required: false
          description: Cantidad de reservas a saltear desde el inicio del listado.
          schema:
            type: integer
            minimum: 0
            default: 0
      responses:
        '200':
          description: Página de reservas. Si ninguna cumple los filtros, `items` viene vacío y `total` es 0.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ListadoReservasRespuesta'
              examples:
                pendientes:
                  summary: Reservas VIP pendientes
                  value:
                    items:
                      - id: 9c4e1d70-3a2b-4c58-b1f6-7e0a5d2c8b34
                        codigoReserva: R2WN8HDE
                        estado: PENDIENTE
                        fecha: '2026-09-19'
                        comensales: 6
                        nombreCliente: Ana Pérez
                        emailCliente: ana.perez@example.com
                        telefonoCliente: +54 9 11 5555-1234
                        turno:
                          id: 3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73
                          horaInicio: '20:00'
                          horaFin: '23:30'
                        zona:
                          id: 5d2a9c41-7e3b-4f6a-a1d8-0c9b2e7f4a63
                          nombre: VIP
                        mesa:
                          id: e1a7c3f5-2d94-4b60-8a1e-9f3c6b0d7a52
                          etiqueta: V2
                        createdAt: '2026-09-17T14:32:10.000Z'
                    total: 1
                    limit: 20
                    offset: 0
        '400':
          description: >-
            Un filtro está mal formado: la fecha no es `YYYY-MM-DD` o no existe, el estado no es
            uno de los cuatro, un id no es UUID, `limit` u `offset` están fuera de rango, o hay
            parámetros no declarados.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorRespuesta'
              examples:
                filtroInvalido:
                  summary: Fecha inexistente y límite fuera de rango
                  value:
                    statusCode: 400
                    message:
                      - fecha debe ser una fecha de calendario que exista
                      - limit no debe ser mayor a 100
                    error: Bad Request
        '401':
          description: Token ausente, inválido o expirado.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorRespuesta'
        '403':
          description: Token válido sin rol `ADMIN`.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorRespuesta'
        '429':
          description: Se superó el límite de solicitudes al listado en la ventana configurada.
components:
  schemas:
    ConsultarReservaDto:
      type: object
      description: Código y email de una misma reserva.
      properties:
        codigo:
          type: string
          pattern: ^[A-Za-z0-9]{8}$
          description: Código alfanumérico de 8 caracteres. Se compara sin distinguir mayúsculas y minúsculas.
          example: K7PM3QXA
        email:
          type: string
          format: email
          maxLength: 254
          description: Email con el que se hizo la reserva. Se compara sin distinguir mayúsculas y minúsculas.
          example: ana.perez@example.com
      required:
        - codigo
        - email
    TurnoReservaRespuesta:
      type: object
      description: Turno de la reserva, con horas locales del restaurante.
      properties:
        id:
          type: string
          format: uuid
          description: Id del turno.
          example: 3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73
        horaInicio:
          type: string
          pattern: ^\d{2}:\d{2}$
          description: Hora local de inicio (`HH:mm`), sin conversión de zona horaria.
          example: '20:00'
        horaFin:
          type: string
          pattern: ^\d{2}:\d{2}$
          description: Hora local de fin (`HH:mm`). Si es anterior a la de inicio, el turno termina al día siguiente.
          example: '23:30'
      required:
        - id
        - horaInicio
        - horaFin
    ZonaReservaRespuesta:
      type: object
      description: Zona de la reserva.
      properties:
        id:
          type: string
          format: uuid
          description: Id de la zona.
          example: b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19
        nombre:
          type: string
          enum:
            - STANDARD
            - VIP
          description: Nombre de la zona.
          example: STANDARD
      required:
        - id
        - nombre
    MesaReservaRespuesta:
      type: object
      description: Mesa asignada a la reserva. Solo la ve el admin.
      properties:
        id:
          type: string
          format: uuid
          description: Id de la mesa.
          example: e1a7c3f5-2d94-4b60-8a1e-9f3c6b0d7a52
        etiqueta:
          type: string
          description: Etiqueta de la mesa en el salón.
          example: V2
      required:
        - id
        - etiqueta
    ReservaConsultadaRespuesta:
      type: object
      description: Vista mínima de una reserva para quien la consulta con su código y su email.
      properties:
        codigoReserva:
          type: string
          pattern: ^[A-Za-z0-9]{8}$
          description: Código alfanumérico de 8 caracteres.
          example: K7PM3QXA
        estado:
          type: string
          enum:
            - PENDIENTE
            - CONFIRMADA
            - CANCELADA
            - NO_SHOW
          description: Estado actual de la reserva.
          example: CONFIRMADA
        fecha:
          type: string
          format: date
          description: Fecha de calendario local del restaurante (`YYYY-MM-DD`).
          example: '2026-09-19'
        comensales:
          type: integer
          minimum: 1
          description: Cantidad de comensales reservados.
          example: 4
        turno:
          $ref: '#/components/schemas/TurnoReservaRespuesta'
        zona:
          $ref: '#/components/schemas/ZonaReservaRespuesta'
      required:
        - codigoReserva
        - estado
        - fecha
        - comensales
        - turno
        - zona
    ReservaAdminRespuesta:
      type: object
      description: Reserva completa para el admin, con datos de contacto y mesa.
      properties:
        id:
          type: string
          format: uuid
          description: Identificador interno de la reserva, el que usan las demás rutas de admin.
          example: 9c4e1d70-3a2b-4c58-b1f6-7e0a5d2c8b34
        codigoReserva:
          type: string
          pattern: ^[A-Za-z0-9]{8}$
          description: Código alfanumérico de 8 caracteres.
          example: R2WN8HDE
        estado:
          type: string
          enum:
            - PENDIENTE
            - CONFIRMADA
            - CANCELADA
            - NO_SHOW
          description: Estado actual de la reserva.
          example: PENDIENTE
        fecha:
          type: string
          format: date
          description: Fecha de calendario local del restaurante (`YYYY-MM-DD`).
          example: '2026-09-19'
        comensales:
          type: integer
          minimum: 1
          description: Cantidad de comensales reservados.
          example: 6
        nombreCliente:
          type: string
          description: Nombre de quien reservó.
          example: Ana Pérez
        emailCliente:
          type: string
          format: email
          description: Email de quien reservó, tal cual se guardó.
          example: ana.perez@example.com
        telefonoCliente:
          type: string
          description: Teléfono de contacto, en formato libre.
          example: +54 9 11 5555-1234
        turno:
          $ref: '#/components/schemas/TurnoReservaRespuesta'
        zona:
          $ref: '#/components/schemas/ZonaReservaRespuesta'
        mesa:
          $ref: '#/components/schemas/MesaReservaRespuesta'
        createdAt:
          type: string
          format: date-time
          description: Instante de creación de la reserva, en UTC.
          example: '2026-09-17T14:32:10.000Z'
      required:
        - id
        - codigoReserva
        - estado
        - fecha
        - comensales
        - nombreCliente
        - emailCliente
        - telefonoCliente
        - turno
        - zona
        - mesa
        - createdAt
    ListadoReservasRespuesta:
      type: object
      description: Página de reservas y el total que cumple los filtros.
      properties:
        items:
          type: array
          description: Reservas de la página, en orden cronológico.
          items:
            $ref: '#/components/schemas/ReservaAdminRespuesta'
        total:
          type: integer
          minimum: 0
          description: Cantidad total de reservas que cumplen los filtros, sin paginar.
          example: 1
        limit:
          type: integer
          description: Tamaño de página aplicado.
          example: 20
        offset:
          type: integer
          description: Desplazamiento aplicado.
          example: 0
      required:
        - items
        - total
        - limit
        - offset
```

Al incorporar el fragmento, `openapi:check` compara estructura, no equivalencia semántica:
si el generador de Swagger produce alguna respuesta inline en vez de `$ref`, o un enum con
`x-enumNames: undefined`, se normaliza como describe `disponibilidad` (Risks) y se mantienen
los mismos códigos, descripciones y esquemas.

## Risks / Trade-offs

- **[Riesgo]** El `ValidationPipe` global de `main` (`whitelist` + `forbidNonWhitelisted`, sin
  `transform`) y el de la rama de `disponibilidad` (`transform: true`, sin `whitelist`) son
  incompatibles entre sí. Este change necesita **las dos**: `transform: true` para que
  `limit`/`offset` lleguen como número, y `forbidNonWhitelisted` para el `400` ante un filtro
  mal escrito → **Mitigación:** la tarea 1.4 verifica el `main.ts` vigente antes de empezar y,
  si falta alguna, la agrega con su test en este PR. Conviene avisarle a quien implementa
  `disponibilidad` y a `reservas-crear`, porque el pipe es global y cambia el comportamiento
  de sus DTOs.
- **[Riesgo]** No está confirmado cómo traduce Prisma `mode: 'insensitive'` sobre `equals`
  en PostgreSQL. Si genera un `ILIKE` sin escapar, un `_` o un `%` del email funcionaría
  como comodín y `%@example.com` encontraría Reservas ajenas → **Mitigación:** un test de
  integración contra PostgreSQL real que consulta con `anaXperez@example.com` y
  `%@example.com` sobre una Reserva de `ana_perez@example.com`; es la razón por la que ese
  escenario está en la spec. Si falla, se pasa al plan B de D2 (`findUnique` y comparación en
  la aplicación).
- **[Riesgo]** La consulta pública devuelve el estado a cualquiera que tenga código + email.
  Eso es lo que pide §5, pero un email conocido reduce el secreto al código de 8 caracteres
  → **Mitigación:** ~2^40 combinaciones por Reserva y el límite de D5; no se agrega un
  segundo factor porque §5 no lo pide.
- **[Riesgo]** El límite se mide por IP. Detrás de un proxy o balanceador sin `trust proxy`,
  todos los clientes comparten el mismo bucket y la consulta se rechaza para todos →
  **Mitigación:** anotado para el despliegue. Para un TP que corre local o en un solo
  host no aplica, pero conviene confirmar la configuración de `req.ip` al integrar.
- **[Riesgo]** El límite global de 10 solicitudes por minuto también le pega a otras rutas
  públicas (`GET /disponibilidad`, `POST /reservas`) sin que ningún change lo haya decidido →
  **Mitigación:** fuera del alcance de este change; queda en Open Questions.
- **[Riesgo]** El listado devuelve nombre, email y teléfono de todos los clientes →
  **Mitigación:** guard `JwtAuthGuard` + `RolesGuard(ADMIN)`, tests de `401` y `403`
  (§9) y el límite de D7. Un token robado sigue siendo un riesgo que este change acota
  pero no elimina.
- **[Trade-off]** `POST` para una operación de lectura rompe la semántica HTTP (no es
  cacheable ni "segura" a ojos de un proxy). Es el precio de no poner el email en la URL; la
  consulta responde `200`, no `201`, y su `description` lo aclara.
- **[Trade-off]** El email se compara sin distinguir mayúsculas pero no se normaliza al
  guardar: dos Reservas del mismo cliente pueden tener el email guardado con distinta
  capitalización. No afecta a la consulta ni al listado, solo a quien quiera agrupar por
  email en el futuro.
- **[Trade-off]** `offset` puede repetir o saltear filas si otro cliente reserva mientras el
  admin pagina. El orden total garantiza que dos páginas de un mismo estado no se
  superponen; ante escrituras concurrentes puede haber corrimientos, aceptables en un panel.
- **[Riesgo]** `buscarPorCodigoYEmail` se comparte con `cancelacion-turnos`: un cambio de
  firma en uno rompe al otro → **Mitigación:** D3 fija la firma, y el roadmap ya ordena
  mergear este change primero.

## Migration Plan

1. Sin migraciones: no se agregan columnas ni índices; el filtro por código usa el índice
   único de `codigoReserva`.
2. Sin variables de entorno nuevas: reutiliza `THROTTLE_TTL` y `THROTTLE_LIMIT`.
3. Rollback: revertir el PR. Las dos rutas desaparecen y `buscarPorCodigoYEmail` deja de
   existir (si `cancelacion-turnos` ya lo adoptó, se revierte junto con él). No quedan datos
   incompatibles.

## Open Questions

- **Rango de fechas y búsqueda por cliente en el listado.** No los pide ningún change. Si el
  panel necesita "próximos 7 días" o buscar por email o nombre, se agrega con un change
  propio, sin cambiar el contrato actual (los parámetros son opcionales).
- **Límite global del throttler.** El valor por defecto (10 solicitudes por 60 s por IP)
  aplica a todas las rutas sin `@Throttle()` propio, incluidas `GET /disponibilidad` y
  `POST /reservas`. Un formulario que consulta disponibilidad al cambiar cada campo lo agota
  rápido. Se decide con el frontend; este change solo fija el de la consulta y el del listado.
- **Fila del roadmap.** `docs/roadmap-mvp.md` describe la consulta como un `GET`. Cuando el
  roadmap (#29) llegue a `main`, hay que ajustar esa fila a `POST /reservas/consultar`.
