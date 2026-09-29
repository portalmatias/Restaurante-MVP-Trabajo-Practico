## Why

Hoy el dominio del sistema (`Reserva`, `Mesa`, `Zona`, `Turno`, `Usuario`, `Configuracion`, el
enum `EstadoReserva` y los cinco invariantes de negocio) existe únicamente como texto en
`openspec/config.yaml` §6. Ningún change de capability concreta (`auth-admin`,
`disponibilidad`, `gestion-salon`, `reservas-crear`, etc.) puede escribir su propia spec sin
antes tener un modelo de datos formal y acordado: si cada capability infiere el schema por su
cuenta, dos integrantes van a terminar modelando la misma entidad de forma distinta. Por eso
`docs/roadmap-mvp.md` (Fase 2) marca este change como el segundo bloqueante secuencial del
proyecto, inmediatamente después de `fundacion-repo`.

Este change formaliza esas entidades e invariantes como la **primera spec de comportamiento
real** del proyecto (hasta ahora `openspec/specs/` está vacío porque `diseno-general-app` usó
`skip_specs: true`).

## What Changes

- Se introduce la capability `modelo-dominio`, que especifica:
  - Las entidades `Usuario`, `Zona`, `Mesa`, `Turno`, `Reserva` y `Configuracion` (o
    `ConfiguracionNegocio`), con sus campos, relaciones y qué valores son configurables vs.
    fijos, según `config.yaml` §6.
  - El enum `EstadoReserva` (`PENDIENTE | CONFIRMADA | CANCELADA | NO_SHOW`) y sus
    transiciones válidas.
  - Los **cinco invariantes de §6 como requisitos con escenarios propios** (no como texto
    suelto): cada uno debe quedar expresado de forma que se pueda derivar un test que intente
    violarlo, tal como exige §9 (Testing) de la constitución.
- No modifica `openspec/config.yaml`: los valores de negocio (rangos VIP/STANDARD, turnos
  base) ya están fijados ahí y este change los hereda sin reabrir la discusión.
- La fase de implementación de este mismo change (PR `feature/modelo-dominio`, posterior a
  este PR de spec) agrega `backend/prisma/schema.prisma`, la migración inicial versionada
  (`prisma migrate dev`), `backend/prisma/seed.ts` idempotente, y tests que intentan violar
  cada invariante — en particular el índice único parcial sobre `(mesaId, turnoId, fecha)`
  para reservas activas, que es lo que hace cumplir el invariante 1 a nivel de base de datos.

## Capabilities

### New Capabilities
- `modelo-dominio`: entidades del dominio, enum de estados de reserva y los cinco invariantes
  de negocio de `config.yaml` §6, como spec formal que el resto de las capabilities
  (`auth-admin`, `gestion-salon`, `disponibilidad`, `reservas-crear`, `cancelacion-turnos`,
  `reserva-vip`) va a referenciar en vez de reinventar.

### Modified Capabilities
_Ninguna._ No hay specs archivadas todavía sobre las que declarar un delta.

## Impact

- **Bloquea y desbloquea:** este change es prerrequisito de todo el backend (Fase 3 en
  adelante del roadmap). Ninguna otra capability puede escribir su propia spec de datos sin
  contradecir este modelo.
- **Dependencia externa a este change:** el PR de spec (`feature/spec-modelo-dominio`, este)
  no necesita código y se puede escribir y revisar ya. El PR de implementación
  (`feature/modelo-dominio`) sí depende de que exista `backend/` — lo crea `fundacion-repo`
  (Fase 1, dueño `portalmatias`), que todavía no arrancó. El `tasks.md` de este change va a
  dejar esa dependencia explícita para que nadie intente aplicar las tareas de implementación
  antes de tiempo.
- **Código afectado (cuando se implemente):** `backend/prisma/schema.prisma`,
  `backend/prisma/migrations/`, `backend/prisma/seed.ts`, y sus tests unitarios en
  `backend/src/**/*.spec.ts` (uno por invariante como mínimo).
- **No afecta** `openapi/openapi.yaml` — este change no expone ningún endpoint nuevo, solo el
  modelo de datos subyacente.
