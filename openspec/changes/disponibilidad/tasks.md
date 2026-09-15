## 1. Prerrequisitos (bloqueante)

- [ ] 1.1 Confirmar que el PR #12 (`modelo-dominio`) está mergeado a `main` y crear
      `feature/disponibilidad` desde ese `main`. No seguir hasta que sea cierto. Verificar con
      `git log origin/main --oneline | grep -i modelo` y confirmando que
      `backend/prisma/schema.prisma` tiene `Turno`, `Reserva` y `ConfiguracionNegocio`, y que
      `npm run db:migrate -w backend` y `npm run db:seed -w backend` corren sin errores.
- [ ] 1.2 Confirmar que `ConfiguracionNegocio` tiene `zonaHoraria` (IANA) con seed
      `America/Argentina/Buenos_Aires`. Si no lo tiene, aplicar el plan B de `design.md`
      (Migration Plan): agregar el campo con default, generar la migración con
      `--create-only`, revisar que el SQL no toque el índice único parcial de `Reserva` y
      actualizar el `upsert` de `seed.ts`. Verificar con `npx prisma migrate status` (dentro de
      `backend/`) sin migraciones pendientes y con una consulta a la fila `id = 1` que devuelva
      la zona horaria.
- [ ] 1.3 Si ni #12 ni `auth-admin` los agregaron, sumar `class-validator` y
      `class-transformer` a `backend/` y registrar un `ValidationPipe` global con
      `transform: true` en `main.ts` (D8). Verificar que `npm run build -w backend` compila y
      que `npm run test:e2e -w backend` sigue en verde con los tests existentes.
- [ ] 1.4 Crear `backend/src/disponibilidad/disponibilidad.module.ts`, vacío por ahora, y
      registrarlo en `AppModule`. Verificar que `npm run build -w backend` compila y que
      `npm run openapi:check` sigue pasando (el módulo todavía no tiene controller).

## 2. Zona horaria: tests primero, después `inicioTurnoUtc`

- [ ] 2.1 Escribir `backend/src/disponibilidad/zona-horaria.spec.ts` **antes** de la
      implementación, con una función `inicioTurnoUtc` que por ahora solo lanza un error. Casos:
      `2026-09-19` + `12:00` en Buenos Aires da `2026-09-19T15:00:00Z`; `+ 20:00` da
      `2026-09-19T23:00:00Z`; `2026-09-20` + `23:30` da `2026-09-21T02:30:00Z` (cruce de
      medianoche UTC); `2009-01-15` + `12:00` da `2009-01-15T14:00:00Z` (horario de verano
      histórico); `America/New_York` `2026-03-08` + `03:30` da `2026-03-08T07:30:00Z`. Sumar
      los casos del día de la semana con `getUTCDay`: `2026-09-19` da `SABADO` y
      `2026-09-21` da `LUNES`. Verificar que la suite corre y falla (rojo).
- [ ] 2.2 Implementar `inicioTurnoUtc(fecha, horaInicio, zonaHoraria)` con
      `Intl.DateTimeFormat(...).formatToParts` y la segunda pasada, más el mapeo de
      `getUTCDay()` al enum `DiaSemana` (D5, Trampas de fechas). Verificar en Git Bash que la
      suite de 2.1 pasa con las dos zonas horarias:
      `TZ=UTC npm test -w backend -- zona-horaria` y
      `TZ=America/Argentina/Buenos_Aires npm test -w backend -- zona-horaria`.

## 3. Reglas: tests primero, después `evaluarReglas`

- [ ] 3.1 Definir los tipos en `backend/src/disponibilidad/reglas/`: `CodigoMotivo` (enum con
      los ocho códigos en el orden de la spec), `MotivoNoDisponible`, `ContextoReserva` y
      `SolicitudDisponibilidad`, más `evaluarReglas` y `calcularLugaresRestantes` que solo
      lanzan un error. Verificar con `npm run typecheck -w backend`.
- [ ] 3.2 Escribir `evaluar-reglas.spec.ts` para turno y anticipación, con contextos armados a
      mano con los valores del seed y `ahora` fijo: turno inactivo; turno de otro día de la
      semana; exactamente 2 h antes permitido y 1 h 59 min rechazado (`ANTICIPACION_MINIMA`);
      VIP con 23 h 59 min rechazado; fecha pasada con solo `ANTICIPACION_MINIMA`; exactamente
      30 días permitido y 30 días + 1 min rechazado (`ANTICIPACION_MAXIMA`); exactamente 60
      días en VIP permitido. Verificar que la suite falla (rojo).
- [ ] 3.3 Sumar a `evaluar-reglas.spec.ts` los casos de comensales, aforo y mesa: bordes 1/8
      en STANDARD y 2/12 en VIP permitidos; 1 en VIP con `COMENSALES_FUERA_DE_RANGO`; 9 en
      STANDARD con `COMENSALES_FUERA_DE_RANGO` y `SIN_MESA_DISPONIBLE` en ese orden; llenar
      exacto el aforo VIP (18 + 2) permitido y 18 + 4 con `AFORO_ZONA`; aforo global 30 con
      26 + 4 permitido y 26 + 6 con `AFORO_GLOBAL`; lugar en el aforo pero sin mesa que
      alcance con `SIN_MESA_DISPONIBLE`. Verificar que la suite falla (rojo).
