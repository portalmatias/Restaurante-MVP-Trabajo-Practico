> **Estado al 2026-09-17 (esta sesión):** se implementaron los tres services (Zonas, Mesas,
> Horarios) con sus DTOs y tests unitarios — sección 2.1/2.2, 3.1–3.5 y 4.1–4.3, más la
> cobertura de la sección 5 que ya cubren esos mismos tests, incluida la baja de Mesa contra
> Postgres real (5.6). `auth-admin` todavía no existe (`backend/src/auth/`), así que los tres
> `*Controller*` (2.3, 3.6, 4.4), el test e2e de `401` (5.1) y la actualización de
> `openapi/openapi.yaml` (6.2, que requiere el controller para no romper `openapi:check`)
> quedan pendientes hasta que `auth-admin` esté mergeado — ver 1.2. La prueba de la carrera
> de promesas (5.6.1) tampoco se escribió — ver la nota en esa tarea.
>
> **Nota de entorno para quien retome esto en esta máquina:** hay un Postgres nativo (no
> Docker) escuchando en el 5432 (`/Library/PostgreSQL/17`), así que `docker compose up -d`
> tal como está el `docker-compose.yml` del repo va a fallar con "address already in use".
> Para correr los tests de integración acá, remapear el contenedor a otro puerto local
> (ej. `5433:5432` en `docker-compose.yml`, sin commitear ese cambio) y apuntar
> `DATABASE_URL`/`DATABASE_URL_TEST` del `.env` a ese puerto.
>
> **Corrección tras el review de cubic sobre PR #24 (2026-09-18, PR de fix):** el #24 se
> mergeó sin atender los hallazgos de cubic (14 + 2 en la segunda revisión). Los reales se
> corrigieron en este PR de fix: `ZonasService.actualizar` y `MesasService.actualizar` ahora
> corren en una transacción `Serializable` (evita que dos escrituras concurrentes dejen
> `minComensales > maxComensales`, o una Reserva activa inconsistente con una edición de
> capacidad/zona — verificado con tests de integración nuevos contra Postgres real, no solo
> mocks); `HorariosService.actualizar` ahora persiste `activo`; Mesas traduce `P2002` a `409`
> y `P2025` a `404`, y distingue `P2003` por operación (zona inexistente al crear/editar:
> `404`; reservas que impiden eliminar: `409`). Zonas traduce `P2025` al actualizar a `404`;
> Horarios traduce `P2002` al crear/actualizar a `409` y `P2025` al actualizar o cambiar
> actividad a `404`. Zonas no tiene operación de alta. Los DTOs con campos opcionales usan
> `@ValidateIf` en vez de `@IsOptional()`
> (un `null` explícito ya no se cuela como "campo ausente"); `CrearTurnoDto`/
> `ActualizarTurnoDto` transforman `HH:mm`/`HH:mm:ss` a `Date` en vez de exigir un ISO
> completo; la etiqueta de Mesa rechaza strings de solo espacios; y la carrera de `upsert`
> de Zona en los tests de integración (que el primer fix solo trasladó a
> `reservas-invariantes.integration-spec.ts`, no la eliminó) ahora usa un helper compartido
> (`test/helpers/upsert-seguro.ts`) en los dos archivos.

> **Seguimiento del PR #27 (2026-09-19):** las suites de integración comparten las filas
> STANDARD/VIP, por lo que `jest-integration.json` fija `maxWorkers: 1`. El helper de upsert
> no evita que una suite sobrescriba los valores de otra; ejecutar las suites en serie sí
> impide esa interferencia dentro de una ejecución de Jest. Las operaciones concurrentes
> dentro de cada test siguen usando `Promise.allSettled`. No correr dos ejecuciones de
> integración simultáneas contra la misma base; usar bases separadas para ello. Los unitarios
> verifican el aislamiento `Serializable`, exactamente tres intentos al agotarse `P2034`
> y los errores de fila/relación eliminada entre la consulta y la escritura. La prueba de
> capacidad concurrente verifica un valor final solicitado, sin afirmar que solo una escritura
> pueda persistir.

