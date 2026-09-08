# Roadmap de changes del MVP y huecos de proceso

> Documento de proceso. No agrega comportamiento al sistema: ordena el trabajo que viene y
> deja asentados los huecos que hoy bloquean la Definition of Done de `openspec/config.yaml` §13.
> Las referencias con "§" apuntan a secciones del campo `context:` de `openspec/config.yaml`.

## 1. Punto de partida

El repositorio tiene **cinco archivos y cero líneas de código**: solo `.claude/` y `openspec/`.
El único change, [`diseno-general-app`](../openspec/changes/diseno-general-app/), está completo:
fijó las cuatro decisiones que estaban en conflicto entre `config.yaml` y `requerimientos-mvp.docx`
(cliente sin cuenta, enum de estados, rango VIP 2-12, asignación *best fit*) y dejó el mapa de
arquitectura general. No agregó comportamiento.

El problema ahora no es *qué* construir —eso ya está en §6 y en el docx— sino **en qué orden y
quién**.

## 2. Huecos de proceso detectados

Tres restricciones que la consigna evalúa y que hoy **no se cumplen**:

```
+----------------------------------------------------------------+
|  HUECO 1:  main NO esta protegida                              |
|            GET /branches/main/protection -> 404                |
|            §11 dice "main esta protegida, nadie pushea         |
|            directo". Hoy eso es solo texto en un YAML.         |
+----------------------------------------------------------------+
|  HUECO 2:  el tercer integrante tiene 0 commits                |
|            colaboradores: FedeWerk (3), portalmatias (3),      |
|                           lussofacundo-iresm (0)               |
|            §11: "se evalua el historial" / reparto parejo.     |
+----------------------------------------------------------------+
|  HUECO 3:  PR #3 (archive) sigue abierto                       |
|            Mientras no se mergee, `openspec list` muestra      |
|            diseno-general-app como change activo.              |
+----------------------------------------------------------------+
```

Y cuatro faltantes en el repo:

- **No existe CI.** §13 hace de "CI en verde" un requisito de la Definition of Done de *todo*
  change. Hasta que exista, ningún change puede cerrarse formalmente.
- **No existe `.gitignore`.** §10 dice que `.env` nunca se commitea, pero hoy nada lo impide.
- **`requerimientos-mvp.docx` no está en el repo**, pese a que el `proposal.md` y el `design.md`
  citan RF-01…RF-13 y RN-04…RN-11. Un revisor —o la docente— no puede seguir esas referencias.
- **No existe `openapi/openapi.yaml`**, que §3 define como el artefacto entregable del contrato.

### El nudo del CI se destraba solo

GitHub Actions **sí ejecuta un workflow que el propio PR agrega** (en el evento `pull_request`
se usa el archivo del branch head). Por lo tanto el PR que crea `ci.yml` puede tener CI verde en
sí mismo. No hace falta ninguna excepción a la Definition of Done, ni separar el CI del bootstrap
en dos changes.

## 3. Decisiones de formato del roadmap

- **Dos PRs por change.** `feature/spec-<x>` mergea los artefactos de OpenSpec; después
  `feature/<x>` mergea el código. Es lo que ya se hizo con `diseno-general-app`, usa los dos
  prefijos de rama de §11, y —clave— permite que las specs corran por delante del código para que
  nadie quede esperando durante las fases secuenciales.
- **`gestion-salon` es un solo change** que cubre zonas + mesas + turnos. Los módulos NestJS
  siguen separados como pide el `design.md`; lo que no se separa es la ceremonia de OpenSpec —
  serían tres PRs casi idénticos sobre CRUDs que comparten schema, guards y sección de OpenAPI.
- **El frontend entra completo**, arrancando contra `openapi.yaml` apenas la spec del endpoint
  está mergeada; no espera a que el backend esté implementado.

## 4. Fase 0 — Destrabar (sin código)

Nada de esto necesita un change de OpenSpec: no son features y no cambian comportamiento.

