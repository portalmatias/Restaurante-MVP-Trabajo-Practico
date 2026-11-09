## 1. Pruebas primero

- [x] 1.1 Escribir `backend/test/reservas-demo-seed.integration-spec.ts` con casos de
      `elegirTurnoEnVentana`: martes 10:00 → almuerzo del martes; martes 13:00 → cena del martes;
      domingo 23:00 → `null`; sábado 21:00 → almuerzo del domingo (el inicio más próximo); un turno
      que empieza justo al cumplirse la ventana queda afuera. Verificar que fallan (RED) porque el
      módulo todavía no existe.
- [x] 1.2 En el mismo archivo, sobre un schema de Postgres propio (patrón de
      `plano-mesas-seed.integration-spec.ts`): correr la carga de reservas de demostración dos
      veces y verificar que `SEEDPAS2` es `CONFIRMADA`, con el turno terminado y su día de la
      semana; que `SEEDVTN2` está en una mesa VIP con inicio dentro de la ventana; que no hay
      duplicados; y que un `NO_SHOW` hecho entre corridas se conserva. Verificar RED.

## 2. Implementación

- [x] 2.1 Crear `backend/prisma/reservas-demo.ts` con `elegirTurnoEnVentana` y la carga de
      `SEEDPAS2` y `SEEDVTN2` (con el aviso en consola cuando no hay turno), reutilizando
      `inicioTurnoUtc` y los helpers de `src/common/timezone.ts`. Verificar que 1.1 y 1.2 pasan
      (GREEN).
- [x] 2.2 Llamar la carga desde `seed.ts` después de las reservas existentes y correr
      `npm run db:seed -w backend` dos veces contra la base local: termina sin error y no duplica
      filas.
- [x] 2.3 Comprobar a mano contra la base seedeada: cancelar `SEEDVTN2` con su código y email
      responde 409 por ventana, y marcar `SEEDPAS2` como `NO_SHOW` desde el admin responde 204.
      Resultado (09/11/2026, lunes 12:16): `SEEDVTN2` quedó en el almuerzo del martes 10/11 en
      V2; `POST /reservas/SEEDVTN2/cancelar` respondió 409 «fuera de la ventana mínima de
      cancelación» y `PATCH /admin/reservas/:id/no-show` sobre `SEEDPAS2` respondió 204 (después
      se la volvió a dejar `CONFIRMADA` en la base local). `db:seed` se corrió con el `.env` de la
      raíz cargado por dotenv, porque en esta máquina no hay `backend/.env`.

## 3. Documentación y cierre

- [x] 3.1 Actualizar la sección del seed en `README.md` con las dos reservas nuevas, para qué
      sirven y cómo repetir la demo (resetear la base local). Verificar leyendo la sección.
- [x] 3.2 Correr lint, tipos, tests unitarios y de integración del backend, y
      `npx openspec validate seed-datos-demo --strict`; todo en verde.
      Resultado (09/11/2026): lint y tipos OK; unitarios 248/248; con la base de test seedeada
      como en el CI, integración 199/199 y e2e 168/168; `openspec validate --all --strict` 27/27.
