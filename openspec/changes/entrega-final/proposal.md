## Why

La consigna pide tres entregables: el repositorio con un `README.md` que explique la
arquitectura y cómo ejecutar el sistema, especificaciones de OpenSpec completas y válidas, y el
historial de Pull Requests cerrados con ejecuciones verdes en GitHub Actions. La Definition of
Done (`config.yaml` §13) además exige que cada change cumpla todos sus puntos antes de
considerarse terminado. Nadie lo comprobó todavía de punta a punta: hay 19 changes archivados y
103 PRs mergeados, pero ningún documento que muestre, change por change, que se cumplió cada
punto y dónde está la evidencia.

`docs/roadmap-mvp.md` (§10, Fase 6) le asigna este cierre a `entrega-final`. El roadmap también
quedó desactualizado: su estado es del 2026-10-06, da a `frontend-cliente` por abierto aunque
ya está archivado, y no menciona `rediseno-frontend-ichigo`, `plano-mesas` ni los changes que
vinieron después. Además, el README cita una ruta que ya no existe:
`openspec/changes/exposicion-red-local/design.md`, que al archivarse pasó a
`openspec/changes/archive/2026-10-05-exposicion-red-local/design.md`.

## What Changes

- **Verificación de la Definition of Done por change.** Un documento nuevo, `docs/entrega.md`,
  con una tabla por change archivado y los puntos de §13 que le aplican. Cada punto queda
  marcado como cumplido, como «no aplica» (con el motivo) o como desvío, y con su evidencia
  (número de PR, run de CI, archivo). Los changes que todavía están activos
  (`despliegue-continuo-ec2`, `ip-real-detras-de-cloudflare`, `plano-mesas-admin`,
  `verificacion-version-desplegada`) se suman a medida que se archivan.
- **Entregables de la consigna.** El mismo documento enlaza cada entregable con su evidencia:
  README, `openspec validate --all --strict` y el linter de OpenAPI en verde, y el historial
  de PRs y de runs de CI.
- **README.** Se suma una sección «Decisiones de diseño» que resume las decisiones principales
  y enlaza al `design.md` archivado de cada change. Se corrige la ruta que ya no existe y se enlaza
  `docs/entrega.md`.
- **Roadmap.** Se actualiza el estado de `docs/roadmap-mvp.md` a la fecha de la entrega, y las
  secciones de planificación quedan marcadas como históricas.
- **Recorrido de punta a punta.** Se corre contra la base seedeada el flujo manual de cierre que
  describe el roadmap (§13, «Fase 5 y cierre») y se registra el resultado.
- **No** cambia código, specs, el schema, la API ni los workflows. Un desvío que requiera
  cambiar código se registra y se resuelve en su propio change; no se corrige acá.
- **No** se edita el contenido de los changes archivados: si uno tiene un desvío, se documenta
  en `docs/entrega.md`.

## Capabilities

### New Capabilities
_Ninguna._ Este change no agrega comportamiento observable: verifica y documenta lo que ya
existe.

### Modified Capabilities
_Ninguna._

> Este change fija `skip_specs: true` en su `.openspec.yaml`, igual que `fundacion-repo` y
> `ci-integracion-db`. No se inventa un requisito solo para satisfacer `openspec validate`.

## Impact

- **Archivos:** `docs/entrega.md` (nuevo), `README.md` y `docs/roadmap-mvp.md`.
- **Código, API, schema, dependencias y workflows:** sin cambios.
- **Dependencias con otros changes:**
  - El cierre de este change depende de que se archiven los cuatro changes activos, porque su
    verificación también tiene que figurar en `docs/entrega.md`.
  - El seed de demo queda fuera de este change hasta que se integre `plano-mesas-admin`, que
    puede cambiar las mesas del seed. Si el recorrido de punta a punta muestra que al seed le
    faltan datos, se registra y se resuelve en un change propio.
