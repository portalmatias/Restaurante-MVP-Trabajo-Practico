## 1. Prerrequisito (bloqueante)

- [ ] 1.1 Confirmar que el change `fundacion-repo` está mergeado a `main` y que `backend/`
      existe con Prisma configurado (`backend/prisma/` presente, script
      `db:migrate -w backend` disponible en `package.json`). No continuar con la sección 2
      hasta que esto sea cierto — verificar con `ls backend/prisma` y
      `npm run db:migrate -w backend -- --help`.

## 2. Schema de Prisma

- [ ] 2.1 Definir en `backend/prisma/schema.prisma` los modelos `Usuario`, `Zona`, `Mesa`,
      `Turno`, `Reserva`, `ConfiguracionNegocio` y los enums `RolUsuario`, `NombreZona`,
      `EstadoReserva`, según `design.md` (sección Decisions → Modelos). Verificar con
      `npx prisma validate`.
- [ ] 2.2 Generar la migración inicial con
      `prisma migrate dev --name init_modelo_dominio --create-only` y verificar que el SQL
      generado incluye las seis tablas esperadas.
- [ ] 2.3 Editar a mano el SQL de la migración para reemplazar el índice único de
      `Reserva(mesaId, turnoId, fecha)` por el índice parcial con
      `WHERE estado IN ('PENDIENTE', 'CONFIRMADA')` (ver `design.md`), dejando un comentario
      en el archivo explicando que es una edición manual. Verificar leyendo el SQL resultante.
- [ ] 2.4 Aplicar la migración con `prisma migrate dev` y verificar que corre sin error y que
      `npx prisma migrate status` reporta la base al día.

## 3. Seed

- [ ] 3.1 Implementar `backend/prisma/seed.ts` con `upsert` idempotente: 1 usuario admin, las
      2 zonas (`STANDARD`/`VIP`) con los valores de `config.yaml` §6, mesas de capacidades
      variadas en cada zona, los 2 turnos base activos de martes a domingo, y algunas
      reservas de ejemplo en distintos estados. Verificar corriendo
      `npm run db:seed -w backend` dos veces seguidas y confirmar con una query que no hay
      filas duplicadas.

## 4. Tests de los cinco invariantes

- [ ] 4.1 Test que crea dos reservas activas para la misma mesa, turno y fecha, y verifica
      que la segunda es rechazada por el índice único parcial (invariante 1).
- [ ] 4.2 Test que intenta crear una reserva con comensales por encima de la capacidad de la
      mesa asignada y verifica el rechazo (invariante 2).
- [ ] 4.3 Dos tests: uno que intenta reservar sobre un turno inactivo, otro que intenta usar
      una mesa de una zona distinta a la solicitada; ambos verifican rechazo (invariante 3).
- [ ] 4.4 Test que intenta crear una reserva que excede el aforo restante de la zona para ese
      turno/fecha, aunque exista una mesa físicamente libre, y verifica el rechazo
      (invariante 4).
- [ ] 4.5 Test que intenta transicionar una reserva `CANCELADA` o `NO_SHOW` a cualquier otro
      estado y verifica el rechazo (invariante 5).
- [ ] 4.6 Test que verifica que el código de reserva generado es único (generar N códigos y
      comprobar ausencia de colisiones, o forzar una colisión simulada y verificar que el
      sistema reintenta o rechaza).

## 5. Verificación final

- [ ] 5.1 Correr `openspec validate modelo-dominio --strict` y confirmar que el change es
      válido.
- [ ] 5.2 Confirmar que `backend/prisma/schema.prisma`, la migración generada y `seed.ts`
      quedaron commiteados (nunca aplicados con `prisma db push`), según la Definition of
      Done de `config.yaml` §13.
