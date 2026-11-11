## Context

Ver `proposal.md` — Why. Estado de partida (`main` en `4b24d1f`, 2026-11-05):

- Hay 19 changes archivados en `openspec/changes/archive/`, de `2026-09-07-diseno-general-app`
  a `2026-11-02-plano-mesas`, y todos tienen sus tareas marcadas.
- Hay cuatro changes activos: `despliegue-continuo-ec2`, `ip-real-detras-de-cloudflare`,
  `plano-mesas-admin` y `verificacion-version-desplegada`.
- `openspec validate --all --strict` pasa en todos los changes y specs existentes.
- Hay 103 PRs mergeados.
- `README.md` ya explica la arquitectura, el primer arranque, la red, el CI y el seed.
  No tiene una sección de decisiones, y cita una sola ruta de `openspec/` que ya no existe
  (línea 277, `exposicion-red-local`, que ahora está en `archive/`).
- `docs/roadmap-mvp.md` describe el estado al 2026-10-06.

Los primeros changes (`diseno-general-app`, `fundacion-repo`) son anteriores al CI y a la
protección de `main`, así que algunos puntos de §13 no les aplican tal como están escritos.

## Goals / Non-Goals

**Goals:**

- Que cualquiera (la docente o un integrante) pueda comprobar, change por change, cada punto de
  la Definition of Done y llegar a su evidencia en uno o dos clics.
- Que cada entregable de la consigna tenga un enlace directo a su evidencia.
- Que el README y el roadmap describan el estado real del proyecto al entregar.

**Non-Goals:**

- Corregir código, specs o tests. Un desvío que lo requiera se resuelve en su propio change.
- Medir el reparto del trabajo entre integrantes: lo muestra el historial de GitHub y no lo
  tiene que interpretar el propio equipo.
- Preparar el seed de demo (ver `proposal.md` — Impact).

## Decisions

### D1. La verificación vive en `docs/entrega.md`, no en el README

El README es para quien quiere entender y ejecutar el sistema; una tabla de unos 20 changes por
11 puntos lo vuelve difícil de leer. `docs/entrega.md` tiene una sección por change y el README
lo enlaza desde una línea.

*Alternativa descartada:* un `checklist.md` dentro de cada change archivado. Obliga a editar
los archivados (ver D4), y la evidencia queda repartida en 19 lugares.

### D2. Tres valores por punto: «Cumple», «No aplica» y «Desvío»

- **Cumple:** con su evidencia (número de PR, run de CI, ruta del archivo).
- **No aplica:** con el motivo en una línea. Por ejemplo, «Si tocó el schema» en un change que
  no toca `schema.prisma`, o «CI en verde» en un change anterior a `fundacion-repo`.
- **Desvío:** el punto aplica y no se cumplió. Se explica qué pasó y, si se puede corregir, se
  enlaza el issue que lo sigue. Un desvío no se esconde ni se reescribe como «No aplica».

### D3. La evidencia se junta a mano con `gh` y `git`, sin un script versionado

Para cada change se identifican sus PRs (spec, implementación y archivo) por la rama y el
título, y se consulta:

- autor, aprobaciones (`gh api .../pulls/<n>/reviews`) y que la aprobación sea de alguien
  distinto del autor;
- el estado de los checks del último commit antes del merge;
- los archivos que tocó (`schema.prisma` y `migrations/`, `openapi/openapi.yaml`,
  `.env.example`, tests).

Los comandos usados quedan en un apéndice de `docs/entrega.md`, para que la verificación se
pueda repetir.

*Alternativa descartada:* un script en `scripts/` que arme la tabla. Se corre una sola vez, y
§9 pediría tests para él. Además, varios puntos («PR en español», «hay tests para las reglas
que toca») necesitan criterio y no se pueden decidir automáticamente.

### D4. No se editan los changes archivados

Un archivado registra lo que se decidió en su momento. Si su `tasks.md` o su `design.md` dicen
algo que después cambió, el desvío o la aclaración se anota en `docs/entrega.md`, que es lo que
se lee al entregar.

### D5. «Decisiones de diseño» en el README: una línea por decisión y un enlace

La sección resume las decisiones que explican cómo está hecho el sistema (contrato OpenAPI
contract-first, asignación de mesas, concurrencia en las reservas, autenticación, límites de
solicitudes, manejo de fechas, despliegue). Cada una tiene una o dos líneas y enlaza al
`design.md` archivado que la justifica. No copia el razonamiento: si se copia, las dos versiones
terminan diciendo cosas distintas.

Una decisión cuyo change sigue activo al abrir el primer PR (el despliegue, de
`despliegue-continuo-ec2`) enlaza la ruta activa, `openspec/changes/<change>/design.md`. Cuando
ese change se archiva, el segundo PR (D7) actualiza el enlace a `archive/`.

### D6. El roadmap se actualiza, no se reescribe

Se reemplaza la sección de estado por el estado a la fecha de la entrega, y las secciones de
planificación (fases, reparto, riesgos) quedan marcadas como históricas. Su contenido no se
toca, porque documenta cómo se planificó el trabajo.

### D7. Dos PRs de implementación

1. El primero verifica los 19 archivados, suma la sección de entregables, corrige el README y
   el roadmap, y registra el recorrido de punta a punta.
2. El segundo, cuando se archiven los changes activos (los cuatro del principio, más
   `seed-datos-demo` y `reserva-nota-cliente`, que se sumaron el 2026-11-11), suma su verificación y archiva
   `entrega-final`.

Así lo verificable no espera a los changes que dependen del servidor de producción (FedeWerk)
o que están en curso (`plano-mesas-admin`).

## Risks / Trade-offs

- [Un punto que requiere criterio, como «hay tests para las reglas de negocio que toca», se
  marca distinto según quién lo revise] → Se anota en una línea qué tests lo cubren, y el PR
  pide la revisión de otro integrante, como cualquier otro.
- [Los changes activos no se archivan antes de la entrega] → `docs/entrega.md` los lista
  como «en curso» con su estado de tareas, y se entrega igual. El archivo de `entrega-final`
  queda para después.
- [La verificación encuentra un desvío grande cerca de la entrega] → Se registra igual. Que lo
  corrija un change propio o quede documentado lo decide el equipo, no este change.