- [ ] 3.4 Sumar los casos de orden, lugares restantes y medianoche: los cuatro motivos a la vez
      en el orden fijo (cena del lunes, fecha martes, VIP, 1 comensal); `lugaresRestantes` como
      `min(zona, global)`, sin restar lo solicitado (20, no 8) y 0 cuando el aforo quedó por
      debajo de lo ocupado; cena del sábado con `ahora` a las 18:00 local permitida (2 h
      exactas contra 23:00Z) y a las 22:00 local (`2026-09-20T01:00Z`) con
      `ANTICIPACION_MINIMA`. Verificar que la suite falla (rojo).
- [ ] 3.5 Implementar `evaluarReglas` y `calcularLugaresRestantes` como funciones puras (D1,
      D2). Verificar que toda la suite de 3.2–3.4 pasa con `TZ=UTC` y con
      `TZ=America/Argentina/Buenos_Aires` (mismos comandos que 2.2, filtrando por
      `evaluar-reglas`).

## 4. Cargador de contexto y lock

- [ ] 4.1 Escribir `backend/test/disponibilidad-contexto.e2e-spec.ts` **antes** del cargador,
      contra la base de test de `docker-compose`, con datos propios y `Reserva` limpia en cada
      test: `CANCELADA` y `NO_SHOW` no suman a `ocupadosZona` ni a `ocupadosGlobal`;
      `PENDIENTE` sí suma; la zona se resuelve por la mesa; el global suma todas las zonas;
      una reserva con fecha `2026-09-20` no cuenta para `2026-09-19`; las capacidades libres
      excluyen mesas con reserva activa e incluyen las que solo tienen una cancelada;
      `turnoId` y `zonaId` inexistentes lanzan `NotFoundException`. Verificar que falla (rojo)
      con `npm run test:e2e -w backend -- disponibilidad-contexto`.
- [ ] 4.2 Implementar `cargarContexto(db, solicitud)` con la API tipada de Prisma (D1). La
      fecha se pasa siempre como `Date.UTC(y, m - 1, d)` y nunca como instante con hora
      (Trampas de fechas). Verificar que la suite de 4.1 pasa y que el mismo test corre
      pasando un `tx` de `prisma.$transaction`.
- [ ] 4.3 Implementar `bloquearTurnoFecha(tx, turnoId, fecha)` con `$executeRaw` y un
      comentario que remita a D6 y D7 de `design.md`. Verificar con un test de integración
      que la llamada dentro de una transacción no falla. Si Postgres no infiere el tipo de los
      parámetros, agregar `::text` y volver a correrlo.

## 5. Service

- [ ] 5.1 Implementar `DisponibilidadService.consultar(query)`: convertir `fecha` con
      `Date.UTC`, `cargarContexto(prisma)`, `evaluarReglas(contexto, solicitud, new Date())` y
      `calcularLugaresRestantes`, con `disponible = motivos.length === 0`. Exportar desde
      `DisponibilidadModule` el service, `cargarContexto`, `evaluarReglas`,
      `calcularLugaresRestantes` y `bloquearTurnoFecha` para `reservas-crear`. Verificar con
      `npm run build -w backend`. El comportamiento se prueba en la sección 7.

## 6. Contrato OpenAPI y controller (orden D2 de `fundacion-repo`)

- [ ] 6.1 Copiar el fragmento de la sección "Contrato OpenAPI" de `design.md` a
      `openapi/openapi.yaml`, sin cambiar nombres. Verificar que `npm run openapi:lint` pasa y
      que `npm run openapi:check` **falla** porque el path todavía no tiene controller. Eso
      confirma que la compuerta ve el cambio.
- [ ] 6.2 Crear los DTOs y el controller decorado, con el cuerpo del handler sin implementar:
      `ConsultarDisponibilidadDto` (D8), clases de respuesta con nombre exacto
      `DisponibilidadRespuesta`, `MotivoNoDisponible` y `ErrorRespuesta`, enum con
      `enumName: 'CodigoMotivo'`, `@ApiTags('disponibilidad')`, método `consultar` en
      `DisponibilidadController` (`operationId` `DisponibilidadController_consultar`) y
      respuestas 200/400/404 con `summary` y `description` en español idénticos al YAML.
      Ajustar decoradores hasta que `npm run build -w backend && npm run openapi:check` pase
      sin diferencias.
- [ ] 6.3 Implementar el handler delegando en `DisponibilidadService.consultar`, sin lógica en
      el controller (§7). Verificar que `npm run openapi:check` sigue pasando y que, con la
      base sembrada y el backend levantado, `curl` a `/disponibilidad` con la cena de un sábado
      futuro y zona STANDARD devuelve `200` con `disponible`, `lugaresRestantes` y `motivos`.

