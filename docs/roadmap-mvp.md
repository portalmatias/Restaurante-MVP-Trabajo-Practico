# Roadmap de changes del MVP y huecos de proceso

> Documento de proceso. No agrega comportamiento al sistema: ordena el trabajo que viene y
> deja asentados los huecos que hoy bloquean la Definition of Done de `openspec/config.yaml` §13.
> Las referencias con "§" apuntan a secciones del campo `context:` de `openspec/config.yaml`.

## Estado al 2026-09-19

Foto de GitHub al 2026-09-19. Distingue código mergeado, PRs abiertos y trabajo pendiente;
un check verde o una aprobación no significa que una funcionalidad esté habilitada.
Las secciones siguientes conservan la secuencia y el reparto original, con sus estados
actualizados. Los estados de los PRs deben volver a consultarse antes de integrar cambios.

### Entregas y dependencias

| Change / etapa | Responsable | Estado comprobado | Próximo paso |
|---|---|---|---|
| Fundación | portalmatias | Implementación #10/#11 mergeada; archivada en #13. Consigna y requerimientos incorporados en #4. | Mantener CI y reconfirmar opciones de revisión de `main` (ver abajo). |
| `modelo-dominio` | FedeWerk | Spec #7 e implementación #12 mergeadas: schema, migraciones, seed, invariantes y helpers horarios. | Verificar DoD antes de archivar; todavía figura como change activo. |
| `ci-integracion-db` | FedeWerk | Spec #26 e implementación #28 mergeadas (2026-09-21). PostgreSQL corre en el job `test` de `main`: migra, seedea y ejecuta unitarios, e2e e integración. | Cerrado. Verificar DoD antes de archivar. |
| `auth-admin` | FedeWerk | Spec #9 e implementación #25 mergeadas (2026-09-21). | Cerrado en cuanto a login; el registro en `AppModule` y el contrato OpenAPI de `/auth/login` los completó `gestion-salon` (#27, ver abajo) al ser el PR que terminó registrando el módulo. Verificar DoD antes de archivar. |
| `disponibilidad` | portalmatias | Specs #19/#21 mergeadas; rama `feature/disponibilidad` con tres commits propios y sin PR abierto. | Revisar y abrir PR de implementación; verificar el validador compartido y el lock que reutilizará creación. |
| `gestion-salon` | lussofacundo-iresm | Spec #15 y corrección de baja histórica #20 mergeadas; services/DTOs/tests en #24. #27 (abierto) agregó los tres controllers, registró `AuthModule`/`ZonasModule`/`MesasModule`/`HorariosModule` en `AppModule` (ya no bloqueado, con Postgres en CI) y publicó el contrato OpenAPI completo (`/auth/login` incluido). | Obtener revisión de #27 y mergear. |
| `reservas-crear` | portalmatias | Spec #22 mergeada; implementación no mergeada. | Integrar disponibilidad y luego implementar creación transaccional. |
| `reserva-consultar` | FedeWerk | Sin change propio en `main` ni PR abierto. | Preparar spec; implementación después de creación. |
| `cancelacion-turnos` | lussofacundo-iresm | Spec #16 y ajuste UTC−3 #23 mergeados; implementación pendiente. | Esperar el merge de `reservas-crear` antes de la sección 2 de sus tareas. |
| `reserva-vip` | lussofacundo-iresm | Spec #17 mergeada; implementación pendiente. | Esperar el merge de `reservas-crear`; endpoints admin requieren auth. |
| Frontend funcional | FedeWerk / portalmatias | Solo base generada de Next.js; sin PRs abiertos de pantallas. | Preparar `frontend-base` y contratos/tipos según §9. |
| `entrega-final` | lussofacundo-iresm | Pendiente. | Preparar checklist; no cerrar hasta completar los flujos y la DoD. |

### PRs abiertos y revisión

