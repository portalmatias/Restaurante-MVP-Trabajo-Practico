## Context

Ver `proposal.md` (sección Why) para la motivación y `specs/catalogo-publico/spec.md` para el
comportamiento esperado. Este documento resuelve dónde vive el código nuevo y qué contrato
exacto exponen los dos endpoints.

Estado del que se parte, en `main`:

- `ZonasController` (`backend/src/zonas/zonas.controller.ts:31-36`) está montado en
  `admin/zonas` con `@UseGuards(JwtAuthGuard, RolesGuard)` y `@Roles(RolUsuario.ADMIN)` a
  nivel de clase. `HorariosController` (`backend/src/horarios/horarios.controller.ts:35-39`)
  hace lo mismo en `admin/turnos`. Ambos decoradores de guard son de clase, no de método.
- `JwtAuthGuard` (`backend/src/auth/guards/jwt-auth.guard.ts`) es un wrapper directo de
  `AuthGuard('jwt')` de Passport, sin ningún mecanismo de `Reflector`/metadata para marcar una
  ruta como pública dentro de un controller guardado (no existe un decorador `@Public()` en el
  repo). Agregar uno para este change tocaría la infraestructura de auth que protege **todas**
  las rutas admin existentes, un riesgo innecesario para una feature de solo lectura.
- `ZonasModule` y `HorariosModule` importan `AuthModule` únicamente para que
  `JwtAuthGuard`/`RolesGuard` resuelvan la estrategia `jwt` (comentario en
  `backend/src/zonas/zonas.module.ts:9-12`); ambos ya exportan su service
  (`ZonasService`/`HorariosService`) para reuso externo.
- `ZonasService.listar()` y `HorariosService.listar()` hacen `prisma.zona.findMany()` /
  `prisma.turno.findMany()` sin `select`: devuelven todas las columnas escalares, incluida
  `aforoMaximo` (Zona) y `activo` (Turno). Ninguno de los dos hace `include` de relaciones, así
  que `mesas` nunca aparece en la respuesta de Zona hoy tampoco.
- `ZonaRespuestaDto`/`TurnoRespuestaDto` (`backend/src/zonas/dto/zona-respuesta.dto.ts`,
  `backend/src/horarios/dto/turno-respuesta.dto.ts`) son clases usadas solo para documentar
  `@ApiOkResponse`; el service sigue devolviendo el modelo de Prisma tal cual, así que la forma
  publicada depende de qué columnas trae el `select`/`findMany`, no de la clase.
- `TurnoRespuestaDto` documenta que `horaInicio`/`horaFin` (`@db.Time` de Prisma) viajan como
  fecha-hora ISO 8601 con fecha fija `1970-01-01` (ejemplo:
  `'1970-01-01T20:00:00.000Z'`, `turno-respuesta.dto.ts:18-22`): es la serialización JSON por
  defecto de un `Date`, y ninguna capa lo reformatea. `hora-local.util.ts` solo convierte en la
  dirección opuesta (`HH:mm` de un body de request → `Date`), nunca formatea una salida.
  `GET /disponibilidad` nunca devuelve `horaInicio`/`horaFin` en su cuerpo: los usa
  internamente (`cargar-contexto.ts:64`, `evaluar-reglas.ts:56`) solo para calcular, así que no
  hay ahí una segunda convención de salida a seguir.
- `Turno.diaSemana` es un enum nativo de Postgres (`enum DiaSemana { LUNES MARTES MIERCOLES
  JUEVES VIERNES SABADO DOMINGO }`, `schema.prisma:46-54`). Un enum nativo de Postgres ordena
  por la posición en que se declararon sus valores, así que `orderBy: { diaSemana: 'asc' }`
  ya da `LUNES` → `DOMINGO`, el orden de calendario semanal, sin necesidad de un `CASE`
  manual.
