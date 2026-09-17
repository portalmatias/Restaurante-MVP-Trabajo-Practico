## 1. Prerrequisitos (bloqueante)

- [ ] 1.1 Confirmar que la implementación de `reservas-crear` está mergeada a `main` y que
      `backend/src/reservas/reservas.service.ts` existe con un método de creación de Reserva y
      un punto único de escritura de `estado` (según `design.md` de `modelo-dominio`). No
      continuar con la sección 2 hasta que esto sea cierto.
- [ ] 1.2 Confirmar si `reserva-consultar` ya está implementado. Si existe una función de
      búsqueda de Reserva por código + email, reutilizarla en la sección 2 en vez de
      duplicarla (ver `design.md` — comparten servicio).
- [ ] 1.3 Confirmar que `backend/src/common/timezone.ts` existe en `main` (lo trajo #12) y
      revisar la firma vigente de `inicioTurnoUtc(fecha, horaInicio)` y
      `finTurnoUtc(fecha, horaInicio, horaFin)` — ninguna recibe zona horaria, no existe
      `ConfiguracionNegocio.zonaHoraria` (ver `design.md`, segunda corrección). Si la firma
      cambió, ajustar las tareas 2.2 y 3.1 antes de escribir código.

## 2. Cancelación por el cliente

- [ ] 2.1 Crear `dto/cancelar-reserva.dto.ts` (`email`, con `class-validator`). Verificar que
      `npm run build -w backend` compila.
- [ ] 2.2 Implementar `ReservasService.cancelar(codigo, email)`: busca la Reserva por código,
      responde `404 Not Found` genérico si no existe o el email no coincide, rechaza con
      `409 Conflict` si no está `PENDIENTE`/`CONFIRMADA`, calcula el inicio real del Turno con
      `inicioTurnoUtc(reserva.fecha, turno.horaInicio)` (de `backend/src/common/timezone.ts`,
      no reimplementar — ver `design.md`) y rechaza si a ese instante le quedan menos horas que
      `Zona.ventanaCancelacionHoras`, y transiciona a `CANCELADA` por el único punto de
      escritura de estado. Verificar con tests unitarios de cada rechazo y del caso exitoso,
      incluyendo el límite exacto de la ventana (permitido) y un instante después del límite
      (rechazado); correr la suite con `TZ=UTC` y con `TZ=America/Argentina/Buenos_Aires`.
- [ ] 2.3 Implementar `POST /reservas/:codigo/cancelar` en `ReservasController`, sin guard
      (ruta pública). Verificar con Supertest contra una Reserva de prueba.
- [ ] 2.4 Verificar el registro de `ThrottlerModule` y su guard; reutilizarlos si existen o
      configurarlos aquí si faltan. Aplicar `THROTTLE_TTL`/`THROTTLE_LIMIT` (las variables de
      `fundacion-repo`) sobre la ruta. Verificar corriendo más intentos que el límite
      configurado y confirmando que el excedente responde `429` sin tocar la base.

## 3. Marcado de NO_SHOW (admin)

- [ ] 3.1 Implementar `ReservasService.marcarNoShow(id)`: rechaza con `409 Conflict` si la
      Reserva no existe (`404`) o no está `CONFIRMADA` (`409`); calcula el fin real del Turno
      con `finTurnoUtc(reserva.fecha, turno.horaInicio, turno.horaFin)` (de
      `backend/src/common/timezone.ts` — ya resuelve el cruce de medianoche, no reimplementarlo
      — ver `design.md`) y rechaza si `ahora <= finTurnoUtc`, y transiciona a `NO_SHOW` por el
      único punto de escritura de estado. Verificar con tests unitarios de cada rechazo y del
      caso exitoso, incluyendo el turno de cena (20:00–23:30 local) que cruza medianoche en
      UTC; correr la suite con `TZ=UTC` y con `TZ=America/Argentina/Buenos_Aires`.
- [ ] 3.2 Implementar `PATCH /admin/reservas/:id/no-show` en `ReservasController`, protegido
      por `JwtAuthGuard` + `RolesGuard(ADMIN)`. Verificar con Supertest.

## 4. Tests de los requisitos de la spec

- [ ] 4.1 Test: email que no coincide y código inexistente responden `404` de forma
      indistinguible (spec: "Cancelación de Reserva por código y email").
- [ ] 4.2 Test: cancelación en el límite exacto de la ventana permitida, y fuera de la ventana
      rechazada con `409` (spec: "Ventana mínima de cancelación por Zona") — un caso por Zona
      (`STANDARD` 2h, `VIP` 24h).
- [ ] 4.3 Test: cancelar una Reserva ya `CANCELADA` responde `409`, y cancelar una Reserva ya
      `NO_SHOW` también responde `409` (spec: "Solo Reservas activas pueden cancelarse").
- [ ] 4.4 Test e2e: superar el límite de intentos de cancelación responde `429` sin validar
      código ni email (spec: "Límite de intentos de cancelación").
- [ ] 4.5 Test: marcar `NO_SHOW` antes de que termine el turno responde `409`, y después de que
      termina es exitoso (spec: "Marcado de NO_SHOW por el admin").
- [ ] 4.6 Test: marcar `NO_SHOW` un minuto antes del cierre del turno de cena (20:00–23:30
      local) responde `409`, corriendo el test con `TZ=UTC` y con
      `TZ=America/Argentina/Buenos_Aires` para confirmar que da el mismo resultado en los dos
      (spec: "Marcar NO_SHOW rechazado un minuto antes del cierre, con el turno cruzando
      medianoche en UTC" — este es el escenario que expone el bug de tratar `horaFin` como si
      ya fuera UTC).
- [ ] 4.7 Test: marcar `NO_SHOW` sobre una Reserva no `CONFIRMADA` responde `409` (spec:
      "Marcar NO_SHOW sobre una Reserva que no está CONFIRMADA rechazado").
- [ ] 4.8 Test e2e: `PATCH /admin/reservas/:id/no-show` sin token responde `401`, y con un JWT
      válido de un rol distinto de `ADMIN` responde `403` (spec: "Ruta de marcado de NO_SHOW
      sin token rechazada" y "Ruta de marcado de NO_SHOW con token de rol incorrecto
      rechazada").
- [ ] 4.9 Tests del turno 23:00–01:00 local, también del 31 de diciembre al 1 de enero:
      rechazar a las 23:30, a las 00:59 y exactamente a la 01:00; permitir a la 01:01.
      Ejecutar con `TZ=UTC` y `TZ=America/Argentina/Buenos_Aires` y verificar los mismos
      instantes de fin. Cubrir por separado el escenario de cena que cruza medianoche en UTC.
- [ ] 4.10 Tests del contrato: ambas operaciones exitosas responden `204` sin cuerpo;
      identificadores con formato inválido y body/email inválido responden `400`; NO_SHOW
      con UUID válido inexistente responde `404`. Las pruebas anteriores cubren los demás
      errores `401`, `403`, `409` y `429` según cada ruta.

## 5. Verificación final

- [ ] 5.1 Correr `openspec validate cancelacion-turnos --strict` y confirmar que el change es
      válido.
- [ ] 5.2 Incorporar el fragmento "Contrato OpenAPI" de `design.md` a
      `openapi/openapi.yaml` junto con los controllers en el PR de implementación; declarar
      `security: []` para cancelar y `security: [{ bearerAuth: [] }]` para NO_SHOW. Validar
      con Spectral y `openapi:check` (Definition of Done, `config.yaml` §13).
- [ ] 5.3 Confirmar que no hicieron falta variables de entorno nuevas ni migraciones de
      Prisma — este change no agrega campos a `Reserva` ni a `Zona`.
