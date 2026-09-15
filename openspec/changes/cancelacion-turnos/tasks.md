## 1. Prerrequisitos (bloqueante)

- [ ] 1.1 Confirmar que la implementación de `reservas-crear` está mergeada a `main` y que
      `backend/src/reservas/reservas.service.ts` existe con un método de creación de Reserva y
      un punto único de escritura de `estado` (según `design.md` de `modelo-dominio`). No
      continuar con la sección 2 hasta que esto sea cierto.
- [ ] 1.2 Confirmar si `reserva-consultar` ya está implementado. Si existe una función de
      búsqueda de Reserva por código + email, reutilizarla en la sección 2 en vez de
      duplicarla (ver `design.md` — comparten servicio).

## 2. Cancelación por el cliente

- [ ] 2.1 Crear `dto/cancelar-reserva.dto.ts` (`email`, con `class-validator`). Verificar que
      `npm run build -w backend` compila.
- [ ] 2.2 Implementar `ReservasService.cancelar(codigo, email)`: busca la Reserva por código,
      rechaza con una respuesta genérica si no existe o el email no coincide, rechaza con
      `409 Conflict` si no está `PENDIENTE`/`CONFIRMADA`, rechaza si al Turno le quedan menos
      horas que `Zona.ventanaCancelacionHoras`, y transiciona a `CANCELADA` por el único punto
      de escritura de estado. Verificar con tests unitarios de cada rechazo y del caso exitoso,
      incluyendo el límite exacto de la ventana (permitido) y un instante después del límite
      (rechazado).
- [ ] 2.3 Implementar `POST /reservas/:codigo/cancelar` en `ReservasController`, sin guard
      (ruta pública). Verificar con Supertest contra una Reserva de prueba.
- [ ] 2.4 Aplicar el throttler global (`THROTTLE_TTL`/`THROTTLE_LIMIT`, ya configurado desde
      `fundacion-repo`) sobre la ruta. Verificar corriendo más intentos que el límite
      configurado y confirmando que el excedente responde `429` sin tocar la base.

## 3. Marcado de NO_SHOW (admin)

- [ ] 3.1 Implementar `ReservasService.marcarNoShow(id)`: rechaza con `409 Conflict` si la
      Reserva no está `CONFIRMADA`, rechaza si el Turno (combinando `Reserva.fecha` +
      `Turno.horaFin` en UTC) todavía no terminó, y transiciona a `NO_SHOW` por el único punto
      de escritura de estado. Verificar con tests unitarios de cada rechazo y del caso exitoso.
- [ ] 3.2 Implementar `PATCH /admin/reservas/:id/no-show` en `ReservasController`, protegido
      por `JwtAuthGuard` + `RolesGuard(ADMIN)`. Verificar con Supertest.

## 4. Tests de los requisitos de la spec

- [ ] 4.1 Test: email que no coincide y código inexistente responden de forma indistinguible
      (spec: "Cancelación de Reserva por código y email").
- [ ] 4.2 Test: cancelación en el límite exacto de la ventana permitida, y fuera de la ventana
      rechazada (spec: "Ventana mínima de cancelación por Zona") — un caso por Zona
      (`STANDARD` 2h, `VIP` 24h).
- [ ] 4.3 Test: cancelar una Reserva ya `CANCELADA` responde `409` (spec: "Solo Reservas
      activas pueden cancelarse").
- [ ] 4.4 Test e2e: superar el límite de intentos de cancelación responde `429` sin validar
      código ni email (spec: "Límite de intentos de cancelación").
- [ ] 4.5 Test: marcar `NO_SHOW` antes de que termine el turno rechazado, y después de que
      termina exitoso (spec: "Marcado de NO_SHOW por el admin").
- [ ] 4.6 Test: marcar `NO_SHOW` sobre una Reserva no `CONFIRMADA` responde `409` (spec:
      "Marcar NO_SHOW sobre una Reserva que no está CONFIRMADA rechazado").
- [ ] 4.7 Test e2e: `PATCH /admin/reservas/:id/no-show` sin token responde `401` (spec: "Ruta
      de marcado de NO_SHOW sin token rechazada").

## 5. Verificación final

- [ ] 5.1 Correr `openspec validate cancelacion-turnos --strict` y confirmar que el change es
      válido.
- [ ] 5.2 Agregar a `openapi/openapi.yaml` los paths `POST /reservas/{codigo}/cancelar` (sin
      `security`) y `PATCH /admin/reservas/{id}/no-show` (con `security: [bearerAuth]`), en el
      mismo PR (Definition of Done, `config.yaml` §13).
- [ ] 5.3 Confirmar que no hicieron falta variables de entorno nuevas ni migraciones de
      Prisma — este change no agrega campos a `Reserva` ni a `Zona`.