- `GET /disponibilidad` (`disponibilidad.controller.ts:33`) usa `@SkipThrottle()` con un
  comentario que remite a `config.yaml` §5: el throttling es para rutas que reciben un código
  de reserva (defensa contra enumeración), y una consulta pública sin ese dato no lo necesita.
- `openapi/openapi.yaml` dedica una tag en minúscula (`disponibilidad`, línea 18) a la única
  ruta pública sin auth que existe hoy, distinta de las tags en mayúscula (`Zonas`, `Turnos`,
  `Mesas`) de las rutas admin. Los `operationId` siguen siempre
  `<NombreDeClaseDelController>_<métodoDelHandler>` (`ZonasController_listar`,
  `HorariosController_listar`, `DisponibilidadController_consultar`). Los enums de
  `diaSemana`/`nombre` se declaran inline (`type: string`, `enum: [...]`), sin
  `enumName`, salvo `CodigoMotivo` que lo pide explícitamente en su decorador.
- Tests HTTP de un endpoint público completo van en `backend/test/*.e2e-spec.ts` (Supertest
  contra `AppModule` con el mismo `ValidationPipe({ transform: true })` de `main.ts`, ver
  `disponibilidad.e2e-spec.ts:1-46`); `*.integration-spec.ts` se usa para probar un service
  contra Postgres real sin pasar por HTTP (`zonas.integration-spec.ts`). Este change agrega
  endpoints HTTP nuevos, así que corresponde `*.e2e-spec.ts`.

## Goals / Non-Goals

**Goals:**
- Decidir dónde vive el controller público sin tocar el controller ni los guards admin
  existentes.
- Fijar el `select` exacto de cada endpoint para que los campos sensibles/operativos
  (`aforoMaximo`, `mesas`, `activo`) nunca lleguen a serializarse, ni hoy ni si alguien agrega
  un campo nuevo a `Zona`/`Turno` más adelante.
- Fijar el contrato OpenAPI (paths, DTOs, tags, `operationId`) siguiendo las convenciones ya
  existentes en `openapi.yaml`.

**Non-Goals:**
- No cambia `ZonasController`, `HorariosController`, `ZonaRespuestaDto` ni
  `TurnoRespuestaDto` (los admin). Su forma de respuesta actual (con `aforoMaximo`/`activo`) no
  se toca.
- No agrega caché ni rate limiting: mismo argumento que `GET /disponibilidad` (Decision D6).
- No agrega alta, baja ni edición de Zonas o Turnos (ya resuelto por `gestion-salon`).
- No decide el formato de horas para todo el contrato: si el equipo más adelante quiere migrar
  `horaInicio`/`horaFin` a un formato más simple en **todo** el sistema, es un change propio
  que también toca `TurnoRespuestaDto` (ver Open Questions).

## Decisions

### D1: Un segundo controller por módulo de dominio, no un módulo nuevo

Cada endpoint público vive en el módulo de su propio dominio, en un controller nuevo que
reutiliza el service ya existente:

- `backend/src/zonas/zonas-publicas.controller.ts` → `ZonasPublicasController`, `@Controller('zonas')`,
  sin guards, inyecta `ZonasService` (ya lo exporta `ZonasModule`).
- `backend/src/horarios/turnos-publicos.controller.ts` → `TurnosPublicosController`,
  `@Controller('turnos')`, sin guards, inyecta `HorariosService` (ya lo exporta
  `HorariosModule`).

Cada módulo agrega el controller nuevo a su array `controllers: []`, sin tocar `imports`,
`providers` ni el controller admin existente.

**Alternativa descartada: agregar un método público a `ZonasController`/`HorariosController`.**
Los guards de esas clases son decoradores de clase (`@UseGuards(...)` sobre el `Controller`),
así que un método nuevo en la misma clase queda protegido igual que el resto salvo que se
introduzca un mecanismo de bypass (un decorador `@Public()` + `Reflector` dentro de
`JwtAuthGuard.canActivate`). Ese mecanismo no existe hoy y agregarlo modifica el guard que
protege **todas** las rutas admin actuales, para una feature que no lo necesita. Se descarta
por riesgo desproporcionado al alcance.