**Nota de mantenimiento (agregada 2026-09-22, a pedido de portalmatias):** esta sección
detallaba el estado individual de cada PR abierto, y se desactualizó sola en cuestión de
horas — #25/#26/#28 pasaron de "abiertos, pedir revisión" a mergeados entre que se escribió
y que se revisó. GitHub es la fuente de verdad para qué PR está abierto, aprobado o
mergeado; esta sección ya no intenta duplicarla en detalle, solo linkea:

```bash
gh pr list --state open
gh pr checks <numero>       # el estado del check de Cubic no implica que sus observaciones estén resueltas
```

Quedan abiertos: [#27 — controllers y contrato de `gestion-salon`](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/27)
(esperando revisión de un compañero) y este mismo roadmap
([#29](https://github.com/portalmatias/Restaurante-MVP-Trabajo-Practico/pull/29)).

### Orden recomendado y trabajo disponible

1. ~~**Matías:** revisar #28 ya corregido; coordinar con Fede la integración de #26/#28.~~
   **Cerrado el 2026-09-21:** #26 y #28 mergeados a `main`.
2. **Compañero revisor:** revisar #27 (controllers y contrato de `gestion-salon`, ya
   desbloqueado por el merge de #28).
3. ~~**Fede:** atender pendientes de #25 y probar auth contra PostgreSQL en CI.~~
   **Cerrado el 2026-09-21:** #25 mergeado. El registro en `AppModule` y el contrato
   OpenAPI de `/auth/login`, que quedaban pendientes de ese PR, los completó #27.
4. **Matías:** abrir/revisar disponibilidad y después implementar `reservas-crear`.
5. **Facundo:** implementar cancelación y VIP en cuanto #27 mergee y se cumplan sus
   prerrequisitos (`reservas-crear`). Mientras tanto, revisar disponibilidad, preparar
   matrices de pruebas y mantener documentación; modificar PRs ajenos solo con
   autorización del responsable, como se acordó para #28.

### Fundación y protección de main

- `fundacion-repo` mergeado (#10, #11) y archivado (#13).
- La protección de `main` se documentó como aplicada el 2026-09-14 (0.2 y 0.4).
  El 2026-09-19 el endpoint de la rama confirmó `protected: true` y los tres checks
  requeridos con enforcement para todos. **Pendiente de reconfirmación por portalmatias:**
  las opciones detalladas de aprobación, descarte de reviews y force-push; la consulta de
  protección clásica devolvió `404` con este acceso y la de reglas aplicables una lista
  vacía. Eso no demuestra ausencia de protección. No se cambiaron permisos.
  Configuración documentada/esperada:

  | Regla | Valor |
  |---|---|
  | PR obligatorio | sí, **1 aprobación** |
  | Aprobaciones viejas se descartan si entran commits nuevos | sí |
  | Checks obligatorios | `Especificación (OpenSpec + OpenAPI)`, `Lint y tipos`, `Tests (backend)` |
  | Rama al día con `main` antes de mergear | no (con tres tracks en paralelo obligaría a rebasear todo el tiempo) |
  | Se aplica también a admins | **sí** |
  | Force-push y borrado de `main` | prohibidos |

  Política del equipo: exigir revisión de un compañero; el autor no puede autoaprobarse.
  Una aprobación ajena y los checks requeridos habilitan el merge, sujeto a las reglas
  efectivamente configuradas. Esto no prohíbe que el autor ejecute el merge tras la aprobación.

**Tres cosas que aprendimos y afectan a todos los changes que vienen:**

1. **Un PR de spec no puede agregar paths a `openapi/openapi.yaml`.** El job obligatorio
   "Especificación" corre `npm run openapi:check`, que compara literalmente `paths` y
   `components.schemas` del YAML contra lo que genera `@nestjs/swagger` desde los controllers.
   Un path sin controller pone CI en rojo. Por eso el fragmento OpenAPI de cada endpoint va en
   el `design.md` del change (sección "Contrato OpenAPI") y se copia al YAML en el PR de
   implementación, junto con el controller. Esto corrige lo que prometía §9 de este documento
   (ver ahí): el frontend puede arrancar leyendo el contrato del `design.md`, no del YAML.
   Si el equipo necesita el YAML antes, la salida es enseñarle a `openapi-check` a ignorar
   paths marcados como planeados, en un change propio que toque `scripts/`.
2. **`openapi:check` da un falso rojo con enums.** Con cualquier enum declarado con `enumName`,
   `@nestjs/swagger` deja `x-enumNames: undefined` en el documento en memoria y el diff lo
   cuenta como deriva. Se arregla normalizando el documento generado con
   `JSON.parse(JSON.stringify(doc))` antes de comparar. Detalle en el `design.md` de
   `disponibilidad` (Risks). Le va a pasar a cualquier endpoint con enums.
3. **Fechas y zona horaria.** Los horarios de `Turno` (`12:00`, `20:00`) son hora **local** del
   restaurante, no UTC, aunque la columna sea `@db.Time`. Cualquier cálculo contra "ahora"
   (anticipación, ventana de cancelación, "el turno ya pasó") tiene que convertir
   `fecha + hora` local a un instante UTC usando la zona horaria del restaurante. Si se toman
   como UTC, todas las ventanas quedan corridas 3 horas. Además, `getDay()`/`getHours()`
   dependen de la zona horaria del proceso (la máquina de desarrollo está en Buenos Aires y CI
   en UTC): hay que usar siempre `getUTC*` y `Date.UTC`. **Decisión vigente: offset fijo
   UTC−3**, no una zona configurable. #12 incorporó `backend/src/common/timezone.ts`:
   reutilizar `inicioTurnoUtc` y `finTurnoUtc`, incluido el cruce de medianoche. La spec de
   disponibilidad se incorporó en #19 y se alineó en #21; la de cancelación se incorporó
   en #16 y se alineó en #23. Ambos ajustes adoptan el offset fijo UTC−3.

## 1. Punto de partida (histórico)

Al redactar el plan original, el repositorio tenía **cinco archivos y cero líneas de código**:
solo `.claude/` y `openspec/`. El único change,
[`diseno-general-app`](../openspec/changes/archive/2026-09-07-diseno-general-app/), estaba completo:
fijó las cuatro decisiones que estaban en conflicto entre `config.yaml` y `requerimientos-mvp.docx`
(cliente sin cuenta, enum de estados, rango VIP 2-12, asignación *best fit*) y dejó el mapa de
arquitectura general. No agregó comportamiento.

El problema ahora no es *qué* construir —eso ya está en §6 y en el docx— sino **en qué orden y
quién**.

## 2. Huecos de proceso detectados (histórico)

Los siguientes hallazgos motivaron el plan inicial; **no describen el estado actual**.
La documentación, CI, contrato y participación de los tres integrantes ya existen; #3 está
mergeado. Las opciones detalladas de revisión de `main` requieren la reconfirmación indicada
al inicio; la rama sí figura protegida.

Tres restricciones que entonces no se cumplían:

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
- **El frontend puede prepararse en paralelo**, leyendo el contrato planeado en `design.md`.
  Los tipos HTTP se generan desde el contrato, no se escriben a mano; los paths se incorporan
  al YAML ejecutable junto con los controllers (ver §9).

## 4. Fase 0 — Destrabar (sin código)

Nada de esto necesita un change de OpenSpec: no son features y no cambian comportamiento.

| # | Acción | Dueño |
|---|---|---|
| 0.1 | ✅ PR #3 mergeado: `diseno-general-app` archivado. | FedeWerk (review) |
| 0.2 | ✅ Activar **branch protection** en `main`: require PR, 1 approval, prohibir force-push. Los *required status checks* se agregan recién en 0.4. | portalmatias |
| 0.3 | ✅ Documentos incorporados en #4; `.gitignore` presente y ampliado en #14. | FedeWerk (documentos); mantenimiento compartido |
| 0.4 | ✅ *(tras Fase 1)* Marcar los jobs de `ci.yml` como required status checks. | portalmatias |

El reparto inicial asignaba 0.3 a Facundo; los documentos los incorporó Fede en #4.
Facundo ya contribuyó las specs de salón, cancelación y VIP y la implementación de salón.
Las tareas 0.2/0.4 constan como cerradas: protección y checks confirmados actualmente;
opciones detalladas de aprobación pendientes de reconfirmación.

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

Resumen del workflow en `main` (dispara en `pull_request` y en push a `main`):

```
job: spec   -> openspec validate --all --strict + lint OpenAPI + build + openapi:check
job: lint   -> npm run lint  +  tsc --noEmit (ambos workspaces)
job: test   -> unitarios backend + e2e de arranque + tests de scripts (SIN base de datos)
```

> **Por qué el job `test` no toca la base todavía.** En la Fase 1 no existen `schema.prisma`,
> migraciones ni `seed.ts` — llegan en la Fase 2. Si el job corriera `db:migrate` / `db:seed`,
> fallaría con *"Missing script"* y el PR quedaría en rojo, contradiciendo la premisa de que el
> PR que agrega `ci.yml` puede estar verde por sí mismo. Los pasos con Postgres se agregan
> después, en el change `ci-integracion-db` (§6.1), y no dentro de `modelo-dominio`, porque §14
> prohíbe tocar `.github/workflows/` en un PR de feature.

Tres cosas a resolver dentro de este change, las dos primeras con justificación en su `design.md`
porque §2 prohíbe sumar librerías sin argumentarlo:

1. Cómo se invoca la CLI de OpenSpec en CI (dependencia de dev vs `npx`).
2. Qué linter de OpenAPI se usa (Spectral o Redocly).
3. **Quién es la fuente de verdad del contrato OpenAPI** — ver abajo.

### La fuente de verdad del contrato OpenAPI

Hay una tensión real dentro de la constitución: §2 describe el contrato como
"Generado/validado desde el backend", pero §3 lo llama "el contrato formal de la API,
**versionado en el repo** y validado en CI". No pueden ser las dos cosas a la vez, y de cuál
valga depende que el paralelismo de la Fase 5 funcione: si el YAML se genera desde los
controllers, no existe hasta que el backend exista, y el frontend no puede arrancar antes.

**Decisión adoptada: contract-first.** El `openapi/openapi.yaml` escrito a mano es la fuente de verdad.
Es lo que habilita que el frontend arranque en paralelo, y es como lo describe §3. Para no
perder lo que §2 pide, **CI genera el spec desde `@nestjs/swagger` y lo diffea contra el YAML
commiteado**: si la implementación se desvía del contrato, el job falla. Así el contrato se
escribe primero *y* queda validado contra el backend.

La redacción de §2/§3 de `config.yaml` ya refleja esta decisión. Los contratos planeados
quedan en `design.md` hasta que sus controllers se incorporen a la aplicación.

> **Tradeoff asumido.** Este PR es más grande de lo que le gustaría a §14 ("cambios chicos y
> revisables"). Casi todo es output de generadores. Mitigación: el `tasks.md` lo parte en tareas
> de ≤2h, y el review se concentra en los cuatro archivos que *no* son boilerplate — `ci.yml`,
> `.env.example`, `docker-compose.yml`, `openapi.yaml`. Partirlo en dos PRs sería peor: el primero
> tendría CI inexistente y el segundo la agregaría tocando `.github/workflows/` fuera de su propio
> change, contra §14.

## 6. Fase 2 — Modelo de dominio (secuencial, bloquea todo el backend)

**Change `modelo-dominio`** — dueño: **FedeWerk**

**Estado:** spec #7 e implementación #12 mergeadas; archivado pendiente de verificar DoD.

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

### 6.1. Change `ci-integracion-db` — inmediatamente después

**Dueño: FedeWerk. Estado:** #26 (spec) y #28 (implementación) mergeados (2026-09-21).

Alcance: agregar al `ci.yml` un service container PostgreSQL, ejecutar `prisma migrate deploy`
y `db:seed` antes de los tests, y agregar `test:integration` después de los e2e existentes.
También actualizar README, roadmap y artefactos del change. Resolver la equivalencia con
Docker Compose exigida por §9 y la configuración de arranque para los jobs que instancian
la app. Fue en un change propio porque §14 prohíbe tocar workflows en un PR de feature.

Es la contrapartida directa de haber dejado el job `test` sin base de datos en la Fase 1: con
el merge, los tests de integración contra base real que exige §9 corren en CI en `main` —
ya no es solo verificación local del PR.

## 7. Fase 3 — Backend en paralelo (tres tracks)

| Change | Dueño | Depende de | Alcance |
|---|---|---|---|
| `auth-admin` | FedeWerk | modelo-dominio | `POST /auth/login`, bcrypt, `@nestjs/jwt` + Passport, `JwtAuthGuard` + `RolesGuard`. Tests obligatorios de §9: ruta admin sin token y con rol incorrecto. |
| `disponibilidad` | portalmatias | modelo-dominio | `GET /disponibilidad` + **el validador de reglas compartido** (turno activo, ventanas de anticipación, rango de comensales por zona, aforo). El `design.md` es explícito: `reservas` lo reutiliza, no lo reimplementa. |
| `gestion-salon` | lussofacundo-iresm | auth-admin (impl) | CRUD de zonas, mesas y turnos bajo `/admin`, protegido por guard. Módulos NestJS `zonas/`, `mesas/`, `horarios/` separados. |

`gestion-salon` ya tiene services, DTOs y tests mergeados (#24). #27 (abierto, esperando
revisión) agrega los tres controllers, registra `AuthModule`/`ZonasModule`/`MesasModule`/
`HorariosModule` en `AppModule` (ya no bloqueado: `ci-integracion-db` #28 le dio a CI
Postgres para todo el job `test`) y publica el contrato OpenAPI completo, incluido
`/auth/login` — que quedaba pendiente desde `auth-admin` (#25) por el mismo motivo.

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

Puede prepararse en paralelo al backend leyendo las specs y sus contratos planeados.

> **Corrección (2026-09-14):** la entrada en `openapi.yaml` no puede mergearse antes que el
> controller, porque el chequeo de deriva de CI lo impide (ver el estado al inicio). Lo que
> se mergea con la spec es el fragmento OpenAPI dentro del `design.md` del change. Mientras
> un endpoint no esté implementado, el frontend usa ese diseño para preparar pantallas.
> La generación de tipos desde fragmentos planeados requiere definir el mecanismo en
> `frontend-base`; no autoriza escribir tipos HTTP a mano ni agregar paths ficticios al YAML.

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
FedeWerk            modelo-dominio, ci-integracion-db (chico),
                    auth-admin, reserva-consultar,
                    frontend-base (chico), frontend-admin             -> 6 changes
lussofacundo-iresm  gestion-salon, cancelacion-turnos, reserva-vip,
                    entrega-final                                     -> 4 changes
```

14 changes x 2 PRs = **~28 PRs**, más los de Fase 0. §11 exige que cada integrante ejecute las
sesiones de su propio módulo y commitee bajo su propia autoría: nadie mergea trabajo generado en
nombre de otro.

> **El recuento son items, no esfuerzo.** `ci-integracion-db` y `frontend-base` son chicos, así
> que los 6 de Fede pesan parecido a los 4 de los demás. Dos ajustes fáciles si al equipo le
> queda desbalanceado: mover `frontend-admin` a Facundo, o `ci-integracion-db` a Matías.
>
> Nota: la tarea 0.3 (docx + `.gitignore`) estaba pensada para abrirle el historial a Facundo,
> pero los documentos los incorporó Fede en el PR #4. Facundo ya aportó las specs de
> `gestion-salon`, `cancelacion-turnos`, `reserva-vip` y los services de salón.

```
Fase 0  [destrabar]     ---- todos, en paralelo, sin codigo
           |
Fase 1  [fundacion]     ---- SECUENCIAL (matias)   <-+ los otros dos escriben
           |             CI sin base de datos        | las spec PRs de Fase 3
Fase 2  [modelo]        ---- SECUENCIAL (fede)     <-+
           |
       [ci-integracion-db] (fede, chico)
           |             CI ya corre contra postgres
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

- **Cuello de botella actual:** revisión y merge de #27 (controllers de `gestion-salon`,
  registro en `AppModule` y contrato OpenAPI); disponibilidad y creación para implementar
  cancelación/VIP. Fundación, modelo, auth y PostgreSQL en CI ya están mergeados. Avanzar
  revisiones, specs y preparación de pruebas sin saltar prerrequisitos.
- **Librerías nuevas que §2 obliga a justificar en su `design.md`:** el linter de OpenAPI y la CLI
  de OpenSpec en CI (Fase 1), y el generador de tipos desde OpenAPI (Fase 5). `@nestjs/jwt`,
  Passport, bcrypt y `@nestjs/throttler` ya están avaladas por §5.
- **Contrato OpenAPI:** resuelto como contract-first en §2/§3 de la constitución. Sigue
  pendiente integrar y verificar el fix de normalización de enums que está en la rama de
  disponibilidad, no en `main`.
- ~~**La cobertura de CI crece en dos etapas.** Entre la Fase 1 y `ci-integracion-db` (§6.1), CI
  corre lint, tipos y unitarios, pero **no** tests contra base real. Es una ventana corta y
  deliberada; el riesgo es olvidarse de cerrarla y dejar los e2e de §9 fuera del pipeline.~~
  **Cerrado el 2026-09-21:** `ci-integracion-db` (#28) mergeó a `main`, con un service
  container de Postgres en el job `test`, migración, seed y `test:integration` corriendo en
  cada PR. #27 serializa las suites de integración que comparten datos
  (`maxWorkers: 1`) — no ejecutar dos suites completas de `test:integration` contra la misma
  base simultáneamente.
- ~~**Los required status checks (0.4) no se pueden configurar antes de la Fase 1** — GitHub solo los
  ofrece después de que el check corrió al menos una vez. Es fácil olvidarse y dejar `main` a medio
  proteger.~~ **Cerrado el 2026-09-14:** configurados junto con la protección de `main`.
- **El repositorio es público.** Ningún `.env`, credencial ni URL real de base entra en ningún
  commit; el `.gitignore` de 0.3 es la primera línea de defensa (ya existe desde el PR #4).
- **Archivado pendiente:** solo diseño general y fundación están archivados. Mergear una
  implementación no publica automáticamente sus specs en `openspec/specs/`; verificar DoD
  y ejecutar el flujo de archivado cuando corresponda, sin cerrar funcionalidades parciales.

## 13. Verificación por fase

**Fase 0**

```bash
gh pr list --state open                                # PR #3 ya no aparece
gh api repos/portalmatias/Restaurante-MVP-Trabajo-Practico/branches/main --jq '{protected, protection}'
openspec list                                          # revisar activos; no exigir lista vacía
ls docs/requerimientos-mvp.docx .gitignore
```

Confirmar `protected: true` y los checks requeridos en la respuesta de la rama.
El endpoint detallado `branches/main/protection` puede devolver `404` según los permisos
o el mecanismo de reglas: no interpretarlo por sí solo como ausencia de protección.
Portalmatias debe reconfirmar las opciones detalladas de aprobación indicadas al inicio.

**Fase 1** — el PR debe mostrar los tres jobs de CI en verde, y en limpio:

```bash
npm install && docker compose up -d && npm run dev     # backend y frontend levantan
openspec validate --strict
```

**Fase 2** — idempotencia del seed e invariantes:

```bash
npm run db:migrate -w backend && npm run db:seed -w backend
npm run db:seed -w backend                             # segunda corrida: sin duplicados
npm run test -w backend
npm run test:integration -w backend                    # invariantes contra base de test
```

**`ci-integracion-db` (§6.1)** — el PR tiene que mostrar el job `test` levantando Postgres y
corriendo migraciones, seed, unitarios, e2e e integración. Compuerta: que un test de integración
que falle a propósito **ponga el PR en
rojo**; si pasa igual, el service container no se está usando.

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
