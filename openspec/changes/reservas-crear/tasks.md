## 1. Prerrequisitos (bloqueante)

- [x] 1.1 Confirmar que el PR #12 (`modelo-dominio`) y la implementación de `disponibilidad`
      están mergeados a `main`, y crear `feature/reservas-crear` desde ese `main`. No seguir
      hasta que sea cierto. Verificar con `git log origin/main --oneline` y confirmando que
      existen `backend/src/reservas/reservas.service.ts` y `backend/src/disponibilidad/`, y que
      `npm run db:migrate -w backend` y `npm run db:seed -w backend` corren sin errores.
- [x] 1.2 Confirmar que `DisponibilidadModule` exporta `cargarContexto`, `evaluarReglas`,
      `bloquearTurnoFecha`, `CodigoMotivo`, `MotivoNoDisponible` y el validador de `fecha` del
      DTO de la consulta, con esos nombres y firmas (D1). Si algún nombre cambió al
      implementarse, usar el real y anotarlo en la descripción del PR, sin renombrar nada.
      Verificar con `grep -rn "export" backend/src/disponibilidad`.
- [x] 1.3 Confirmar si `ContextoReserva` ya expone `mesasLibres` con `id`, `etiqueta` y
      `capacidad`, y `zona.requiereConfirmacionAdmin` (D3, D4). Anotar el resultado: define si
      la sección 2 hace falta. Verificar leyendo el tipo en `backend/src/disponibilidad/`.
- [x] 1.4 Confirmar que el `ValidationPipe` global está registrado con `transform: true` y
      **sin** `enableImplicitConversion` (si no, `comensales: "4"` pasaría la validación del
      body). Verificar con `grep -n "ValidationPipe" -A3 backend/src/main.ts`.

## 2. Extensión explícita del contexto (solo si 1.3 encontró que falta)

> No aplica: 1.3 confirmó que `ContextoReserva` ya expone `mesasLibres` con `id`, `etiqueta` y
> `capacidad`, y `zona.requiereConfirmacionAdmin` (`backend/src/disponibilidad/reglas/tipos.ts`).

- [x] 2.1 Sumar a `backend/test/disponibilidad-contexto.e2e-spec.ts` (o la suite del cargador
      que exista) los casos **antes** del cambio: `mesasLibres` trae `id`, `etiqueta` y
      `capacidad` de cada mesa libre de la zona y excluye las que tienen reserva activa;
      `zona.requiereConfirmacionAdmin` es `true` en VIP y `false` en STANDARD. Verificar que
      la suite falla (rojo).
- [x] 2.2 Ampliar el `select` de `cargarContexto` y el tipo `ContextoReserva`, sin cambiar el
      nombre ni la firma de la función, ni `evaluarReglas` (que sigue leyendo solo
      capacidades). Verificar que la suite de 2.1 pasa y que toda la suite de
      `disponibilidad` sigue en verde con `npm test -w backend -- disponibilidad` y
      `npm run test:e2e -w backend -- disponibilidad`.

## 3. Tests primero: invariantes, best fit y estado inicial

- [ ] 3.1 Adaptar `backend/test/reservas-invariantes.integration-spec.ts` de #12 a la nueva
      entrada de `crearReserva` (sin `mesaId` ni `zonaSolicitadaId`, con `zonaId`), **antes**
      de tocar el service. Usar zonas y mesas propias para controlar qué mesa elige best fit.
      Cada invariante (1 a 4) sigue con al menos un test que intenta violarlo, y los rechazos
      se afirman como `ConflictException` con el `CodigoMotivo` que corresponde. Conservar el
      test de colisión de código que espía `generarCodigoReserva`. Verificar que la suite
      falla (rojo) con `npm run test:integration -w backend -- reservas-invariantes`.