**Alternativa descartada: módulo `catalogo` nuevo, cruzando Zona y Turno.** Requeriría que ese
módulo importe `ZonasModule` y `HorariosModule` (o directamente sus services) solo para volver
a exponerlos con otro nombre, sin ganar cohesión: §7 organiza el backend "por módulo de
dominio", y Zona/Turno ya son ese dominio. Un módulo transversal solo para el catálogo público
agrega una capa de indirección sin un beneficio de reuso que el placement por dominio no dé
también.

### D2: Servicio con `select` explícito (allow-list), no reutilizar `listar()`

Se agregan métodos nuevos, no se reusa el `listar()` admin:

```ts
// ZonasService
async listarPublicas() {
  return this.prisma.zona.findMany({
    select: {
      id: true,
      nombre: true,
      minComensales: true,
      maxComensales: true,
      anticipacionMinHoras: true,
      anticipacionMaxDias: true,
      ventanaCancelacionHoras: true,
      requiereConfirmacionAdmin: true,
    },
  });
}

// HorariosService
async listarPublicos(diaSemana?: DiaSemana) {
  return this.prisma.turno.findMany({
    where: { activo: true, ...(diaSemana ? { diaSemana } : {}) },
    select: { id: true, diaSemana: true, horaInicio: true, horaFin: true },
    orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
  });
}
```

Un `select` explícito es una lista de permitidos: si mañana se agrega una columna a `Zona` o
`Turno`, el endpoint público no la expone hasta que alguien la sume a propósito a este
`select`. La lógica de qué se filtra y cómo se ordena queda en el service, no en el
controller (§7: "la lógica de negocio vive en los services").

**Alternativa descartada:** reusar `zonasService.listar()`/`horariosService.listar()` y recortar
campos en el controller o con `class-transformer` (`@Exclude`/`plainToInstance`). Se descarta
porque es una lista de bloqueados (hay que acordarse de excluir cada campo nuevo sensible) en
vez de permitidos, y porque mover el recorte al controller viola la separación de §7. También
haría que el controller conozca la forma interna completa de `Zona`/`Turno` para saber qué
omitir.

### D3: `horaInicio`/`horaFin` en el mismo formato que ya usa `GET /admin/turnos`

Los dos campos viajan igual que en `TurnoRespuestaDto`: string ISO 8601 con fecha fija
`1970-01-01` (ejemplo `'1970-01-01T20:00:00.000Z'`), que codifica la hora local del
restaurante (config.yaml §7) y no un instante real. Es la serialización JSON por defecto del
`Date` que devuelve Prisma para una columna `@db.Time`; no se aplica ninguna transformación
adicional en el DTO de respuesta nuevo.

**Alternativa descartada (la asumida al arrancar este change): formatear como `HH:mm`.** Se
descarta después de revisar el código, por tres motivos:
1. No es la convención existente. `GET /admin/turnos` — el único otro lugar que hoy devuelve
   estos campos — usa el formato ISO-1970, no `HH:mm` (`turno-respuesta.dto.ts:18-22`).
   `GET /disponibilidad` no devuelve estos campos en absoluto (los usa solo internamente), así
   que tampoco aporta una convención de salida alternativa a seguir.
2. Un mismo campo (`Turno.horaInicio`, la misma columna `@db.Time`) terminaría serializado en
   dos formatos distintos según qué endpoint lo devuelva, obligando al frontend a manejar dos
   parsers para el mismo dato.
3. Requeriría sumar lógica de formateo de salida que hoy no existe en ningún lado del
   backend (`hora-local.util.ts` solo transforma en la dirección de entrada, `HH:mm` → `Date`),
   violando la preferencia de §2 por reusar lo que ya está antes de sumar código nuevo.

