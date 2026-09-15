## 1. Prerrequisitos (bloqueante)

- [ ] 1.1 Confirmar que la implementación de `modelo-dominio` está mergeada a `main` y que
      `backend/prisma/schema.prisma` tiene los modelos `Zona`, `Mesa`, `Turno` y `Reserva`.
      Verificar con `ls backend/prisma/schema.prisma` y `npx prisma validate --schema
      backend/prisma/schema.prisma`.
- [ ] 1.2 Confirmar si la implementación de `auth-admin` ya existe (`backend/src/auth/`,
      `JwtAuthGuard`, `RolesGuard`). Si no existe todavía, se puede avanzar igual con los
      services de las secciones 2 a 4 y sus tests unitarios (no dependen del guard); los
      controllers, los tests e2e con guard real y la sección 5.1 quedan bloqueados hasta que
      `auth-admin` esté mergeado.

## 2. Módulo Zonas (`backend/src/zonas/`)

- [ ] 2.1 Crear `zonas.module.ts`, `dto/actualizar-zona.dto.ts` (`class-validator`, todos los
      campos opcionales) y registrar el módulo en `AppModule`. Verificar que
      `npm run build -w backend` compila sin errores.
- [ ] 2.2 Implementar `ZonasService.listar()` y `ZonasService.actualizar(id, dto)`, este
      último lanzando `BadRequestException` si el `dto` deja `minComensales > maxComensales`.
      Verificar con tests unitarios: actualización válida persiste los valores, rango inválido
      se rechaza.
- [ ] 2.3 Implementar `ZonasController` con `GET /admin/zonas` y `PATCH /admin/zonas/:id`,
      protegidos por `JwtAuthGuard` + `RolesGuard(ADMIN)`. Verificar con Supertest contra las
      Zonas sembradas por el seed de `modelo-dominio`.

## 3. Módulo Mesas (`backend/src/mesas/`)

- [ ] 3.1 Crear `mesas.module.ts`, `dto/crear-mesa.dto.ts` y `dto/actualizar-mesa.dto.ts`
      (`zonaId`, `capacidad`, `etiqueta`). Verificar que `npm run build -w backend` compila.
- [ ] 3.2 Implementar `MesasService.crear()`: `NotFoundException` si la Zona no existe,
      `BadRequestException` si la capacidad no es un entero positivo. Verificar con tests
      unitarios de ambos rechazos y del alta exitosa.
- [ ] 3.3 Implementar `MesasService.listar(zonaId?)` con filtro opcional por Zona. Verificar
      con un test unitario que el filtro devuelve solo las Mesas de la Zona pedida.
- [ ] 3.4 Implementar `MesasService.actualizar(id, dto)`: si el `dto` cambia `zonaId` o reduce
      `capacidad`, consultar `prisma.reserva.count` por Reservas activas (`PENDIENTE` o
      `CONFIRMADA`) de esa Mesa y lanzar `ConflictException` si el cambio las dejaría
      inválidas (capacidad insuficiente para alguna, o Zona distinta a la de alguna). Verificar
      con tests unitarios de los tres escenarios de la spec: edición libre de etiqueta/aumento
      de capacidad, reducción de capacidad rechazada, cambio de Zona rechazado.
- [ ] 3.5 Implementar `MesasService.eliminar(id)`, lanzando `ConflictException` si la Mesa
      tiene Reservas activas asociadas. Verificar con tests unitarios de ambos casos (baja
      exitosa, baja rechazada).
- [ ] 3.6 Implementar `MesasController` con `POST`, `GET`, `PATCH /admin/mesas/:id` y
      `DELETE /admin/mesas/:id`, todos protegidos por los guards. Verificar con Supertest
      contra datos del seed.

## 4. Módulo Turnos (`backend/src/horarios/`)

- [ ] 4.1 Crear `horarios.module.ts`, `dto/crear-turno.dto.ts` y `dto/actualizar-turno.dto.ts`
      (`diaSemana`, `horaInicio`, `horaFin`, `activo` opcional). Verificar que
      `npm run build -w backend` compila.
- [ ] 4.2 Implementar `HorariosService.crear()`, con `activo = true` por defecto si el `dto`
      no lo especifica. Verificar con un test unitario.
- [ ] 4.3 Implementar `HorariosService.listar()`, `HorariosService.actualizar(id, dto)` (día y
      horario) y `HorariosService.cambiarActivo(id, activo)`. Verificar con tests unitarios de
      cada uno, confirmando que desactivar no borra el registro (sigue apareciendo en
      `listar()`).
- [ ] 4.4 Implementar `HorariosController` con `POST`, `GET` y `PATCH /admin/turnos/:id`
      (aceptando `activo` como parte del mismo `PATCH` de edición, para no multiplicar rutas),
      todos protegidos por los guards. Verificar con Supertest.

## 5. Tests de los requisitos de la spec

- [ ] 5.1 Test e2e: `GET /admin/zonas` sin token responde `401` (spec: "Rutas de gestión de
      salón protegidas por autenticación de administrador").
- [ ] 5.2 Test: actualización de Zona con `minComensales > maxComensales` rechazada (spec:
      "Actualización de configuración de Zona").
- [ ] 5.3 Test: alta de Mesa con Zona inexistente y alta con capacidad no positiva, ambas
      rechazadas (spec: "Alta de Mesa").
- [ ] 5.4 Test: listado de Mesas filtrado por Zona devuelve solo las de esa Zona (spec:
      "Listado de Mesas").
- [ ] 5.5 Test: reducción de capacidad de Mesa por debajo de una Reserva activa rechazada, y
      cambio de Zona de una Mesa con Reserva activa rechazado (spec: "Edición de Mesa preserva
      las Reservas activas") — sembrar una Reserva activa de prueba contra la Mesa antes de
      cada caso.
- [ ] 5.6 Test: baja de Mesa con Reserva activa rechazada, y baja exitosa sin Reservas activas
      (spec: "Baja de Mesa bloqueada si tiene Reservas activas").
- [ ] 5.7 Test: alta de Turno sin indicar `activo` queda `activo = true` (spec: "Alta de
      Turno").
- [ ] 5.8 Test: desactivar un Turno lo marca `activo = false` sin eliminarlo y sigue
      apareciendo en el listado (spec: "Activación y desactivación de Turno").

## 6. Verificación final

- [ ] 6.1 Correr `openspec validate gestion-salon --strict` y confirmar que el change es
      válido.
- [ ] 6.2 Agregar a `openapi/openapi.yaml` los paths `/admin/zonas`, `/admin/mesas` y
      `/admin/turnos` (operaciones GET/POST/PATCH/DELETE según corresponda, `security:
      [bearerAuth]` en cada una, y los schemas de request/response), en el mismo PR
      (Definition of Done, `config.yaml` §13).
- [ ] 6.3 Confirmar que no hicieron falta variables de entorno nuevas ni migraciones de
      Prisma — este change no agrega campos a `Zona`, `Mesa` ni `Turno`.