| # | Acción | Dueño |
|---|---|---|
| 0.1 | Revisar y mergear **PR #3** (`chore/archive-diseno-general-app`). | FedeWerk (review) |
| 0.2 | Activar **branch protection** en `main`: require PR, 1 approval, prohibir force-push. Los *required status checks* se agregan recién en 0.4. | portalmatias |
| 0.3 | PR `docs:` — agregar `docs/requerimientos-mvp.docx` y crear `.gitignore` (`node_modules/`, `.env`, `dist/`, `.next/`, `coverage/`). | **lussofacundo-iresm** |
| 0.4 | *(tras Fase 1)* Marcar los jobs de `ci.yml` como required status checks. | portalmatias |

**0.3 va deliberadamente al integrante sin commits**: es chico, sin dependencias, y le abre el
historial antes de que empiece lo grande. El docx además es *input* de las specs de la Fase 3 —
sin él nadie puede citar RF/RN con confianza.

`.gitignore` es urgente: el primer `npm install` de la Fase 1 crea `node_modules/`.

## 5. Fase 1 — Fundación (secuencial, bloquea todo)

**Change `fundacion-repo`** — dueño: **portalmatias**

- `feature/spec-fundacion-repo`: `proposal.md`, `design.md`, `tasks.md`, con `skip_specs: true`
  en `.openspec.yaml` (igual que `diseno-general-app`: no introduce comportamiento).
- `feature/fundacion-repo`:
  - `package.json` raíz con workspaces `["backend", "frontend"]` + ESLint/Prettier transversales
    (§4: nada más se instala en la raíz).
  - `backend/` (`nest new`) y `frontend/` (`create-next-app`, App Router).
  - `docker-compose.yml` con Postgres de dev **y** de test (§10 exige base `_test` separada).
  - `.env.example` con las siete variables de §10, versionado y sin valores reales.
  - `openapi/openapi.yaml` esqueleto: `info`, `servers`, `components.securitySchemes` con bearer
    JWT, `paths: {}`. Cada capability lo va llenando.
  - `.github/workflows/ci.yml` con los cuatro pasos de §12.
  - `README.md` inicial con el bloque "Primer arranque" de §10.

Contenido de `ci.yml` (dispara en `pull_request` y en push a `main`):

```
job: spec   -> openspec validate --strict  +  lint del openapi.yaml
job: lint   -> npm run lint  +  tsc --noEmit (ambos workspaces)
job: test   -> services: postgres; migrate + seed; tests unitarios y e2e del backend
```

Dos cosas a resolver dentro de este change, ambas con justificación en su `design.md` porque §2
prohíbe sumar librerías sin argumentarlo: cómo se invoca la CLI de OpenSpec en CI (dependencia de
dev vs `npx`), y qué linter de OpenAPI se usa (Spectral o Redocly).

