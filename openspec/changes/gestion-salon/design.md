## Context

Ver `proposal.md` — `Why`. Las entidades `Zona`, `Mesa` y `Turno` ya están definidas en
`openspec/specs/modelo-dominio/spec.md` (implementación en curso, PR #12 todavía sin mergear).
Este change no agrega campos ni migraciones: expone operaciones administrativas sobre esas
entidades ya existentes. `reservas-crear` todavía no existe como capability, así que no hay
`ReservasModule` al que importar — las validaciones de este change que necesitan consultar
Reservas leen directamente la tabla `Reserva` vía Prisma: activas para edición de Mesa y
de cualquier estado para su baja.

## Goals / Non-Goals

**Goals:**
- Definir las rutas concretas y el naming de cada operación de `specs/gestion-salon/spec.md`.
- Decidir cómo verificar Reservas asociadas sin depender de un módulo de Reservas
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

### Verificación de Reservas: consulta directa a la tabla `Reserva`, no a un service
`MesasService` inyecta `PrismaService`. Para editar una Mesa consulta
`prisma.reserva.count({ where: { mesaId, estado: { in: ['PENDIENTE', 'CONFIRMADA'] } } })`;
para eliminarla consulta `prisma.reserva.count({ where: { mesaId } })`, sin filtro de estado.
Lo hace directamente, en vez de depender de un `ReservasService` que todavía no existe (nace en
`reservas-crear`, posterior en el roadmap). **Alternativa considerada:** esperar a que exista
`reservas-crear` y consumir su service — se descarta porque bloquearía innecesariamente este
change, que el roadmap marca como paralelo y sin esa dependencia. Es una lectura (`count`), no
escritura, así que no hay riesgo de que este change y `reservas-crear` diverjan en cómo se
crea una Reserva. La edición conserva el criterio de "activa" de `modelo-dominio`
(`PENDIENTE` o `CONFIRMADA`); la baja protege también el historial (`CANCELADA` y `NO_SHOW`).

### Validación de reglas que comparan dos campos: en el service, no en el DTO
El rechazo de `minComensales > maxComensales` (Zona) y de "capacidad de Mesa por debajo de una
Reserva activa" viven en el service correspondiente, no como un validador custom de
`class-validator` en el DTO. **Alternativa considerada:** un `@ValidatorConstraint` custom en
el DTO de Zona para el rango de comensales — se descarta para mantener consistencia con
`config.yaml` §7 ("la lógica de negocio vive en los services"); el DTO solo valida forma y
tipos de cada campo por separado, el service valida relaciones entre campos y contra el estado
de la base.

### Baja de Mesa es DELETE físico; baja de Turno es un toggle de `activo`
**Decisión:** `DELETE /admin/mesas/{id}` elimina físicamente solo una Mesa sin Reservas
asociadas de ningún estado. Si no existe responde `404 Not Found`; si tiene Reservas responde
`409 Conflict`, con el mensaje "No se puede eliminar una mesa con reservas asociadas.";
si se elimina responde `204 No Content`, sin cuerpo. Una Reserva `CANCELADA` o `NO_SHOW`
sigue referenciando su Mesa: liberar cupo no elimina esa relación ni autoriza borrar el historial.

El service verifica existencia y Reservas asociadas antes de llamar a `prisma.mesa.delete`.
La FK de `Reserva.mesaId` debe conservar su comportamiento restrictivo (`ON DELETE RESTRICT`):
no se usa borrado en cascada ni se pone la relación en null. Si una Reserva se inserta entre
la consulta y el DELETE, la FK impide la eliminación y el service traduce el error `P2003`
a `409 Conflict`. Si la Mesa desaparece concurrentemente, traduce `P2025` a `404 Not Found`.
La consulta previa mejora el mensaje; la FK garantiza que no queden Reservas huérfanas.

**Alternativa considerada:** baja lógica con `Mesa.activa`. Permitiría retirar una Mesa con
historial conservando sus Reservas, pero requiere migración y cambios coordinados en listado,
disponibilidad, creación y reasignación para excluir Mesas inactivas. Se difiere a un change
propio para mantener el alcance actual sin cambios de schema. En este change una Mesa con
historial permanece listada y disponible para nuevas reservas si cumple las demás reglas.

La baja de Turno sigue siendo `activo = false`. El contrato de implementación debe documentar
las respuestas `204`, `404` y `409` del DELETE de Mesa en `openapi/openapi.yaml`.

### Prueba determinística de la carrera entre consulta y DELETE
La prueba de integración usa PostgreSQL real y una barrera de promesas controlada desde el
test. Se permite interceptar temporalmente `prisma.mesa.delete` con un spy de Jest sobre la
misma instancia de `PrismaService` inyectada en `MesasService`: el spy solo demora la llamada
y luego delega en el método original, previamente guardado y ligado a su delegado. No fabrica
resultados ni errores, y no reemplaza la base de datos ni las consultas por mocks.

Secuencia de la prueba:
1. Crear una Mesa sin Reservas y preparar dos señales: `deleteAlcanzado` y `permitirDelete`.
2. Interceptar el DELETE: notificar `deleteAlcanzado`, esperar `permitirDelete` y ejecutar el
   método original con los mismos argumentos. Iniciar `MesasService.eliminar(id)` y capturar
   su resultado o error desde ese momento para evitar rechazos de promesas sin manejar.
3. Esperar `deleteAlcanzado`: el service ya verificó que no había Reservas, pero el DELETE
   todavía no llegó a PostgreSQL. Insertar y confirmar una Reserva de esa Mesa mediante un
   segundo cliente Prisma conectado a la misma base de test, fuera de una transacción pendiente.
4. Resolver `permitirDelete` y comprobar que el DELETE real falla por la FK, que el service
   lo traduce a `ConflictException` (`409`) y que Mesa, Reserva y relación siguen persistidas.
5. En `finally`, liberar siempre la barrera, esperar que termine la operación, restaurar el
   spy, limpiar los datos y desconectar el segundo cliente. Usar el timeout de Jest como
   límite ante fallos, nunca sleeps para ordenar operaciones.

La interceptación existe solo en la suite; no se agrega ningún hook de sincronización al
código de producción. Los e2e de 5.6 verifican además la respuesta HTTP del controller.

## Risks / Trade-offs

- **[Riesgo]** Editar el horario o el día de un Turno que ya tiene Reservas activas asociadas
  puede dejarlas inconsistentes con el nuevo horario (la Reserva se creó asumiendo el horario
  viejo) → **Mitigación:** aceptado, fuera de alcance del MVP — `config.yaml` no lo exige y el
  flujo esperado es que el admin configure el salón antes de que haya Reservas, no durante.
  Queda como pregunta abierta, no bloquea este change.
- **[Riesgo]** Consultar `Reserva` directamente desde `MesasService` antes de que exista
  `reservas-crear` acopla este change a la forma de la tabla en vez de a un service estable →
  **Mitigación:** son lecturas simples (`count` por Mesa, con filtro de estado solo para
  edición); no hay lógica de
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