Si el equipo más adelante decide que `HH:mm` es preferible en **toda** la API, es un change
propio que también actualiza `TurnoRespuestaDto` y sus tests (ver Open Questions); no algo que
esta feature deba decidir unilateralmente para un solo endpoint.

### D4: Incluir `ventanaCancelacionHoras` en la Zona pública

Se expone junto al resto de los campos no sensibles. Es un dato ya público (documentado en
`config.yaml` §6), explícitamente habilitado por el pedido original, y le sirve al futuro
formulario de `frontend-cliente` para mostrar la política de cancelación junto a la elección de
zona (por ejemplo, avisar que VIP pide 24 h de anticipación para cancelar) sin depender de otra
llamada. El costo marginal de sumar un campo ya autorizado es nulo.

**Alternativa descartada:** omitirlo ahora y agregarlo después si `frontend-cliente` lo pide.
Se descarta porque no hay ninguna razón de seguridad o de complejidad para no incluirlo hoy, y
omitirlo solo pospone una adición trivial a un segundo change de OpenSpec sobre el mismo
endpoint público.

### D5: Filtro opcional `diaSemana` en `GET /turnos`

Query param opcional, validado con `@IsEnum(DiaSemana)` (mismo patrón que
`CrearTurnoDto.diaSemana`, `crear-turno.dto.ts:14`). Sin el parámetro, se listan los turnos
activos de todos los días. Un valor fuera del enum responde `400` (comportamiento estándar del
`ValidationPipe` global, igual que el resto de los DTOs de query del proyecto).

**Alternativa descartada: sin filtro.** Con el conjunto de datos del seed (2 turnos × 7 días,
14 filas como máximo) el frontend podría filtrar del lado del cliente sin problema. Pero el
filtro cuesta una condición de `where` y una validación ya estandarizada
(`ConsultarDisponibilidadDto` ya usa el mismo mecanismo de DTO con `class-validator` para query
params), y evita depender de que `frontend-cliente` implemente ese filtrado. Se conserva por
simplicidad real, no por especulación de uso futuro.

**Alternativa descartada: exponer un query param `activo` para que el cliente pida también los
inactivos.** Contradice el propósito del endpoint ("catálogo público de turnos activos"): un
visitante no tiene ningún uso legítimo para un turno inactivo, y agregar la opción reintroduce
la superficie que `GET /admin/turnos` ya cubre con auth.

### D6: Sin rate limiting, mismo argumento que `GET /disponibilidad`

Los dos controllers nuevos llevan `@SkipThrottle()` con un comentario que remite a esta
decisión. `config.yaml` §5 pide throttling para las rutas que reciben un código de reserva
(defensa contra enumeración por fuerza bruta); ninguno de los dos endpoints recibe uno ni
expone datos personales de una reserva. Es el mismo razonamiento ya documentado en
`disponibilidad.controller.ts:24-32`, no uno nuevo.

### D7: Nombres, tags y `operationId`

- Controllers: `ZonasPublicasController` (`backend/src/zonas/zonas-publicas.controller.ts`),
  `TurnosPublicosController` (`backend/src/horarios/turnos-publicos.controller.ts`). El sufijo
  distingue la clase pública de la clase admin homónima en el mismo módulo.
- Método único por controller: `listar()`, igual verbo que ya usan
  `ZonasController.listar()`/`HorariosController.listar()`.
- `operationId`: `ZonasPublicasController_listar` y `TurnosPublicosController_listar`, simple
  aplicación del patrón `<NombreDeClase>_<método>` que ya siguen todos los controllers del
  proyecto.
- Tags nuevas en minúscula, `zonas` y `turnos`, distintas de las tags `Zonas`/`Turnos` (con
  mayúscula) que ya usan los controllers admin — mismo criterio que usó `disponibilidad`
  (minúscula, pública, sin auth) para diferenciarse de `Auth`/`Mesas`/etc. (mayúscula, admin).
  Mantiene agrupadas en Swagger UI las rutas públicas separadas de las protegidas por JWT.
