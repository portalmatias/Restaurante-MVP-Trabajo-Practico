## 1. Prerrequisitos (bloqueante)

- [ ] 1.1 Confirmar que la implementación de `reservas-crear` está mergeada a `main` y que
      `backend/src/reservas/reservas.service.ts` existe con un punto único de escritura de
      `estado` (según `design.md` de `modelo-dominio`). No continuar con la sección 2 hasta
      que esto sea cierto.
- [ ] 1.2 Confirmar si `cancelacion-turnos` ya agregó métodos propios a `ReservasService`. Si
      es así, seguir la misma convención de nombres y de manejo de errores al agregar
      `confirmar`/`rechazar`, para no divergir dentro del mismo service.

## 2. Confirmación y rechazo

- [ ] 2.1 Implementar `ReservasService.confirmar(id)`: rechaza con `409 Conflict` si la
      Reserva no está `PENDIENTE`, y transiciona a `CONFIRMADA` por el único punto de escritura
      de estado, sin revalidar aforo ni Mesa (ver `design.md`). Verificar con tests unitarios
      del caso exitoso y del rechazo por estado inválido.
- [ ] 2.2 Implementar `ReservasService.rechazar(id)`: rechaza con `409 Conflict` si la Reserva
      no está `PENDIENTE`, y transiciona a `CANCELADA` por el único punto de escritura de
      estado. Verificar con tests unitarios del caso exitoso y del rechazo por estado inválido.
- [ ] 2.3 Implementar `PATCH /admin/reservas/:id/confirmar` y
      `PATCH /admin/reservas/:id/rechazar` en `ReservasController`, ambos protegidos por
      `JwtAuthGuard` + `RolesGuard(ADMIN)`. Verificar con Supertest contra una Reserva
      `PENDIENTE` de prueba.

## 3. Tests de los requisitos de la spec

- [ ] 3.1 Test: confirmar una Reserva `PENDIENTE` la deja `CONFIRMADA` (spec: "Confirmación de
      Reserva pendiente").
- [ ] 3.2 Test: confirmar una Reserva que no está `PENDIENTE` responde `409` (spec:
      "Confirmación bloqueada si la Reserva no está pendiente").
- [ ] 3.3 Test: rechazar una Reserva `PENDIENTE` la deja `CANCELADA` (spec: "Rechazo de Reserva
      pendiente").
- [ ] 3.4 Test: rechazar una Reserva que no está `PENDIENTE` responde `409` (spec: "Rechazo
      bloqueado si la Reserva no está pendiente").
- [ ] 3.5 Test e2e: confirmar o rechazar sin token responde `401`, y con un JWT válido de un
      rol distinto de `ADMIN` responde `403` (spec: "Confirmación o rechazo sin token
      rechazados" y "Confirmación o rechazo con token de rol incorrecto rechazados").

## 4. Verificación final

- [ ] 4.1 Correr `openspec validate reserva-vip --strict` y confirmar que el change es válido.
- [ ] 4.2 Agregar a `openapi/openapi.yaml` los paths `PATCH /admin/reservas/{id}/confirmar` y
      `PATCH /admin/reservas/{id}/rechazar` (ambos con `security: [bearerAuth]`), en el mismo
      PR (Definition of Done, `config.yaml` §13).
- [ ] 4.3 Confirmar que no hicieron falta variables de entorno nuevas ni migraciones de
      Prisma — este change no agrega campos a `Reserva`.