- [ ] 3.2 Sumar a esa suite: estado `CONFIRMADA` en una zona con
      `requiereConfirmacionAdmin = false` y `PENDIENTE` con `true`, incluida una zona
      STANDARD configurada en `true` (D4); un turno o una zona inexistentes lanzan
      `NotFoundException`; un rechazo por reglas no persiste nada (se cuenta `Reserva` antes y
      después); la reserva persistida tiene `fecha` igual al `Date.UTC` enviado para un turno
      configurado a las 22:00 local. Verificar que falla (rojo).
- [x] 3.3 Crear `backend/src/reservas/elegir-mesa-best-fit.ts` con una función que solo lanza
      un error y escribir `elegir-mesa-best-fit.spec.ts`: 3 comensales con mesas 2, 2, 4, 6 y 8
      elige la de 4; capacidad exacta; empate de capacidad elige la menor `etiqueta`
      (`S1` antes que `S2`, y `S10` antes que `S2`); lista desordenada da el mismo resultado;
      ninguna alcanza devuelve `undefined`; lista vacía devuelve `undefined`. Verificar que la
      suite falla (rojo) con `npm test -w backend -- elegir-mesa-best-fit`.
- [x] 3.4 Implementar `elegirMesaBestFit` como función pura (D3). Verificar que la suite de
      3.3 pasa con `TZ=UTC` y con `TZ=America/Argentina/Buenos_Aires`.

## 4. Tests primero: concurrencia y choques

- [ ] 4.1 Escribir `backend/test/reservas-concurrencia.integration-spec.ts` **antes** de
      reescribir el service, contra la base de test de `docker-compose`, con datos propios y
      `Reserva` limpia en cada test (D10). Casos con `Promise.allSettled` sobre
      `crearReserva`: aforo VIP 8 y 4 creaciones de 3 comensales dan exactamente 2 resueltas y
      2 `ConflictException` con `AFORO_ZONA`, con suma activa 6, repetido 10 veces; aforo
      global 10 con una creación de 6 en STANDARD y otra de 6 en VIP dan 1 y 1 con
      `AFORO_GLOBAL`; 2 creaciones de 7 comensales en STANDARD dan 1 en la mesa de 8 y 1 con
      `SIN_MESA_DISPONIBLE`. En todos, ningún rechazo es un error distinto de
      `ConflictException`. Verificar que falla (rojo) con
      `npm run test:integration -w backend -- reservas-concurrencia`: con el service de #12
      tiene que fallar al menos por la entrada nueva y por los `P2034`.
- [ ] 4.2 Sumar a la misma suite los choques que devuelven `409` y no `500`, con errores
      reales de la base y sin mocks de Prisma (D10): se inserta a mano una reserva activa en la
      mesa `S1`, se espía `elegirMesaBestFit` para que devuelva `S1` y se espera
      `ConflictException` con `motivos` exactamente `SIN_MESA_DISPONIBLE` (el índice parcial
      real rechaza el `INSERT`); una transacción auxiliar toma `bloquearTurnoFecha` del mismo
      `(turno, fecha)` y lo retiene más que el `timeout` de la creación, y se espera
      `ConflictException` con `motivos: []`. Verificar que falla (rojo).

## 5. Service

- [ ] 5.1 Reescribir `ReservasService.crearReserva(input)` con el flujo de D1: `$transaction`
      sin `isolationLevel` (READ COMMITTED), `bloquearTurnoFecha(tx, ...)` como primera
      sentencia, `cargarContexto(tx, ...)`, `evaluarReglas(contexto, solicitud, new Date())`
      con `ahora` tomado después del lock, `409` con todos los motivos (D8),
      `elegirMesaBestFit`, estado por `requiereConfirmacionAdmin` y el `INSERT` con
      `SAVEPOINT` y reintento de código de #12 (D5). Borrar `SERIALIZACION_MAX_INTENTOS`, el
      bucle de `P2034`, `ejecutarCreacionReserva` con sus validaciones inline y el mapa
      `diaSemanaTurnoNumero`. No tocar `transicionarEstado`. Verificar que las suites de 3.1,
      3.2, 4.1 y 4.2 pasan, y que
      `grep -n "Serializable\|P2034\|aforoMaximo\|anticipacion\|capacidad >" backend/src/reservas/reservas.service.ts`
      no devuelve nada.
