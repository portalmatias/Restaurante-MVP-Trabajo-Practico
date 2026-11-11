# Entrega final

Verificación de la entrega del Trabajo Práctico: los entregables que pide la consigna y la
Definition of Done (`openspec/config.yaml` §13) de cada change archivado, con su evidencia. Es la
implementación del change [`entrega-final`](../openspec/changes/entrega-final/).

La Definition of Done de los changes archivados se verificó el 2026-11-09 sobre `main` en
`5c70958`. Los entregables y el recorrido de punta a punta, el 2026-11-11 sobre `main` en
`5dd778d`.

## Cómo leer este documento

Cada punto de la Definition of Done tiene uno de tres valores (D2 de `entrega-final`):

- **Cumple:** con su evidencia (PR, run de CI o archivo).
- **No aplica:** el punto no corresponde a ese change, con el motivo.
- **Desvío:** el punto aplica y no se cumplió. Se explica qué pasó y si se puede corregir.

Los changes que todavía están activos (`despliegue-continuo-ec2`, `ip-real-detras-de-cloudflare`,
`plano-mesas-admin`, `reserva-nota-cliente`, `seed-datos-demo` y `verificacion-version-desplegada`)
se suman cuando se archiven (tarea 7.2).

## Entregables de la consigna

| Entregable | Evidencia |
|---|---|
| URL del repositorio, con un `README.md` que explique la arquitectura y cómo ejecutarlo | https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico. El [`README.md`](../README.md) explica la arquitectura («Arquitectura»), el primer arranque, los comandos y las [decisiones de diseño](../README.md#decisiones-de-diseño). |
| Especificaciones de OpenSpec completas y válidas | `npx openspec validate --all --strict`: 28 de 28 válidos (los changes activos y las specs de `openspec/specs/`; los archivados ya están fundidos en ellas). `npm run openapi:lint`: sin errores en `openapi/openapi.yaml`. Los dos, el 2026-11-11 sobre `main` en `5dd778d`. |
| Historial de Pull Requests cerrados | [PRs mergeados](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pulls?q=is%3Apr+is%3Amerged): 109 al 2026-11-11. |
| Ejecuciones verdes en GitHub Actions | [Runs del CI en `main`](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/workflows/ci.yml?query=branch%3Amain). El run de `5dd778d` terminó en verde ([43100362411](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/actions/runs/43100362411)). El CI bloquea el merge de un PR si falla la validación de OpenSpec, el lint o los tests (`openspec/config.yaml` §12). |

## Resumen

| Change | Archivado | Cumple | No aplica | Desvío |
|---|---|---|---|---|
| [`diseno-general-app`](#diseno-general-app) | 2026-09-07 | 3 | 6 | 2 |
| [`fundacion-repo`](#fundacion-repo) | 2026-09-14 | 7 | 2 | 2 |
| [`disponibilidad`](#disponibilidad) | 2026-09-23 | 9 | 2 | 0 |
| [`auth-admin`](#auth-admin) | 2026-09-28 | 7 | 2 | 2 |
| [`ci-integracion-db`](#ci-integracion-db) | 2026-09-28 | 7 | 4 | 0 |
| [`frontend-base`](#frontend-base) | 2026-09-28 | 8 | 3 | 0 |
| [`gestion-salon`](#gestion-salon) | 2026-09-28 | 9 | 2 | 0 |
| [`modelo-dominio`](#modelo-dominio) | 2026-09-28 | 8 | 1 | 2 |
| [`reserva-consultar`](#reserva-consultar) | 2026-09-28 | 9 | 2 | 0 |
| [`reservas-crear`](#reservas-crear) | 2026-09-28 | 9 | 2 | 0 |
| [`catalogo-publico`](#catalogo-publico) | 2026-09-29 | 9 | 2 | 0 |
| [`cancelacion-turnos`](#cancelacion-turnos) | 2026-09-30 | 9 | 2 | 0 |
| [`reserva-vip`](#reserva-vip) | 2026-09-30 | 9 | 2 | 0 |
| [`frontend-admin`](#frontend-admin) | 2026-10-01 | 8 | 3 | 0 |
| [`exposicion-red-local`](#exposicion-red-local) | 2026-10-05 | 9 | 2 | 0 |
| [`throttle-rutas-admin`](#throttle-rutas-admin) | 2026-10-05 | 9 | 2 | 0 |
| [`frontend-cliente`](#frontend-cliente) | 2026-10-26 | 8 | 3 | 0 |
| [`rediseno-frontend-ichigo`](#rediseno-frontend-ichigo) | 2026-10-28 | 8 | 3 | 0 |
| [`plano-mesas`](#plano-mesas) | 2026-11-02 | 10 | 1 | 0 |

**15 de los 19 changes cumplen todos los puntos que les aplican.** Los otros 4 tienen el mismo
desvío: un PR mergeado a `main` sin una aprobación registrada en GitHub.

## Desvíos

| PR | Change | Qué pasó |
|---|---|---|
| [#2](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/2) | `diseno-general-app` | Spec mergeada el 2026-09-07 sin aprobación registrada. |
| [#7](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/7) | `modelo-dominio` | Spec mergeada el 2026-09-10 sin aprobación registrada. |
| [#8](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/8) | `fundacion-repo` | Spec mergeada el 2026-09-10 sin aprobación registrada. |
| [#9](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/9) | `auth-admin` | Spec mergeada el 2026-09-10 sin aprobación registrada. |
| [#10](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/10) | `fundacion-repo` | Implementación mergeada el 2026-09-14 sin aprobación registrada. |

Son PRs de las dos primeras semanas, y en todos el merge lo hizo un integrante distinto del
autor. Fuera de los changes pasó lo mismo con otros tres PRs de esos días, que no pertenecen a
ningún change: [#1](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/1) (bootstrap de OpenSpec y Claude Code),
[#5](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/5) (roadmap) y
[#6](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/6) (skill de CI y plugin compartidos). Desde
[#13](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/13) (2026-09-15), todos los PRs a `main` tienen la aprobación
de un compañero. **No se pueden corregir:** una aprobación no se puede registrar después del merge,
y reabrir esos cambios para aprobarlos de nuevo no cambiaría lo que pasó. Por eso no tienen issue y
quedan documentados acá.

Dos PRs no tienen aprobación, pero no son desvíos: [#11](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/11) se integró en la rama de
#10 y [#97](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/97) en la de #92, no en `main`. El contenido de #97 llegó a `main` con #92,
que se aprobó después de ese merge.

## Verificación por change

### `diseno-general-app`

Archivado el 2026-09-07. PRs: [#2](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/2), [#3](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/3).

| # | Punto de la Definition of Done | Valor | Evidencia |
|---|---|---|---|
| 1 | El change existe, está aprobado y `openspec validate --strict` pasa | Desvío | La spec ([#2](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/2)) se mergeó sin una aprobación registrada en GitHub. `openspec validate --all --strict` pasa (2026-11-09, `5c70958`). |
| 2 | Todas las tareas de `tasks.md` están marcadas | Cumple | 8/8 tareas marcadas en `openspec/changes/archive/2026-09-07-diseno-general-app/tasks.md`. |
| 3 | Si tocó el schema: hay migración de Prisma | No aplica | No toca `backend/prisma/schema.prisma`. |
| 4 | Si tocó la API: `openapi/openapi.yaml` actualizado en el mismo PR | No aplica | No cambia endpoints del backend. |
| 5 | Si agregó variables de entorno: `.env.example` actualizado | No aplica | No agrega variables de entorno: las que usa ya estaban en `.env.example`. |
| 6 | Hay tests para las reglas de negocio que toca | No aplica | Solo documentación de diseño; no hay código. |
| 7 | `npm run lint` y `tsc --noEmit` pasan | No aplica | Solo documentación; no hay código que lintear. |
| 8 | CI en verde | No aplica | Sus PRs ([#2](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/2), [#3](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/3)) son anteriores a que existiera el CI, que creó [#10](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/10). |
| 9 | PR con descripción en español, enlazado al change | Cumple | Todos sus PRs ([#2](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/2), [#3](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/3)) tienen título y descripción en español y nombran el change. |
| 10 | Aprobado por un compañero distinto del autor | Desvío | [#2](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/2) se mergeó sin una aprobación registrada en GitHub; lo mergeó otro integrante. No se puede corregir después del merge. El resto ([#3](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/3)) tiene aprobación de un compañero. |
| 11 | Mergeado a `main` y archivado | Cumple | Archivado en `openspec/changes/archive/2026-09-07-diseno-general-app/` con [#3](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/3). |

### `fundacion-repo`

Archivado el 2026-09-14. PRs: [#8](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/8), [#10](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/10), [#11](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/11), [#13](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/13).

| # | Punto de la Definition of Done | Valor | Evidencia |
|---|---|---|---|
| 1 | El change existe, está aprobado y `openspec validate --strict` pasa | Desvío | La spec ([#8](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/8)) se mergeó sin una aprobación registrada en GitHub. `openspec validate --all --strict` pasa (2026-11-09, `5c70958`). |
| 2 | Todas las tareas de `tasks.md` están marcadas | Cumple | 20/20 tareas marcadas en `openspec/changes/archive/2026-09-14-fundacion-repo/tasks.md`. |
| 3 | Si tocó el schema: hay migración de Prisma | No aplica | No toca `backend/prisma/schema.prisma`. |
| 4 | Si tocó la API: `openapi/openapi.yaml` actualizado en el mismo PR | Cumple | [#10](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/10) cambia controllers o DTOs y actualiza `openapi/openapi.yaml` en el mismo PR. |
| 5 | Si agregó variables de entorno: `.env.example` actualizado | Cumple | [#10](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/10) agrega `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `NEXT_PUBLIC_API_URL`, `THROTTLE_TTL` y `THROTTLE_LIMIT` (commit de [#11](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/11), integrado con [#10](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/10)) a `.env.example`. |
| 6 | Hay tests para las reglas de negocio que toca | No aplica | Crea el andamiaje del repo; no hay reglas de negocio todavía. Igual deja el test del endpoint de estado ([#10](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/10)). |
| 7 | `npm run lint` y `tsc --noEmit` pasan | Cumple | El check «Lint y tipos» quedó en verde en [#10](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/10), [#11](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/11). [#8](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/8) es anterior a que existiera el CI ([#10](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/10)) y solo trae documentación. |
| 8 | CI en verde | Cumple | Todos los checks en verde en el último commit de [#10](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/10), [#13](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/13). [#8](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/8) es anterior a que existiera el CI ([#10](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/10)) y solo trae documentación. |
| 9 | PR con descripción en español, enlazado al change | Cumple | Todos sus PRs ([#8](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/8), [#10](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/10), [#11](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/11), [#13](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/13)) tienen título y descripción en español y nombran el change. |
| 10 | Aprobado por un compañero distinto del autor | Desvío | [#8](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/8), [#10](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/10) se mergeó sin una aprobación registrada en GitHub; lo mergeó otro integrante. No se puede corregir después del merge. El resto ([#13](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/13)) tiene aprobación de un compañero. [#11](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/11) se integró en la rama de #10, no en `main`. |
| 11 | Mergeado a `main` y archivado | Cumple | Archivado en `openspec/changes/archive/2026-09-14-fundacion-repo/` con [#13](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/13). |

### `disponibilidad`

Archivado el 2026-09-23. PRs: [#19](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/19), [#21](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/21), [#36](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/36), [#39](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/39).

| # | Punto de la Definition of Done | Valor | Evidencia |
|---|---|---|---|
| 1 | El change existe, está aprobado y `openspec validate --strict` pasa | Cumple | Spec en [#19](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/19), [#21](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/21), aprobada por FedeWerk, lussofacundo-iresm. `openspec validate --all --strict` pasa (2026-11-09, `5c70958`). |
| 2 | Todas las tareas de `tasks.md` están marcadas | Cumple | 33/33 tareas marcadas en `openspec/changes/archive/2026-09-23-disponibilidad/tasks.md`. |
| 3 | Si tocó el schema: hay migración de Prisma | No aplica | No toca `backend/prisma/schema.prisma`. |
| 4 | Si tocó la API: `openapi/openapi.yaml` actualizado en el mismo PR | Cumple | [#36](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/36) cambia controllers o DTOs y actualiza `openapi/openapi.yaml` en el mismo PR. |
| 5 | Si agregó variables de entorno: `.env.example` actualizado | No aplica | No agrega variables de entorno: las que usa ya estaban en `.env.example`. |
| 6 | Hay tests para las reglas de negocio que toca | Cumple | Tests agregados en [#36](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/36). |
| 7 | `npm run lint` y `tsc --noEmit` pasan | Cumple | El check «Lint y tipos» quedó en verde en [#36](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/36). |
| 8 | CI en verde | Cumple | Todos los checks en verde en el último commit de [#19](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/19), [#21](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/21), [#36](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/36), [#39](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/39). |
| 9 | PR con descripción en español, enlazado al change | Cumple | Todos sus PRs ([#19](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/19), [#21](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/21), [#36](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/36), [#39](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/39)) tienen título y descripción en español y nombran el change. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | Cada PR a `main` ([#19](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/19), [#21](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/21), [#36](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/36), [#39](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/39)) tiene la aprobación de un compañero distinto del autor. |
| 11 | Mergeado a `main` y archivado | Cumple | Archivado en `openspec/changes/archive/2026-09-23-disponibilidad/` con [#39](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/39). |

### `auth-admin`

Archivado el 2026-09-28. PRs: [#9](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/9), [#25](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/25), [#33](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/33), [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46).

| # | Punto de la Definition of Done | Valor | Evidencia |
|---|---|---|---|
| 1 | El change existe, está aprobado y `openspec validate --strict` pasa | Desvío | La spec ([#9](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/9)) se mergeó sin una aprobación registrada en GitHub. `openspec validate --all --strict` pasa (2026-11-09, `5c70958`). |
| 2 | Todas las tareas de `tasks.md` están marcadas | Cumple | 18/18 tareas marcadas en `openspec/changes/archive/2026-09-28-auth-admin/tasks.md`. |
| 3 | Si tocó el schema: hay migración de Prisma | No aplica | No toca `backend/prisma/schema.prisma`. |
| 4 | Si tocó la API: `openapi/openapi.yaml` actualizado en el mismo PR | Cumple | [#25](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/25) agregó el controller de `/auth/login` sin registrar `AuthModule` en `AppModule`, así que el endpoint todavía no se servía y el contrato quedó en `design.md` (regla de §3: no se publican endpoints sin implementar). [#33](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/33) registró el módulo y agregó el contrato a `openapi/openapi.yaml` en el mismo PR. |
| 5 | Si agregó variables de entorno: `.env.example` actualizado | No aplica | No agrega variables de entorno: las que usa ya estaban en `.env.example`. |
| 6 | Hay tests para las reglas de negocio que toca | Cumple | Tests agregados en [#25](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/25), [#33](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/33). |
| 7 | `npm run lint` y `tsc --noEmit` pasan | Cumple | El check «Lint y tipos» quedó en verde en [#25](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/25), [#33](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/33). [#9](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/9) es anterior a que existiera el CI ([#10](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/10)) y solo trae documentación. |
| 8 | CI en verde | Cumple | Todos los checks en verde en el último commit de [#25](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/25), [#33](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/33), [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46). [#9](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/9) es anterior a que existiera el CI ([#10](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/10)) y solo trae documentación. |
| 9 | PR con descripción en español, enlazado al change | Cumple | Todos sus PRs ([#9](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/9), [#25](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/25), [#33](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/33), [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46)) tienen título y descripción en español y nombran el change. |
| 10 | Aprobado por un compañero distinto del autor | Desvío | [#9](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/9) se mergeó sin una aprobación registrada en GitHub; lo mergeó otro integrante. No se puede corregir después del merge. El resto ([#25](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/25), [#33](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/33), [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46)) tiene aprobación de un compañero. |
| 11 | Mergeado a `main` y archivado | Cumple | Archivado en `openspec/changes/archive/2026-09-28-auth-admin/` con [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46). |

### `ci-integracion-db`

Archivado el 2026-09-28. PRs: [#26](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/26), [#28](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/28), [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46).

| # | Punto de la Definition of Done | Valor | Evidencia |
|---|---|---|---|
| 1 | El change existe, está aprobado y `openspec validate --strict` pasa | Cumple | Spec en [#26](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/26), aprobada por lussofacundo-iresm. `openspec validate --all --strict` pasa (2026-11-09, `5c70958`). |
| 2 | Todas las tareas de `tasks.md` están marcadas | Cumple | 13/13 tareas marcadas en `openspec/changes/archive/2026-09-28-ci-integracion-db/tasks.md`. |
| 3 | Si tocó el schema: hay migración de Prisma | No aplica | No toca `backend/prisma/schema.prisma`. |
| 4 | Si tocó la API: `openapi/openapi.yaml` actualizado en el mismo PR | No aplica | No cambia endpoints del backend. |
| 5 | Si agregó variables de entorno: `.env.example` actualizado | No aplica | No agrega variables de entorno: las que usa ya estaban en `.env.example`. |
| 6 | Hay tests para las reglas de negocio que toca | No aplica | Cambia el workflow de CI, no reglas de negocio. Su compuerta (que un test de integración que falla deje el PR en rojo) está registrada en su `tasks.md`. |
| 7 | `npm run lint` y `tsc --noEmit` pasan | Cumple | El check «Lint y tipos» quedó en verde en [#28](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/28). |
| 8 | CI en verde | Cumple | Todos los checks en verde en el último commit de [#26](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/26), [#28](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/28), [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46). |
| 9 | PR con descripción en español, enlazado al change | Cumple | Todos sus PRs ([#26](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/26), [#28](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/28), [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46)) tienen título y descripción en español y nombran el change. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | Cada PR a `main` ([#26](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/26), [#28](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/28), [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46)) tiene la aprobación de un compañero distinto del autor. |
| 11 | Mergeado a `main` y archivado | Cumple | Archivado en `openspec/changes/archive/2026-09-28-ci-integracion-db/` con [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46). |

### `frontend-base`

Archivado el 2026-09-28. PRs: [#42](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/42), [#43](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/43), [#47](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/47).

| # | Punto de la Definition of Done | Valor | Evidencia |
|---|---|---|---|
| 1 | El change existe, está aprobado y `openspec validate --strict` pasa | Cumple | Spec en [#42](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/42), aprobada por lussofacundo-iresm. `openspec validate --all --strict` pasa (2026-11-09, `5c70958`). |
| 2 | Todas las tareas de `tasks.md` están marcadas | Cumple | 40/40 tareas marcadas en `openspec/changes/archive/2026-09-28-frontend-base/tasks.md`. |
| 3 | Si tocó el schema: hay migración de Prisma | No aplica | No toca `backend/prisma/schema.prisma`. |
| 4 | Si tocó la API: `openapi/openapi.yaml` actualizado en el mismo PR | No aplica | No cambia endpoints del backend. |
| 5 | Si agregó variables de entorno: `.env.example` actualizado | No aplica | No agrega variables de entorno: las que usa ya estaban en `.env.example`. |
| 6 | Hay tests para las reglas de negocio que toca | Cumple | Tests agregados en [#43](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/43). |
| 7 | `npm run lint` y `tsc --noEmit` pasan | Cumple | El check «Lint y tipos» quedó en verde en [#43](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/43). |
| 8 | CI en verde | Cumple | Todos los checks en verde en el último commit de [#42](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/42), [#43](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/43), [#47](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/47). |
| 9 | PR con descripción en español, enlazado al change | Cumple | Todos sus PRs ([#42](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/42), [#43](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/43), [#47](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/47)) tienen título y descripción en español y nombran el change. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | Cada PR a `main` ([#42](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/42), [#43](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/43), [#47](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/47)) tiene la aprobación de un compañero distinto del autor. |
| 11 | Mergeado a `main` y archivado | Cumple | Archivado en `openspec/changes/archive/2026-09-28-frontend-base/` con [#47](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/47). |

### `gestion-salon`

Archivado el 2026-09-28. PRs: [#15](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/15), [#20](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/20), [#24](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/24), [#27](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/27), [#38](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/38), [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46).

| # | Punto de la Definition of Done | Valor | Evidencia |
|---|---|---|---|
| 1 | El change existe, está aprobado y `openspec validate --strict` pasa | Cumple | Spec en [#15](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/15), [#20](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/20), aprobada por portalmatias. `openspec validate --all --strict` pasa (2026-11-09, `5c70958`). |
| 2 | Todas las tareas de `tasks.md` están marcadas | Cumple | 27/27 tareas marcadas en `openspec/changes/archive/2026-09-28-gestion-salon/tasks.md`. |
| 3 | Si tocó el schema: hay migración de Prisma | No aplica | No toca `backend/prisma/schema.prisma`. |
| 4 | Si tocó la API: `openapi/openapi.yaml` actualizado en el mismo PR | Cumple | [#24](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/24) implementó solo los services y sus DTOs, sin controllers ni endpoints. Los controllers entraron en [#27](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/27) junto con su contrato en `openapi/openapi.yaml`. |
| 5 | Si agregó variables de entorno: `.env.example` actualizado | No aplica | No agrega variables de entorno: las que usa ya estaban en `.env.example`. |
| 6 | Hay tests para las reglas de negocio que toca | Cumple | Tests agregados en [#24](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/24), [#27](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/27), [#38](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/38). |
| 7 | `npm run lint` y `tsc --noEmit` pasan | Cumple | El check «Lint y tipos» quedó en verde en [#24](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/24), [#27](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/27), [#38](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/38). |
| 8 | CI en verde | Cumple | Todos los checks en verde en el último commit de [#15](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/15), [#20](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/20), [#24](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/24), [#27](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/27), [#38](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/38), [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46). |
| 9 | PR con descripción en español, enlazado al change | Cumple | Todos sus PRs ([#15](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/15), [#20](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/20), [#24](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/24), [#27](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/27), [#38](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/38), [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46)) tienen título y descripción en español y nombran el change. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | Cada PR a `main` ([#15](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/15), [#20](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/20), [#24](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/24), [#27](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/27), [#38](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/38), [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46)) tiene la aprobación de un compañero distinto del autor. |
| 11 | Mergeado a `main` y archivado | Cumple | Archivado en `openspec/changes/archive/2026-09-28-gestion-salon/` con [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46). |

### `modelo-dominio`

Archivado el 2026-09-28. PRs: [#7](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/7), [#12](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/12), [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46).

| # | Punto de la Definition of Done | Valor | Evidencia |
|---|---|---|---|
| 1 | El change existe, está aprobado y `openspec validate --strict` pasa | Desvío | La spec ([#7](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/7)) se mergeó sin una aprobación registrada en GitHub. `openspec validate --all --strict` pasa (2026-11-09, `5c70958`). |
| 2 | Todas las tareas de `tasks.md` están marcadas | Cumple | 14/14 tareas marcadas en `openspec/changes/archive/2026-09-28-modelo-dominio/tasks.md`. |
| 3 | Si tocó el schema: hay migración de Prisma | Cumple | [#12](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/12) cambia `schema.prisma` e incluye su migración en `backend/prisma/migrations/`. |
| 4 | Si tocó la API: `openapi/openapi.yaml` actualizado en el mismo PR | No aplica | No cambia endpoints del backend. |
| 5 | Si agregó variables de entorno: `.env.example` actualizado | Cumple | [#12](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/12) agrega `DATABASE_URL_TEST` a `.env.example`. |
| 6 | Hay tests para las reglas de negocio que toca | Cumple | Tests agregados en [#12](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/12). |
| 7 | `npm run lint` y `tsc --noEmit` pasan | Cumple | El check «Lint y tipos» quedó en verde en [#12](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/12). [#7](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/7) es anterior a que existiera el CI ([#10](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/10)) y solo trae documentación. |
| 8 | CI en verde | Cumple | Todos los checks en verde en el último commit de [#12](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/12), [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46). [#7](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/7) es anterior a que existiera el CI ([#10](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/10)) y solo trae documentación. |
| 9 | PR con descripción en español, enlazado al change | Cumple | Todos sus PRs ([#7](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/7), [#12](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/12), [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46)) tienen título y descripción en español y nombran el change. |
| 10 | Aprobado por un compañero distinto del autor | Desvío | [#7](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/7) se mergeó sin una aprobación registrada en GitHub; lo mergeó otro integrante. No se puede corregir después del merge. El resto ([#12](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/12), [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46)) tiene aprobación de un compañero. |
| 11 | Mergeado a `main` y archivado | Cumple | Archivado en `openspec/changes/archive/2026-09-28-modelo-dominio/` con [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46). |

### `reserva-consultar`

Archivado el 2026-09-28. PRs: [#32](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/32), [#35](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/35), [#47](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/47).

| # | Punto de la Definition of Done | Valor | Evidencia |
|---|---|---|---|
| 1 | El change existe, está aprobado y `openspec validate --strict` pasa | Cumple | Spec en [#32](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/32), aprobada por portalmatias. `openspec validate --all --strict` pasa (2026-11-09, `5c70958`). |
| 2 | Todas las tareas de `tasks.md` están marcadas | Cumple | 26/26 tareas marcadas en `openspec/changes/archive/2026-09-28-reserva-consultar/tasks.md`. |
| 3 | Si tocó el schema: hay migración de Prisma | No aplica | No toca `backend/prisma/schema.prisma`. |
| 4 | Si tocó la API: `openapi/openapi.yaml` actualizado en el mismo PR | Cumple | [#35](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/35) cambia controllers o DTOs y actualiza `openapi/openapi.yaml` en el mismo PR. |
| 5 | Si agregó variables de entorno: `.env.example` actualizado | No aplica | No agrega variables de entorno: las que usa ya estaban en `.env.example`. |
| 6 | Hay tests para las reglas de negocio que toca | Cumple | Tests agregados en [#35](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/35). |
| 7 | `npm run lint` y `tsc --noEmit` pasan | Cumple | El check «Lint y tipos» quedó en verde en [#35](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/35). |
| 8 | CI en verde | Cumple | Todos los checks en verde en el último commit de [#32](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/32), [#35](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/35), [#47](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/47). |
| 9 | PR con descripción en español, enlazado al change | Cumple | Todos sus PRs ([#32](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/32), [#35](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/35), [#47](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/47)) tienen título y descripción en español y nombran el change. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | Cada PR a `main` ([#32](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/32), [#35](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/35), [#47](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/47)) tiene la aprobación de un compañero distinto del autor. |
| 11 | Mergeado a `main` y archivado | Cumple | Archivado en `openspec/changes/archive/2026-09-28-reserva-consultar/` con [#47](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/47). |

### `reservas-crear`

Archivado el 2026-09-28. PRs: [#22](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/22), [#40](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/40), [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46).

| # | Punto de la Definition of Done | Valor | Evidencia |
|---|---|---|---|
| 1 | El change existe, está aprobado y `openspec validate --strict` pasa | Cumple | Spec en [#22](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/22), aprobada por FedeWerk. `openspec validate --all --strict` pasa (2026-11-09, `5c70958`). |
| 2 | Todas las tareas de `tasks.md` están marcadas | Cumple | 33/33 tareas marcadas en `openspec/changes/archive/2026-09-28-reservas-crear/tasks.md`. |
| 3 | Si tocó el schema: hay migración de Prisma | No aplica | No toca `backend/prisma/schema.prisma`. |
| 4 | Si tocó la API: `openapi/openapi.yaml` actualizado en el mismo PR | Cumple | [#40](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/40) cambia controllers o DTOs y actualiza `openapi/openapi.yaml` en el mismo PR. |
| 5 | Si agregó variables de entorno: `.env.example` actualizado | No aplica | No agrega variables de entorno: las que usa ya estaban en `.env.example`. |
| 6 | Hay tests para las reglas de negocio que toca | Cumple | Tests agregados en [#40](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/40). |
| 7 | `npm run lint` y `tsc --noEmit` pasan | Cumple | El check «Lint y tipos» quedó en verde en [#40](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/40). |
| 8 | CI en verde | Cumple | Todos los checks en verde en el último commit de [#22](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/22), [#40](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/40), [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46). |
| 9 | PR con descripción en español, enlazado al change | Cumple | Todos sus PRs ([#22](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/22), [#40](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/40), [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46)) tienen título y descripción en español y nombran el change. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | Cada PR a `main` ([#22](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/22), [#40](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/40), [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46)) tiene la aprobación de un compañero distinto del autor. |
| 11 | Mergeado a `main` y archivado | Cumple | Archivado en `openspec/changes/archive/2026-09-28-reservas-crear/` con [#46](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/46). |

### `catalogo-publico`

Archivado el 2026-09-29. PRs: [#44](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/44), [#51](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/51), [#55](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/55).

| # | Punto de la Definition of Done | Valor | Evidencia |
|---|---|---|---|
| 1 | El change existe, está aprobado y `openspec validate --strict` pasa | Cumple | Spec en [#44](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/44), aprobada por FedeWerk. `openspec validate --all --strict` pasa (2026-11-09, `5c70958`). |
| 2 | Todas las tareas de `tasks.md` están marcadas | Cumple | 22/22 tareas marcadas en `openspec/changes/archive/2026-09-29-catalogo-publico/tasks.md`. |
| 3 | Si tocó el schema: hay migración de Prisma | No aplica | No toca `backend/prisma/schema.prisma`. |
| 4 | Si tocó la API: `openapi/openapi.yaml` actualizado en el mismo PR | Cumple | [#51](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/51) cambia controllers o DTOs y actualiza `openapi/openapi.yaml` en el mismo PR. |
| 5 | Si agregó variables de entorno: `.env.example` actualizado | No aplica | No agrega variables de entorno: las que usa ya estaban en `.env.example`. |
| 6 | Hay tests para las reglas de negocio que toca | Cumple | Tests agregados en [#51](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/51). |
| 7 | `npm run lint` y `tsc --noEmit` pasan | Cumple | El check «Lint y tipos» quedó en verde en [#51](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/51). |
| 8 | CI en verde | Cumple | Todos los checks en verde en el último commit de [#44](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/44), [#51](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/51), [#55](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/55). |
| 9 | PR con descripción en español, enlazado al change | Cumple | Todos sus PRs ([#44](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/44), [#51](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/51), [#55](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/55)) tienen título y descripción en español y nombran el change. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | Cada PR a `main` ([#44](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/44), [#51](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/51), [#55](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/55)) tiene la aprobación de un compañero distinto del autor. |
| 11 | Mergeado a `main` y archivado | Cumple | Archivado en `openspec/changes/archive/2026-09-29-catalogo-publico/` con [#55](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/55). |

### `cancelacion-turnos`

Archivado el 2026-09-30. PRs: [#16](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/16), [#23](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/23), [#49](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/49), [#50](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/50), [#59](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/59).

| # | Punto de la Definition of Done | Valor | Evidencia |
|---|---|---|---|
| 1 | El change existe, está aprobado y `openspec validate --strict` pasa | Cumple | Spec en [#16](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/16), [#23](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/23), aprobada por FedeWerk, portalmatias. `openspec validate --all --strict` pasa (2026-11-09, `5c70958`). |
| 2 | Todas las tareas de `tasks.md` están marcadas | Cumple | 22/22 tareas marcadas en `openspec/changes/archive/2026-09-30-cancelacion-turnos/tasks.md`. |
| 3 | Si tocó el schema: hay migración de Prisma | No aplica | No toca `backend/prisma/schema.prisma`. |
| 4 | Si tocó la API: `openapi/openapi.yaml` actualizado en el mismo PR | Cumple | [#50](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/50) cambia controllers o DTOs y actualiza `openapi/openapi.yaml` en el mismo PR. |
| 5 | Si agregó variables de entorno: `.env.example` actualizado | No aplica | No agrega variables de entorno: las que usa ya estaban en `.env.example`. |
| 6 | Hay tests para las reglas de negocio que toca | Cumple | Tests agregados en [#50](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/50). |
| 7 | `npm run lint` y `tsc --noEmit` pasan | Cumple | El check «Lint y tipos» quedó en verde en [#50](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/50). |
| 8 | CI en verde | Cumple | Todos los checks en verde en el último commit de [#16](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/16), [#23](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/23), [#49](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/49), [#50](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/50), [#59](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/59). |
| 9 | PR con descripción en español, enlazado al change | Cumple | Todos sus PRs ([#16](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/16), [#23](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/23), [#49](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/49), [#50](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/50), [#59](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/59)) tienen título y descripción en español y nombran el change. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | Cada PR a `main` ([#16](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/16), [#23](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/23), [#49](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/49), [#50](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/50), [#59](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/59)) tiene la aprobación de un compañero distinto del autor. |
| 11 | Mergeado a `main` y archivado | Cumple | Archivado en `openspec/changes/archive/2026-09-30-cancelacion-turnos/` con [#59](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/59). |

### `reserva-vip`

Archivado el 2026-09-30. PRs: [#17](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/17), [#49](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/49), [#56](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/56), [#59](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/59).

| # | Punto de la Definition of Done | Valor | Evidencia |
|---|---|---|---|
| 1 | El change existe, está aprobado y `openspec validate --strict` pasa | Cumple | Spec en [#17](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/17), aprobada por portalmatias. `openspec validate --all --strict` pasa (2026-11-09, `5c70958`). |
| 2 | Todas las tareas de `tasks.md` están marcadas | Cumple | 13/13 tareas marcadas en `openspec/changes/archive/2026-09-30-reserva-vip/tasks.md`. |
| 3 | Si tocó el schema: hay migración de Prisma | No aplica | No toca `backend/prisma/schema.prisma`. |
| 4 | Si tocó la API: `openapi/openapi.yaml` actualizado en el mismo PR | Cumple | [#56](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/56) cambia controllers o DTOs y actualiza `openapi/openapi.yaml` en el mismo PR. |
| 5 | Si agregó variables de entorno: `.env.example` actualizado | No aplica | No agrega variables de entorno: las que usa ya estaban en `.env.example`. |
| 6 | Hay tests para las reglas de negocio que toca | Cumple | Tests agregados en [#56](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/56). |
| 7 | `npm run lint` y `tsc --noEmit` pasan | Cumple | El check «Lint y tipos» quedó en verde en [#56](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/56). |
| 8 | CI en verde | Cumple | Todos los checks en verde en el último commit de [#17](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/17), [#49](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/49), [#56](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/56), [#59](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/59). |
| 9 | PR con descripción en español, enlazado al change | Cumple | Todos sus PRs ([#17](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/17), [#49](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/49), [#56](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/56), [#59](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/59)) tienen título y descripción en español y nombran el change. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | Cada PR a `main` ([#17](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/17), [#49](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/49), [#56](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/56), [#59](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/59)) tiene la aprobación de un compañero distinto del autor. |
| 11 | Mergeado a `main` y archivado | Cumple | Archivado en `openspec/changes/archive/2026-09-30-reserva-vip/` con [#59](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/59). |

### `frontend-admin`

Archivado el 2026-10-01. PRs: [#48](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/48), [#58](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/58), [#64](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/64).

| # | Punto de la Definition of Done | Valor | Evidencia |
|---|---|---|---|
| 1 | El change existe, está aprobado y `openspec validate --strict` pasa | Cumple | Spec en [#48](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/48), aprobada por portalmatias. `openspec validate --all --strict` pasa (2026-11-09, `5c70958`). |
| 2 | Todas las tareas de `tasks.md` están marcadas | Cumple | 38/38 tareas marcadas en `openspec/changes/archive/2026-10-01-frontend-admin/tasks.md`. |
| 3 | Si tocó el schema: hay migración de Prisma | No aplica | No toca `backend/prisma/schema.prisma`. |
| 4 | Si tocó la API: `openapi/openapi.yaml` actualizado en el mismo PR | No aplica | No cambia endpoints del backend. |
| 5 | Si agregó variables de entorno: `.env.example` actualizado | No aplica | No agrega variables de entorno: las que usa ya estaban en `.env.example`. |
| 6 | Hay tests para las reglas de negocio que toca | Cumple | Tests agregados en [#58](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/58). |
| 7 | `npm run lint` y `tsc --noEmit` pasan | Cumple | El check «Lint y tipos» quedó en verde en [#58](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/58). |
| 8 | CI en verde | Cumple | Todos los checks en verde en el último commit de [#48](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/48), [#58](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/58), [#64](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/64). |
| 9 | PR con descripción en español, enlazado al change | Cumple | Todos sus PRs ([#48](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/48), [#58](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/58), [#64](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/64)) tienen título y descripción en español y nombran el change. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | Cada PR a `main` ([#48](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/48), [#58](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/58), [#64](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/64)) tiene la aprobación de un compañero distinto del autor. |
| 11 | Mergeado a `main` y archivado | Cumple | Archivado en `openspec/changes/archive/2026-10-01-frontend-admin/` con [#64](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/64). |

### `exposicion-red-local`

Archivado el 2026-10-05. PRs: [#62](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/62), [#68](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/68), [#69](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/69).

| # | Punto de la Definition of Done | Valor | Evidencia |
|---|---|---|---|
| 1 | El change existe, está aprobado y `openspec validate --strict` pasa | Cumple | Spec en [#62](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/62), aprobada por lussofacundo-iresm, portalmatias. `openspec validate --all --strict` pasa (2026-11-09, `5c70958`). |
| 2 | Todas las tareas de `tasks.md` están marcadas | Cumple | 19/19 tareas marcadas en `openspec/changes/archive/2026-10-05-exposicion-red-local/tasks.md`. |
| 3 | Si tocó el schema: hay migración de Prisma | No aplica | No toca `backend/prisma/schema.prisma`. |
| 4 | Si tocó la API: `openapi/openapi.yaml` actualizado en el mismo PR | No aplica | No cambia endpoints del backend. |
| 5 | Si agregó variables de entorno: `.env.example` actualizado | Cumple | [#68](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/68) agrega `HOST` y `TRUST_PROXY` a `.env.example`. |
| 6 | Hay tests para las reglas de negocio que toca | Cumple | Tests agregados en [#68](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/68). |
| 7 | `npm run lint` y `tsc --noEmit` pasan | Cumple | El check «Lint y tipos» quedó en verde en [#68](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/68). |
| 8 | CI en verde | Cumple | Todos los checks en verde en el último commit de [#62](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/62), [#68](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/68), [#69](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/69). |
| 9 | PR con descripción en español, enlazado al change | Cumple | Todos sus PRs ([#62](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/62), [#68](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/68), [#69](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/69)) tienen título y descripción en español y nombran el change. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | Cada PR a `main` ([#62](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/62), [#68](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/68), [#69](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/69)) tiene la aprobación de un compañero distinto del autor. |
| 11 | Mergeado a `main` y archivado | Cumple | Archivado en `openspec/changes/archive/2026-10-05-exposicion-red-local/` con [#69](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/69). |

### `throttle-rutas-admin`

Archivado el 2026-10-05. PRs: [#60](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/60), [#66](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/66), [#70](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/70).

| # | Punto de la Definition of Done | Valor | Evidencia |
|---|---|---|---|
| 1 | El change existe, está aprobado y `openspec validate --strict` pasa | Cumple | Spec en [#60](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/60), aprobada por portalmatias. `openspec validate --all --strict` pasa (2026-11-09, `5c70958`). |
| 2 | Todas las tareas de `tasks.md` están marcadas | Cumple | 13/13 tareas marcadas en `openspec/changes/archive/2026-10-05-throttle-rutas-admin/tasks.md`. |
| 3 | Si tocó el schema: hay migración de Prisma | No aplica | No toca `backend/prisma/schema.prisma`. |
| 4 | Si tocó la API: `openapi/openapi.yaml` actualizado en el mismo PR | Cumple | [#66](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/66) cambia controllers o DTOs y actualiza `openapi/openapi.yaml` en el mismo PR. |
| 5 | Si agregó variables de entorno: `.env.example` actualizado | No aplica | No agrega variables de entorno: las que usa ya estaban en `.env.example`. |
| 6 | Hay tests para las reglas de negocio que toca | Cumple | Tests agregados en [#66](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/66). |
| 7 | `npm run lint` y `tsc --noEmit` pasan | Cumple | El check «Lint y tipos» quedó en verde en [#66](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/66). |
| 8 | CI en verde | Cumple | Todos los checks en verde en el último commit de [#60](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/60), [#66](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/66), [#70](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/70). |
| 9 | PR con descripción en español, enlazado al change | Cumple | Todos sus PRs ([#60](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/60), [#66](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/66), [#70](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/70)) tienen título y descripción en español y nombran el change. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | Cada PR a `main` ([#60](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/60), [#66](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/66), [#70](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/70)) tiene la aprobación de un compañero distinto del autor. |
| 11 | Mergeado a `main` y archivado | Cumple | Archivado en `openspec/changes/archive/2026-10-05-throttle-rutas-admin/` con [#70](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/70). |

### `frontend-cliente`

Archivado el 2026-10-26. PRs: [#45](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/45), [#52](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/52), [#53](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/53), [#54](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/54), [#57](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/57), [#61](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/61), [#67](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/67), [#74](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/74), [#75](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/75), [#80](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/80), [#84](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/84).

| # | Punto de la Definition of Done | Valor | Evidencia |
|---|---|---|---|
| 1 | El change existe, está aprobado y `openspec validate --strict` pasa | Cumple | Spec en [#45](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/45), aprobada por FedeWerk. `openspec validate --all --strict` pasa (2026-11-09, `5c70958`). |
| 2 | Todas las tareas de `tasks.md` están marcadas | Cumple | 53/53 tareas marcadas en `openspec/changes/archive/2026-10-26-frontend-cliente/tasks.md`. |
| 3 | Si tocó el schema: hay migración de Prisma | No aplica | No toca `backend/prisma/schema.prisma`. |
| 4 | Si tocó la API: `openapi/openapi.yaml` actualizado en el mismo PR | No aplica | No cambia endpoints del backend. |
| 5 | Si agregó variables de entorno: `.env.example` actualizado | No aplica | No agrega variables de entorno: las que usa ya estaban en `.env.example`. |
| 6 | Hay tests para las reglas de negocio que toca | Cumple | Tests agregados en [#52](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/52), [#53](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/53), [#54](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/54), [#57](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/57), [#61](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/61), [#67](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/67), [#74](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/74), [#75](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/75). |
| 7 | `npm run lint` y `tsc --noEmit` pasan | Cumple | El check «Lint y tipos» quedó en verde en [#52](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/52), [#53](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/53), [#54](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/54), [#57](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/57), [#61](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/61), [#67](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/67), [#74](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/74), [#75](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/75). |
| 8 | CI en verde | Cumple | Todos los checks en verde en el último commit de [#45](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/45), [#52](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/52), [#53](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/53), [#54](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/54), [#57](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/57), [#61](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/61), [#67](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/67), [#74](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/74), [#75](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/75), [#80](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/80), [#84](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/84). |
| 9 | PR con descripción en español, enlazado al change | Cumple | Todos sus PRs ([#45](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/45), [#52](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/52), [#53](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/53), [#54](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/54), [#57](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/57), [#61](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/61), [#67](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/67), [#74](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/74), [#75](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/75), [#80](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/80), [#84](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/84)) tienen título y descripción en español y nombran el change. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | Cada PR a `main` ([#45](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/45), [#52](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/52), [#53](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/53), [#54](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/54), [#57](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/57), [#61](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/61), [#67](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/67), [#74](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/74), [#75](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/75), [#80](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/80), [#84](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/84)) tiene la aprobación de un compañero distinto del autor. |
| 11 | Mergeado a `main` y archivado | Cumple | Archivado en `openspec/changes/archive/2026-10-26-frontend-cliente/` con [#84](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/84). |

### `rediseno-frontend-ichigo`

Archivado el 2026-10-28. PRs: [#77](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/77), [#78](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/78), [#81](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/81), [#92](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/92), [#97](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/97).

| # | Punto de la Definition of Done | Valor | Evidencia |
|---|---|---|---|
| 1 | El change existe, está aprobado y `openspec validate --strict` pasa | Cumple | Spec en [#77](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/77), [#81](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/81), aprobada por lussofacundo-iresm, portalmatias. `openspec validate --all --strict` pasa (2026-11-09, `5c70958`). |
| 2 | Todas las tareas de `tasks.md` están marcadas | Cumple | 47/47 tareas marcadas en `openspec/changes/archive/2026-10-28-rediseno-frontend-ichigo/tasks.md`. |
| 3 | Si tocó el schema: hay migración de Prisma | No aplica | No toca `backend/prisma/schema.prisma`. |
| 4 | Si tocó la API: `openapi/openapi.yaml` actualizado en el mismo PR | No aplica | No cambia endpoints del backend. |
| 5 | Si agregó variables de entorno: `.env.example` actualizado | No aplica | No agrega variables de entorno: las que usa ya estaban en `.env.example`. |
| 6 | Hay tests para las reglas de negocio que toca | Cumple | Tests agregados en [#78](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/78), [#92](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/92). |
| 7 | `npm run lint` y `tsc --noEmit` pasan | Cumple | El check «Lint y tipos» quedó en verde en [#78](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/78), [#92](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/92). |
| 8 | CI en verde | Cumple | Todos los checks en verde en el último commit de [#77](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/77), [#78](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/78), [#81](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/81), [#92](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/92). |
| 9 | PR con descripción en español, enlazado al change | Cumple | Todos sus PRs ([#77](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/77), [#78](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/78), [#81](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/81), [#92](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/92), [#97](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/97)) tienen título y descripción en español y nombran el change. [#97](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/97) no enlaza el change, pero se integró en la rama de #92, no en `main`. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | Cada PR a `main` ([#77](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/77), [#78](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/78), [#81](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/81), [#92](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/92)) tiene la aprobación de un compañero distinto del autor. [#97](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/97) se integró en la rama de #92, no en `main`; su contenido llegó a `main` con #92, aprobado por lussofacundo-iresm el 2026-11-02, después de este merge. |
| 11 | Mergeado a `main` y archivado | Cumple | Archivado en `openspec/changes/archive/2026-10-28-rediseno-frontend-ichigo/` con [#92](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/92), [#97](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/97). |

### `plano-mesas`

Archivado el 2026-11-02. PRs: [#76](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/76), [#86](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/86), [#89](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/89), [#104](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/104).

| # | Punto de la Definition of Done | Valor | Evidencia |
|---|---|---|---|
| 1 | El change existe, está aprobado y `openspec validate --strict` pasa | Cumple | Spec en [#76](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/76), aprobada por lussofacundo-iresm, portalmatias. `openspec validate --all --strict` pasa (2026-11-09, `5c70958`). |
| 2 | Todas las tareas de `tasks.md` están marcadas | Cumple | 38/38 tareas marcadas en `openspec/changes/archive/2026-11-02-plano-mesas/tasks.md`. |
| 3 | Si tocó el schema: hay migración de Prisma | Cumple | [#86](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/86) cambia `schema.prisma` e incluye su migración en `backend/prisma/migrations/`. |
| 4 | Si tocó la API: `openapi/openapi.yaml` actualizado en el mismo PR | Cumple | [#86](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/86) cambia controllers o DTOs y actualiza `openapi/openapi.yaml` en el mismo PR. |
| 5 | Si agregó variables de entorno: `.env.example` actualizado | No aplica | No agrega variables de entorno: las que usa ya estaban en `.env.example`. |
| 6 | Hay tests para las reglas de negocio que toca | Cumple | Tests agregados en [#86](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/86), [#89](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/89). |
| 7 | `npm run lint` y `tsc --noEmit` pasan | Cumple | El check «Lint y tipos» quedó en verde en [#86](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/86), [#89](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/89). |
| 8 | CI en verde | Cumple | Todos los checks en verde en el último commit de [#76](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/76), [#86](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/86), [#89](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/89), [#104](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/104). |
| 9 | PR con descripción en español, enlazado al change | Cumple | Todos sus PRs ([#76](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/76), [#86](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/86), [#89](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/89), [#104](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/104)) tienen título y descripción en español y nombran el change. |
| 10 | Aprobado por un compañero distinto del autor | Cumple | Cada PR a `main` ([#76](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/76), [#86](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/86), [#89](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/89), [#104](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/104)) tiene la aprobación de un compañero distinto del autor. |
| 11 | Mergeado a `main` y archivado | Cumple | Archivado en `openspec/changes/archive/2026-11-02-plano-mesas/` con [#104](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/104). |

## Recorrido de punta a punta

Corrido el 2026-11-11 a las 18:10 (hora de Argentina) contra la app local (`npm run dev`), con
una base PostgreSQL migrada y con el seed de desarrollo de `main` en `5dd778d`, que ya incluye
las reservas de demostración de `seed-datos-demo` (#113). Es el flujo de `docs/roadmap-mvp.md`
§13 («Fase 5 y cierre»), hecho en el navegador con Playwright: cada paso usa las pantallas del
cliente y del admin. La única excepción es la elección de fecha, turno, zona y comensales del
paso 1, que se cargó por la URL de la pantalla de resultado (el asistente guarda esa selección
en la URL, D1 de `frontend-cliente`) en lugar de tocar el calendario.

| # | Paso | Resultado esperado | Resultado |
|---|---|---|---|
| 1 | Consultar disponibilidad: viernes 13/11, cena, STANDARD, 2 comensales | Hay lugar | OK: «¡Hay lugar!», 40 lugares y el plano con S1 a S5 libres. |
| 2 | Reservar en STANDARD | `CONFIRMADA` y un código de 8 caracteres | OK: `ZTMVJNEC`, «Tu reserva está confirmada». |
| 3 | Reservar en VIP: sábado 14/11, cena, 2 comensales | `PENDIENTE` | OK: `3YYQLGNT`, «Tu reserva está pendiente de confirmación». |
| 4 | Consultar `ZTMVJNEC` con su código y su email | Muestra el detalle | OK: estado, fecha, turno, zona y comensales. |
| 5 | Consultar `ZTMVJNEC` con otro email | No devuelve nada | OK: «No encontramos una reserva con esos datos». |
| 6 | Cancelar `ZTMVJNEC` dentro de la ventana | Se cancela | OK: «Tu reserva fue cancelada». |
| 7 | Cancelar fuera de la ventana: `SEEDVTN2` (VIP, hoy 20:00; la ventana VIP es de 24 h) | Rechazado | OK: la pantalla no ofrece «Cancelar mi reserva», como pide `frontend-cliente` («Una reserva fuera de la ventana no ofrece cancelar»). Pedida directo a la API, `POST /reservas/SEEDVTN2/cancelar` responde `409` «La reserva ya no se puede cancelar: está fuera de la ventana mínima de cancelación de su zona». |
| 8 | Como admin, confirmar la VIP `3YYQLGNT` | Pasa a `CONFIRMADA` | OK: de «Pendiente» a «Confirmada» en `/admin/reservas` (mesa V1). |
| 9 | Marcar `NO_SHOW` en `SEEDPAS2` (07/01/2026, turno ya pasado) | Se acepta | OK: de «Confirmada» a «Ausente». |
| 10 | El aforo no cuenta `CANCELADA` ni `NO_SHOW` | Solo cuenta las activas | OK. Viernes 13, cena: STANDARD 0/40 (la única reserva es `ZTMVJNEC`, cancelada) y VIP 2/20 (`SEEDPND2`, pendiente). 07/01, cena: 0 (`SEEDPAS2`, `NO_SHOW`). Control, sábado 14, cena: 6 (STANDARD 4 de `SEEDCNF2` y VIP 2 de `3YYQLGNT`). Los números coinciden con la base. |

Los 10 pasos dan el resultado esperado.

## Cómo repetir la verificación

Los datos de las tablas salen de GitHub y del repo con estos comandos (D3 de `entrega-final`):

```bash
# PRs mergeados: autor, quién mergeó, aprobaciones y descripción
gh pr list --state merged --limit 400 --json number,title,author,mergedBy,mergedAt,body,reviews

# Archivos de un PR (para ver si tocó schema, migraciones, controllers, openapi.yaml, .env.example o tests)
gh api "repos/portalmatias/Restaurante-MVP-Trabajo-Practico/pulls/<n>/files?per_page=100" --jq '.[].filename'

# Checks del último commit de un PR
sha=$(gh api repos/portalmatias/Restaurante-MVP-Trabajo-Practico/pulls/<n> --jq .head.sha)
gh api "repos/portalmatias/Restaurante-MVP-Trabajo-Practico/commits/$sha/check-runs" --jq '.check_runs[]|[.name,.conclusion]'

# Rama a la que se integró un PR (main o la de otro PR)
gh api repos/portalmatias/Restaurante-MVP-Trabajo-Practico/pulls/<n> --jq .base.ref

# Tareas marcadas de cada change archivado
for d in openspec/changes/archive/*/; do echo "$d $(grep -c '^\s*- \[x\]' $d/tasks.md)/$(grep -cE '^\s*- \[( |x)\]' $d/tasks.md)"; done

# Variables que usa el código y no están en .env.example (tiene que salir vacío)
grep -rhoE "process\.env\.[A-Z_]+|config\.get(<[a-z]+>)?\('[A-Z_]+'" backend/src frontend/src | grep -oE "[A-Z_]{3,}" | sort -u > /tmp/usadas
grep -oE '^#? ?[A-Z_]+=' .env.example | grep -oE '[A-Z_]+' | sort -u > /tmp/ejemplo
comm -23 /tmp/usadas /tmp/ejemplo

# Entregables
npx openspec validate --all --strict
npm run openapi:lint
```

Cada PR se asignó a su change por los archivos que tocó en `openspec/changes/<change>/` o en su
carpeta de `archive/`.