- DTOs de respuesta nuevos y propios, no una reutilización de `ZonaRespuestaDto`/
  `TurnoRespuestaDto`: `@nestjs/swagger` nombra el schema generado igual que la clase, y
  reutilizar la clase admin publicaría también sus campos (`aforoMaximo`, `activo`) en el
  schema aunque el service no los devuelva. Nombres: `ZonaPublicaRespuestaDto` y
  `TurnoPublicoRespuestaDto`.

## Riesgos / Trade-offs

- **[Riesgo]** Registrar el controller nuevo en el módulo y olvidarlo en `AppModule`/`controllers: []`
  pasa desapercibido en el código pero no en CI: `npm run openapi:check` compara el YAML contra
  lo que genera `@nestjs/swagger` desde los controllers efectivamente registrados, así que un
  controller sin registrar hace fallar el chequeo → **Mitigación:** `tasks.md` lo verifica
  explícitamente antes de dar la tarea por cerrada.
- **[Riesgo]** El orden de `DiaSemana` por `orderBy: 'asc'` depende de que Postgres ordene un
  enum nativo por la posición de declaración (`schema.prisma:46-54`, `LUNES` primero), no de
  una regla que TypeScript o Prisma documenten como contrato estable de forma explícita en el
  cliente generado → **Mitigación:** el requisito de orden determinístico de la spec se cubre
  con un test e2e que arma turnos de varios días y confirma el orden observado, así que una
  reordenación futura del enum se detecta en CI en vez de asumirse.
- **[Trade-off]** Los dos endpoints dependen de `ZonasService`/`HorariosService`, pensados
  originalmente para el CRUD admin. Si alguna vez esos services agregan lógica que no debería
  correr en una lectura pública (por ejemplo, algo que dispare una escritura), habría que
  revisar que los métodos públicos nuevos (`listarPublicas`/`listarPublicos`) sigan siendo
  operaciones de solo lectura independientes. Hoy son `findMany` puros, sin ese riesgo.
- **[Trade-off]** Mantener el formato ISO-1970 para `horaInicio`/`horaFin` (D3) traslada al
  frontend la misma responsabilidad de interpretación que ya tiene hoy con `GET /admin/turnos`
  (parsear una fecha-hora con fecha fija como si fuera una hora del día). No es una carga
  nueva que este change introduzca, pero tampoco la resuelve.

## Migration Plan

1. Sin migraciones: este change solo lee `Zona` y `Turno`, tablas existentes desde
   `modelo-dominio`.
2. Rollback: revertir el PR de implementación. No hay estado persistido que limpiar.

## Contrato OpenAPI

El fragmento de abajo **no** se agrega a `openapi/openapi.yaml` en este PR de spec —
`npm run openapi:check` compara literalmente `paths` y `components.schemas` contra lo que
generan los controllers, y un path sin controller pone CI en rojo (config.yaml §3). Se copia al
YAML en el PR de implementación, junto con los controllers, en el orden ya usado por
`disponibilidad`: primero el YAML, después los decoradores hasta que `openapi:check` pase, y
por último la implementación del handler.

Nombres fijos, porque el diff es literal: schemas `ZonaPublicaRespuestaDto` y
`TurnoPublicoRespuestaDto`; `operationId` `ZonasPublicasController_listar` y
`TurnosPublicosController_listar`; tags `zonas` y `turnos`.

