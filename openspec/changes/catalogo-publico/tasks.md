## 1. Prerrequisitos (verificación, no bloqueante)

- [ ] 1.1 Confirmar que `ZonasModule` y `HorariosModule` ya están registrados en `AppModule` y
      ya exportan `ZonasService`/`HorariosService` (`backend/src/app.module.ts:52,54`,
      `zonas.module.ts:16`, `horarios.module.ts:13`). Verificar con
      `rg -n "ZonasModule|HorariosModule" backend/src/app.module.ts` y confirmando los
      `exports` de cada módulo. No hace falta tocar `AppModule`: los controllers nuevos se
      agregan a `controllers: []` de cada módulo, que ya está importado.
- [ ] 1.2 Confirmar que el `ValidationPipe({ transform: true })` global de `main.ts` y
      `class-validator`/`class-transformer` ya están instalados (los trajo `disponibilidad`).
      Verificar con `rg -n "ValidationPipe" backend/src/main.ts` y
      `npm run build -w backend`.

## 2. Service de Zonas: test primero, después `listarPublicas`

- [ ] 2.1 En `backend/src/zonas/zonas.service.spec.ts`, agregar un `describe('listarPublicas')`
      que mockea `prisma.zona.findMany` (mismo patrón de mock manual que el resto del archivo,
      `zonas.service.spec.ts:42-52`, el `beforeEach` que arma los `jest.fn()`) y verifica que `listarPublicas()` llama a `findMany` con
      `select: { id, nombre, minComensales, maxComensales, anticipacionMinHoras,
      anticipacionMaxDias, ventanaCancelacionHoras, requiereConfirmacionAdmin }` — sin
      `aforoMaximo` — y que devuelve tal cual lo que responde el mock. Verificar que la suite
      falla (rojo) con `npm test -w backend -- zonas.service`.
- [ ] 2.2 Implementar `ZonasService.listarPublicas()` (design.md D2). Verificar que el test de
      2.1 pasa y que `npm run typecheck -w backend` no rompe.

## 3. Service de Turnos: test primero, después `listarPublicos`

- [ ] 3.1 En `backend/src/horarios/horarios.service.spec.ts`, agregar un
      `describe('listarPublicos')` que mockea `prisma.turno.findMany` y verifica: sin
      argumento, llama con `where: { activo: true }`, `select: { id, diaSemana, horaInicio,
      horaFin }` (sin `activo`) y `orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }]`; con
      `listarPublicos('SABADO')`, el `where` incluye además `diaSemana: 'SABADO'`. Verificar
      que la suite falla (rojo) con `npm test -w backend -- horarios.service`.
- [ ] 3.2 Implementar `HorariosService.listarPublicos(diaSemana?: DiaSemana)` (design.md D2).
      Verificar que los tests de 3.1 pasan y que `npm run typecheck -w backend` no rompe.

## 4. Contrato OpenAPI y controllers públicos (orden D2 de `fundacion-repo`)

- [ ] 4.1 Copiar el fragmento de la sección "Contrato OpenAPI" de `design.md` a
      `openapi/openapi.yaml` (tags `zonas`/`turnos`, paths `/zonas` y `/turnos`, schemas
      `ZonaPublicaRespuestaDto` y `TurnoPublicoRespuestaDto`), sin cambiar nombres. Verificar
      que `npm run openapi:lint` pasa y que `npm run openapi:check` **falla** porque ninguno de
      los dos paths tiene controller todavía.
- [ ] 4.2 Crear `ZonaPublicaRespuestaDto` (`backend/src/zonas/dto/zona-publica-respuesta.dto.ts`)
      y `TurnoPublicoRespuestaDto`
      (`backend/src/horarios/dto/turno-publico-respuesta.dto.ts`) con `@nestjs/swagger`, más
      `ListarTurnosPublicosDto` (`backend/src/horarios/dto/listar-turnos-publicos.dto.ts`) con
      `diaSemana?: DiaSemana` opcional validado con `@IsOptional()` **y** `@IsEnum(DiaSemana)`.
      A diferencia de `CrearTurnoDto.diaSemana` (`crear-turno.dto.ts:14`), acá el campo es
      opcional: sin `@IsOptional()`, `GET /turnos` sin query respondería `400`. Un valor vacío
      (`?diaSemana=`) no es `undefined` y responde `400`. Verificar con
      `npm run typecheck -w backend`.
- [ ] 4.3 Crear `ZonasPublicasController` en `backend/src/zonas/zonas-publicas.controller.ts`
      (`@Controller('zonas')`, `@SkipThrottle()` con el mismo comentario de justificación que
      `disponibilidad.controller.ts:24-32`, sin `@UseGuards`, `@ApiTags('zonas')`, método
      `listar()` con `operationId` `ZonasPublicasController_listar` delegando en
      `zonasService.listarPublicas()` sin lógica propia, §7) y registrarlo en
      `controllers: []` de `ZonasModule`, sin tocar `ZonasController`. Verificar con
      `npm run build -w backend` y que `npm run openapi:check` deja de marcar diferencias en
      `/zonas` (aunque siga fallando por `/turnos`, todavía sin controller).
