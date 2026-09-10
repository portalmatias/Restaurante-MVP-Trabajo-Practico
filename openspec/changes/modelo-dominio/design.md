## Context

Ver `proposal.md` — `Why` para la motivación. En resumen: este change formaliza en
`specs/modelo-dominio/spec.md` las entidades y los cinco invariantes que hoy solo existen como
texto en `config.yaml` §6. Este documento resuelve **cómo** modelar eso en `schema.prisma` y
qué mecanismo (constraint de base de datos vs. validación de servicio) hace cumplir cada
invariante. No hay código en el repo todavía; este diseño asume la estructura de monorepo ya
fijada en `config.yaml` §4 (`backend/prisma/schema.prisma`, `migrations/`, `seed.ts`), que
nace en `fundacion-repo` (Fase 1 del roadmap, todavía sin implementar).

## Goals / Non-Goals

**Goals:**
- Definir los modelos de `schema.prisma`, sus campos, relaciones y enums.
- Para cada uno de los cinco invariantes de la spec, decidir si se hace cumplir con un
  constraint de base de datos o con validación de servicio, y por qué.
- Definir la estrategia de seed idempotente (§10 de `config.yaml`).

**Non-Goals:**
- No define DTOs ni endpoints — este change no expone ninguna API.
- No define el algoritmo *best fit* en detalle (ya quedó en el `design.md` de
  `diseno-general-app`; se implementa en `reservas-crear`).
- No decide la reasignación manual de mesa por el admin (es de `gestion-salon`/`reservas`).

## Decisions

### Modelos de `schema.prisma`

- **Usuario**: `id` (uuid), `email` (único), `passwordHash`, `rol` (enum `RolUsuario { ADMIN }`),
  `createdAt`.
- **Zona**: `id`, `nombre` (enum `NombreZona { STANDARD VIP }`, único), `minComensales`,
  `maxComensales`, `anticipacionMinHoras`, `anticipacionMaxDias`, `ventanaCancelacionHoras`,
  `requiereConfirmacionAdmin` (boolean), `aforoMaximo`.
- **Mesa**: `id`, `zonaId` (FK a Zona), `capacidad`, `etiqueta` (identificador legible para el
  admin, ej. "M12"). Índice sobre `zonaId`.
- **Turno**: `id`, `diaSemana`, `horaInicio`, `horaFin` (`@db.Time`, sin componente de fecha),
  `activo` (boolean, default `true`).
- **Reserva**: `id`, `mesaId` (FK), `turnoId` (FK), `fecha` (`@db.Date`), `comensales`,
  `estado` (enum `EstadoReserva`), `nombreCliente`, `emailCliente`, `telefonoCliente`,
  `codigoReserva` (string de 8 caracteres, único), `createdAt`, `updatedAt`.
- **ConfiguracionNegocio**: tabla de una sola fila (singleton) con `aforoGlobal` y cualquier
  otro valor de negocio que no sea específico de una Zona.

**Configuración: fila única tipada vs. tabla key/value.** Se elige una fila única con columnas
tipadas. Alternativa considerada: tabla genérica clave/valor (más flexible, pero pierde
tipado y obliga a parsear/castear en el service). Para el alcance del MVP —pocos valores
conocidos de antemano— la fila tipada es más simple y Prisma la valida en tiempo de
compilación. Trade-off aceptado: agregar un valor de configuración nuevo requiere una
migración, no solo un `INSERT`.

### Invariante 1 (exclusividad mesa + turno + fecha) → índice único **parcial**

El schema DSL de Prisma no soporta una condición `WHERE` en un índice único. Estrategia:

1. Generar la migración con `prisma migrate dev --name init_modelo_dominio --create-only`.
2. Editar a mano el SQL generado para agregar:
   ```sql
   CREATE UNIQUE INDEX "reserva_mesa_turno_fecha_activa_key"
     ON "Reserva" ("mesaId", "turnoId", "fecha")
     WHERE "estado" IN ('PENDIENTE', 'CONFIRMADA');
   ```
