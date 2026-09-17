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
> mocks); `HorariosService.actualizar` ahora persiste `activo`; `crear`/`actualizar` de los
> tres services traducen `P2002`/`P2025` de Prisma a `409`/`404` en vez de dejarlos escapar
> como `500`; los DTOs con campos opcionales usan `@ValidateIf` en vez de `@IsOptional()`
> (un `null` explícito ya no se cuela como "campo ausente"); `CrearTurnoDto`/
> `ActualizarTurnoDto` transforman `HH:mm`/`HH:mm:ss` a `Date` en vez de exigir un ISO
> completo; la etiqueta de Mesa rechaza strings de solo espacios; y la carrera de `upsert`
> de Zona en los tests de integración (que el primer fix solo trasladó a
> `reservas-invariantes.integration-spec.ts`, no la eliminó) ahora usa un helper compartido
> (`test/helpers/upsert-seguro.ts`) en los dos archivos.

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
- [ ] 2.3 Implementar `ZonasController` con `GET /admin/zonas` y `PATCH /admin/zonas/:id`,
      protegidos por `JwtAuthGuard` + `RolesGuard(ADMIN)`. Verificar con Supertest contra las
      Zonas sembradas por el seed de `modelo-dominio`. **Bloqueado:** necesita `JwtAuthGuard`/
      `RolesGuard` de `auth-admin`, que todavía no existe.

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
- [ ] 3.6 Implementar `MesasController` con `POST`, `GET`, `PATCH /admin/mesas/:id` y
      `DELETE /admin/mesas/:id`, todos protegidos por los guards. Verificar con Supertest
      contra datos del seed. El DELETE responde `204` sin cuerpo al eliminar, `404` si la
      Mesa no existe y `409` si tiene Reservas asociadas. **Bloqueado:** mismo motivo que 2.3.

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
- [ ] 4.4 Implementar `HorariosController` con `POST`, `GET` y `PATCH /admin/turnos/:id`
      (aceptando `activo` como parte del mismo `PATCH` de edición, para no multiplicar rutas),
      todos protegidos por los guards. Verificar con Supertest. **Bloqueado:** mismo motivo
      que 2.3.

## 5. Tests de los requisitos de la spec

- [ ] 5.1 Test e2e: `GET /admin/zonas` sin token responde `401` (spec: "Rutas de gestión de
      salón protegidas por autenticación de administrador"). **Bloqueado:** mismo motivo
      que 2.3.
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
      ante un `P2002`. El HTTP real (`204`/`404`/`409` vía Supertest) sigue pendiente hasta
      que exista el controller.
- [ ] 5.6.1 Test de integración de la carrera entre consulta y DELETE: sincronizar la
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
      del timeout externo de Jest. **No hecho esta sesión, a propósito:** es la tarea más
      compleja del change (spy + `Promise.race` + dos clientes Prisma + limpieza anidada) y
      sin Postgres real para correrla y corregirla iterativamente, escribirla "a ciegas"
      tiene demasiado riesgo de un bug sutil en el propio test (exactamente el tipo de error
      que solo se ve corriéndolo). Queda pendiente para quien retome este change con Docker
      disponible; el diseño ya está completamente especificado en `design.md`.
- [x] 5.7 Test: alta de Turno sin indicar `activo` queda `activo = true` (spec: "Alta de
      Turno"). **Cubierto** por `horarios.service.spec.ts` (4.2).
- [x] 5.8 Test: desactivar un Turno lo marca `activo = false` sin eliminarlo y sigue
      apareciendo en el listado (spec: "Activación y desactivación de Turno"). **Cubierto**
      por `horarios.service.spec.ts` (4.3).

## 6. Verificación final

- [x] 6.1 Correr `openspec validate gestion-salon --strict` y confirmar que el change es
      válido. **Hecho.**
- [ ] 6.2 Agregar a `openapi/openapi.yaml` los paths `/admin/zonas`, `/admin/mesas` y
      `/admin/turnos` (operaciones GET/POST/PATCH/DELETE según corresponda, `security:
      [bearerAuth]` en cada una, y los schemas de request/response), en el mismo PR
      (Definition of Done, `config.yaml` §13). Documentar en el DELETE de Mesa las respuestas
      `204` sin cuerpo, `404` y `409` por Reservas asociadas de cualquier estado.
      **Bloqueado:** sin controllers todavía (2.3/3.6/4.4), agregar estos paths al YAML
      committeado haría fallar `openapi:check` (compara contra los controllers reales —
      convención fijada en el PR #18). Se agrega junto con los controllers.
- [x] 6.3 Confirmar que no hicieron falta variables de entorno nuevas ni migraciones de
      Prisma — este change no agrega campos a `Zona`, `Mesa` ni `Turno`. **Hecho** — no se
      tocó `schema.prisma` ni `.env.example`.