- [ ] 4.4 Crear `TurnosPublicosController` en
      `backend/src/horarios/turnos-publicos.controller.ts` (`@Controller('turnos')`,
      `@SkipThrottle()`, sin `@UseGuards`, `@ApiTags('turnos')`, método `listar(@Query() dto:
      ListarTurnosPublicosDto)` con `operationId` `TurnosPublicosController_listar` delegando
      en `horariosService.listarPublicos(dto.diaSemana)`) y registrarlo en `controllers: []`
      de `HorariosModule`, sin tocar `HorariosController`. Verificar con
      `npm run build -w backend && npm run openapi:check` en verde, sin diferencias.

## 5. Tests e2e de los endpoints (Supertest, `backend/test/`)

- [ ] 5.1 Crear `backend/test/zonas-publicas.e2e-spec.ts`: levantar `AppModule` con el mismo
      `ValidationPipe` de `main.ts`. Como `Zona.nombre` es un enum de exactamente dos valores
      no se crean Zonas nuevas: usar `upsertSeguro` (`backend/test/helpers/upsert-seguro.ts`)
      para fijar valores conocidos de `STANDARD` y `VIP` antes de los tests y restaurarlos
      después, mismo patrón que `zonas.integration-spec.ts:48-64`. Casos: sin header
      `Authorization` responde `200`; ningún elemento tiene `aforoMaximo` ni `mesas`; el
      elemento `VIP` trae exactamente `minComensales`, `maxComensales`, `anticipacionMinHoras`,
      `anticipacionMaxDias`, `ventanaCancelacionHoras` y `requiereConfirmacionAdmin` con los
      valores fijados. Verificar con `npm run test:e2e -w backend -- zonas-publicas`.
- [ ] 5.2 Crear `backend/test/turnos-publicos.e2e-spec.ts`: mismo setup de app. Para no pisar
      los Turnos del seed ni los de otras suites, crear Turnos propios en una franja horaria
      libre (ver las bandas ya reservadas en `disponibilidad.e2e-spec.ts:34-38`: `06:00–06:59`
      disponibilidad, `05:xx` disponibilidad-contexto, `01:xx` reservas-invariantes; usar por
      ejemplo `03:xx`) y borrarlos en `afterEach`/`afterAll`. Casos: sin header `Authorization`
      responde `200`; un Turno con `activo: false` creado por el test no aparece en la
      respuesta; las claves de cada elemento, ordenadas, son exactamente
      `["diaSemana", "horaFin", "horaInicio", "id"]` (así un campo de más hace fallar el test); con Turnos propios en
      `MARTES` 03:00 y `MARTES` 03:30 más `MIERCOLES` 03:00, todos activos, la respuesta trae
      los dos de `MARTES` antes que el de `MIERCOLES`, y el de `03:00` antes que el de `03:30`
      dentro de `MARTES`; `horaInicio`/`horaFin` llegan como `'1970-01-01T03:00:00.000Z'` /
      `'1970-01-01T03:30:00.000Z'` (mismo formato que `GET /admin/turnos`);
      `?diaSemana=MARTES` devuelve solo los de `MARTES`; `?diaSemana=FERIADO` y `?diaSemana=`
      responden `400`; `?diaSemana=LUNES` responde `200` con `[]`. Para que este último caso sea
      determinístico, el test primero comprueba en la base que no haya Turnos `LUNES` activos
      (el seed los deja inactivos y `jest-e2e.json` usa `maxWorkers: 1`, así que las suites no
      corren a la vez) y, si los hubiera, falla con un mensaje que lo explica en vez de dar un
      falso rojo en la aserción. Verificar
      con `npm run test:e2e -w backend -- turnos-publicos`.
- [ ] 5.3 En cualquiera de los dos archivos (o en uno nuevo
      `backend/test/catalogo-publico-regresion.e2e-spec.ts`), agregar dos tests de no
      regresión: `GET /admin/zonas` sin header `Authorization` sigue respondiendo `401`, y
      `GET /admin/turnos` sin header `Authorization` sigue respondiendo `401`. Verificar con
      `npm run test:e2e -w backend`.

## 6. Cierre (Definition of Done, `config.yaml` §13)

- [ ] 6.1 `openspec validate catalogo-publico --strict` pasa y todas las tareas de este archivo
      están marcadas. Verificar con el comando y revisando que no quede ningún `- [ ]`.
- [ ] 6.2 El change no agrega migraciones ni toca `schema.prisma`. Verificar con
      `git diff main --stat -- backend/prisma` vacío.
- [ ] 6.3 `openapi/openapi.yaml` actualizado en el mismo PR. Verificar con
      `npm run openapi:lint` y `npm run openapi:check` en verde.
- [ ] 6.4 No se agregaron variables de entorno ni dependencias nuevas. Verificar con
      `git diff main -- .env.example backend/package.json package.json` vacío (salvo cambios
      de formateo que ya existieran).
- [ ] 6.5 Tests de las reglas que toca el change: `npm test -w backend` y
      `npm run test:e2e -w backend` en verde. Verificar con esos dos comandos desde la raíz.
- [ ] 6.6 `npm run lint` y `npm run typecheck` en limpio, sin warnings nuevos. Verificar con
      los dos comandos desde la raíz.
- [ ] 6.7 CI en verde en el PR de implementación.
- [ ] 6.8 PR con descripción en español, enlazado a
      `openspec/changes/catalogo-publico/`, aprobado por un compañero distinto del autor.
      Verificar en GitHub.
- [ ] 6.9 Después del merge, archivar el change con `openspec archive catalogo-publico` en su
      propio PR. Verificar que `openspec/specs/catalogo-publico/spec.md` existe en `main`.
