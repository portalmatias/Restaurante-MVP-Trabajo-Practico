## Context

Ver `proposal.md` — `Why` para la motivación completa. En resumen: dos documentos base
(`config.yaml` y `requerimientos-mvp.docx`) proponían modelos distintos de auth, estados,
mínimo VIP y asignación de mesa. Este documento no repite esas decisiones (ya están en el
proposal); describe la arquitectura sobre la que se apoyan, para que los changes de
capabilities concretas partan del mismo mapa.

No hay código en el repo todavía (`backend/`, `frontend/` y `prisma/schema.prisma` no
existen). El stack, la estructura de monorepo y las convenciones ya están fijados en
`config.yaml` (§2, §4, §7) y no se vuelven a discutir acá.

## Goals / Non-Goals

**Goals:**
- Definir los límites de los módulos del backend por dominio y qué expone cada uno al
  frontend a través de `openapi/openapi.yaml`.
- Describir el flujo de punta a punta de una reserva (disponibilidad → creación →
  confirmación/cancelación) al nivel de qué componente hace qué, sin entrar en código.
- Dar el criterio técnico de cómo se van a implementar las cuatro decisiones del proposal
  (estado, auth, mínimo VIP, asignación), para que las specs de cada capability no tengan
  que re-derivarlo.

**Non-Goals:**
- No define el `schema.prisma` campo por campo (eso es tarea de `feature/spec-modelo-dominio`).
- No define los endpoints uno por uno con su request/response (eso es tarea de cada change
  de capability — `feature/auth`, `feature/spec-disponibilidad`, etc.).
- No decide nada sobre CI/CD (`feature/ci-pipeline` es un change aparte, y `config.yaml`,
  línea del contexto §14, prohíbe tocar `.github/workflows/` fuera de su propio change).

## Decisions

### Módulos del backend y límites

Un módulo NestJS por dominio, como ya fija `config.yaml` §7: `auth`, `zonas`, `mesas`,
`horarios` (turnos), `reservas`. Regla de dependencia: solo `reservas` conoce a `zonas`,
`mesas` y `horarios` (para validar zona/mesa/turno al crear una reserva); `zonas`, `mesas`
y `horarios` no se conocen entre sí. `auth` no depende de ningún otro módulo de dominio —
protege rutas vía guard, no expone lógica de negocio.

**Alternativa considerada:** un único módulo `salon` que agrupe zonas+mesas+turnos. Se
descarta porque el docx los trata como recursos administrables por separado (RF-04, RF-05,
RF-06 son CRUDs independientes) y separarlos en módulos propios facilita repartir el
trabajo entre los 3 integrantes sin que dos personas toquen el mismo archivo.

### Contrato backend ↔ frontend

El único contrato entre `backend/` y `frontend/` es `openapi/openapi.yaml` (ya fijado en
`config.yaml` §4). El frontend no importa tipos del backend directamente; los deriva del
YAML. Cada change que agregue o cambie un endpoint actualiza el YAML en el mismo PR
(Definition of Done, `config.yaml` §13).

### Flujo de una reserva (referencia para las specs de capability)

```
Cliente/Visitante                Backend                              DB
       │                            │                                  │
       │  GET /disponibilidad ─────▶│  valida turno activo (RN-05),    │
       │  (fecha, turno, zona,      │  ventana de anticipación,        │
       │   comensales)              │  mínimo/máximo de zona,          │
       │                            │  aforo restante ────────────────▶│ (solo lectura)
       │◀──── cupo + lugares ───────│                                  │
       │                            │                                  │
       │  POST /reservas ──────────▶│  re-valida todo lo anterior      │
       │  (mismos datos + nombre/   │  DENTRO de una transacción       │
       │   email/teléfono)          │  Prisma; asigna mesa (best fit); │
       │                            │  valida aforo con el nuevo       │
       │                            │  comensal ya sumado ─────────────▶│ INSERT Reserva
       │                            │                                  │ (índice único parcial
       │◀── 201 + código de reserva │                                  │  mesaId+turnoId+fecha)
       │    (si VIP: PENDIENTE;     │                                  │
       │     si no: CONFIRMADA)     │                                  │
```

La consulta de disponibilidad (RF-08/09/10) y la creación (RF-11/12/13) comparten toda la
validación de negocio; la única diferencia es que la creación corre en una transacción y
persiste. Esto evita duplicar las reglas RN-04/05/06/07 en dos lugares: la capability
`disponibilidad` reutiliza el mismo validador que `reservas`, no lo reimplementa.

### Estados y transición NO_SHOW

El enum `EstadoReserva` (`PENDIENTE | CONFIRMADA | CANCELADA | NO_SHOW`) vive en el schema
de Prisma. La transición a `NO_SHOW` requiere un endpoint de admin aparte (no está en la
lista de endpoints del docx) — se agrega como parte de `feature/reserva-consultar` o
`feature/cancelacion-turnos` (a decidir en el `tasks.md` de ese change), con guard que
verifique `fecha+turno` ya pasado antes de aceptar la transición.

### Mínimo/máximo de comensales configurable

`Zona.minComensales` y un campo equivalente de máximo (o un rango) viven en la tabla
`Zona`, cargados por seed con los valores de `config.yaml` §6 (STANDARD 1-8, VIP 2-12). No
se hardcodea el `4` que traía el docx. `ConfiguracionNegocio` (ventana de cancelación,
máximo de reservas activas) sigue el mismo criterio: configurable, con default en el seed.

### Asignación best fit

Al crear la reserva, la query de mesas candidatas filtra por zona + capacidad ≥ comensales
+ disponibilidad en ese turno/fecha, ordena por capacidad ascendente y toma la primera. Se
ejecuta dentro de la misma transacción que el `INSERT` de la reserva para que la
comprobación de disponibilidad y la asignación sean atómicas frente a pedidos concurrentes.

**Alternativa considerada:** asignar mesa de forma asíncrona/diferida (ej. un job que
asigna mesas cada cierto intervalo). Se descarta: la consigna académica valora la
trazabilidad y la asignación inmediata es más simple de testear (§9 de `config.yaml`).

## Risks / Trade-offs

- **[Riesgo] El modelo "sin cuenta" para el cliente reintroduce el problema de enumeración**
  del código de reserva (baja entropía) → **Mitigación:** ya prevista en `config.yaml` §5,
  rate limiting con `@nestjs/throttler` en las rutas públicas de consulta/cancelación. Se
  hereda tal cual, no hay nada nuevo que decidir acá.
- **[Riesgo] Revertir la exclusión de "asignación inteligente" del docx (best fit) agrega
  complejidad no prevista en el relevamiento original** → **Mitigación:** el algoritmo es
  una sola query ordenada por capacidad, no un solver de optimización; el costo real es
  bajo. De todos modos, si en la revisión de equipo o con la docente se prefiere volver a
  "primera mesa libre", el cambio queda acotado a un único método del servicio de reservas
  y no afecta el resto de este diseño.
- **[Riesgo] Cuatro capabilities (auth, gestión de salón, disponibilidad, reservas)
  comparten este mismo documento de diseño como base** → si se actualiza una decisión acá
  después de que ya se creó una de esas specs, hay que propagar el cambio a mano →
  **Mitigación:** ninguna decisión de este documento se toca sin antes revisar qué changes
  ya la consumieron (buscar referencias a este `design.md` en los `proposal.md` de los
  changes siguientes).