- [ ] 5.2 Implementar la traducción de errores de D9: `P2002` sobre `mesaId` a `409` con
      `SIN_MESA_DISPONIBLE`, códigos agotados a `409` con `motivos: []`, y `P2028`/`P2024` de
      `$transaction` a `409` con `motivos: []` y un mensaje que pide reintentar. Cualquier otro
      error se propaga. Si el test de `P2002` de 4.2 muestra que `meta.target` trae el nombre
      del índice y no `mesaId`, comparar también contra
      `reserva_mesa_turno_fecha_activa_key` (Trampas). Verificar que 4.2 pasa y que la suite de
      4.1 no muestra ningún `P2028` en 10 repeticiones. Si aparece, subir `timeout` de
      `$transaction` y anotar el valor en un comentario que remita a este `tasks.md`.

## 6. Contrato OpenAPI y controller (orden D2 de `fundacion-repo`)

- [ ] 6.1 Copiar el fragmento de la sección "Contrato OpenAPI" de `design.md` a
      `openapi/openapi.yaml`, sin cambiar nombres, reusando `MotivoNoDisponible`,
      `CodigoMotivo` y `ErrorRespuesta` ya presentes. Verificar que `npm run openapi:lint` pasa
      y que `npm run openapi:check` **falla** porque el path todavía no tiene controller.
- [ ] 6.2 Crear `CrearReservaDto` (D6, reusando el validador de `fecha` de `disponibilidad`),
      `ReservaCreadaRespuesta` y `ReservaRechazadaRespuesta` con esos nombres exactos, y
      `ReservasController` con `@ApiTags('Reservas')` y el método `crear`
      (`operationId` `ReservasController_crear`, `@HttpCode(201)`, respuestas
      201/400/404/409 con `summary` y `description` idénticos al YAML), con el handler sin
      implementar. Sin guard. Si `cancelacion-turnos` ya creó el controller, agregar el método
      ahí. Ajustar decoradores hasta que `npm run build -w backend && npm run openapi:check`
      pase sin diferencias.
- [ ] 6.3 Implementar el handler: convertir `fecha` con `Date.UTC`, armar el input campo por
      campo desde el DTO (así `mesaId`, `estado` o `codigoReserva` del body no llegan al
      service, D6), delegar en `crearReserva` y mapear la reserva a `ReservaCreadaRespuesta`
      con `fecha` armada con `getUTC*` (D7). Sin lógica de negocio en el controller (§7).
      Verificar que `npm run openapi:check` sigue pasando y que, con la base sembrada y el
      backend levantado, un `curl -X POST` a `/reservas` con la cena de un sábado futuro en
      STANDARD devuelve `201` con `estado: CONFIRMADA`.

## 7. Tests e2e del endpoint (Supertest)

- [ ] 7.1 Crear `backend/test/reservas-crear.e2e-spec.ts` levantando la app con el mismo
      `ValidationPipe` que `main.ts`, con datos propios y `Reserva` limpia antes de cada test.
      No usar las reservas de ejemplo del seed. Fechas calculadas desde el reloj real y lejos
      de los bordes. Verificar que la suite arranca y termina con
      `npm run test:e2e -w backend -- reservas-crear`.
- [ ] 7.2 Tests `201`: sin header `Authorization`; forma exacta del cuerpo (tiene
      `codigoReserva` de 8 alfanuméricos, `estado`, `fecha` igual a la enviada, `turnoId`,
      `zonaId` y `comensales`, y **no** tiene `id`, `mesaId`, `mesa` ni datos de contacto);
      STANDARD `CONFIRMADA` y VIP `PENDIENTE`. Verificar con el mismo comando.
