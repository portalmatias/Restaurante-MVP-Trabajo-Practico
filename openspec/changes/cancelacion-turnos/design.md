## Context

Ver `proposal.md` — `Why`. `Reserva` y el enum `EstadoReserva` (con sus transiciones válidas)
ya están definidos en `openspec/specs/modelo-dominio/spec.md`; la ventana de cancelación vive
como dato de configuración en `Zona.ventanaCancelacionHoras`. Este change no existe todavía
como código: depende de `reservas-crear` (todavía sin spec) para que exista `ReservasService` y
Reservas reales sobre las que operar. La spec no necesita ninguna de las dos.

**Corrección post-review (2026-09-15, comentario de portalmatias en PR #16):** la primera
versión de este documento asumía que `Turno.horaInicio`/`horaFin` ya estaban en UTC. Es
incorrecto: son **hora local del restaurante** (la cena 20:00–23:30 es hora de Buenos Aires).
`disponibilidad` (PR #19, todavía sin mergear) ya resolvió esta conversión para el resto del
sistema con el helper `inicioTurnoUtc` (su `design.md`, decisión D5); este change lo reutiliza
en vez de reinventar la conversión, ver más abajo.

## Goals / Non-Goals

**Goals:**
- Fijar la semántica exacta del límite de la ventana de cancelación (inclusive vs. exclusive),
  porque `config.yaml` §9 exige testear el borde exacto y el texto de §6 no lo desambigua.
- Definir cómo se calcula, en UTC real, el instante de inicio del Turno (para la ventana de
  cancelación) y el de fin del Turno (para `NO_SHOW`), dado que ambos son hora **local** del
  restaurante y `Turno.horaFin`/`horaInicio` no llevan fecha (`@db.Time`).
- Decidir la forma de las rutas de este change.

**Non-Goals:**
- No define el algoritmo de `ReservasService.crear()` ni el flujo de `reservas-crear` — este
  change solo agrega dos operaciones (`cancelar`, `marcarNoShow`) que se apoyan en la Reserva
  ya creada por ese service.
- No define `reserva-consultar` — comparten servicio según el roadmap, pero esa capability
  tiene su propia spec.

## Decisions

### Ventana de cancelación: el límite exacto está permitido (inclusive)
**Decisión:** si al inicio del Turno le quedan *exactamente* `ventanaCancelacionHoras`, la
cancelación se permite. Se rechaza solo cuando quedan estrictamente menos horas que la
ventana. **Alternativa considerada:** límite exclusivo (rechazar también el instante exacto)
— se descarta porque `config.yaml` §6 describe el valor como "ventana **mínima**", y la lectura
más natural de "mínimo de N horas de anticipación" es que N horas exactas ya cumplen el
mínimo. Si el equipo o la consigna de la docente esperan lo contrario, es un cambio de una
sola comparación (`>=` vs `>`) y un ajuste del escenario de borde en la spec.

### Instante real de inicio/fin de Turno: reusar `inicioTurnoUtc` de `disponibilidad`, no reinventarlo
**Decisión:** tanto la ventana de cancelación (instante de **inicio** del Turno) como
`NO_SHOW` (instante de **fin** del Turno) se calculan con la misma función
`inicioTurnoUtc(fecha, hora, zonaHoraria)` que define `disponibilidad` (design.md, D5) —a
pesar del nombre, la función solo combina una fecha, una hora local y una zona en un instante
UTC, así que sirve igual para `horaInicio` que para `horaFin`. La función usa
`Intl.DateTimeFormat(...).formatToParts` para el offset de la zona en ese instante (con una
segunda pasada por si hay cambio de horario de verano entre medio) y toma la zona horaria de
`ConfiguracionNegocio.zonaHoraria` (IANA, seed `America/Argentina/Buenos_Aires`) — campo
pedido a `modelo-dominio` en el review de PR #12; si no llega ahí, este change asume el mismo
plan B que documenta `disponibilidad` (agregar el campo con su propia migración). Todo el
código que lee `fecha`/`hora` de Prisma usa `getUTC*` (nunca `getDate`/`getHours`/`getDay`),
porque el proceso local corre en `America/Argentina/Buenos_Aires` y CI en UTC — usar los
métodos no-UTC da un resultado distinto en cada entorno.

**Alternativa considerada:** tratar `horaInicio`/`horaFin` como si ya fueran UTC (versión
original de este documento, antes del review) — es el bug que reportó portalmatias: corre la
ventana de cancelación y el chequeo de `NO_SHOW` exactamente el offset de la zona (3 horas hoy
en Buenos Aires), y ese offset puede variar si Argentina vuelve a tener horario de verano.
**Alternativa considerada:** implementar una conversión propia en vez de reusar
`inicioTurnoUtc` — se descarta porque duplicaría la misma lógica (con las mismas trampas de
horario de verano y cruce de medianoche) en dos changes que corren en paralelo
(`disponibilidad` y este), exactamente el escenario que el comentario de portalmatias pide
evitar ("para que lo reusemos todos").

### Rutas: `POST /reservas/:codigo/cancelar` y `PATCH /admin/reservas/:id/no-show`
**Decisión:** la cancelación del cliente es un `POST` con el email en el body (no un `DELETE`
con query string), para no exponer el email en logs de acceso ni en el historial del navegador.
El marcado de `NO_SHOW` sigue el patrón de `gestion-salon` (`PATCH` sobre un sub-recurso de
estado, sin necesidad de un cuarto estado genérico "editar Reserva" que no existe en la spec).
**Alternativa considerada:** `DELETE /reservas/:codigo?email=...` — se descarta por la
exposición del email en la URL.

### Throttling: se reutiliza el límite global, sin `@Throttle()` propio
A diferencia de `POST /auth/login` (que sí definió un límite más estricto porque es el endpoint
de mayor privilegio del sistema), la cancelación pública reutiliza `THROTTLE_TTL` /
`THROTTLE_LIMIT` globales ya configurados desde `fundacion-repo`. No hay una razón de riesgo
diferencial que justifique una configuración separada, a diferencia del login administrativo.

## Risks / Trade-offs

- **[Riesgo]** La semántica inclusiva del límite de la ventana es una interpretación propia,
  no un texto literal de `config.yaml` → **Mitigación:** documentada acá explícitamente y
  cubierta por un escenario de spec dedicado al borde exacto; si la corrección del TP espera
  lo contrario, el ajuste es de una comparación y un escenario, no de arquitectura.
- **[Riesgo]** Este change se acopla a la forma final de `ReservasService`, que nace en
  `reservas-crear` y todavía no tiene spec → **Mitigación:** ya es una dependencia reconocida
  por el roadmap (Fase 4, secuencial); no se puede implementar antes de todos modos, así que
  el acoplamiento no bloquea nada que no estuviera ya bloqueado.
- **[Riesgo]** Calcular "el turno ya terminó" combinando dos campos (`fecha` + `horaFin`)
  fuera de una única columna `timestamp` es más propenso a errores de límite que comparar un
  solo valor → **Mitigación:** se cubre con un escenario de la spec ("Marcar NO_SHOW antes de
  que termine el turno rechazado") y `config.yaml` §9 ya exige testear estos bordes de
  fecha/hora explícitamente.
- **[Riesgo]** `inicioTurnoUtc` depende de `ConfiguracionNegocio.zonaHoraria`, un campo que
  todavía no existe en el schema mergeado (pedido a `modelo-dominio` en el review de PR #12) →
  **Mitigación:** si no se agrega ahí, este change sigue el plan B de `disponibilidad`
  (migración propia con default `America/Argentina/Buenos_Aires`); de cualquier forma la
  implementación de este change no puede empezar antes de que `reservas-crear` exista, así que
  hay margen para que se resuelva río arriba.
- **[Riesgo]** Este change corre en paralelo a `disponibilidad`, de donde toma
  `inicioTurnoUtc` — si la firma o el nombre del export cambian antes de mergearse, hay que
  actualizar la importación acá → **Mitigación:** bajo costo (es una sola función pura,
  documentada con tests en `disponibilidad`); se verifica en la tarea de prerrequisitos antes
  de escribir código.