> **Seguimiento del PR #27 (2026-09-21):** una vez mergeados `auth-admin` (#25) y la spec de
> `ci-integracion-db` (#26), se desbloquearon 2.3/3.6/4.4/5.1: los tres controllers
> (`ZonasController`, `MesasController`, `HorariosController`) ya existen, protegidos por
> `JwtAuthGuard` + `RolesGuard(ADMIN)`, y cada módulo de dominio ahora importa `AuthModule`
> (trae los guards y registra `JwtStrategy`). Cobertura: tests unitarios de cada controller
> (`*.controller.spec.ts`, mockeando el service) más un test de integración HTTP nuevo,
> `backend/test/gestion-salon-admin.integration-spec.ts` (Supertest contra Postgres real,
> arma su propio módulo mínimo igual que `auth.integration-spec.ts` — `AppModule` todavía no
> registra estos módulos, ver la nota de 2.1), con 401 sin token, 403 con rol incorrecto y
> flujo feliz completo (CRUD de Mesa, PATCH de Zona, alta/edición de Turno con `activo`) para
> las tres rutas — 16 tests, más los 4 existentes de `zonas`/`mesas.integration-spec.ts` que
> pasaron a necesitar `ConfigModule` en su `TestingModule` (antes no hacía falta: sus módulos
> no importaban `AuthModule`, que necesita `ConfigService` para `JwtModule.registerAsync`).
> Verificado: `typecheck`, `build`, `test` (85/85), `test:e2e` (1/1), `lint` y
> `test:integration` (53/53, 6 suites) todos en verde contra Postgres real (workaround del
> puerto 5433 de esta máquina, revertido al terminar). **6.2 (openapi.yaml) y el registro de
> estos módulos en `AppModule` siguen deliberadamente pendientes** hasta que se mergee la
> implementación de `ci-integracion-db` (#28, ya aprobada): recién ahí el job "Tests
> (backend)" de CI corre con PostgreSQL disponible durante `test:e2e`, que es lo que hoy
> impide registrar estos módulos sin romper `app.e2e-spec.ts` (mismo motivo documentado en
> 2.1 para `auth-admin`).

> **Seguimiento del PR #27 (2026-09-22):** `ci-integracion-db` (#28) mergeó a `main`. Con
> Postgres ya disponible en el job "Tests (backend)" durante todos sus pasos, se registraron
> `AuthModule`, `ZonasModule`, `MesasModule` y `HorariosModule` en `AppModule` (ver el
> comentario reescrito ahí; `ReservasModule` sigue sin registrar por un motivo distinto — no
> tiene controller propio todavía, nace en `reservas-crear`). Consecuencia inmediata: las
> rutas `/admin/zonas`, `/admin/mesas`, `/admin/turnos` y `/auth/login` pasaron a ser
> alcanzables en la app real (antes solo existían dentro de módulos de test armados a mano) —
> confirmado con un smoke test real (`node dist/src/main.js` + `curl`, login y las tres rutas
> admin con token). `backend/test/jest-e2e.json` necesitó el mismo `transformIgnorePatterns`
> que ya tenía `jest-integration.json` (ESM de `passport-jwt`/`@nestjs/jwt`): `app.e2e-spec.ts`
> ahora arranca `AppModule` completo, que importa `AuthModule` por primera vez.
>
> **6.2 (openapi.yaml) hecho** en el mismo commit: se agregaron `/admin/zonas`,
> `/admin/zonas/{id}`, `/admin/mesas`, `/admin/mesas/{id}`, `/admin/turnos` y
> `/admin/turnos/{id}` — y también `/auth/login` (pendiente desde `auth-admin`, tasks.md 5.2:
> "se copia al YAML real en el PR que registre `AuthModule` en `AppModule`", que terminó
> siendo este). Dos hallazgos reales corregidos antes de escribir el YAML, verificados
> generando el documento real con `@nestjs/swagger` (no a mano): (1) `@ApiBearerAuth()` sin
> argumento en los tres controllers emitía `security: [{bearer: []}]`, un nombre de esquema
> que no existe en `components.securitySchemes` (solo está `bearerAuth`) — corregido a
> `@ApiBearerAuth('bearerAuth')`; (2) ninguno de los DTOs de `gestion-salon` tenía
> `@ApiProperty()` (el proyecto no usa el plugin CLI de swagger que infiere metadata por
> reflection), así que publicaban como `{}` vacío — se agregaron a los 5 DTOs, más
> `@ApiQuery` explícito para `zonaId` en `GET /admin/mesas` (tampoco se infiere solo) y DTOs
> de respuesta nuevos (`ZonaRespuestaDto`, `MesaRespuestaDto`, `TurnoRespuestaDto`) para
> documentar los schemas de respuesta que pedía esta tarea. `openapi:lint` sin errores (se
> sumó un `tags:` global que también resolvió los warnings preexistentes de
> `operation-tag-defined`) y `openapi:check` sin deriva.
>
> Verificado de nuevo end-to-end contra Postgres real (mismo workaround de puerto 5433,
> revertido al terminar): `typecheck`, `build`, `lint`, `test` (85/85), `test:e2e` (1/1, ahora
> contra `AppModule` completo con Prisma real), `test:integration` (53/53, 6 suites),
> `test:scripts` (20/20), `openapi:lint` y `openapi:check` todos en verde.

> **Seguimiento (2026-09-22):** con Docker ya disponible en esta máquina para esta sesión,
> se retomó y cerró **5.6.1** (la última tarea pendiente del change) — ver la nota completa
> en esa tarea, más abajo. `openspec list` pasa de 26/27 a 27/27. Verificado de nuevo:
> `typecheck`, `lint`, `build`, `test` (117/117 — el número subió porque en el ínterin se
> mergeó la implementación de `disponibilidad`, ajena a este change), `test:e2e` (36/36, 5
> suites), `test:integration` (55/55, 6 suites, repetido 4 veces sin fallos),
> `test:scripts` (20/20), `openapi:lint` y `openapi:check`.

## 1. Prerrequisitos (bloqueante)

- [x] 1.1 Confirmar que la implementación de `modelo-dominio` está mergeada a `main` y que
      `backend/prisma/schema.prisma` tiene los modelos `Zona`, `Mesa`, `Turno` y `Reserva`.
      Verificar con `ls backend/prisma/schema.prisma` y `npx prisma validate --schema
      backend/prisma/schema.prisma`. **Hecho:** mergeado en PR #12; `prisma validate` pasa.
- [x] 1.2 Confirmar si la implementación de `auth-admin` ya existe (`backend/src/auth/`,
      `JwtAuthGuard`, `RolesGuard`). Si no existe todavía, se puede avanzar igual con los
      services de las secciones 2 a 4 y sus tests unitarios (no dependen del guard); los
      controllers, los tests e2e con guard real y la sección 5.1 quedan bloqueados hasta que
      `auth-admin` esté mergeado. **Hecho:** no existe todavía (spec en PR #9, sin
      implementación). Se avanzó con services + tests unitarios según lo previsto acá.

## 2. Módulo Zonas (`backend/src/zonas/`)

- [x] 2.1 Crear `zonas.module.ts`, `dto/actualizar-zona.dto.ts` (`class-validator`, todos los
      campos opcionales) y registrar el módulo en `AppModule`. Verificar que
      `npm run build -w backend` compila sin errores. **Hecho, con una corrección:** se
      sumaron `class-validator`/`class-transformer` a `backend/package.json` (avalados por
      `config.yaml` §2, no existían todavía en el repo). **`ZonasModule` (igual que
      `MesasModule`/`HorariosModule`) NO se registró en `AppModule`, a propósito** — se
      había registrado en el primer commit y rompió `test/app.e2e-spec.ts` en CI: importan
      `PrismaModule` (`@Global()`), y ese smoke test arranca `AppModule` completo en el job
      "Tests (backend)", que corre **sin** PostgreSQL (llega con `ci-integracion-db`);
      `PrismaService.onModuleInit` intenta `$connect()` y falla. Mismo motivo por el que
      `ReservasModule` (PR #12) tampoco está en `AppModule`. Se registra ahí cuando tenga
      un controller real.
- [x] 2.2 Implementar `ZonasService.listar()` y `ZonasService.actualizar(id, dto)`, este
      último lanzando `BadRequestException` si el `dto` deja `minComensales > maxComensales`.
      Verificar con tests unitarios: actualización válida persiste los valores, rango inválido
      se rechaza. **Hecho** — `zonas.service.spec.ts`, 9 tests (incluye el caso de rango
      inválido combinando un campo del `dto` con el persistido, y el borde `min === max`).
      **Corrección (PR de fix):** la lectura y la escritura corren dentro de una
      transacción `Serializable` (P1 de cubic — dos `PATCH` concurrentes con bordes
      opuestos podían dejar el rango inválido persistido); verificado también con un test
      de integración contra Postgres real (`zonas.integration-spec.ts`) que dispara dos
      actualizaciones en simultáneo y confirma que el resultado final nunca queda
      corrupto.
- [x] 2.3 Implementar `ZonasController` con `GET /admin/zonas` y `PATCH /admin/zonas/:id`,
      protegidos por `JwtAuthGuard` + `RolesGuard(ADMIN)`. Verificar con Supertest contra las
      Zonas sembradas por el seed de `modelo-dominio`. **Hecho** — `zonas.controller.ts` +
      `zonas.controller.spec.ts` (unitario) + cobertura HTTP en
      `gestion-salon-admin.integration-spec.ts` (401/403/200, incluido `400` con id no-UUID).
      `ZonasModule` ahora importa `AuthModule` y está registrado en `AppModule`
      (seguimiento 2026-09-22, arriba) — la ruta es alcanzable en la app real.

## 3. Módulo Mesas (`backend/src/mesas/`)

- [x] 3.1 Crear `mesas.module.ts`, `dto/crear-mesa.dto.ts` y `dto/actualizar-mesa.dto.ts`
      (`zonaId`, `capacidad`, `etiqueta`). Verificar que `npm run build -w backend` compila.
      **Hecho.**
- [x] 3.2 Implementar `MesasService.crear()`: `NotFoundException` si la Zona no existe,
      `BadRequestException` si la capacidad no es un entero positivo. Verificar con tests
      unitarios de ambos rechazos y del alta exitosa. **Hecho** — incluye `0`, `-1` y `1.5`
      como casos de capacidad no positiva.
- [x] 3.3 Implementar `MesasService.listar(zonaId?)` con filtro opcional por Zona. Verificar
      con un test unitario que el filtro devuelve solo las Mesas de la Zona pedida. **Hecho.**
- [x] 3.4 Implementar `MesasService.actualizar(id, dto)`: si el `dto` trae `capacidad`
      (no solo si la reduce — el chequeo corre siempre que venga el campo, aumentarla nunca
      puede invalidar una Reserva ya válida contra la capacidad vieja) o cambia `zonaId`,
      consultar `prisma.reserva.count` por Reservas activas (`PENDIENTE` o `CONFIRMADA`) de
      esa Mesa y lanzar `ConflictException` si el cambio las dejaría inválidas (capacidad
      insuficiente para alguna, o Zona distinta a la de alguna). Verificar con tests
      unitarios de los tres escenarios de la spec: edición libre de etiqueta/aumento de
      capacidad, reducción de capacidad rechazada, cambio de Zona rechazado. **Hecho** —
      `mesas.service.spec.ts`, cubre además zona destino inexistente. **Corrección (PR de
      fix):** toda la validación y la escritura corren dentro de una transacción
      `Serializable` (P1 de cubic — sin esto, una Reserva podía crearse entre el `count` y
      el `update` y quedar inconsistente); verificado también con un test de integración
      contra Postgres real (`mesas.integration-spec.ts`).
- [x] 3.5 Implementar `MesasService.eliminar(id)`, lanzando `ConflictException` si la Mesa
      tiene Reservas asociadas de cualquier estado (`count` sin filtro por estado) y
      `NotFoundException` si no existe. Eliminar físicamente solo si no tiene Reservas.
      Traducir `P2003` del DELETE a `ConflictException` y `P2025` a `NotFoundException`.
      Verificar con tests unitarios los rechazos por cada estado, la baja exitosa, la Mesa
      inexistente y ambos errores concurrentes; no borrar ni desvincular Reservas. **Hecho**
      (unitario, con Prisma mockeado) — ver 5.6 para la verificación contra Postgres real.
- [x] 3.6 Implementar `MesasController` con `POST`, `GET`, `PATCH /admin/mesas/:id` y
      `DELETE /admin/mesas/:id`, todos protegidos por los guards. Verificar con Supertest
      contra datos del seed. El DELETE responde `204` sin cuerpo al eliminar, `404` si la
      Mesa no existe y `409` si tiene Reservas asociadas. **Hecho** — `mesas.controller.ts`
      (incluye `ListarMesasQueryDto` para el filtro `zonaId` por query param) +
      `mesas.controller.spec.ts` (unitario) + cobertura HTTP en
      `gestion-salon-admin.integration-spec.ts` (401/403, alta `201`, listado filtrado,
      edición `200`, baja `204` con verificación de que la fila desaparece). `MesasModule`
      ahora importa `AuthModule` y está registrado en `AppModule` (seguimiento
      2026-09-22, arriba) — la ruta es alcanzable en la app real.

## 4. Módulo Turnos (`backend/src/horarios/`)

- [x] 4.1 Crear `horarios.module.ts`, `dto/crear-turno.dto.ts` y `dto/actualizar-turno.dto.ts`
      (`diaSemana`, `horaInicio`, `horaFin`, `activo` opcional). Verificar que
      `npm run build -w backend` compila. **Hecho.**
- [x] 4.2 Implementar `HorariosService.crear()`, con `activo = true` por defecto si el `dto`
      no lo especifica. Verificar con un test unitario. **Hecho** — incluye también el caso
      `activo: false` explícito. **Corrección (PR de fix):** traduce `P2002`
      (`@@unique([diaSemana, horaInicio])`) a `ConflictException` en vez de dejarlo escapar
      como `500`.
- [x] 4.3 Implementar `HorariosService.listar()`, `HorariosService.actualizar(id, dto)` (día y
      horario) y `HorariosService.cambiarActivo(id, activo)`. Verificar con tests unitarios de
      cada uno, confirmando que desactivar no borra el registro (sigue apareciendo en
      `listar()`). **Hecho.** **Corrección (PR de fix, P1 de cubic):** `actualizar` ignoraba
      silenciosamente `activo` del `PATCH` — el flujo de activar/desactivar en el mismo
      `PATCH` de edición que documenta la spec no funcionaba. Ahora lo persiste, con tests
      para `true` y `false`. También traduce `P2002` a `409`.
- [x] 4.4 Implementar `HorariosController` con `POST`, `GET` y `PATCH /admin/turnos/:id`
      (aceptando `activo` como parte del mismo `PATCH` de edición, para no multiplicar rutas),
      todos protegidos por los guards. Verificar con Supertest. **Hecho** — rutas bajo
      `/admin/turnos` (nombre de dominio, no `/admin/horarios`) en `horarios.controller.ts` +
      `horarios.controller.spec.ts` (unitario) + cobertura HTTP en
      `gestion-salon-admin.integration-spec.ts` (401, alta `201` con `horaInicio`/`horaFin`
      en formato `HH:mm`, listado, `PATCH` con `activo` en el mismo `200`). `HorariosModule`
      ahora importa `AuthModule` y está registrado en `AppModule` (seguimiento
      2026-09-22, arriba) — la ruta es alcanzable en la app real.

## 5. Tests de los requisitos de la spec

- [x] 5.1 Test e2e: `GET /admin/zonas` sin token responde `401` (spec: "Rutas de gestión de
      salón protegidas por autenticación de administrador"). **Hecho**, como test de
      integración en vez de e2e (mismo patrón que `auth.integration-spec.ts`, para no
      duplicar la app entre archivos): `gestion-salon-admin.integration-spec.ts` arma su
      propio módulo mínimo y cubre 401 sin token en las tres rutas (`/admin/zonas`,
      `/admin/mesas`, `/admin/turnos`), no solo `/admin/zonas`. Confirmado además contra la
      app real (`AppModule` ya registra estos módulos, seguimiento 2026-09-22 arriba): un
      smoke test manual (`node dist/src/main.js` + `curl`) verificó `401` real sin token en
      `/admin/zonas`.
- [x] 5.2 Test: actualización de Zona con `minComensales > maxComensales` rechazada (spec:
      "Actualización de configuración de Zona"). **Cubierto** por `zonas.service.spec.ts`
      (2.2) — no se duplicó en un archivo aparte.
- [x] 5.3 Test: alta de Mesa con Zona inexistente y alta con capacidad no positiva, ambas
      rechazadas (spec: "Alta de Mesa"). **Cubierto** por `mesas.service.spec.ts` (3.2).
- [x] 5.4 Test: listado de Mesas filtrado por Zona devuelve solo las de esa Zona (spec:
      "Listado de Mesas"). **Cubierto** por `mesas.service.spec.ts` (3.3).
- [x] 5.5 Test: reducción de capacidad de Mesa por debajo de una Reserva activa rechazada, y
      cambio de Zona de una Mesa con Reserva activa rechazado (spec: "Edición de Mesa preserva
      las Reservas activas") — sembrar una Reserva activa de prueba contra la Mesa antes de
      cada caso. **Cubierto** por `mesas.service.spec.ts` (3.4).
- [x] 5.6 Tests de integración contra PostgreSQL real: baja exitosa sin ninguna Reserva
      (ausente del listado), baja de Mesa inexistente (`NotFoundException`) y rechazo con
      `ConflictException` para cada estado (`PENDIENTE`, `CONFIRMADA`, `CANCELADA`,
      `NO_SHOW`). Verificar tras cada rechazo que la Mesa, la Reserva y su relación
      permanecen intactas (spec: "Baja de Mesa preserva las Reservas activas e históricas").
      **Hecho y confirmado** contra Postgres real — `backend/test/mesas.integration-spec.ts`
      contra `MesasService` directamente (sin HTTP: no hay controller todavía, ver 3.6),
      mismo patrón que `reservas-invariantes.integration-spec.ts`. `npm run test:integration
      -w backend`: 21/21 en verde (3 suites), repetido 4 veces sin flaky. La corrida real
      expuso y corrigió un bug genuino en el `beforeAll` del test: dos
      `*.integration-spec.ts` corriendo en paralelo (workers de Jest) hacían `upsert` de la
      misma fila `Zona.nombre = 'STANDARD'` — se resolvió reintentando con `findUniqueOrThrow`
      ante un `P2002`. El `204` vía Supertest (con el controller ya implementado, ver 3.6)
      se agregó en `gestion-salon-admin.integration-spec.ts`; `404`/`409` vía HTTP no se
      duplicaron ahí porque ya están cubiertos a nivel de service en este mismo archivo y en
      `mesas.service.spec.ts`.
- [x] 5.6.1 Test de integración de la carrera entre consulta y DELETE: sincronizar la
      inserción de una Reserva después del `count` y antes del DELETE siguiendo la sección
      "Prueba determinística de la carrera entre consulta y DELETE" del diseño. Usar un spy
      temporal sobre `prisma.mesa.delete` que espere una barrera y delegue en el método real;
      confirmar la inserción con un segundo cliente antes de liberar la barrera. Sin sleeps
      ni resultados/errores simulados. Verificar que la FK real impide la baja y el service
      lanza `ConflictException` (`409`), conservando ambos registros. Confirmar que la FK usa
      `ON DELETE RESTRICT`. Acotar explícitamente la espera de la barrera y detectar la
      terminación anticipada del service con `Promise.race`; cancelar los timers al terminar.
      Liberar la barrera, consumir el resultado de la operación, restaurar el spy y cerrar
      clientes con `finally` anidados según el diseño, antes de propagar el fallo. Verificar
      también la limpieza con una Mesa inexistente que falle antes del DELETE, sin depender
      del timeout externo de Jest. **Hecho (2026-09-22, retomado con Docker disponible en
      esta máquina):** implementado exactamente según el diseño en
      `backend/test/mesas.integration-spec.ts` — `interceptarDelete` (spy + barrera de
      promesas, delega en el método original capturado antes de espiar),
      `esperarBarreraODeteccionTemprana` (`Promise.race` con plazo explícito, cancela su
      timer siempre) y `capturarResultado` (evita rechazos de promesas sin manejar). Dos
      pruebas: la carrera real (segundo `PrismaClient`, conexión propia con
      `connection_limit`/`statement_timeout`/`connect_timeout` acotados, inserta la Reserva
      dentro de la barrera) y la verificación del propio mecanismo con una Mesa inexistente
      (confirma detección temprana, muy por debajo del plazo completo). Corrida repetida
      contra Postgres real (4 corridas seguidas de la suite completa, 55/55 cada vez) sin
      fallos. **Hallazgo documentado, no un bug del test:** el proceso de Jest tarda ~5s
      extra en salir después de que el DELETE interceptado termina en un error real de
      Prisma (`P2003`) — aislado experimentalmente a la combinación específica de un `await`
      real antes de invocar el método original *y* que ese método rechace; no reproduce con
      un delete exitoso por el mismo mock, ni con un delete fallido sin ese `await`
      intermedio, ni depende de `jest.spyOn` en particular (se reprodujo igual con un swap
      manual del método) ni de `segundoCliente` (se reprodujo sin crearlo). Costo fijo, una
      vez por corrida del proceso de Jest — no por test, no compone con más pruebas — y
      siempre termina con exit code `0`. Detalle completo en el comentario de
      `interceptarDelete`.
- [x] 5.7 Test: alta de Turno sin indicar `activo` queda `activo = true` (spec: "Alta de
      Turno"). **Cubierto** por `horarios.service.spec.ts` (4.2).
- [x] 5.8 Test: desactivar un Turno lo marca `activo = false` sin eliminarlo y sigue
      apareciendo en el listado (spec: "Activación y desactivación de Turno"). **Cubierto**
      por `horarios.service.spec.ts` (4.3).

## 6. Verificación final

- [x] 6.1 Correr `openspec validate gestion-salon --strict` y confirmar que el change es
      válido. **Hecho.**
- [x] 6.2 Agregar a `openapi/openapi.yaml` los paths `/admin/zonas`, `/admin/mesas` y
      `/admin/turnos` (operaciones GET/POST/PATCH/DELETE según corresponda, `security:
      [bearerAuth]` en cada una, y los schemas de request/response), en el mismo PR
      (Definition of Done, `config.yaml` §13). Documentar en el DELETE de Mesa las respuestas
      `204` sin cuerpo, `404` y `409` por Reservas asociadas de cualquier estado. **Hecho**
      (seguimiento 2026-09-22, arriba) — junto con `/auth/login`, pendiente desde
      `auth-admin`. Los seis paths, `security: [bearerAuth]` en cada operación protegida y
      los schemas de request/response se generaron con `@nestjs/swagger` desde la app real
      (no se escribieron a mano sin verificar) y se copiaron al YAML committeado;
      `openapi:check` confirma cero deriva. Dos hallazgos reales corregidos en el camino:
      `@ApiBearerAuth()` sin argumento generaba un requisito de seguridad `bearer` que no
      coincide con el esquema `bearerAuth` ya definido (corregido pasando el nombre
      explícito), y los DTOs de este change no tenían `@ApiProperty()` (el proyecto no usa
      el plugin CLI de swagger), así que publicaban schemas vacíos — se agregaron a los 5
      DTOs existentes más 3 DTOs de respuesta nuevos (`ZonaRespuestaDto`,
      `MesaRespuestaDto`, `TurnoRespuestaDto`) y un `@ApiQuery` explícito para el filtro
      `zonaId` de `GET /admin/mesas` (tampoco se infiere sin el plugin).
- [x] 6.3 Confirmar que no hicieron falta variables de entorno nuevas ni migraciones de
      Prisma — este change no agrega campos a `Zona`, `Mesa` ni `Turno`. **Hecho** — no se
      tocó `schema.prisma` ni `.env.example`.
