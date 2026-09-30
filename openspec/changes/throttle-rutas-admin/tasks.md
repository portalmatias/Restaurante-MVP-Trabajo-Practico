## 1. Prerrequisitos

- [ ] 1.1 Confirmar sobre `main` actualizado que la clave del throttler sigue siendo por
      controller + método + IP (`generateKey` y `getTracker` en
      `node_modules/@nestjs/throttler/dist/throttler.guard.js`, versión de `package-lock.json`)
      y que los cuatro controllers de admin siguen siendo `ZonasController`, `MesasController`,
      `HorariosController` y `ReservasAdminController`. Si cambió algo, actualizar `design.md`
      (Context y D3) antes de seguir. Verificación: nota en el PR con la versión y la línea
      revisada.

## 2. Límite común de admin

- [ ] 2.1 Crear `backend/src/auth/decorators/limite-admin.decorator.ts` con `LimiteAdmin()`
      (`applyDecorators(SkipThrottle({ default: false }), Throttle({ default: { limit: 60,
      ttl: 60_000 } }))`) y un comentario que explique el valor y remita a D1/D2 de este
      change. Verificación: `npm run lint` y `npm run typecheck -w backend` pasan.
- [ ] 2.2 Aplicar `@LimiteAdmin()` a nivel de clase en `ZonasController`, `MesasController`,
      `HorariosController` y `ReservasAdminController`, junto a `@UseGuards` y `@Roles`. En
      `ReservasAdminController.listar`, quitar el `@SkipThrottle({ default: false })` y el
      `@Throttle(...)` de método y actualizar su comentario (y el de `marcarNoShow`, que hoy
      dice "Sin throttling propio"). Verificación: el test existente
      `reserva-consultar-listado.e2e-spec.ts` → "supera el límite propio (60/min)" sigue
      pasando sin cambios.

## 3. Tests e2e contra `AppModule` y Postgres real

- [ ] 3.1 Crear `backend/test/throttle-rutas-admin.e2e-spec.ts` con una app nueva por test
      (patrón de `reserva-consultar-listado.e2e-spec.ts`) y un `it.each` sobre las 12
      operaciones de la tabla de `design.md` → "Contrato OpenAPI": 60 solicitudes con token de
      admin no responden `429` y la 61 responde `429`. Sin efectos secundarios (D4): UUID
      inexistente en `PATCH`/`DELETE`, body vacío en `POST`. Cubre los escenarios
      "Solicitudes dentro del límite se atienden" y "La solicitud 61 se rechaza".
      Verificación: `npm run test:e2e -w backend` en verde contra la base de test.
- [ ] 3.2 Test: agotar el cupo de `PATCH /admin/reservas/:id/confirmar` con UUID inexistentes y
      después confirmar una Reserva `PENDIENTE` creada por el test; responde `429` y la Reserva
      sigue `PENDIENTE` en la base (escenario "Una operación rechazada por el límite no
      modifica datos"). Verificación: el test lee el estado con Prisma después de la
      solicitud.
- [ ] 3.3 Test: con el cupo de `PATCH /admin/reservas/:id/confirmar` agotado, `GET
      /admin/mesas` responde `200` en la misma app (escenario "El límite de una ruta no consume
      el de otra"). Verificación: test en verde.
- [ ] 3.4 Test: 20 `PATCH /admin/reservas/:id/confirmar` seguidos sobre 20 Reservas `PENDIENTE`
      creadas por el test responden `204`, ninguno `429` (escenario "Ráfaga de acciones del
      panel no se rechaza"). Falla con el límite global de hoy (10), lo que confirma que el
      test mide el cambio. Verificación: correrlo una vez sin la tarea 2.2 y ver que falla en
      la solicitud 11; con 2.2, en verde.
- [ ] 3.5 Regresión de límites que no deben cambiar: confirmar que siguen en verde, sin
      modificarlos, `auth.e2e-spec.ts` → "responde 429 al superar los 5 intentos por minuto,
      incluso con credenciales correctas", `reserva-consultar.e2e-spec.ts` → "supera
      THROTTLE_LIMIT y rechaza con 429, incluso con código y email correctos" y
      `cancelacion-turnos.e2e-spec.ts` → "supera THROTTLE_LIMIT y rechaza con 429, sin validar código ni email". Cubre el
      requisito "El login y las rutas públicas con código de reserva conservan su límite". Si
      alguno no existiera en `main`, agregarlo en el archivo de 3.1. Verificación: los tres en
      verde en la corrida de CI del PR.
- [ ] 3.6 Confirmar que los tests de integración que ya ejercitan rutas de admin
      (`gestion-salon-admin.integration-spec.ts`, `zonas.integration-spec.ts`,
      `mesas.integration-spec.ts`, `reservas-admin-guards-aislado.integration-spec.ts`) siguen
      pasando: arman su propio `ThrottlerModule`, y el decorador de clase ahora les aplica 60
      en vez de 10. Verificación: `npm run test:integration -w backend` en verde.

## 4. Contrato OpenAPI

- [ ] 4.1 Agregar `@ApiTooManyRequestsResponse({ description })` con el texto de `design.md`
      a los 12 métodos de la tabla, y la respuesta `'429'` correspondiente en
      `openapi/openapi.yaml` (escenario "Toda operación de admin declara la respuesta 429").
      Verificación: `npm run openapi:check` y `npm run openapi:lint` en verde.
- [ ] 4.2 Regenerar `frontend/src/lib/api/schema.d.ts` con `npm run api:types -w frontend`.
      Verificación: `npm run api:types:check -w frontend` en verde y `npm run typecheck -w
      frontend` sin errores nuevos.

## 5. Verificación final

- [ ] 5.1 Prueba manual con la app levantada (`npm run dev`, admin del seed): desde
      `/admin/reservas`, confirmar o rechazar más de 10 Reservas seguidas y editar más de 10
      veces una Mesa en `/admin/salon` sin ver el aviso de límite; y comprobar que
      `/admin/login` sigue mostrando el `429` al sexto intento fallido en un minuto.
      Verificación: capturas o nota en el PR.
- [ ] 5.2 Correr `openspec validate throttle-rutas-admin --strict`, `npm run lint` y
      `npm run typecheck` en limpio, y confirmar que no hicieron falta variables de entorno nuevas
      ni migraciones de Prisma.
