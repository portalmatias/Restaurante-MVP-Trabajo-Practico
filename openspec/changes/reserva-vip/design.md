## Context

Ver `proposal.md` — `Why`. `Reserva` y el enum `EstadoReserva` con sus transiciones válidas
(`PENDIENTE → CONFIRMADA`, `PENDIENTE → CANCELADA`) ya están definidos en
`openspec/specs/modelo-dominio/spec.md`. Este change depende de `reservas-crear` (todavía sin
spec) para que exista `ReservasService` y Reservas `PENDIENTE` reales sobre las que operar. La
spec no necesita ninguna de las dos.

## Goals / Non-Goals

**Goals:**
- Definir la forma de las dos rutas de este change.
- Aclarar si confirmar una Reserva requiere revalidar aforo/disponibilidad, dado que
  `modelo-dominio` ya cuenta las Reservas `PENDIENTE` como activas.

**Non-Goals:**
- No define `reservas-crear` ni cómo una Reserva llega a `PENDIENTE` — eso ya lo fija
  `modelo-dominio` (Zona `VIP` con `requiereConfirmacionAdmin = true`).
- No define el listado de Reservas `PENDIENTE` para el admin — lo cubre `reserva-consultar`.

## Decisions

### Confirmar no revalida aforo ni disponibilidad de Mesa
**Decisión:** `confirmar` solo cambia el `estado` de la Reserva; no vuelve a chequear aforo de
Zona ni disponibilidad de Mesa. **Alternativa considerada:** revalidar como si fuera una
creación nueva — se descarta porque el invariante 1 de `modelo-dominio` (índice único parcial
sobre `mesaId`+`turnoId`+`fecha`) ya trata `PENDIENTE` como estado activo desde el momento de
la creación, igual que `CONFIRMADA`; la Mesa y el cupo de aforo ya están "tomados" desde que la
Reserva se creó. Revalidar en la confirmación sería redundante y podría rechazar una
confirmación por una condición que ya era cierta desde la creación, generando una UX confusa
para el admin.

### El gate de la transición es el estado (`PENDIENTE`), no la Zona
**Decisión:** ambas operaciones solo verifican que la Reserva esté `PENDIENTE`; no verifican
explícitamente que su Zona sea `VIP`. **Alternativa considerada:** validar también
`zona.nombre === 'VIP'` — se descarta porque en el MVP toda Reserva `PENDIENTE` es,
por construcción, de una Zona con `requiereConfirmacionAdmin = true` (hoy solo `VIP`); agregar
un chequeo de Zona duplicaría una garantía que ya da el estado, y acoplaría este change a un
nombre de Zona fijo en vez de a la propiedad de configuración que realmente importa.

### Rutas: `PATCH /admin/reservas/:id/confirmar` y `PATCH /admin/reservas/:id/rechazar`
Mismo patrón que el `NO_SHOW` de `cancelacion-turnos`: `PATCH` sobre un sub-recurso de acción,
sin introducir un endpoint genérico de "editar estado de Reserva" que no está en ninguna spec.

## Risks / Trade-offs

- **[Riesgo]** Este change se acopla a la forma final de `ReservasService`, que nace en
  `reservas-crear` y todavía no tiene spec → **Mitigación:** dependencia ya reconocida por el
  roadmap (Fase 4); no se puede implementar antes de todos modos.
- **[Riesgo]** `reserva-vip`, `reserva-consultar` y `cancelacion-turnos` tocan el mismo
  `ReservasController`/`ReservasService` → **Mitigación:** el roadmap ya sugiere un orden de
  merge (`reserva-consultar` primero); cada change agrega métodos nuevos sin tocar los de los
  otros, así que el riesgo de conflicto es de rebase, no de diseño.
- **[Riesgo]** No validar Zona explícitamente asume que `PENDIENTE` seguirá siendo exclusivo
  de Zonas con `requiereConfirmacionAdmin = true` → **Mitigación:** esa garantía la da
  `reservas-crear`, no este change; si en el futuro cambiara, el ajuste es agregar un chequeo
  acá, no rediseñar la spec.
