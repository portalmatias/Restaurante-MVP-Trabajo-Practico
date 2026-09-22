## 1. Prerrequisitos (bloqueante)

- [ ] 1.1 Confirmar que la implementación de `reservas-crear` está mergeada a `main` y que
      existen `ReservasController` (tag `Reservas`, con `POST /reservas`) y
      `ReservasService` con `crearReserva`. No continuar con la sección 2 hasta que esto sea
      cierto. Verificar con `git log origin/main --oneline -- backend/src/reservas` y
      `ls backend/src/reservas`.
- [ ] 1.2 Confirmar que `AuthModule` está registrado en `AppModule` y que `JwtAuthGuard`,
      `RolesGuard` y `@Roles` están disponibles (el listado los usa). Si el PR de registro
      todavía no está mergeado, esperarlo: las secciones 3 y 4 no se pueden probar sin él.
      Verificar con `grep AuthModule backend/src/app.module.ts`.
- [x] 1.3 Confirmar que `ci-integracion-db` (#28) está mergeado y que el job `Tests
      (backend)` corre `test:integration` contra PostgreSQL. Los tests de la sección 2
      dependen de una base real. Verificado el 2026-09-21: #28 está en `main` (`c419074`) y
      `.github/workflows/ci.yml` declara `services.postgres` y ejecuta
      `npm run test:integration -w backend`.
- [ ] 1.4 Verificar el `ValidationPipe` global de `backend/src/main.ts`: tiene que tener
      `transform: true` (para `limit`/`offset`) **y** `whitelist` + `forbidNonWhitelisted`
      (para el `400` ante campos o parámetros no declarados). Si falta alguno, agregarlo con
      un test que lo demuestre y avisar a `reservas-crear` y `disponibilidad`, porque es un
      pipe global (ver Riesgos de `design.md`).
- [ ] 1.5 Confirmar que existen en `main` el validador de fecha de calendario de
      `disponibilidad` (`EsFechaDeCalendarioExistente`, D4) y el schema `ErrorRespuesta`. Si
      todavía no, coordinar con quien implementa `disponibilidad` (extraerlo a `common/` o
      esperar su merge) en vez de duplicarlos. Verificar con `grep` en `backend/src` y en
      `openapi/openapi.yaml`.
- [ ] 1.6 Confirmar que las Reservas de ejemplo del seed tienen código de exactamente 8
      caracteres (`^[A-Za-z0-9]{8}$`), porque la consulta valida ese formato. Verificar con
      `npm run db:seed -w backend` y una consulta a `Reserva.codigoReserva`.
- [ ] 1.7 Confirmar si `cancelacion-turnos` ya agregó su propia búsqueda por código + email.
      Si existe, reemplazarla por `buscarPorCodigoYEmail` (D3) o coordinar con su dueño en
      vez de dejar dos criterios de comparación.

## 2. Consulta pública

- [ ] 2.1 Crear `dto/consultar-reserva.dto.ts` (`codigo`: `@Matches(/^[A-Za-z0-9]{8}$/)`;
      `email`: `@IsEmail()`, `@MaxLength(254)`) y `dto/reserva-consultada-respuesta.dto.ts`
      con los `@ApiProperty` de D4 y del contrato. Verificar que `npm run build -w backend`
      compila.
- [ ] 2.2 Implementar `ReservasService.buscarPorCodigoYEmail(codigo, email, db)` con la
      consulta única de D2 (`toUpperCase()` en el código, `mode: 'insensitive'` en el email)
      y el helper del `404` con texto fijo. Verificar con un test de **integración** contra
      PostgreSQL que cubra: coincidencia exacta, código en minúsculas, email con otras
      mayúsculas, email incorrecto, código inexistente, y el email con `_` y `%`
      (`ana_perez@example.com` no se encuentra con `anaXperez@example.com` ni con
      `%@example.com`). Si el último falla, aplicar el plan B de D2 y ajustar `design.md`.
- [ ] 2.3 Implementar `ReservasService.consultar(codigo, email)`: llama a
      `buscarPorCodigoYEmail`, lanza el `404` genérico si es `null` y mapea a la vista mínima
      de D4 (`fecha` con `getUTC*`, horas `HH:mm` con `getUTCHours`/`getUTCMinutes`, sin
      `id`, mesa, contacto ni marcas de tiempo). Verificar con tests unitarios del mapeo,
      incluida una Reserva `CANCELADA` y una `PENDIENTE`, corriendo la suite con `TZ=UTC` y
      con `TZ=America/Argentina/Buenos_Aires`.
- [ ] 2.4 Implementar `POST /reservas/consultar` en `ReservasController` (`200`, sin guard,
      `@ApiOperation`/`@ApiResponse` iguales al contrato). Verificar con Supertest contra una
      Reserva de prueba: `200` con código y email correctos.
- [ ] 2.5 Test e2e de los rechazos de la spec: `404` con email incorrecto y `404` con código
      inexistente, **con cuerpos idénticos** (comparación profunda de ambas respuestas);
      `400` con código de 7 caracteres, con símbolos, con email inválido, con body vacío y con
      un campo extra; y que el cuerpo del `404` no contiene el código ni el email enviados.
- [ ] 2.6 Test e2e de rate limiting: superar `THROTTLE_LIMIT` en la ventana devuelve `429`, y
      una consulta con código y email **correctos** hecha después de superar el límite
      también devuelve `429` sin la Reserva. Verificar que el test crea su propia app para no
      compartir el contador con otras suites.
- [ ] 2.7 Test de que la consulta es de solo lectura: consultar dos veces devuelve respuestas
      iguales y `estado`, `mesaId` y `updatedAt` de la Reserva no cambian. Verificar con la
      Reserva releída de la base.

## 3. Listado de administrador

- [ ] 3.1 Crear `dto/listar-reservas.dto.ts` (`fecha` con el validador de la tarea 1.5,
      `estado` con `@IsEnum(EstadoReserva)`, `zonaId` y `turnoId` con `@IsUUID()`, `limit`
      con `@Type(() => Number)`, `@IsInt`, `@Min(1)`, `@Max(100)` y `offset` con `@IsInt`,
      `@Min(0)`, todos opcionales) y `dto/reserva-admin-respuesta.dto.ts` y
      `dto/listado-reservas-respuesta.dto.ts`. El `enum` de `estado` sin `enumName`. Verificar
      que compila y que los `@ApiProperty` reproducen los `parameters` del contrato.
- [ ] 3.2 Implementar `ReservasService.listar(filtros)`: arma el `where` solo con los filtros
      presentes (`zonaId` como `mesa: { zonaId }`, `fecha` convertida con `Date.UTC`), el
      orden total de D6 (`fecha`, `turno.horaInicio`, `createdAt`, `id`), `limit`/`offset`
      con sus defaults y `total` con `prisma.$transaction([findMany, count])`. Verificar con
      un test de integración contra PostgreSQL: cada filtro por separado, los cuatro
      combinados, lista vacía con un `zonaId` inexistente, `total` mayor que `limit`, y
      páginas consecutivas con `limit=2` sobre varias Reservas de la misma fecha y el mismo
      turno (por ejemplo, `CANCELADA` en mesas distintas, con el mismo `createdAt`) sin filas
      repetidas ni omitidas.
- [ ] 3.3 Test unitario del mapeo a `ReservaAdminRespuesta` (incluye `id`, contacto, `mesa`
      y `createdAt`; `fecha` y horas con la misma conversión que la tarea 2.3), corriendo la
      suite con `TZ=UTC` y con `TZ=America/Argentina/Buenos_Aires`.
- [ ] 3.4 Implementar `GET /admin/reservas` en `ReservasController` con
      `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(RolUsuario.ADMIN)` y
      `@Throttle({ default: { limit: 60, ttl: 60000 } })` (D7). Verificar con Supertest y un
      JWT de admin del seed: `200` con `items`, `total`, `limit` y `offset`.
- [ ] 3.5 Tests e2e de los guards (§9): sin token → `401` y sin `items`; con un JWT válido de
      rol distinto de `ADMIN` → `403` (firmar el token de prueba con el mismo
      `JWT_SECRET` y un `rol` inválido, como hacen los tests de `auth-admin`); token
      expirado → `401`. Verificar que ninguna de las tres respuestas incluye datos de
      Reservas.
- [ ] 3.6 Tests e2e de validación de filtros: `fecha=2026-02-30` → `400`; `estado=INVENTADO`
      → `400`; `zonaId=abc` → `400`; `limit=101`, `limit=0`, `limit=abc` y `offset=-1` →
      `400`; un parámetro no declarado (`estdo=PENDIENTE`) → `400` y no el listado
      completo; un `zonaId` bien formado pero inexistente → `200` con `items` vacío y
      `total` 0.
- [ ] 3.7 Test e2e de rate limiting del listado: 60 solicitudes en la ventana responden `200`
      y la siguiente `429`; verificar además que un admin que cambia tres filtros seguidos no
      recibe `429`.

## 4. Contrato y cierre

- [ ] 4.1 Copiar el fragmento de "Contrato OpenAPI" de `design.md` a `openapi/openapi.yaml` y
      completar los decoradores de Swagger para que el YAML generado coincida. Verificar con
      `npm run openapi:lint` y `npm run openapi:check` en verde (si aparece el falso rojo de
      `x-enumNames`, aplicar la normalización de `disponibilidad`; si Swagger deja respuestas
      inline, expandir los `$ref` como indica `design.md`).
- [ ] 4.2 Avisar a `cancelacion-turnos` (y a su dueño) de la firma final de
      `buscarPorCodigoYEmail` y del helper del `404`, y dejar el aviso en la descripción del
      PR. Verificar que la tarea 1.2 de `cancelacion-turnos` puede marcarse como resuelta.
- [ ] 4.3 Actualizar la fila de `reserva-consultar` en `docs/roadmap-mvp.md` (de `GET` a
      `POST /reservas/consultar`) si el roadmap ya está en `main`; si no, dejarlo anotado en
      el PR. Verificar con `git diff` de la fila.
- [ ] 4.4 Prueba manual con la base seedeada: consultar una Reserva del seed con su código y
      email (`200`), con el email cambiado (`404`), con un código inexistente (`404` idéntico),
      y listar `GET /admin/reservas?estado=PENDIENTE` con el token del admin del seed (el `id`
      de la respuesta sirve para `reserva-vip`). Verificar leyendo las respuestas reales, no
      solo el código de estado.
- [ ] 4.5 Recorrer la Definition of Done de `config.yaml` §13 sobre el PR de implementación:
      `openspec validate reserva-consultar --strict`, todas las tareas marcadas, sin
      migración ni variables nuevas, `openapi.yaml` actualizado, `npm run lint` y
      `tsc --noEmit` en limpio, CI en verde, PR en español enlazado al change, aprobación de
      un compañero distinto del autor y archivado con `openspec archive` después del merge.
