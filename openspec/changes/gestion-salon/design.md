## Context

Ver `proposal.md` — `Why`. Las entidades `Zona`, `Mesa` y `Turno` ya están definidas en
`openspec/specs/modelo-dominio/spec.md` (implementación en curso, PR #12 todavía sin mergear).
Este change no agrega campos ni migraciones: expone operaciones administrativas sobre esas
entidades ya existentes. `reservas-crear` todavía no existe como capability, así que no hay
`ReservasModule` al que importar — las validaciones de este change que necesitan consultar
Reservas activas leen directamente la tabla `Reserva` vía Prisma.

## Goals / Non-Goals

**Goals:**
- Definir las rutas concretas y el naming de cada operación de `specs/gestion-salon/spec.md`.
- Decidir cómo verificar "Reservas activas asociadas" sin depender de un módulo de Reservas
  que todavía no existe.
- Decidir dónde vive la validación de reglas que comparan dos campos entre sí (rango de
  comensales de Zona, capacidad de Mesa vs. Reserva existente).

**Non-Goals:**
- No implementa la reasignación manual de una Reserva a otra Mesa (`config.yaml` §6) — es
  una operación sobre `Reserva`, no sobre el salón en sí; queda para la capability que
  gestione Reservas del lado admin.
- No implementa `reservas-crear` ni ningún flujo de creación de Reservas — solo las consulta
  de forma read-only para las validaciones de Mesa/Turno de este change.
- No decide el algoritmo *best fit* ni la validación de aforo — ya son de `disponibilidad` /
  `reservas-crear`.

## Decisions

### Rutas: `/admin/turnos`, no `/admin/horarios`
**Decisión:** las rutas usan el nombre de la entidad en español (`Turno`), consistente con
`config.yaml` §7 ("nombres de dominio en español": `Reserva`, `Mesa`, `Zona`, `Turno`) y con
el naming de recursos REST del resto de la API. El módulo de NestJS sigue llamándose
`horarios/` porque así lo fija `docs/roadmap-mvp.md` (Fase 3), pero eso es un detalle interno
de organización de carpetas, no el contrato de la API. **Alternativa considerada:** usar
`/admin/horarios` para que coincida con el nombre del módulo — se descarta porque el contrato
de API debe reflejar el vocabulario de dominio (`Turno`), no la carpeta que lo implementa.

### Zona: solo lectura y actualización, sin alta ni baja
`Zona.nombre` es un enum de Prisma con exactamente dos valores (`STANDARD`, `VIP`), definido
en `modelo-dominio`. No tiene sentido exponer `POST`/`DELETE` sobre un conjunto cerrado por el
propio schema: crear una tercera Zona requeriría una migración que agregue un valor al enum,
no una fila nueva. Por eso la capability solo expone `GET` y `PATCH` sobre las dos Zonas ya
sembradas por el seed de `modelo-dominio`.

### Verificación de Reservas activas: consulta directa a la tabla `Reserva`, no a un service
`MesasService` (para baja/edición de Mesa) inyecta `PrismaService` y consulta
`prisma.reserva.count({ where: { mesaId, estado: { in: ['PENDIENTE', 'CONFIRMADA'] } } })`
directamente, en vez de depender de un `ReservasService` que todavía no existe (nace en
`reservas-crear`, posterior en el roadmap). **Alternativa considerada:** esperar a que exista
`reservas-crear` y consumir su service — se descarta porque bloquearía innecesariamente este
change, que el roadmap marca como paralelo y sin esa dependencia. Es una lectura (`count`), no
escritura, así que no hay riesgo de que este change y `reservas-crear` diverjan en cómo se
crea una Reserva; ambos leen la misma tabla con el mismo criterio de "activa" que ya fija
`modelo-dominio` (`PENDIENTE` o `CONFIRMADA`).

### Validación de reglas que comparan dos campos: en el service, no en el DTO
El rechazo de `minComensales > maxComensales` (Zona) y de "capacidad de Mesa por debajo de una
Reserva activa" viven en el service correspondiente, no como un validador custom de
`class-validator` en el DTO. **Alternativa considerada:** un `@ValidatorConstraint` custom en
el DTO de Zona para el rango de comensales — se descarta para mantener consistencia con
`config.yaml` §7 ("la lógica de negocio vive en los services"); el DTO solo valida forma y
tipos de cada campo por separado, el service valida relaciones entre campos y contra el estado
de la base.

### Baja de Mesa es DELETE físico; baja de Turno es un toggle de `activo`
Ya justificado en `proposal.md` — `What Changes`. Consecuencia de diseño: `MesasService` no
necesita el campo `activo` que sí tiene `Turno` en el schema de `modelo-dominio`, así que no
hace falta ninguna migración para este change.

## Risks / Trade-offs

- **[Riesgo]** Editar el horario o el día de un Turno que ya tiene Reservas activas asociadas
  puede dejarlas inconsistentes con el nuevo horario (la Reserva se creó asumiendo el horario
  viejo) → **Mitigación:** aceptado, fuera de alcance del MVP — `config.yaml` no lo exige y el
  flujo esperado es que el admin configure el salón antes de que haya Reservas, no durante.
  Queda como pregunta abierta, no bloquea este change.
- **[Riesgo]** Consultar `Reserva` directamente desde `MesasService` antes de que exista
  `reservas-crear` acopla este change a la forma de la tabla en vez de a un service estable →
  **Mitigación:** es una lectura simple (`count` por `estado`), y ese mismo criterio de
  "Reserva activa" ya está fijado por el invariante 1 de `modelo-dominio`; no hay lógica de
  negocio propia de `reservas-crear` que este change necesite reutilizar.
- **[Riesgo]** Este change puede escribirse y mergearse su spec antes que `auth-admin`, pero
  su implementación no puede probarse end-to-end (con guard real) hasta que el guard exista →
  **Mitigación:** ya asumido por el roadmap; los tests unitarios de `MesasService` /
  `ZonasService` / `HorariosService` no dependen del guard y pueden escribirse antes. Los e2e
  que verifican `401` sí dependen de `auth-admin` implementado.

## Open Questions

- ¿Hay que bloquear la edición de horario/día de un Turno que ya tiene Reservas activas
  asociadas, igual que se bloquea en Mesa? No lo exige `config.yaml` y no cambia la spec de
  este change; si el equipo decide que sí, se agrega como un `MODIFIED Requirement` en un
  change posterior.