> **Tradeoff asumido.** Este PR es más grande de lo que le gustaría a §14 ("cambios chicos y
> revisables"). Casi todo es output de generadores. Mitigación: el `tasks.md` lo parte en tareas
> de ≤2h, y el review se concentra en los cuatro archivos que *no* son boilerplate — `ci.yml`,
> `.env.example`, `docker-compose.yml`, `openapi.yaml`. Partirlo en dos PRs sería peor: el primero
> tendría CI inexistente y el segundo la agregaría tocando `.github/workflows/` fuera de su propio
> change, contra §14.

## 6. Fase 2 — Modelo de dominio (secuencial, bloquea todo el backend)

**Change `modelo-dominio`** — dueño: **FedeWerk**

- `feature/spec-modelo-dominio`: primera spec de capability real del proyecto. Entidades
  `Usuario`, `Zona`, `Mesa`, `Turno`, `Reserva`, `Configuracion`; el enum `EstadoReserva`; y **los
  cinco invariantes de §6 como requisitos con escenarios propios**.
- `feature/modelo-dominio`: `backend/prisma/schema.prisma`, migración inicial versionada
  (`prisma migrate dev`, nunca `db push`), `seed.ts` idempotente con lo que pide §10, y tests que
  intenten violar cada invariante — en particular el **índice único parcial sobre
  `(mesaId, turnoId, fecha)` para reservas activas**, que es lo que hace cumplir el invariante 1 a
  nivel base de datos.

Es el change con más impacto sobre el resto: conviene que **los otros dos lo revisen a fondo**,
aunque solo uno apruebe formalmente.

> **Mientras corren las Fases 1 y 2, las otras dos personas no esperan:** escriben las
> `feature/spec-*` de la Fase 3. Las specs no necesitan código. Esa es toda la razón de haber
> elegido dos PRs por change.

## 7. Fase 3 — Backend en paralelo (tres tracks)

| Change | Dueño | Depende de | Alcance |
|---|---|---|---|
| `auth-admin` | FedeWerk | modelo-dominio | `POST /auth/login`, bcrypt, `@nestjs/jwt` + Passport, `JwtAuthGuard` + `RolesGuard`. Tests obligatorios de §9: ruta admin sin token y con rol incorrecto. |
| `disponibilidad` | portalmatias | modelo-dominio | `GET /disponibilidad` + **el validador de reglas compartido** (turno activo, ventanas de anticipación, rango de comensales por zona, aforo). El `design.md` es explícito: `reservas` lo reutiliza, no lo reimplementa. |
| `gestion-salon` | lussofacundo-iresm | auth-admin (impl) | CRUD de zonas, mesas y turnos bajo `/admin`, protegido por guard. Módulos NestJS `zonas/`, `mesas/`, `horarios/` separados. |

`gestion-salon` necesita el guard mergeado para su implementación, pero **su spec PR se puede
escribir y mergear antes**, así que el track no queda bloqueado.

El **validador compartido de `disponibilidad` es la pieza de mayor riesgo del proyecto**: si su
interfaz no queda bien pensada, `reservas-crear` termina duplicando reglas y se rompe la garantía
de §6 de que consulta y creación validan lo mismo. Merece revisión de los tres.

## 8. Fase 4 — Reservas

| Change | Dueño | Depende de | Alcance |
|---|---|---|---|
| `reservas-crear` | portalmatias | disponibilidad | `POST /reservas`. Transacción Prisma, best fit (query ordenada por capacidad ascendente), validación de aforo con el comensal nuevo ya sumado, generación del código de 8 caracteres, `PENDIENTE` si VIP / `CONFIRMADA` si no. |
| `reserva-consultar` | FedeWerk | reservas-crear | `GET` público con **código + email** (ambos deben coincidir) + `@nestjs/throttler` contra enumeración. Listado y filtros para admin. |
| `cancelacion-turnos` | lussofacundo-iresm | reservas-crear | Cancelación con ventana por zona (2h STANDARD / 24h VIP) + endpoint admin de `NO_SHOW`, con guard que verifique que el turno ya pasó. Tests de los bordes exactos de la ventana (§9). |
| `reserva-vip` | lussofacundo-iresm | reservas-crear | Flujo `PENDIENTE` → confirmar/rechazar por admin. Transiciones inválidas → `409 Conflict`. |

`reserva-consultar` y `cancelacion-turnos` tocan el mismo servicio: conviene mergear
`reserva-consultar` primero y que `cancelacion-turnos` rebase sobre él.

## 9. Fase 5 — Frontend

Arranca en paralelo al backend: cada pantalla solo necesita que **la spec del endpoint y su
entrada en `openapi.yaml` estén mergeadas**, no la implementación.

| Change | Dueño | Alcance |
|---|---|---|
| `frontend-base` | FedeWerk | Layout, rutas `/admin` y `/reservas`, y el cliente HTTP con **tipos derivados de `openapi.yaml`** (§7 lo exige: no se escriben a mano). La herramienta de generación es una dependencia nueva → justificarla en su `design.md`. |
| `frontend-cliente` | portalmatias | Reservar, consultar por código+email, cancelar. Conversión UTC → hora local (§7: es responsabilidad del front). |
| `frontend-admin` | FedeWerk | Login, dashboard de aforo, CRUD del salón, confirmar VIP, marcar NO_SHOW. |

## 10. Fase 6 — Entrega

**Change `entrega-final`** — dueño: **lussofacundo-iresm**

README completo (setup, credenciales del seed admin —que §10 aclara que no son secreto—,
decisiones de diseño con enlace a los changes archivados), seed de demo, y **verificación punto
por punto de la Definition of Done de §13 sobre cada change archivado**.

## 11. Reparto y secuencia

```
portalmatias        fundacion-repo, disponibilidad, reservas-crear,
                    frontend-cliente                                  -> 4 changes
FedeWerk            modelo-dominio, auth-admin, reserva-consultar,
                    frontend-base, frontend-admin                     -> 5 changes
lussofacundo-iresm  [chore docs+gitignore], gestion-salon,
                    cancelacion-turnos, reserva-vip, entrega-final    -> 4 changes + 1 chore
```

13 changes x 2 PRs + 2 PRs de Fase 0 = **~28 PRs**. §11 exige que cada integrante ejecute las
sesiones de su propio módulo y commitee bajo su propia autoría: nadie mergea trabajo generado en
nombre de otro.

```
Fase 0  [destrabar]     ---- todos, en paralelo, sin codigo
           |
Fase 1  [fundacion]     ---- SECUENCIAL (matias)   <-+ los otros dos escriben
           |                                         | las spec PRs de Fase 3
Fase 2  [modelo]        ---- SECUENCIAL (fede)     <-+
           |
           +-------------------+-------------------+
           |                   |                   |
Fase 3  auth-admin      disponibilidad      gestion-salon      <- PARALELO
        (fede)          (matias)            (facundo)
           |                   |                   |
           +---------+---------+                   |
                     v                             |
Fase 4        reservas-crear (matias)              |
                     |                             |
           +---------+---------+-------------------+
           v                   v                   v
     reserva-consultar   cancelacion-turnos   reserva-vip      <- PARALELO
        (fede)             (facundo)            (facundo)
           |
Fase 5  frontend-base -> frontend-cliente / frontend-admin      <- PARALELO al backend
           |
Fase 6  entrega-final (facundo)
```

## 12. Riesgos

- **Las Fases 1 y 2 son un cuello de botella real.** Dos personas dependen de una durante dos
  changes seguidos. Único mitigante: que escriban spec PRs en paralelo. Si eso no se respeta, se
  pierde una semana.
- **Librerías nuevas que §2 obliga a justificar en su `design.md`:** el linter de OpenAPI y la CLI
  de OpenSpec en CI (Fase 1), y el generador de tipos desde OpenAPI (Fase 5). `@nestjs/jwt`,
  Passport, bcrypt y `@nestjs/throttler` ya están avaladas por §5.
- **Los required status checks (0.4) no se pueden configurar antes de la Fase 1** — GitHub solo los
  ofrece después de que el check corrió al menos una vez. Es fácil olvidarse y dejar `main` a medio
  proteger.
- **El repositorio es público.** Ningún `.env`, credencial ni URL real de base entra en ningún
  commit; el `.gitignore` de 0.3 es la primera línea de defensa y hoy no existe.
- **`openspec/specs/` va a seguir vacío hasta la Fase 2**, porque `diseno-general-app` usa
  `skip_specs`. Es esperable, no un error.

## 13. Verificación por fase

**Fase 0**

```bash
gh pr list --state open                                # PR #3 ya no aparece
gh api repos/<owner>/<repo>/branches/main/protection   # 200, no 404
openspec list                                          # sin changes activos
ls docs/requerimientos-mvp.docx .gitignore
```

**Fase 1** — el PR debe mostrar los tres jobs de CI en verde, y en limpio:

```bash
npm install && docker compose up -d && npm run dev     # backend y frontend levantan
openspec validate --strict
```

**Fase 2** — idempotencia del seed e invariantes:

```bash
npm run db:migrate -w backend && npm run db:seed -w backend
npm run db:seed -w backend                             # segunda corrida: sin duplicados
npm run test -w backend                                # un test por invariante, todos pasan
```

**Fases 3 y 4** — por cada change, la Definition of Done completa de §13, con foco en: migración
commiteada si tocó schema, `openapi/openapi.yaml` actualizado **en el mismo PR** si tocó la API,
`.env.example` actualizado si sumó variables, y tests de las reglas de negocio de §6 que el change
toca.

**Fase 5 y cierre** — flujo manual de punta a punta contra el front, con la base seedeada:

```
consultar disponibilidad (fecha/turno/zona/comensales)
  -> reservar STANDARD -> queda CONFIRMADA, devuelve codigo de 8 caracteres
  -> reservar VIP      -> queda PENDIENTE
  -> consultar con codigo + email  (y verificar que con email erroneo NO devuelve nada)
  -> cancelar dentro de la ventana -> OK
  -> cancelar fuera de la ventana  -> rechazado
  -> como admin: confirmar la VIP, y marcar NO_SHOW en una reserva de turno ya pasado
  -> verificar que el aforo del dashboard no cuenta CANCELADA ni NO_SHOW
```