## 7. Tests e2e del endpoint (Supertest)

- [ ] 7.1 Crear `backend/test/disponibilidad.e2e-spec.ts` levantando la app con el mismo
      `ValidationPipe` que `main.ts`, con datos propios y `Reserva` limpia antes de cada test.
      No usar las reservas de ejemplo del seed, que tienen fechas relativas. Las fechas se
      calculan desde el reloj real y lejos de los bordes (D9). Verificar que la suite arranca y
      termina.
- [ ] 7.2 Tests `400`: falta `zonaId`; `fecha=2026-09-19T20:00:00Z`; `fecha=2026-02-30`;
      `turnoId=abc`; `comensales` igual a `0`, `2.5` y `dos`. En todos, cuerpo
      `{ statusCode: 400, message: string[], error: "Bad Request" }`. Verificar con
      `npm run test:e2e -w backend -- disponibilidad`.
- [ ] 7.3 Tests `404`: `turnoId` UUID inexistente y `zonaId` UUID inexistente, con cuerpo
      `{ statusCode: 404, message: string, error: "Not Found" }`. Verificar con el mismo
      comando.
- [ ] 7.4 Tests `200`: consulta sin header `Authorization` con lugar (`disponible: true`,
      `motivos: []`, `lugaresRestantes` igual al aforo de la zona); turno del lunes con
      `200` y solo `TURNO_INACTIVO` (nunca `409`); la cantidad de reservas es la misma antes y
      después de consultar; con reservas VIP de 12 y 6, la consulta de 2 da `disponible: true`
      y, después de insertar otra de 2, la misma consulta da `AFORO_ZONA` con
      `lugaresRestantes: 0`. Verificar con el mismo comando.

## 8. Test de integración del lock (depende de `ci-integracion-db` para correr en CI)

- [ ] 8.1 Escribir `backend/test/disponibilidad-lock.e2e-spec.ts` con un helper de test que
      reproduce el flujo que va a usar `reservas-crear` (transacción → `bloquearTurnoFecha` →
      `cargarContexto(tx)` → `evaluarReglas` → si no hay motivos, `INSERT` en la mesa libre
      más chica que alcance). Con aforo VIP configurado en 8 y sin reservas, lanzar con
      `Promise.all` 4 creaciones de 3 comensales para la misma cena y fecha. Verificar que se
      persisten exactamente 2 y que la suma de comensales activos es 6, repitiendo el caso 10
      veces para que no pase por casualidad, y que ninguna transacción aborta con `P2028`. Los
      escenarios de `409` del requisito compartido se prueban por HTTP en `reservas-crear`.
- [ ] 8.2 Hasta que `ci-integracion-db` esté mergeado, correr las suites de las secciones 4,
      7 y 8 localmente contra `docker-compose` y dejar la salida en la descripción del PR,
      aclarando que CI todavía no las ejecuta. Verificar que el PR tiene esa nota, o que el job
      `test` de CI las muestra si `ci-integracion-db` ya está mergeado.

## 9. Cierre (Definition of Done, `config.yaml` §13)

- [ ] 9.1 `openspec validate disponibilidad --strict` pasa y todas las tareas de este archivo
      están marcadas. Verificar con el comando y revisando que no quede ningún `- [ ]`.
- [ ] 9.2 Si se aplicó el plan B de 1.2, la migración está generada y commiteada (nunca
      `db push`) y el índice parcial de `Reserva` sigue intacto. Verificar con
      `npx prisma migrate status` y leyendo el `migration.sql` nuevo.
- [ ] 9.3 `openapi/openapi.yaml` actualizado en el mismo PR. Verificar con
      `npm run openapi:lint` y `npm run openapi:check` en verde.
- [ ] 9.4 No se agregaron variables de entorno (la zona horaria es un dato de
      `ConfiguracionNegocio`, no de `.env`). Verificar con `git diff main -- .env.example`
      vacío. Si alguna hizo falta, sumarla ahí.
- [ ] 9.5 Tests de las reglas del §6 que toca el change: `npm test -w backend` en verde con
      `TZ=UTC` y con `TZ=America/Argentina/Buenos_Aires`, y `npm run test:e2e -w backend` en
      verde localmente.
- [ ] 9.6 `npm run lint` y `npm run typecheck` en limpio, sin warnings nuevos. Verificar con
      los dos comandos desde la raíz.
- [ ] 9.7 CI en verde en el PR `feature/disponibilidad`. Verificar en la pestaña Checks.
- [ ] 9.8 PR con descripción en español, enlazado a `openspec/changes/disponibilidad/`, con la
      nota de 8.2 si corresponde, y aprobado por un compañero distinto del autor. Verificar en
      GitHub.
- [ ] 9.9 Después del merge, archivar el change con `openspec archive disponibilidad` en su
      propio PR. Verificar que `openspec/specs/disponibilidad/spec.md` existe en `main`.