```yaml
tags:
  - name: zonas
    description: Catálogo público y de solo lectura de Zonas (change catalogo-publico).
  - name: turnos
    description: >-
      Catálogo público y de solo lectura de Turnos activos (change catalogo-publico).
paths:
  /zonas:
    get:
      summary: Catálogo público de Zonas
      description: >-
        Lista todas las Zonas con los campos no sensibles que necesita el formulario de
        reserva del cliente. No incluye `aforoMaximo` ni las Mesas de la zona. Es una ruta
        pública, sin autenticación.
      operationId: ZonasPublicasController_listar
      tags:
        - zonas
      parameters: []
      responses:
        '200':
          description: Listado de Zonas. Una lista vacía responde `200`, no `404`.
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/ZonaPublicaRespuestaDto'
  /turnos:
    get:
      summary: Catálogo público de Turnos activos
      description: >-
        Lista los Turnos con `activo: true`, ordenados por día de la semana (lunes a domingo)
        y, dentro del mismo día, por hora de inicio. Es una ruta pública, sin autenticación.
      operationId: TurnosPublicosController_listar
      tags:
        - turnos
      parameters:
        - name: diaSemana
          in: query
          required: false
          description: Filtra los Turnos activos devueltos por día de la semana.
          schema:
            type: string
            enum:
              - LUNES
              - MARTES
              - MIERCOLES
              - JUEVES
              - VIERNES
              - SABADO
              - DOMINGO
            example: SABADO
      responses:
        '200':
          description: >-
            Listado de Turnos activos, opcionalmente filtrado por día de la semana. Una lista
            vacía responde `200`, no `404`.
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/TurnoPublicoRespuestaDto'
        '400':
          description: '`diaSemana` no es uno de los siete días válidos.'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorRespuesta'
components:
  schemas:
    ZonaPublicaRespuestaDto:
      type: object
      description: >-
        Forma pública de una Zona: sin `aforoMaximo` ni Mesas, datos operativos del salón sin
        uso para quien todavía no reservó.
      properties:
        id:
          type: string
          example: 3fa85f64-5717-4562-b3fc-2c963f66afa6
        nombre:
          type: string
          enum:
            - STANDARD
            - VIP
          example: VIP
        minComensales:
          type: number
          example: 2
        maxComensales:
          type: number
          example: 12
        anticipacionMinHoras:
          type: number
          example: 24
        anticipacionMaxDias:
          type: number
          example: 60
        ventanaCancelacionHoras:
          type: number
          example: 24
        requiereConfirmacionAdmin:
          type: boolean
          example: true
      required:
        - id
        - nombre
        - minComensales
        - maxComensales
        - anticipacionMinHoras
        - anticipacionMaxDias
        - ventanaCancelacionHoras
        - requiereConfirmacionAdmin
    TurnoPublicoRespuestaDto:
      type: object
      description: >-
        Forma pública de un Turno activo: sin el campo `activo` (todos los devueltos ya lo
        son). `horaInicio`/`horaFin` viajan en el mismo formato que ya usa
        `TurnoRespuestaDto` de `GET /admin/turnos`.
      properties:
        id:
          type: string
          example: 3fa85f64-5717-4562-b3fc-2c963f66afa6
        diaSemana:
          type: string
          enum:
            - LUNES
            - MARTES
            - MIERCOLES
            - JUEVES
            - VIERNES
            - SABADO
            - DOMINGO
          example: SABADO
        horaInicio:
          type: string
          example: '1970-01-01T20:00:00.000Z'
        horaFin:
          type: string
          example: '1970-01-01T23:30:00.000Z'
      required:
        - id
        - diaSemana
        - horaInicio
        - horaFin
```

## Open Questions

- **¿`HH:mm` para todo el contrato?** Si el equipo decide más adelante que `horaInicio`/
  `horaFin` deberían viajar como `HH:mm` en toda la API, es un change propio que toca también
  `TurnoRespuestaDto`/`GET /admin/turnos` (D3). No bloquea ni cambia el alcance de este change.
- **¿Filtrado server-side o client-side en `frontend-cliente`?** El filtro `diaSemana` (D5)
  queda disponible pero `frontend-cliente` puede optar por pedir todos los turnos activos una
  vez y filtrar en el cliente, dado el tamaño chico del catálogo. Cualquiera de los dos usa el
  mismo contrato.
