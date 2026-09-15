## Why

Un visitante sin cuenta tiene que poder preguntar si hay lugar para N comensales en una
fecha, un turno y una zona antes de reservar (RF-08), recibir cuántos lugares quedan (RF-09),
y que esa respuesta respete las reglas de turno, anticipación, rango de comensales y aforo
(RF-10). Hoy esas reglas existen solo como texto en `config.yaml` §6 y, parcialmente, como
validaciones inline dentro de `ReservasService.crearReserva` (PR #12, `modelo-dominio`).

La pieza importante no es el endpoint sino el **validador de reglas compartido**:
`docs/roadmap-mvp.md` §7 lo marca como la pieza de mayor riesgo del proyecto, porque
`reservas-crear` lo va a reutilizar tal cual. Si la consulta y la creación evalúan reglas
distintas, el cliente ve "hay lugar" y después recibe un `409`. Conviene fijarlo ahora, en la
Fase 3, antes de que `reservas-crear` escriba su propia versión.

## What Changes

- Se introduce `GET /disponibilidad`, público (sin auth), que consulta **una** combinación
  `fecha` + `turnoId` + `zonaId` + `comensales` (no una grilla). Es una foto del momento: no
  crea ni bloquea nada.
- La respuesta válida es siempre `200` con `disponible`, `lugaresRestantes` (en comensales,
  el mínimo entre lo que queda en la zona y lo que queda en el aforo global, nunca negativo) y
  `motivos`: **todas** las reglas que fallan, con un `codigo` estable y un `mensaje` en
  español, en un orden fijo. Los códigos son `TURNO_INACTIVO`,
  `TURNO_NO_CORRESPONDE_A_FECHA`, `ANTICIPACION_MINIMA`, `ANTICIPACION_MAXIMA`,
  `COMENSALES_FUERA_DE_RANGO`, `AFORO_ZONA`, `AFORO_GLOBAL` y `SIN_MESA_DISPONIBLE`.
- Una query mal formada responde `400` y un turno o una zona inexistentes responden `404`.
  Este endpoint nunca responde `409` ni `422`.
- `fecha` es una **fecha de calendario local del restaurante** en formato `YYYY-MM-DD`, sin
  hora. El inicio del turno se interpreta en la zona horaria IANA del restaurante, así que el
  día de la semana y la anticipación se calculan sobre el calendario local y no sobre UTC.
- Se crea el módulo `backend/src/disponibilidad/` con el validador compartido: un cargador de
  contexto (el único punto que lee la base), las reglas como función pura, un helper de zona
  horaria sin librerías y el lock de creación por `(turno, fecha)`. El módulo exporta esas
  piezas para que `reservas-crear` las use en lugar de reimplementarlas.
- **Contradicciones entre `requerimientos-mvp.docx` y `config.yaml` que este change resuelve:**
  - *Aforo global.* El docx solo menciona el aforo de zona (RN-04) y el invariante 4 de §6
    habla solo de la zona, pero §6 "Aforo" lo define como tope duro global y por zona. Se
    resuelve a favor del tope global real (`AFORO_GLOBAL`).
  - *200 vs 409.* RF-13 pide `409` cuando no hay disponibilidad **al crear**. La consulta es
    otra operación: "no hay lugar" es una respuesta válida, no un error, y va con `200`.
  - *RN-06 (no reservar en el pasado).* No hace falta una regla propia: una fecha pasada
    siempre queda por debajo de la anticipación mínima y cae en `ANTICIPACION_MINIMA`.
  - *RN-07 (mínimo VIP de 4).* Ya la reemplazó `diseno-general-app` por el rango configurable
    por zona (VIP 2–12). RF-10 se cumple con `COMENSALES_FUERA_DE_RANGO`.
  - *RNF-04 (lista 422) y RNF-06 (fechas UTC/ISO 8601 en la API).* Se fija la convención
    400/404/409 sin 422, y la fecha de calendario viaja como `YYYY-MM-DD` (formato de fecha de
    ISO 8601), no como un instante UTC.
- **Edición de `openspec/config.yaml`** que acompaña este change (la escribe otra persona en
  paralelo; acá solo se describe): en §6, el aforo global como tope real evaluado junto al de
  zona; en §7, la convención HTTP 400 (input mal formado) / 404 (recurso inexistente) / 409
  (conflicto de negocio al escribir), sin 422, y que las fechas de calendario viajan como
  `YYYY-MM-DD`.

### Fuera de alcance

- **RN-10** (máximo de 3 reservas activas por cliente, contando por email): va en
  `reservas-crear`.
- **Reemplazar las validaciones inline de `ReservasService.crearReserva`** (PR #12) por el
  validador: va en `reservas-crear`. Este change **no toca** el módulo `reservas/`.
- **Best fit y el `INSERT` de la reserva**: van en `reservas-crear`. Acá solo se responde si
  existe alguna mesa que alcance.
- **Tests e2e contra Postgres en CI**: necesitan `ci-integracion-db` (roadmap §6.1). Hasta
  entonces corren localmente contra la base de test de `docker-compose`.
- **La implementación** (PR `feature/disponibilidad`) arranca recién con #12 mergeado.

## Capabilities

### New Capabilities
- `disponibilidad`: consulta pública de disponibilidad para una combinación de fecha, turno,
  zona y comensales, con los ocho motivos de no disponibilidad, el cálculo de lugares
  restantes y el validador de reglas compartido que después usa la creación de reservas.

### Modified Capabilities
_Ninguna._ `modelo-dominio` todavía no está archivada en `openspec/specs/`, y este change
consume sus entidades sin cambiarles requisitos. El campo de zona horaria es una dependencia
pedida a ese change (ver Impact), no un delta de este.

## Impact

- **Depende de:**
  - **PR #12 (`modelo-dominio`)**: schema de Prisma, seed y `PrismaService`. Sin ese merge
    no hay nada que consultar.
  - **Zona horaria del restaurante**: se le pidió a FedeWerk en #12 un campo
    `ConfiguracionNegocio.zonaHoraria` (IANA, seed `America/Argentina/Buenos_Aires`) y la
    aclaración en §7 de que los horarios de `Turno` son hora local. Si #12 se mergea sin ese
    campo, el PR de implementación de este change lo agrega con su propia migración (plan B
    en `design.md`).
  - **`ci-integracion-db`**: para que los e2e con Supertest y el test de integración del lock
    corran en CI.
- **Desbloquea:** `reservas-crear`, que toma el lock, el cargador y las reglas de este módulo.
  También el formulario con disponibilidad en vivo del frontend (RF-22).
- **Código afectado (en la implementación):** `backend/src/disponibilidad/` (module,
  controller, service, DTOs, cargador, reglas, helper de zona horaria, lock) y sus tests
  `*.spec.ts`, más `backend/test/disponibilidad.e2e-spec.ts`. No toca `backend/src/reservas/`.
- **API / `openapi/openapi.yaml`:** agrega `GET /disponibilidad` y los schemas
  `DisponibilidadRespuesta`, `MotivoNoDisponible`, `CodigoMotivo` y `ErrorRespuesta`. En
  **este** PR de spec el fragmento vive en `design.md` y no en el YAML, porque el chequeo de
  deriva (`npm run openapi:check`) pondría CI en rojo con un path sin controller. Se copia al
  YAML en el PR de implementación, junto con el controller.
- **Dependencias npm:** ninguna librería de fechas. La conversión de zona horaria usa `Intl`,
  que viene con Node.
