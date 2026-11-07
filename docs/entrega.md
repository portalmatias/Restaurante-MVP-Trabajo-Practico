# Entrega final

Este documento muestra, change por change, que se cumplió la Definition of Done
([`openspec/config.yaml`](../openspec/config.yaml) §13) y enlaza cada entregable de la consigna
con su evidencia. Lo arma el change [`entrega-final`](../openspec/changes/entrega-final/).

## Cómo leer las tablas

Cada change archivado tiene una tabla con los 11 puntos de §13. Cada punto tiene uno de tres
valores:

- **Cumple:** con su evidencia (número de PR, run de CI o ruta del archivo).
- **No aplica:** con el motivo en una línea. Por ejemplo, «Migración de Prisma» en un change que
  no toca `schema.prisma`, o «CI en verde» en un change anterior al CI.
- **Desvío:** el punto aplica y no se cumplió. Se explica qué pasó y, si se puede corregir, se
  enlaza el issue que lo sigue.

Los changes archivados no se editan: si su `tasks.md` o su `design.md` dicen algo que después
cambió, la aclaración queda acá.

## Entregables de la consigna

Comprobado el 2026-11-07 sobre `main` en `5c70958`.

| Entregable | Evidencia |
|---|---|
| Repositorio con un `README.md` que explica la arquitectura y cómo ejecutar el sistema | [`README.md`](../README.md): arquitectura, decisiones de diseño, primer arranque, red, despliegue, comandos, CI y seed. |
| Especificaciones de OpenSpec completas y válidas | `npx openspec validate --all --strict`: 26 de 26 válidos. Specs vigentes en [`openspec/specs/`](../openspec/specs/) y changes archivados en [`openspec/changes/archive/`](../openspec/changes/archive/). |
| Contrato de la API válido | `npm run openapi:lint` (Spectral) sobre [`openapi/openapi.yaml`](../openapi/openapi.yaml): sin errores. |
| Historial de Pull Requests cerrados | [PRs cerrados](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pulls?q=is%3Apr+is%3Aclosed): 107 mergeados y 1 cerrado sin mergear. |
| Ejecuciones verdes de GitHub Actions | [Runs de CI en `main`](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/workflows/ci.yml?query=branch%3Amain). El último, sobre `5c70958`, en verde: [run 42131994019](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/42131994019). |
| Definition of Done de cada change | Las tablas de este documento ([Verificación por change](#verificación-por-change)). |

## Resumen de la verificación

Verificación hecha el 2026-11-07 sobre `main` en `5c70958`. De los 19 changes archivados, 14
cumplen todos los puntos que les aplican y 5 tienen desvíos. Todos son del mismo tipo:
PRs mergeados sin una aprobación registrada en GitHub.

| Change | Punto | PRs | Qué pasó |
|---|---|---|---|
| `diseno-general-app` | 1 y 10 | [#2](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/2) | Spec mergeada sin aprobación. |
| `fundacion-repo` | 1 y 10 | [#8](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/8), [#10](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/10), [#11](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/11) | Spec e implementación mergeadas sin aprobación. |
| `modelo-dominio` | 1 y 10 | [#7](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/7) | Spec mergeada sin aprobación. |
| `auth-admin` | 1 y 10 | [#9](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/9) | Spec mergeada sin aprobación. |
| `rediseno-frontend-ichigo` | 10 | [#97](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/97) | PR encadenado sobre #92, mergeado por su autor sin aprobación. |

En los PRs de septiembre (#2 a #11), el merge lo hizo siempre un integrante distinto del autor,
pero no quedó una aprobación formal en GitHub. Se mergearon entre el 2026-09-07 y el
2026-09-14, el día en que se aplicó la protección de `main` que exige una aprobación
([`roadmap-mvp.md`](roadmap-mvp.md), «Fundación y protección de main»). Dos PRs apuntaban a
otra rama y no a `main`, así que la protección no los frenaba: #11 se mergeó en la rama de #10, y
#97 en la de #92. Lussofacundo-iresm aprobó después #92 sobre un commit que ya incluía el
cambio de #97.

**No se abren issues por estos desvíos:** una aprobación no se puede registrar después del
merge. Quedan documentados acá.

### Aclaraciones

- **Tests del frontend en CI.** El CI corre los tests del frontend recién desde el commit
  `904e256` (2026-10-05). En `frontend-base`, `frontend-admin` y `frontend-cliente` el CI estaba
  en verde y los tests existen, pero el CI de ese momento no los ejecutaba. Hoy corren en cada PR.
- **Fecha de archivo.** Se usa la fecha de la carpeta de `archive/`. Varios PRs de archivo
  figuran mergeados un día después porque GitHub muestra la hora en UTC y el equipo trabaja en
  UTC-3.
- **Descripción de #35.** El primer párrafo de [#35](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/35) quedó del borrador («Implementa solo la
  parte del service…»), aunque el PR se completó después con el controller y el contrato. No
  cambia el resultado del punto 9.
- **PRs de apoyo.** Algunos changes tienen PRs de ajuste además de los de spec, implementación y
  archivo (por ejemplo #20, #21, #23, #49 y #80). Figuran en la línea de PRs de su change y
  todos tienen aprobación de un compañero.

## Verificación por change

### `diseno-general-app`

Archivado el 2026-09-07 en [`2026-09-07-diseno-general-app`](../openspec/changes/archive/2026-09-07-diseno-general-app/). PRs: spec [#2](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/2), sin implementación (change solo de diseño), archivo [#3](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/3).

| # | Punto | Valor | Evidencia o motivo |
|---|---|---|---|
| 1 | Change aprobado y `openspec validate --strict` | Desvío | [#2](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/2) se mergeó sin aprobación (solo un comentario de cubic); lo mergeó portalmatias, no el autor. `validate --all --strict` pasa (26/26). |
| 2 | Tareas de `tasks.md` completas | Cumple | 8 tareas marcadas, ninguna pendiente. |
| 3 | Migración de Prisma (si tocó el schema) | No aplica | Change de documentación, no toca `schema.prisma`. |
| 4 | `openapi/openapi.yaml` en el mismo PR (si tocó la API) | No aplica | Change de documentación, no toca la API. |
| 5 | `.env.example` (si agregó variables) | No aplica | No agrega variables de entorno. |
| 6 | Tests de las reglas de negocio que toca (§9) | No aplica | Change sin código. |
| 7 | `npm run lint` y `tsc --noEmit` en limpio | No aplica | Change sin código, anterior al CI (`be9a32a`, 2026-09-09). |
| 8 | CI en verde | No aplica | Anterior al CI; solo corrió cubic, en verde en #2 y #3. |
| 9 | PR en español, enlazado al change | Cumple | #2 y #3 en español; nombran `diseno-general-app` y su ruta. |
| 10 | Aprobado por un compañero distinto del autor | Desvío | #2 (autor FedeWerk) sin aprobación. #3 aprobado por portalmatias. |
| 11 | Mergeado a `main` y archivado | Cumple | [#3](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/3), mergeado el 2026-09-08. |

### `fundacion-repo`

Archivado el 2026-09-14 en [`2026-09-14-fundacion-repo`](../openspec/changes/archive/2026-09-14-fundacion-repo/). PRs: spec [#8](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/8), implementación [#10](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/10) y [#11](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/11) (encadenado sobre #10), archivo [#13](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/13).

| # | Punto | Valor | Evidencia o motivo |
|---|---|---|---|
| 1 | Change aprobado y `openspec validate --strict` | Desvío | [#8](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/8) se mergeó sin ninguna review; lo mergeó FedeWerk, no el autor. `validate --all --strict` pasa (26/26). |
| 2 | Tareas de `tasks.md` completas | Cumple | 20 tareas marcadas, ninguna pendiente. |
| 3 | Migración de Prisma (si tocó el schema) | No aplica | Ningún PR del change toca `schema.prisma`. |
| 4 | `openapi/openapi.yaml` en el mismo PR (si tocó la API) | Cumple | #10 crea `openapi/openapi.yaml` junto con `app.controller.ts`. |
| 5 | `.env.example` (si agregó variables) | Cumple | #10 crea `.env.example` (`DATABASE_URL`, `JWT_*`, `PORT`, `NEXT_PUBLIC_API_URL`, `THROTTLE_*`). |
| 6 | Tests de las reglas de negocio que toca (§9) | No aplica | No toca reglas de negocio; igual suma `app.controller.spec.ts`, `test/app.e2e-spec.ts` y `scripts/openapi-diff.test.mjs`. |
| 7 | `npm run lint` y `tsc --noEmit` en limpio | Cumple | «Lint y tipos» en verde en #10 ([run 34908347951](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/34908347951)) y #11 ([run 34434722533](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/34434722533)); el CI nace en #10. |
| 8 | CI en verde | Cumple | Los tres jobs en verde en #10 ([run 34908347951](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/34908347951)) y #11 ([run 34434722533](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/34434722533)). |
| 9 | PR en español, enlazado al change | Cumple | #8, #10, #11 y #13 en español; enlazan `openspec/changes/fundacion-repo`. |
| 10 | Aprobado por un compañero distinto del autor | Desvío | #8, #10 y #11 (autor portalmatias) sin aprobación; los mergeó FedeWerk. #13 aprobado por FedeWerk. |
| 11 | Mergeado a `main` y archivado | Cumple | [#13](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/13), mergeado el 2026-09-15. |

### `disponibilidad`

Archivado el 2026-09-23 en [`2026-09-23-disponibilidad`](../openspec/changes/archive/2026-09-23-disponibilidad/). PRs: spec [#19](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/19) (ajuste [#21](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/21)), implementación [#36](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/36), archivo [#39](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/39).

| # | Punto | Valor | Evidencia o motivo |
|---|---|---|---|
| 1 | Change aprobado y `openspec validate --strict` | Cumple | #19 aprobado por lussofacundo-iresm y #21 por FedeWerk (autor portalmatias). `validate --all --strict` pasa (26/26). |
| 2 | Tareas de `tasks.md` completas | Cumple | 33 tareas marcadas, ninguna pendiente. |
| 3 | Migración de Prisma (si tocó el schema) | No aplica | #36 no toca `schema.prisma`. |
| 4 | `openapi/openapi.yaml` en el mismo PR (si tocó la API) | Cumple | #36 agrega `disponibilidad.controller.ts` y actualiza `openapi/openapi.yaml`. |
| 5 | `.env.example` (si agregó variables) | No aplica | #36 no agrega variables de entorno. |
| 6 | Tests de las reglas de negocio que toca (§9) | Cumple | `reglas/evaluar-reglas.spec.ts`, `test/disponibilidad.e2e-spec.ts`, `test/disponibilidad-contexto.e2e-spec.ts`, `test/disponibilidad-lock.e2e-spec.ts`. |
| 7 | `npm run lint` y `tsc --noEmit` en limpio | Cumple | «Lint y tipos» en verde en #36 ([run 35672911451](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/35672911451)). |
| 8 | CI en verde | Cumple | Los tres jobs en verde en #36 ([run 35672911451](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/35672911451)). |
| 9 | PR en español, enlazado al change | Cumple | #36 en español; enlaza `openspec/changes/disponibilidad/`. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | #19 y #39: lussofacundo-iresm; #21 y #36: FedeWerk. |
| 11 | Mergeado a `main` y archivado | Cumple | [#39](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/39). |

### `auth-admin`

Archivado el 2026-09-28 en [`2026-09-28-auth-admin`](../openspec/changes/archive/2026-09-28-auth-admin/). PRs: spec [#9](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/9), implementación [#25](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/25) y [#33](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/33), archivo [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46).

| # | Punto | Valor | Evidencia o motivo |
|---|---|---|---|
| 1 | Change aprobado y `openspec validate --strict` | Desvío | [#9](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/9) se mergeó sin aprobación (solo un comentario de cubic); lo mergeó portalmatias, no el autor. `validate --all --strict` pasa (26/26). |
| 2 | Tareas de `tasks.md` completas | Cumple | 18 tareas marcadas, ninguna pendiente. |
| 3 | Migración de Prisma (si tocó el schema) | No aplica | Ningún PR del change toca `schema.prisma`. |
| 4 | `openapi/openapi.yaml` en el mismo PR (si tocó la API) | Cumple | `POST /auth/login` se publica en #33, al registrar `AuthModule`, y ese PR actualiza `openapi/openapi.yaml`. |
| 5 | `.env.example` (si agregó variables) | No aplica | Usa `JWT_SECRET`, `JWT_EXPIRES_IN` y `THROTTLE_*`, ya declaradas en #10. |
| 6 | Tests de las reglas de negocio que toca (§9) | Cumple | `auth.service.spec.ts`, `roles.guard.spec.ts`, `jwt.strategy.spec.ts`, `test/auth.integration-spec.ts` (#25) y `test/auth.e2e-spec.ts` (#33). |
| 7 | `npm run lint` y `tsc --noEmit` en limpio | Cumple | «Lint y tipos» en verde en #25 ([run 35289054482](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/35289054482)) y #33 ([run 35669077072](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/35669077072)). |
| 8 | CI en verde | Cumple | Los tres jobs en verde en #25 ([run 35289054482](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/35289054482)) y #33 ([run 35669077072](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/35669077072)). |
| 9 | PR en español, enlazado al change | Cumple | #9, #25, #33 y #46 en español; nombran `auth-admin`. |
| 10 | Aprobado por un compañero distinto del autor | Desvío | #9 (autor FedeWerk) sin aprobación. #25: lussofacundo-iresm; #33 y #46: portalmatias. |
| 11 | Mergeado a `main` y archivado | Cumple | [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46), mergeado el 2026-09-29. |

### `ci-integracion-db`

Archivado el 2026-09-28 en [`2026-09-28-ci-integracion-db`](../openspec/changes/archive/2026-09-28-ci-integracion-db/). PRs: spec [#26](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/26), implementación [#28](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/28), archivo [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46).

| # | Punto | Valor | Evidencia o motivo |
|---|---|---|---|
| 1 | Change aprobado y `openspec validate --strict` | Cumple | #26 aprobado por lussofacundo-iresm (autor FedeWerk). `validate --all --strict` pasa (26/26). |
| 2 | Tareas de `tasks.md` completas | Cumple | 13 tareas marcadas, ninguna pendiente. |
| 3 | Migración de Prisma (si tocó el schema) | No aplica | No toca `schema.prisma`: aplica en CI las migraciones existentes. |
| 4 | `openapi/openapi.yaml` en el mismo PR (si tocó la API) | No aplica | Solo toca el workflow y la documentación. |
| 5 | `.env.example` (si agregó variables) | No aplica | `DATABASE_URL_TEST`, `JWT_*` y `THROTTLE_*` ya estaban en `.env.example`. |
| 6 | Tests de las reglas de negocio que toca (§9) | No aplica | Solo cambia la configuración de CI; hace correr las suites de integración existentes. |
| 7 | `npm run lint` y `tsc --noEmit` en limpio | Cumple | «Lint y tipos» en verde en #28 ([run 35667486996](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/35667486996)). |
| 8 | CI en verde | Cumple | Los tres jobs en verde en #28 ([run 35667486996](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/35667486996)). |
| 9 | PR en español, enlazado al change | Cumple | #26, #28 y #46 en español; nombran `ci-integracion-db`. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | #26: lussofacundo-iresm; #28 y #46: portalmatias. |
| 11 | Mergeado a `main` y archivado | Cumple | [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46), mergeado el 2026-09-29. |

### `frontend-base`

Archivado el 2026-09-28 en [`2026-09-28-frontend-base`](../openspec/changes/archive/2026-09-28-frontend-base/). PRs: spec [#42](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/42), implementación [#43](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/43), archivo [#47](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/47).

| # | Punto | Valor | Evidencia o motivo |
|---|---|---|---|
| 1 | Change aprobado y `openspec validate --strict` | Cumple | #42 aprobado por lussofacundo-iresm (autor portalmatias). `validate --all --strict` pasa (26/26). |
| 2 | Tareas de `tasks.md` completas | Cumple | 40 tareas marcadas, ninguna pendiente. |
| 3 | Migración de Prisma (si tocó el schema) | No aplica | Change solo de frontend. |
| 4 | `openapi/openapi.yaml` en el mismo PR (si tocó la API) | No aplica | No cambia rutas; solo genera tipos del contrato (`frontend/src/lib/api/schema.d.ts`). |
| 5 | `.env.example` (si agregó variables) | No aplica | `NEXT_PUBLIC_API_URL` ya estaba en `.env.example`. |
| 6 | Tests de las reglas de negocio que toca (§9) | Cumple | `frontend/test/lib/api/client.test.ts`, `errors.test.ts`, `url-base*.test.ts`, `test/components/**`, `test/app/home.test.tsx`. |
| 7 | `npm run lint` y `tsc --noEmit` en limpio | Cumple | «Lint y tipos» (backend y frontend) en verde en #43 ([run 36482219748](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/36482219748)). |
| 8 | CI en verde | Cumple | Los tres jobs en verde en #43 ([run 36482219748](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/36482219748)). El CI todavía no corría los tests del frontend (ver aclaraciones). |
| 9 | PR en español, enlazado al change | Cumple | #43 en español; enlaza `openspec/changes/frontend-base/`. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | #42: lussofacundo-iresm; #43: FedeWerk; #47: portalmatias. |
| 11 | Mergeado a `main` y archivado | Cumple | [#47](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/47). |

### `gestion-salon`

Archivado el 2026-09-28 en [`2026-09-28-gestion-salon`](../openspec/changes/archive/2026-09-28-gestion-salon/). PRs: spec [#15](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/15) (ajuste [#20](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/20)), implementación [#24](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/24), [#27](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/27) y [#38](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/38), archivo [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46).

| # | Punto | Valor | Evidencia o motivo |
|---|---|---|---|
| 1 | Change aprobado y `openspec validate --strict` | Cumple | #15 y #20 aprobados por portalmatias (autor lussofacundo-iresm). `validate --all --strict` pasa (26/26). |
| 2 | Tareas de `tasks.md` completas | Cumple | 27 tareas marcadas, ninguna pendiente. |
| 3 | Migración de Prisma (si tocó el schema) | No aplica | Ningún PR del change toca `schema.prisma`. |
| 4 | `openapi/openapi.yaml` en el mismo PR (si tocó la API) | Cumple | Los controllers llegan en #27, que también actualiza `openapi/openapi.yaml`. |
| 5 | `.env.example` (si agregó variables) | No aplica | Usa `THROTTLE_*` y `JWT_SECRET`, ya declaradas. |
| 6 | Tests de las reglas de negocio que toca (§9) | Cumple | `zonas/mesas/horarios.service.spec.ts`, `*.controller.spec.ts`, `test/mesas.integration-spec.ts`, `test/zonas.integration-spec.ts`, `test/gestion-salon-admin.integration-spec.ts`. |
| 7 | `npm run lint` y `tsc --noEmit` en limpio | Cumple | «Lint y tipos» en verde en #24 ([run 35286814668](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/35286814668)), #27 ([run 35671121010](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/35671121010)) y #38 ([run 35797830468](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/35797830468)). |
| 8 | CI en verde | Cumple | Los tres jobs en verde en #24, #27 y #38. |
| 9 | PR en español, enlazado al change | Cumple | #24, #27 y #38 en español; citan `openspec/changes/gestion-salon/`. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | #15, #20, #24, #38 y #46: portalmatias; #27: FedeWerk. |
| 11 | Mergeado a `main` y archivado | Cumple | [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46). |

### `modelo-dominio`

Archivado el 2026-09-28 en [`2026-09-28-modelo-dominio`](../openspec/changes/archive/2026-09-28-modelo-dominio/). PRs: spec [#7](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/7), implementación [#12](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/12), archivo [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46).

| # | Punto | Valor | Evidencia o motivo |
|---|---|---|---|
| 1 | Change aprobado y `openspec validate --strict` | Desvío | [#7](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/7) se mergeó sin ninguna review; lo mergeó portalmatias, no el autor. `validate --all --strict` pasa (26/26). |
| 2 | Tareas de `tasks.md` completas | Cumple | 14 tareas marcadas, ninguna pendiente. |
| 3 | Migración de Prisma (si tocó el schema) | Cumple | #12 agrega `20260914234727_init_modelo_dominio` y `20260917003345_mesa_etiqueta_unica_y_check_configuracion`. |
| 4 | `openapi/openapi.yaml` en el mismo PR (si tocó la API) | No aplica | No agrega controllers ni rutas: solo services, Prisma y seed. |
| 5 | `.env.example` (si agregó variables) | Cumple | #12 agrega `DATABASE_URL_TEST` a `.env.example`. |
| 6 | Tests de las reglas de negocio que toca (§9) | Cumple | `test/reservas-invariantes.integration-spec.ts`, `test/indices-partial.integration-spec.ts`, `src/common/timezone.spec.ts`. |
| 7 | `npm run lint` y `tsc --noEmit` en limpio | Cumple | «Lint y tipos» en verde en #12 ([run 35283400616](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/35283400616)). |
| 8 | CI en verde | Cumple | Los tres jobs en verde en #12 ([run 35283400616](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/35283400616)). |
| 9 | PR en español, enlazado al change | Cumple | #7, #12 y #46 en español; enlazan `openspec/changes/modelo-dominio/`. |
| 10 | Aprobado por un compañero distinto del autor | Desvío | #7 (autor FedeWerk) sin aprobación. #12 y #46: portalmatias. |
| 11 | Mergeado a `main` y archivado | Cumple | [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46), mergeado el 2026-09-29. |

### `reserva-consultar`

Archivado el 2026-09-28 en [`2026-09-28-reserva-consultar`](../openspec/changes/archive/2026-09-28-reserva-consultar/). PRs: spec [#32](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/32), implementación [#35](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/35), archivo [#47](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/47).

| # | Punto | Valor | Evidencia o motivo |
|---|---|---|---|
| 1 | Change aprobado y `openspec validate --strict` | Cumple | #32 aprobado por portalmatias (autor FedeWerk). `validate --all --strict` pasa (26/26). |
| 2 | Tareas de `tasks.md` completas | Cumple | 26 tareas marcadas, ninguna pendiente. |
| 3 | Migración de Prisma (si tocó el schema) | No aplica | #35 no toca `schema.prisma`. |
| 4 | `openapi/openapi.yaml` en el mismo PR (si tocó la API) | Cumple | #35 cambia `reservas.controller.ts`, agrega `reservas-admin.controller.ts` y actualiza `openapi/openapi.yaml`. |
| 5 | `.env.example` (si agregó variables) | No aplica | Usa `THROTTLE_LIMIT`, ya declarada. |
| 6 | Tests de las reglas de negocio que toca (§9) | Cumple | `reservas-consultar.service.spec.ts`, `consultar-reserva.dto.spec.ts`, `test/reserva-consultar*.e2e-spec.ts`, `test/reservas-admin-guards-aislado.integration-spec.ts`. |
| 7 | `npm run lint` y `tsc --noEmit` en limpio | Cumple | «Lint y tipos» en verde en #35 ([run 36502984329](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/36502984329)). |
| 8 | CI en verde | Cumple | Los tres jobs en verde en #35 ([run 36502984329](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/36502984329)). |
| 9 | PR en español, enlazado al change | Cumple | #35 en español; nombra `reserva-consultar` y la spec #32. Su primer párrafo quedó del borrador (ver aclaraciones). |
| 10 | Aprobado por un compañero distinto del autor | Cumple | #32, #35 y #47: portalmatias. |
| 11 | Mergeado a `main` y archivado | Cumple | [#47](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/47). |

### `reservas-crear`

Archivado el 2026-09-28 en [`2026-09-28-reservas-crear`](../openspec/changes/archive/2026-09-28-reservas-crear/). PRs: spec [#22](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/22), implementación [#40](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/40), archivo [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46).

| # | Punto | Valor | Evidencia o motivo |
|---|---|---|---|
| 1 | Change aprobado y `openspec validate --strict` | Cumple | #22 aprobado por FedeWerk (autor portalmatias). `validate --all --strict` pasa (26/26). |
| 2 | Tareas de `tasks.md` completas | Cumple | 33 tareas marcadas, ninguna pendiente. |
| 3 | Migración de Prisma (si tocó el schema) | No aplica | #40 no toca `schema.prisma`. |
| 4 | `openapi/openapi.yaml` en el mismo PR (si tocó la API) | Cumple | #40 agrega `reservas.controller.ts` y actualiza `openapi/openapi.yaml`. |
| 5 | `.env.example` (si agregó variables) | No aplica | #40 no agrega variables de entorno. |
| 6 | Tests de las reglas de negocio que toca (§9) | Cumple | `elegir-mesa-best-fit.spec.ts`, `test/reservas-crear.e2e-spec.ts`, `test/reservas-concurrencia.integration-spec.ts`, `test/reservas-invariantes.integration-spec.ts`. |
| 7 | `npm run lint` y `tsc --noEmit` en limpio | Cumple | «Lint y tipos» en verde en #40 ([run 35919679551](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/35919679551)). |
| 8 | CI en verde | Cumple | Los tres jobs en verde en #40 ([run 35919679551](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/35919679551)). |
| 9 | PR en español, enlazado al change | Cumple | #40 en español; enlaza `openspec/changes/reservas-crear/`. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | #22 y #40: FedeWerk; #46: portalmatias. |
| 11 | Mergeado a `main` y archivado | Cumple | [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46). |

### `catalogo-publico`

Archivado el 2026-09-29 en [`2026-09-29-catalogo-publico`](../openspec/changes/archive/2026-09-29-catalogo-publico/). PRs: spec [#44](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/44), implementación [#51](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/51), archivo [#55](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/55).

| # | Punto | Valor | Evidencia o motivo |
|---|---|---|---|
| 1 | Change aprobado y `openspec validate --strict` | Cumple | #44 aprobado por FedeWerk (autor portalmatias). `validate --all --strict` pasa (26/26). |
| 2 | Tareas de `tasks.md` completas | Cumple | 22 tareas marcadas, ninguna pendiente. |
| 3 | Migración de Prisma (si tocó el schema) | No aplica | Ningún PR del change toca `schema.prisma`. |
| 4 | `openapi/openapi.yaml` en el mismo PR (si tocó la API) | Cumple | #51 agrega `GET /zonas` y `GET /turnos` y actualiza `openapi/openapi.yaml`. |
| 5 | `.env.example` (si agregó variables) | No aplica | No agrega variables de entorno. |
| 6 | Tests de las reglas de negocio que toca (§9) | Cumple | `zonas.service.spec.ts`, `horarios.service.spec.ts`, `zonas-publicas.e2e-spec.ts`, `turnos-publicos.e2e-spec.ts`, `catalogo-publico-regresion.e2e-spec.ts`. |
| 7 | `npm run lint` y `tsc --noEmit` en limpio | Cumple | «Lint y tipos» en verde en #51 ([run 36632962485](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/36632962485)). |
| 8 | CI en verde | Cumple | Todos los checks en verde en #51 ([run 36632962485](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/36632962485)). |
| 9 | PR en español, enlazado al change | Cumple | #44 y #51 en español; enlazan `openspec/changes/catalogo-publico/`. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | #44: FedeWerk; #51 y #55: lussofacundo-iresm. |
| 11 | Mergeado a `main` y archivado | Cumple | [#55](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/55). |

### `cancelacion-turnos`

Archivado el 2026-09-30 en [`2026-09-30-cancelacion-turnos`](../openspec/changes/archive/2026-09-30-cancelacion-turnos/). PRs: spec [#16](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/16) (ajustes [#23](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/23) y [#49](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/49)), implementación [#50](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/50), archivo [#59](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/59).

| # | Punto | Valor | Evidencia o motivo |
|---|---|---|---|
| 1 | Change aprobado y `openspec validate --strict` | Cumple | #16 aprobado por portalmatias y #23 por FedeWerk. `validate --all --strict` pasa (26/26). |
| 2 | Tareas de `tasks.md` completas | Cumple | 22 tareas marcadas, ninguna pendiente. |
| 3 | Migración de Prisma (si tocó el schema) | No aplica | No toca `schema.prisma`; reutiliza `Reserva` y `EstadoReserva`. |
| 4 | `openapi/openapi.yaml` en el mismo PR (si tocó la API) | Cumple | #50 agrega `POST /reservas/:codigo/cancelar` y `PATCH /admin/reservas/:id/no-show` y actualiza `openapi/openapi.yaml`. |
| 5 | `.env.example` (si agregó variables) | No aplica | `THROTTLE_LIMIT` ya estaba declarada. |
| 6 | Tests de las reglas de negocio que toca (§9) | Cumple | `reservas-cancelar.service.spec.ts`, `reservas-no-show.service.spec.ts`, `cancelacion-turnos.e2e-spec.ts`. |
| 7 | `npm run lint` y `tsc --noEmit` en limpio | Cumple | «Lint y tipos» en verde en #50 ([run 36630744116](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/36630744116)). |
| 8 | CI en verde | Cumple | Todos los checks en verde en #50 ([run 36630744116](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/36630744116)). |
| 9 | PR en español, enlazado al change | Cumple | Descripciones en español que nombran `cancelacion-turnos`. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | #16, #49, #50 y #59: portalmatias; #23: FedeWerk. |
| 11 | Mergeado a `main` y archivado | Cumple | [#59](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/59). |

### `reserva-vip`

Archivado el 2026-09-30 en [`2026-09-30-reserva-vip`](../openspec/changes/archive/2026-09-30-reserva-vip/). PRs: spec [#17](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/17) (ajuste [#49](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/49)), implementación [#56](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/56), archivo [#59](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/59).

| # | Punto | Valor | Evidencia o motivo |
|---|---|---|---|
| 1 | Change aprobado y `openspec validate --strict` | Cumple | #17 aprobado por portalmatias (autor lussofacundo-iresm). `validate --all --strict` pasa (26/26). |
| 2 | Tareas de `tasks.md` completas | Cumple | 13 tareas marcadas, ninguna pendiente. |
| 3 | Migración de Prisma (si tocó el schema) | No aplica | No toca `schema.prisma`. |
| 4 | `openapi/openapi.yaml` en el mismo PR (si tocó la API) | Cumple | #56 agrega `PATCH /admin/reservas/:id/confirmar` y `/rechazar` y actualiza `openapi/openapi.yaml`. |
| 5 | `.env.example` (si agregó variables) | No aplica | No agrega variables de entorno. |
| 6 | Tests de las reglas de negocio que toca (§9) | Cumple | `reservas-vip.service.spec.ts`, `reserva-vip.e2e-spec.ts`. |
| 7 | `npm run lint` y `tsc --noEmit` en limpio | Cumple | «Lint y tipos» en verde en #56 ([run 36650619498](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/36650619498)). |
| 8 | CI en verde | Cumple | Todos los checks en verde en #56 ([run 36650619498](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/36650619498)). |
| 9 | PR en español, enlazado al change | Cumple | Descripciones en español que nombran `reserva-vip`. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | #17, #49, #56 y #59: portalmatias. |
| 11 | Mergeado a `main` y archivado | Cumple | [#59](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/59). |

### `frontend-admin`

Archivado el 2026-10-01 en [`2026-10-01-frontend-admin`](../openspec/changes/archive/2026-10-01-frontend-admin/). PRs: spec [#48](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/48), implementación [#58](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/58), archivo [#64](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/64).

| # | Punto | Valor | Evidencia o motivo |
|---|---|---|---|
| 1 | Change aprobado y `openspec validate --strict` | Cumple | #48 aprobado por portalmatias (autor FedeWerk). `validate --all --strict` pasa (26/26). |
| 2 | Tareas de `tasks.md` completas | Cumple | 38 tareas marcadas, ninguna pendiente. |
| 3 | Migración de Prisma (si tocó el schema) | No aplica | Change solo de frontend. |
| 4 | `openapi/openapi.yaml` en el mismo PR (si tocó la API) | No aplica | Consume endpoints existentes; no cambia rutas del backend. |
| 5 | `.env.example` (si agregó variables) | No aplica | Usa `NEXT_PUBLIC_API_URL`, ya declarada. |
| 6 | Tests de las reglas de negocio que toca (§9) | Cumple | Nueve archivos en `frontend/test/`, entre ellos `lib/aforo/calcular-aforo.test.ts`, `lib/auth/session.test.ts` y `lib/api/admin-client.test.ts`. |
| 7 | `npm run lint` y `tsc --noEmit` en limpio | Cumple | «Lint y tipos» en verde en #58 ([run 36925688249](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/36925688249)). |
| 8 | CI en verde | Cumple | Todos los checks en verde en #58 ([run 36925688249](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/36925688249)). El CI todavía no corría los tests del frontend (ver aclaraciones). |
| 9 | PR en español, enlazado al change | Cumple | #48 y #58 en español; enlazan `openspec/changes/frontend-admin/`. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | #48, #58 y #64: portalmatias. |
| 11 | Mergeado a `main` y archivado | Cumple | [#64](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/64). |

### `exposicion-red-local`

Archivado el 2026-10-05 en [`2026-10-05-exposicion-red-local`](../openspec/changes/archive/2026-10-05-exposicion-red-local/). PRs: spec [#62](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/62), implementación [#68](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/68), archivo [#69](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/69).

| # | Punto | Valor | Evidencia o motivo |
|---|---|---|---|
| 1 | Change aprobado y `openspec validate --strict` | Cumple | #62 aprobado por portalmatias y lussofacundo-iresm (autor FedeWerk). `validate --all --strict` pasa (26/26). |
| 2 | Tareas de `tasks.md` completas | Cumple | 19 tareas marcadas, ninguna pendiente. |
| 3 | Migración de Prisma (si tocó el schema) | No aplica | No toca `schema.prisma`. |
| 4 | `openapi/openapi.yaml` en el mismo PR (si tocó la API) | No aplica | Cambia dónde escucha el servidor y `TRUST_PROXY`; no cambia rutas ni contrato. |
| 5 | `.env.example` (si agregó variables) | Cumple | #68 agrega `HOST` y `TRUST_PROXY` y los documenta en `.env.example`. |
| 6 | Tests de las reglas de negocio que toca (§9) | Cumple | `backend/src/configurar-red.spec.ts`, `backend/test/exposicion-red.e2e-spec.ts`. |
| 7 | `npm run lint` y `tsc --noEmit` en limpio | Cumple | «Lint y tipos» en verde en #68 ([run 36931312324](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/36931312324)). |
| 8 | CI en verde | Cumple | Todos los checks en verde en #68 ([run 36931312324](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/36931312324)). |
| 9 | PR en español, enlazado al change | Cumple | #62 y #68 en español; enlazan `openspec/changes/exposicion-red-local/`. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | #62: portalmatias y lussofacundo-iresm; #68: portalmatias; #69 (autor portalmatias): FedeWerk. |
| 11 | Mergeado a `main` y archivado | Cumple | [#69](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/69), mergeado el 2026-10-06. |

### `throttle-rutas-admin`

Archivado el 2026-10-05 en [`2026-10-05-throttle-rutas-admin`](../openspec/changes/archive/2026-10-05-throttle-rutas-admin/). PRs: spec [#60](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/60), implementación [#66](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/66), archivo [#70](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/70).

| # | Punto | Valor | Evidencia o motivo |
|---|---|---|---|
| 1 | Change aprobado y `openspec validate --strict` | Cumple | #60 aprobado por portalmatias (autor FedeWerk). `validate --all --strict` pasa (26/26). |
| 2 | Tareas de `tasks.md` completas | Cumple | 13 tareas marcadas, ninguna pendiente. |
| 3 | Migración de Prisma (si tocó el schema) | No aplica | No toca `schema.prisma`. |
| 4 | `openapi/openapi.yaml` en el mismo PR (si tocó la API) | Cumple | #66 modifica los controllers de admin y `openapi/openapi.yaml` en el mismo PR. |
| 5 | `.env.example` (si agregó variables) | No aplica | `THROTTLE_LIMIT` ya estaba declarada. |
| 6 | Tests de las reglas de negocio que toca (§9) | Cumple | `backend/test/throttle-rutas-admin.e2e-spec.ts`. |
| 7 | `npm run lint` y `tsc --noEmit` en limpio | Cumple | «Lint y tipos» en verde en #66 ([run 36928650693](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/36928650693)). |
| 8 | CI en verde | Cumple | Todos los checks en verde en #66 ([run 36928650693](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/36928650693)). |
| 9 | PR en español, enlazado al change | Cumple | #60 y #66 en español; enlazan `openspec/changes/throttle-rutas-admin/`. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | #60 y #66: portalmatias; #70 (autor portalmatias): FedeWerk. |
| 11 | Mergeado a `main` y archivado | Cumple | [#70](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/70), mergeado el 2026-10-06. |

### `frontend-cliente`

Archivado el 2026-10-26 en [`2026-10-26-frontend-cliente`](../openspec/changes/archive/2026-10-26-frontend-cliente/). PRs: spec [#45](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/45), implementación [#52](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/52), [#53](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/53), [#54](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/54), [#57](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/57), [#61](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/61) y [#67](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/67), cierre de la verificación [#80](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/80), archivo [#84](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/84).

| # | Punto | Valor | Evidencia o motivo |
|---|---|---|---|
| 1 | Change aprobado y `openspec validate --strict` | Cumple | #45 aprobado por FedeWerk (autor portalmatias). `validate --all --strict` pasa (26/26). |
| 2 | Tareas de `tasks.md` completas | Cumple | 53 tareas marcadas, ninguna pendiente. |
| 3 | Migración de Prisma (si tocó el schema) | No aplica | Ningún PR del change toca `schema.prisma`. |
| 4 | `openapi/openapi.yaml` en el mismo PR (si tocó la API) | No aplica | Solo frontend; usa endpoints existentes. |
| 5 | `.env.example` (si agregó variables) | No aplica | No agrega variables (el `TZ` de #52 se fija solo en la configuración de Jest). |
| 6 | Tests de las reglas de negocio que toca (§9) | Cumple | `frontend/test/lib/ventana-cancelacion.test.ts`, `fecha-hora.test.ts`, `seleccion-reserva.test.ts`, `components/reservas/confirmar-cancelacion.test.tsx`, entre otros. |
| 7 | `npm run lint` y `tsc --noEmit` en limpio | Cumple | «Lint y tipos» en verde en los seis PRs de implementación (por ejemplo, [run 37388279141](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/37388279141)). |
| 8 | CI en verde | Cumple | Todos los checks en verde en los seis PRs. El CI todavía no corría los tests del frontend (ver aclaraciones). |
| 9 | PR en español, enlazado al change | Cumple | Todos en español; enlazan `openspec/changes/frontend-cliente/`. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | #45, #57, #61, #67 y #84: FedeWerk; #52, #53 y #54: lussofacundo-iresm; #80: FedeWerk y lussofacundo-iresm. |
| 11 | Mergeado a `main` y archivado | Cumple | [#84](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/84), mergeado el 2026-10-26. |

### `rediseno-frontend-ichigo`

Archivado el 2026-10-28 en [`2026-10-28-rediseno-frontend-ichigo`](../openspec/changes/archive/2026-10-28-rediseno-frontend-ichigo/). PRs: spec [#77](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/77) (ajuste [#81](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/81)), implementación [#78](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/78), archivo [#92](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/92) (con [#97](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/97) encadenado sobre su rama).

| # | Punto | Valor | Evidencia o motivo |
|---|---|---|---|
| 1 | Change aprobado y `openspec validate --strict` | Cumple | #77 aprobado por lussofacundo-iresm y #81 por portalmatias (autor FedeWerk). `validate --all --strict` pasa (26/26). |
| 2 | Tareas de `tasks.md` completas | Cumple | 47 tareas marcadas, ninguna pendiente; las últimas se cerraron en #92. |
| 3 | Migración de Prisma (si tocó el schema) | No aplica | Ningún PR del change toca `schema.prisma`. |
| 4 | `openapi/openapi.yaml` en el mismo PR (si tocó la API) | No aplica | Rediseño visual, sin cambios en la API. |
| 5 | `.env.example` (si agregó variables) | No aplica | No agrega variables de entorno. |
| 6 | Tests de las reglas de negocio que toca (§9) | Cumple | `frontend/test/components/ui/tablilla.test.tsx`, `calendario.test.tsx`, `app/globals-contrastes.test.ts`, `components/admin/nivel-aforo.test.ts`, entre otros. |
| 7 | `npm run lint` y `tsc --noEmit` en limpio | Cumple | «Lint y tipos» en verde en #78 ([run 40601850815](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/40601850815)). |
| 8 | CI en verde | Cumple | Todos los checks en verde en #78, incluidos los tests del frontend, y en #92 ([run 41545506364](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/41545506364)). |
| 9 | PR en español, enlazado al change | Cumple | #77, #78, #81 y #92 en español; enlazan `openspec/changes/rediseno-frontend-ichigo/`. |
| 10 | Aprobado por un compañero distinto del autor | Desvío | [#97](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/97), encadenado sobre #92, lo mergeó FedeWerk, su autor, sin aprobación. Después lussofacundo-iresm aprobó #92 sobre un commit que ya lo incluía. El resto: #77 y #92 lussofacundo-iresm; #78 y #81 portalmatias. |
| 11 | Mergeado a `main` y archivado | Cumple | [#92](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/92), mergeado el 2026-11-02. |

### `plano-mesas`

Archivado el 2026-11-02 en [`2026-11-02-plano-mesas`](../openspec/changes/archive/2026-11-02-plano-mesas/). PRs: spec [#76](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/76), implementación [#86](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/86) y [#89](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/89), archivo [#104](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/104).

| # | Punto | Valor | Evidencia o motivo |
|---|---|---|---|
| 1 | Change aprobado y `openspec validate --strict` | Cumple | #76 aprobado por lussofacundo-iresm y portalmatias (autor FedeWerk). `validate --all --strict` pasa (26/26). |
| 2 | Tareas de `tasks.md` completas | Cumple | 38 tareas marcadas, ninguna pendiente. |
| 3 | Migración de Prisma (si tocó el schema) | Cumple | #86 agrega `backend/prisma/migrations/20261026161439_plano_mesas/migration.sql`. |
| 4 | `openapi/openapi.yaml` en el mismo PR (si tocó la API) | Cumple | #86 agrega `GET /plano-mesas` y actualiza `openapi/openapi.yaml`. |
| 5 | `.env.example` (si agregó variables) | No aplica | No agrega variables de entorno. |
| 6 | Tests de las reglas de negocio que toca (§9) | Cumple | `backend/src/plano-mesas/estado-mesa.spec.ts`, `layout-plano.spec.ts`, `backend/test/plano-mesas.e2e-spec.ts`, `plano-mesas.integration-spec.ts`, `frontend/test/components/reservas/plano-mesas.test.tsx`. |
| 7 | `npm run lint` y `tsc --noEmit` en limpio | Cumple | «Lint y tipos» en verde en #86 ([run 40417725782](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/40417725782)) y #89 ([run 41547081090](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/41547081090)). |
| 8 | CI en verde | Cumple | Todos los checks en verde en #86 y #89. |
| 9 | PR en español, enlazado al change | Cumple | #86 y #89 en español; enlazan `openspec/changes/plano-mesas/`. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | #76: lussofacundo-iresm y portalmatias; #86: FedeWerk; #89 y #104: lussofacundo-iresm. |
| 11 | Mergeado a `main` y archivado | Cumple | [#104](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/104). |

## Changes en curso

Se suman a la verificación a medida que se archivan.

- `despliegue-continuo-ec2`
- `ip-real-detras-de-cloudflare`
- `plano-mesas-admin`
- `verificacion-version-desplegada`

## Recorrido de punta a punta

Flujo de [`roadmap-mvp.md`](roadmap-mvp.md) §13 («Fase 5 y cierre»), recorrido desde el
frontend el 2026-11-07 a las 19:30 (sábado), con `main` en `5c70958`. Se usó la base local migrada
y seedeada (`npm run db:seed -w backend`), y `npm run dev`. Los pasos se ejecutaron con
Playwright contra `http://127.0.0.1:3000`, con un script local que no se versiona.

| # | Paso | Resultado |
|---|---|---|
| 1 | Consultar disponibilidad: martes 10/11, 20:00 a 23:30, STANDARD | Cumple. «¡Hay lugar!», 40 lugares restantes y plano con 3 mesas libres y 2 que no alcanzan. |
| 2 | Reservar STANDARD (4 comensales) | Cumple. «Tu reserva está confirmada», código `4Q4EYQZ5` (8 caracteres). |
| 3 | Reservar VIP: miércoles 11/11, 20:00 a 23:30, 4 comensales | Cumple. «Tu reserva está pendiente de confirmación», código `KN3RKCG5`. |
| 4 | Consultar con código y email | Cumple. Muestra la reserva confirmada con su resumen. |
| 5 | Consultar con el código y otro email | Cumple. No muestra la reserva: «No encontramos una reserva con esos datos. Revisá el código y el email.» |
| 6 | Cancelar dentro de la ventana | Cumple. Diálogo de confirmación y después «Tu reserva fue cancelada.» |
| 7 | Cancelar fuera de la ventana | No se pudo probar con el seed: en las dos zonas la anticipación mínima es igual a la ventana, así que una reserva recién creada siempre se puede cancelar. Ver [#111](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/issues/111). |
| 8 | Admin: confirmar la VIP | Cumple. Login con el admin del seed; `KN3RKCG5` pasa de «Pendiente» a «Confirmada». |
| 9 | Admin: marcar NO_SHOW en una reserva de un turno ya pasado | No se pudo probar con el seed: la única reserva pasada (`SEEDNSW2`) ya está en NO_SHOW. Ver [#111](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/issues/111). Se probó el caso contrario: marcar ausente la VIP del 11/11 se rechaza con «No se puede marcar NO_SHOW antes de que termine el turno.» |
| 10 | El aforo del dashboard no cuenta CANCELADA ni NO_SHOW | Cumple. 10/11 20:00: 0/40 en STANDARD tras cancelar la reserva de 4. 6/1 12:00: 0 con `SEEDNSW2` (5 comensales, NO_SHOW). 11/11 20:00: 4/20 en VIP, con la reserva confirmada. |

Las reglas de los pasos 7 y 9 están cubiertas por tests (`reservas-cancelar.service.spec.ts`,
`reservas-no-show.service.spec.ts` y `cancelacion-turnos.e2e-spec.ts`); lo que falta es un dato
del seed para mostrarlas a mano.

## Apéndice: comandos usados

La evidencia se juntó a mano con `gh` y `git`, sin un script versionado
([`design.md`](../openspec/changes/entrega-final/design.md), D3). Para repetirla:

```bash
# PRs de un change, por rama y título
gh pr list --state merged --limit 300 --search "<change> in:title"

# Autor, aprobaciones y base de un PR
gh pr view <n> --json author,reviews,baseRefName,mergedAt,body
# --paginate: sin él la API devuelve solo las primeras 30 reviews
gh api --paginate repos/portalmatias/Restaurante-MVP-Trabajo-Practico/pulls/<n>/reviews

# Estado de los checks del último commit del PR
gh pr checks <n>

# Archivos que tocó un PR (schema, migraciones, OpenAPI, .env.example, tests)
gh pr diff <n> --name-only

# Tareas pendientes de un change archivado
# (solo las líneas que empiezan con la casilla; algunas tareas citan «- [ ]» en su texto)
grep -cE '^\s*- \[ \]' openspec/changes/archive/<fecha>-<change>/tasks.md

# Validación de specs y contrato
npx openspec validate --all --strict
npm run openapi:lint
```
