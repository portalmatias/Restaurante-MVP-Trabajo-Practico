## Context

Ver `proposal.md` — `Why`. `Reserva` y el enum `EstadoReserva` (con sus transiciones válidas)
ya están definidos en `openspec/specs/modelo-dominio/spec.md`; la ventana de cancelación vive
como dato de configuración en `Zona.ventanaCancelacionHoras`. Este change no existe todavía
como código: depende de `reservas-crear` (todavía sin spec) para que exista `ReservasService` y
Reservas reales sobre las que operar. La spec no necesita ninguna de las dos.

## Goals / Non-Goals

**Goals:**
- Fijar la semántica exacta del límite de la ventana de cancelación (inclusive vs. exclusive),
  porque `config.yaml` §9 exige testear el borde exacto y el texto de §6 no lo desambigua.
- Definir cómo se calcula "el turno ya terminó" para el marcado de `NO_SHOW`, dado que
  `Turno.horaFin` no lleva fecha (`@db.Time`) y `Reserva.fecha` sí.
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

### Cálculo de "el turno ya terminó": combinar `Reserva.fecha` + `Turno.horaFin` en UTC
`Turno.horaFin` es una hora sin fecha; el instante real de fin de turno se arma combinando la
`fecha` de la Reserva con la `horaFin` de su Turno, ambos ya persistidos en UTC (`config.yaml`
§7). No hay conversión a hora local en el backend — es responsabilidad exclusiva del frontend,
igual que el resto del sistema.

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
