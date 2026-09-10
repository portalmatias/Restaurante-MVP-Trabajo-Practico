## Context

Ver `proposal.md` — Why. El estado de partida es un repositorio con cero código: solo
`.claude/`, `docs/` y `openspec/`. `.gitignore` ya existe (PR #4) y cubre `node_modules/`,
`.env`, `dist/`, `.next/` y `coverage/`, así que este change no necesita tocarlo.

Tres restricciones dan forma al diseño:

1. **§13 hace de "CI en verde" un requisito de todo change.** Mientras no exista `ci.yml`,
   ningún change puede cerrarse formalmente. Eso obliga a que CI nazca acá y no después.
2. **§14 prohíbe tocar `.github/workflows/` dentro de un PR de feature.** Combinado con lo
   anterior, el CI tiene que entrar en este change (que es bootstrap, no feature) o en uno
   propio. Entra acá.
3. **Este change bloquea a los otros dos integrantes** durante toda la Fase 1 del roadmap.
   Cuanto antes se cierre, antes arranca `modelo-dominio`.

## Goals / Non-Goals

**Goals:**

- Dejar el monorepo en un estado donde `npm install && docker compose up -d && npm run dev`
  levante backend y frontend, tal como promete el bloque "Primer arranque" de §10.
- Que el PR de este change tenga **CI verde en sí mismo**, sin excepciones a §13.
- Resolver de forma explícita y trazable la contradicción §2 ↔ §3 sobre el contrato OpenAPI,
  porque de ella depende el paralelismo de toda la Fase 5.
- Dejar el trabajo partido en dos tracks que puedan avanzar **en paralelo sin pisarse**.

**Non-Goals:**

- Ningún módulo de dominio en `backend/src/` — los trae `modelo-dominio`.
- Ninguna pantalla en `frontend/` — las trae `frontend-base`.
- Ningún `schema.prisma`, migración ni `seed.ts`. Este change instala Prisma como dependencia
  y deja el `DATABASE_URL`, nada más.
- Ningún `path` de dominio en `openapi/openapi.yaml`. El único que queda documentado es
  `GET /`, el endpoint de estado que genera el scaffolding de NestJS (ver D2).
- Los pasos de CI que necesitan PostgreSQL. Van en `ci-integracion-db` (roadmap §6.1).
- Los *required status checks* en la protección de `main`: GitHub solo los ofrece después de
  que el check corrió al menos una vez. Es la tarea 0.4 del roadmap, posterior a este PR.

## Decisions

### D1 — Contract-first: `openapi/openapi.yaml` escrito a mano es la fuente de verdad

`config.yaml` §2 dice que el contrato se genera "desde el backend"; §3 dice que se versiona
en el repo. No pueden ser las dos cosas. Se resuelve a favor de **contract-first**, y se
corrige la redacción de §2 en este mismo change.

*Por qué:* si el YAML se genera desde los controllers, no existe hasta que el backend exista,
y el frontend de la Fase 5 no puede arrancar en paralelo. El roadmap entero está construido
sobre ese paralelismo. Además §7 ya exige que los tipos del cliente HTTP se deriven del
contrato — para eso el contrato tiene que preceder al código, no seguirlo.

*Para no perder lo que pedía §2*, CI genera el spec desde `@nestjs/swagger` y lo **diffea
contra el YAML commiteado**. Si la implementación se desvía del contrato, el job `spec` falla.
El contrato se escribe primero *y* queda verificado contra el backend.

*Alcance del diff:* solo `paths` y `components.schemas`. `info`, `servers` y
`securitySchemes` son metadata editorial del YAML a mano y siempre van a diferir de lo que
genera Nest; compararlos daría falsos rojos permanentes.

*Alternativa descartada — generar desde los controllers (code-first):* es el flujo más común
en NestJS y elimina la posibilidad de deriva por construcción. Se descarta porque vuelve
secuencial toda la Fase 5 y contradice §7. Si el equipo cambia de opinión, **hay que hacerlo
antes de `auth-admin`**: es la decisión más cara de revertir del proyecto.

### D2 — El chequeo de deriva se implementa ahora, y resultó no ser vacuo

*Por qué implementarlo acá:* diferirlo significa que el change que lo agregue después va a
tener que tocar `.github/workflows/`, y §14 solo se lo permite a un change propio de CI. Sería
un tercer change de pipeline sin necesidad. Además, dejar la compuerta instalada desde el día
uno evita el escenario de agregarla cuando la deriva ya existe y hay que arreglar diez
endpoints juntos.

*Lo que se esperaba:* que el chequeo pasara trivialmente, con `paths: {}` de los dos lados, y
que recién se probara de verdad en `auth-admin`.

*Lo que pasó:* en la primera corrida se puso **rojo**. `nest new` genera un `AppController`
con `GET /` que devuelve `"Hello World!"`, y el YAML declaraba `paths: {}`. La compuerta
funcionó a la primera, en la Fase 1, sin necesidad de esperar a un endpoint de dominio.

*Cómo se resolvió:* se documentó `GET /` en el contrato como endpoint de estado del servicio,
en vez de borrar el controller. Borrarlo habría dejado al job `test` de CI sin ningún test que
correr —es el único que existe hasta la Fase 2— y lo habría vuelto verde por vacuidad, que es
lo contrario de lo que §12 quiere del pipeline. El controller quedó decorado con
`@ApiOperation` / `@ApiOkResponse` en español (§8) y el service devuelve un texto de estado
en lugar del `"Hello World!"` del scaffolding.

*Lo que esto enseñó sobre el chequeo:* cada endpoint nuevo obliga a que los decoradores de
Swagger y el YAML escrito a mano coincidan en `summary`, `description`, `operationId` y la
forma de cada respuesta. Es más disciplina de la que sugería D1, y es el costo real de
contract-first. Conviene que `auth-admin`, que es el primer endpoint de dominio, lo tenga
presente desde el principio: el orden que funciona es escribir el YAML, decorar el controller
para que genere exactamente eso, y recién ahí implementar.

*Qué diferencias NO son deriva:* la comparación arrancó siendo literal, y el review mostró que
así iba a dar rojos falsos en cuanto apareciera el primer DTO. **Una diferencia de orden solo
cuenta como deriva si el orden es dato.** `required`, `enum` y `tags` se comparan como
multiconjuntos —NestJS los emite en el orden de declaración de las propiedades del DTO, que no
tiene por qué coincidir con el del YAML—, y los `parameters` se emparejan por `name` + `in`,
que es como los identifica la spec de OpenAPI. En cambio `example`, `default` y cualquier otra
lista de datos se comparan en orden, porque ahí el orden sí es información.

Esa lógica vive en `scripts/openapi-diff.mjs`, separada del bootstrap de Nest para poder
testearla sin build. Sus tests (`scripts/openapi-diff.test.mjs`, con `node --test`) corren en
CI y cubren cada uno de los casos de arriba en las dos direcciones: que el orden no dispare un
rojo falso, y que una diferencia real se siga detectando.

### D9 — Una sola versión de TypeScript y de ESLint fijadas en la raíz

Descubierto durante la implementación, no anticipado en el plan original.

`eslint-config-next@16.3.4` declara **como peer dependencies** `eslint: ">=9.0.0"` y
`typescript: ">=3.3.1"`. Son dos rangos sin techo, y npm instala las peer dependencies solo:
resolvió ESLint a la 10 y TypeScript a la 6.0.3, y hoisteó las dos a la raíz, mientras cada
workspace se quedaba con su propio TypeScript 5.9.3 anidado, resuelto desde rangos con caret
distintos (`^5.7.3` en `backend`, `^5` en `frontend`). Eso rompió dos cosas a la vez:

1. ESLint 10 crasheaba al cargar `eslint-plugin-react@7.37.5`, que declara peer `eslint ^9.7`.
2. Con dos compiladores en el mismo repo, ESLint resolvía TypeScript 6 desde la raíz y
   `@types/jest` no resolvía, así que los specs del backend daban once errores fantasma de
   `no-unsafe-call` mientras `tsc` pasaba en limpio desde el workspace.

*Decisión:* `typescript` y `eslint` se declaran **explícitamente como devDependencies de la
raíz, con versión exacta** (`5.9.3` y `9.39.5`), y los dos workspaces declaran esa misma
versión exacta de `typescript` en lugar de un rango con caret. Así las herramientas
transversales y los workspaces resuelven siempre el mismo compilador. Es una extensión natural
de D4: en un monorepo con hoisting, dejar que el rango de una peer dependency ajena elija la
versión de una herramienta compartida es una fuente silenciosa de fallos que se contradicen
entre sí.

*Regla que queda:* cualquier herramienta que corra desde la raíz sobre los dos workspaces
—compilador, linter, formateador— se declara en la raíz con versión exacta, y ningún workspace
la vuelve a declarar con un rango que pueda derivar.

*Corolario, aprendido en el review:* lo mismo aplica a los **runtimes**. `engines` decía
`node: "20.x"` mientras el README prometía "Node 20 LTS o superior", y `concurrently@10.0.5`
pedía `node >=22` sin que nadie lo notara porque la máquina de desarrollo corre Node 24. Los
rangos de `engines` tienen que decir la verdad de lo que el proyecto soporta, y CI es el único
lugar donde eso se comprueba. *(La versión de `concurrently` que disparó esto fue la 10.0.5, que
se instaló brevemente durante la implementación; el repo quedó en la 9.2.4, que pide `node >=18`.)*

### D3 — Spectral como linter de OpenAPI

Se adopta `@stoplight/spectral-cli` con el ruleset `spectral:oas`, configurado en
`.spectral.yaml` en la raíz.

*Por qué sobre Redocly CLI:* ambos son gratuitos, se instalan por npm y validan OpenAPI 3.1.
Spectral es el más neutral de los dos — su ruleset base es el estándar de OAS y no empuja
hacia convenciones ni hacia el registro de un vendor. Redocly CLI trae reglas propias
activadas por defecto que habría que ir apagando, y su flujo natural apunta a su plataforma.
Para un TP evaluable, la herramienta que menos supuestos propios mete es la mejor.

### D4 — La CLI de OpenSpec entra como devDependency de la raíz, no como `npx`

*Por qué:* `npx openspec` resuelve la última versión publicada en cada corrida de CI. Una
release nueva de OpenSpec podría poner en rojo un PR que no cambió nada — y §12 dice que un PR
en rojo no se mergea nunca. Como devDependency, la versión queda fijada en `package-lock.json`
y actualizarla es un commit explícito y revisable.

§4 permite instalar en la raíz las herramientas transversales; la CLI de OpenSpec lo es.

### D5 — Un solo servicio de PostgreSQL con dos bases, no dos contenedores

`docker-compose.yml` levanta **un** contenedor de PostgreSQL con dos bases: `reservas_dev` y
`reservas_test`, creadas por un script de init.

*Por qué:* §10 pide que la base de test sea separada de la de desarrollo "con `_test` como
sufijo" — el sufijo describe nombres de base, no de servidor. Un solo contenedor garantiza que
las dos bases corran exactamente la misma versión de PostgreSQL, usa un solo puerto y un solo
healthcheck. `prisma migrate reset` sobre la base de test solo afecta a la base de su
`DATABASE_URL`, así que el aislamiento que importa se mantiene.

*Alternativa descartada — dos contenedores:* aísla más (un `docker compose down -v` de test no
toca dev), pero duplica recursos y suma un segundo puerto a documentar, a cambio de un
aislamiento que en la práctica ya da el nombre de base.

### D6 — `concurrently` para que `npm run dev` levante los dos workspaces

`npm run dev --workspaces` los corre **en secuencia**: el backend arranca, bloquea, y el
frontend nunca levanta. Como §10 promete explícitamente que `npm run dev` levanta ambos, hace
falta un runner paralelo. Se adopta `concurrently` en la raíz.

*Alternativa descartada — `npm-run-all`:* equivalente en función, pero sin releases desde hace
años. `concurrently` está mantenido y su salida etiquetada por proceso es más legible cuando
los dos servidores escriben al mismo tiempo.

### D7 — El trabajo se parte en dos tracks con propiedad de archivos disjunta

El volumen de este change es casi todo salida de generadores, y §14 pide cambios revisables.
Se parte en dos tracks que pueden ejecutarse **en paralelo sobre el mismo working tree**
porque ningún archivo tiene dos dueños:

```
  TRACK A -- esqueleto               TRACK B -- infra y contrato
  (salida de generadores)            (los archivos que se revisan de verdad)
  --------------------------         ------------------------------------
  package.json (raiz)                docker-compose.yml + init de bases
  eslint.config.mjs, .prettierrc     .env.example
  backend/**   (nest new)            openapi/openapi.yaml + .spectral.yaml
  frontend/**  (create-next-app)     .github/workflows/ci.yml
  README.md                          openspec/config.yaml  (seccion 2)
```

Para que B pueda escribir `ci.yml` sin esperar a que A termine, este design **fija por
adelantado la interfaz** entre los dos tracks. A se compromete a producirla; B puede asumirla:

| Contrato | Valor |
|---|---|
| `npm run lint` | ESLint sobre ambos workspaces |
| `npm run typecheck` | `tsc --noEmit` sobre ambos workspaces |
| `npm run test -w backend` | Jest, los specs que genera `nest new` |
| `npm run dev` | ambos workspaces vía `concurrently` |
| `npm run openapi:lint` | Spectral sobre `openapi/openapi.yaml` |
| `npm run openapi:check` | genera desde `@nestjs/swagger` y diffea `paths` + `components.schemas` |
| Node / npm | 20 LTS / 10 |
| Puertos | frontend `3000`, backend `3001`, PostgreSQL `5432` |
| Bases | `reservas_dev`, `reservas_test` |

Cualquier cambio a esta tabla se acuerda entre los dos tracks antes de aplicarlo, no se decide
de un lado.

### D8 — El job `test` de esta primera versión no levanta PostgreSQL

En la Fase 1 no existen `schema.prisma`, migraciones ni `seed.ts`. Si el job corriera
`db:migrate` / `db:seed` fallaría con *"Missing script"* y el PR quedaría en rojo,
contradiciendo el objetivo de que este PR tenga CI verde por sí mismo.

El service container de PostgreSQL y los tests e2e de §9 se agregan en `ci-integracion-db`,
inmediatamente después de `modelo-dominio`, en un change propio por §14.

## Risks / Trade-offs

- **El PR es grande y §14 pide cambios chicos.** → Casi todo su volumen es boilerplate de
  generadores. `tasks.md` lo parte en tareas de ≤2h y el review se concentra en los seis
  archivos que *no* son boilerplate: `ci.yml`, `.env.example`, `docker-compose.yml`,
  `openapi.yaml`, `package.json` de la raíz y la edición de `config.yaml`. Partirlo en dos PRs
  sería peor: el primero no tendría CI y el segundo lo agregaría fuera de su propio change.

- ~~El chequeo de deriva del contrato (D2) no se ejerce hasta `auth-admin`.~~ **Riesgo
  cerrado en la implementación:** el chequeo se puso rojo en su primera corrida, con el
  `GET /` del scaffolding. Está probado que funciona. Lo que queda como criterio de
  aceptación de `auth-admin` es lo inverso: que su PR demuestre que se puede escribir un
  endpoint de dominio cuyos decoradores generen **exactamente** el YAML escrito a mano, sin
  falsos rojos. Ese es el costo de contract-first que D2 documenta.

- **Los generadores cambian de versión.** `nest new` y `create-next-app` producen salida
  distinta según cuándo se corran, y los tres integrantes no van a correrlos el mismo día. →
  Se fijan las versiones de las CLIs en `tasks.md` y el `package-lock.json` se commitea. A
  partir de ahí nadie más regenera nada.

- **Dos sesiones en paralelo sobre el mismo working tree pueden pisarse.** → La tabla de D7
  asigna cada archivo a exactamente un track. `package.json` de la raíz es del track A: si B
  necesita un script, lo pide, no lo escribe.

- **Los required status checks no se pueden configurar todavía.** GitHub solo los ofrece
  después de la primera corrida del check. → Queda como tarea 0.4 del roadmap, explícitamente
  fuera de este change. El riesgo real es olvidarse y dejar `main` a medio proteger; se anota
  en la descripción del PR.

- **`openspec validate --strict` en el job `spec` no valida nada sustantivo todavía**, porque
  `openspec/specs/` está vacío hasta la Fase 2. → Esperable, no un error. La compuerta se
  ejerce de verdad con la primera spec real, en `modelo-dominio`.

## Migration Plan

No hay migración: el repositorio no tiene estado previo que preservar. El orden de ejecución sí
importa, porque `npm install` de la raíz necesita que los dos workspaces existan:

```
  1. Track A: package.json raiz con workspaces (aunque los directorios esten vacios)
  2. Track A: nest new backend  +  create-next-app frontend
  3. Track A: npm install desde la raiz  ->  package-lock.json unico
  4. Track B: en paralelo desde el paso 1, contra el contrato de D7
  5. Integracion: npm run lint / typecheck / test en limpio
  6. docker compose up -d  +  npm run dev  ->  verificacion manual del punto 10
  7. PR -> los tres jobs de CI en verde -> review -> merge
```

*Rollback:* si algo del bootstrap resulta inservible, se revierte el merge commit. Ningún otro
change depende todavía de este, así que el costo de revertir es cero hasta que arranque
`modelo-dominio`.
