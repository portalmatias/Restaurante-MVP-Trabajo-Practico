## Why

Un visitante sin cuenta que ya vio que hay lugar tiene que poder reservar: dejar fecha, turno,
zona, comensales y sus datos de contacto, y recibir un código con el que después consulta o
cancela (RF-11, `config.yaml` §5). El sistema asigna la mesa solo (RF-12, *best fit* según §6)
y rechaza con `409` cuando no hay lugar (RF-13). Sin este change no existen reservas reales, y
`reserva-consultar`, `cancelacion-turnos` y `reserva-vip` no tienen sobre qué operar.

Hoy la creación existe a medias en `ReservasService.crearReserva` (PR #12, `modelo-dominio`):
recibe la mesa ya elegida, valida las reglas con `throw` inline y corre en `Serializable` con
reintentos por `P2034`. Eso tiene tres problemas: duplica reglas que `disponibilidad` ya fijó
como validador compartido (si divergen, la consulta dice "hay lugar" y la creación responde
`409` por otro motivo, o al revés), no evalúa anticipación ni rango de comensales, y el bucle
de reintentos puede terminar propagando el `P2034` como `500` justo bajo concurrencia.

## What Changes

- Se introduce `POST /reservas`, **público** (sin auth), con `fecha` (`YYYY-MM-DD`, calendario
  local del restaurante), `turnoId`, `zonaId`, `comensales`, `nombreCliente`, `emailCliente` y
  `telefonoCliente`. El cliente **no** elige mesa, estado ni código: si los manda, se ignoran.
- La creación evalúa las reglas con el **validador compartido de `disponibilidad`**
  (`cargarContexto` + `evaluarReglas`), sin reimplementar ninguna. Si hay motivos, responde
  `409` con **todos** los motivos, con los mismos `CodigoMotivo` y en el mismo orden fijo que
  la consulta. Así se cierra la Open Question que `disponibilidad` le dejó a este change.
- Concurrencia: todo corre en **una** transacción `READ COMMITTED` cuya primera sentencia es
  `bloquearTurnoFecha` (lock advisory por `(turno, fecha)`, D6 de `disponibilidad`). Después
  vienen `cargarContexto(tx)`, `evaluarReglas`, la asignación de mesa y el `INSERT`. **Se
  eliminan** el `isolationLevel: Serializable` y el bucle de reintentos por `P2034` de #12.
  Un conflicto de concurrencia nunca responde `500`.
- Asignación **best fit**: la mesa libre de la zona con la menor capacidad que alcance, con
  desempate determinista por `etiqueta` ascendente.
- Estado inicial: `PENDIENTE` si la zona tiene `requiereConfirmacionAdmin = true` (hoy VIP),
  `CONFIRMADA` si no (hoy STANDARD). Se decide por el dato de la zona, no por su nombre.
- Código de reserva de 8 caracteres alfanuméricos, único, generado al crear (reusa el
  generador y el reintento por colisión con `SAVEPOINT` de #12).
- Respuesta `201` con `codigoReserva`, `estado`, `fecha`, `turnoId`, `zonaId` y `comensales`.
  No expone el `id` interno ni la mesa.
- Errores: `400` body mal formado, `404` turno o zona inexistentes, `409` reglas de negocio,
  falta de mesa o choque de concurrencia. Nunca `422` (§7).
- **Pequeña extensión explícita del validador de `disponibilidad`** (sin renombrar nada ni
  cambiar reglas): `ContextoReserva` expone, además de las capacidades libres, el `id` y la
  `etiqueta` de cada mesa libre y el `requiereConfirmacionAdmin` de la zona. Ver D3 y D4.
- **Contradicciones entre `requerimientos-mvp.docx` y `config.yaml` que este change resuelve:**
  - *RF-11 "cliente autenticado"* y endpoint `POST /reservas` con rol `CLIENTE`: se reemplaza
    por reserva sin cuenta, como ya fijó `diseno-general-app` (§5).
  - *RF-12 "una mesa libre que cumpla la capacidad"*: se aplica *best fit*, decisión de
    producto ya tomada en `diseno-general-app`.
  - *RN-02 "dos reservas confirmadas"*: cuentan `PENDIENTE` y `CONFIRMADA` (invariante 1 de §6
    e índice único parcial de #12).

### Fuera de alcance

- **Consultar la reserva por código + email** y el listado admin: `reserva-consultar`.
- **Cancelar, `NO_SHOW`, confirmar o rechazar**: `cancelacion-turnos` y `reserva-vip`. Este
  change no toca `transicionarEstado`.
- **Envío de email** con el código: ver Open Questions. El único canal es la respuesta `201`.
- **RN-10** (máximo de reservas activas por cliente): `disponibilidad` lo delegó acá, pero el
  schema de #12 no tiene el dato y ni §6 ni el roadmap lo piden. Queda en Open Questions y no
  se implementa hasta que el equipo lo decida.
- **Rate limiting e idempotencia de `POST /reservas`**: ver Open Questions.
- **Tests e2e contra Postgres en CI**: necesitan `ci-integracion-db`. Hasta entonces corren
  localmente contra la base de test de `docker-compose`.

## Capabilities

### New Capabilities
- `reservas-crear`: creación pública de una reserva sin cuenta, con las mismas reglas que la
  consulta de disponibilidad, asignación *best fit* de mesa, estado inicial según la zona,
  código de reserva único y garantía de aforo bajo creaciones concurrentes.

### Modified Capabilities
_Ninguna._ `modelo-dominio` y `disponibilidad` todavía no están archivadas en
`openspec/specs/`. Este change consume sus entidades y su validador sin cambiarles requisitos:
la extensión de `ContextoReserva` agrega datos que el cargador ya lee, no cambia ninguna regla
ni ningún escenario de `disponibilidad`.

## Impact

- **Depende de:**
  - **PR #12 (`modelo-dominio`)** mergeado: schema, índice único parcial, seed,
    `PrismaService`, `ReservasService` y `common/timezone.ts`.
  - **Implementación de `disponibilidad`** mergeada: `cargarContexto`, `evaluarReglas`,
    `bloquearTurnoFecha`, `CodigoMotivo`, `MotivoNoDisponible`, `ErrorRespuesta`, el
    validador de `fecha` y el `ValidationPipe` global.
  - **`ci-integracion-db`**: para que el test concurrente y los e2e corran en CI.
- **Desbloquea:** `reserva-consultar`, `cancelacion-turnos` y `reserva-vip` (Fase 4), y el
  formulario de reserva del frontend (Fase 5).
- **Código afectado (en la implementación):** `backend/src/reservas/` (controller nuevo,
  `CrearReservaDto`, clases de respuesta, `elegirMesaBestFit` con su `*.spec.ts`, y
  `ReservasService.crearReserva` reescrito), el tipo `ContextoReserva` y `cargarContexto` en
  `backend/src/disponibilidad/` (solo la extensión de D3/D4),
  `backend/test/reservas-invariantes.integration-spec.ts` de #12 (adaptado a la nueva
  entrada) y `backend/test/reservas-crear.e2e-spec.ts` nuevo. No toca `transicionarEstado`.
- **API / `openapi/openapi.yaml`:** agrega `POST /reservas` y los schemas `CrearReservaDto`,
  `ReservaCreadaRespuesta` y `ReservaRechazadaRespuesta` (reusa `MotivoNoDisponible`,
  `CodigoMotivo` y `ErrorRespuesta` de `disponibilidad`). En **este** PR de spec el fragmento
  vive en `design.md`, porque `npm run openapi:check` pondría CI en rojo con un path sin
  controller. Se copia al YAML en el PR de implementación.
- **Base de datos:** sin migraciones. Todo lo que se escribe ya existe en el schema de #12.
- **Dependencias npm:** ninguna nueva.