3. Dejar un comentario en el archivo de migración explicando que es edición manual, para que
   nadie lo "regenere" sin querer y pierda la condición `WHERE`.

Esto hace cumplir el invariante 1 **a nivel de base de datos**, incluso bajo escrituras
concurrentes. **Alternativa considerada:** validar la exclusividad solo en el service dentro
de la transacción Prisma. Se descarta como único mecanismo — bajo el nivel de aislamiento por
defecto, dos transacciones concurrentes podrían no verse mutuamente y ambas pasar la
validación antes del commit. El índice a nivel de base de datos es la garantía real; la
validación en el service queda como *fast-path* para devolver un `409 Conflict` legible en vez
de propagar el error crudo del constraint.

### Invariantes 2, 3 y 4 (capacidad, turno activo/zona, aforo) → validación de servicio

Ninguno de los tres es expresable como constraint declarativo simple de Prisma/Postgres sin
triggers:
- Invariante 2 compara dos tablas (`Reserva.comensales` vs. `Mesa.capacidad`).
- Invariante 3 compara la zona de la Mesa contra la Zona solicitada.
- Invariante 4 requiere una agregación (suma de comensales activos del turno).

Se descartan los triggers de Postgres porque `config.yaml` §2 prohíbe lógica de negocio fuera
de Prisma/la aplicación ("no usar ORMs, query builders ni acceso SQL directo por fuera de
Prisma"). Los tres se validan en el service, dentro de la misma transacción Prisma que crea la
Reserva — tal como ya describe el flujo de `design.md` de `diseno-general-app`.

### Invariante 5 (estados terminales no retroceden) → único punto de escritura del estado

Prisma no modela una máquina de estados de forma declarativa. Se resuelve con una convención de
código: un único método del service (`transicionarEstado`) es el único lugar autorizado a
escribir el campo `estado` de una Reserva — nunca se actualiza con un `update` genérico desde
otro punto. Ese método valida la transición contra la tabla de transiciones válidas de la spec
antes de escribir.

### Seed idempotente

`upsert` por clave natural en vez de `create`: email para Usuario, `nombre` para Zona,
combinación turno+día para Turno. Correr el seed dos veces no duplica filas (§10).

## Risks / Trade-offs

- **[Riesgo]** La migración con el índice parcial editado a mano puede perderse si alguien
  corre `prisma migrate dev` de nuevo sin revisar el diff y Prisma "repara" el drift →
  **Mitigación:** un test de integración (en `ci-integracion-db`) que intente insertar dos
  Reservas activas duplicadas directamente y verifique que la base las rechaza — cualquier
  regresión de la migración se detecta en CI, no en producción.
- **[Riesgo]** Los invariantes 2, 3 y 4 viven en el service, no en la base — un acceso directo
  a la base fuera de la aplicación podría violarlos → **Mitigación:** aceptable para el
  alcance académico; el invariante más crítico por concurrencia (el 1) sí está a nivel de
  base de datos, y `config.yaml` §2 ya prohíbe el acceso SQL fuera de Prisma de todos modos.
- **[Riesgo]** Modelar `ConfiguracionNegocio` como fila única es rígido si en el futuro hiciera
  falta configuración por sucursal → **Mitigación:** fuera de alcance del MVP (single-tenant),
  trade-off aceptado.

## Migration Plan

1. `prisma migrate dev --name init_modelo_dominio --create-only` genera el SQL base desde el
   schema.
2. Editar a mano el archivo generado para agregar el índice único parcial (ver Decisions).
3. `prisma migrate dev` aplica la migración y deja el historial consistente.
4. `npm run db:seed -w backend` corre `seed.ts` después de migrar.

No hay estrategia de rollback especial: es la migración inicial del proyecto, no hay datos
previos que preservar.