- [ ] 7.3 Tests `400` (falta `telefonoCliente`; `emailCliente: "ana.perez"`;
      `nombreCliente: "   "`; `fecha` con hora y `2026-02-30`; `zonaId: "vip"`; `comensales`
      `0`, `2.5` y `"4"`; body con `estado: "CONFIRMADA"`; body con `mesaId`; los dos por
      `forbidNonWhitelisted` del pipe global, D6), `404` (turno y zona inexistentes), y que en todos la cantidad de
      reservas no cambia y el cuerpo tiene la forma de la spec. Verificar con el mismo comando.
- [ ] 7.4 Tests `409`: turno del lunes con `motivos` exactamente `TURNO_INACTIVO` y cuerpo
      `{ statusCode, message, error: "Conflict", motivos }`; con reservas VIP de 12 y 6, crear
      4 da `AFORO_ZONA` y crear 2 da `201`; y para la misma solicitud rechazada,
      `GET /disponibilidad` devuelve los mismos `motivos` en el mismo orden que el `409`.
      Verificar con el mismo comando.
- [ ] 7.5 Test concurrente por HTTP: `Promise.all` de 8 `POST /reservas` de 4 comensales para
      la misma cena en VIP. Afirmar que todos los status están en `{201, 409}`, que ninguno es
      `500` y que la suma de comensales activos de VIP no supera el aforo. Verificar con el
      mismo comando, repitiéndolo 5 veces.

## 8. Tests contra base real en CI (depende de `ci-integracion-db`)

- [ ] 8.1 Hasta que `ci-integracion-db` esté mergeado, correr las suites de las secciones 2, 3,
      4 y 7 localmente contra `docker-compose` y dejar la salida en la descripción del PR,
      aclarando que CI todavía no las ejecuta. Verificar que el PR tiene esa nota, o que el job
      `test` de CI las muestra si `ci-integracion-db` ya está mergeado.

## 9. Cierre (Definition of Done, `config.yaml` §13)

- [ ] 9.1 `openspec validate reservas-crear --strict` pasa y todas las tareas de este archivo
      están marcadas. Verificar con el comando y revisando que no quede ningún `- [ ]`.
- [ ] 9.2 El change no agrega migraciones ni toca `schema.prisma` (Migration Plan). Verificar
      con `git diff main --stat -- backend/prisma` vacío.
- [ ] 9.3 `openapi/openapi.yaml` actualizado en el mismo PR. Verificar con
      `npm run openapi:lint` y `npm run openapi:check` en verde.
- [ ] 9.4 No se agregaron variables de entorno. Verificar con `git diff main -- .env.example`
      vacío. Si alguna hizo falta (por ejemplo un `timeout` configurable), sumarla ahí.
- [ ] 9.5 Tests de las reglas e invariantes que toca el change: `npm test -w backend` en verde
      con `TZ=UTC` y con `TZ=America/Argentina/Buenos_Aires`, y `npm run test:integration` y
      `npm run test:e2e -w backend` en verde localmente.
- [ ] 9.6 Ninguna regla de disponibilidad quedó duplicada en `reservas/`. Verificar con
      `grep -rn "anticipacion\|aforoMaximo\|aforoGlobal\|minComensales\|maxComensales\|activo" backend/src/reservas --include=*.ts`
      sin resultados fuera de tests.
- [ ] 9.7 `npm run lint` y `npm run typecheck` en limpio, sin warnings nuevos. Verificar con los
      dos comandos desde la raíz.
- [ ] 9.8 CI en verde en el PR `feature/reservas-crear`. Verificar en la pestaña Checks.
- [ ] 9.9 PR con descripción en español, enlazado a `openspec/changes/reservas-crear/`, con la
      nota de 8.1 si corresponde, con las Open Questions de `design.md` resueltas o
      explícitamente pospuestas, y aprobado por un compañero distinto del autor. Verificar en
      GitHub.
- [ ] 9.10 Después del merge, archivar el change con `openspec archive reservas-crear` en su
      propio PR. Verificar que `openspec/specs/reservas-crear/spec.md` existe en `main`.
