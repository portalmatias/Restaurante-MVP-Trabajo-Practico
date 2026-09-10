---
name: ci-github-actions
description: Guía para crear o revisar el workflow de CI (.github/workflows/ci.yml) de este proyecto con GitHub Actions, alineado a la consigna del TP y a openspec/config.yaml §12. Usar cuando se trabaje en el change fundacion-repo, en ci-integracion-db, o en cualquier PR que toque .github/workflows/.
metadata:
  type: project-skill
  owner: equipo
---

# CI con GitHub Actions — Sistema de Reservas

Esta skill no reemplaza a `openspec/config.yaml` (la constitución del proyecto): es una guía
operativa para que **cualquiera de los 3 integrantes**, con cualquier sesión de Claude Code
sobre este repo, arme o revise el CI de la misma forma. Si algo acá contradice `config.yaml`
o `docs/roadmap-mvp.md`, esos dos mandan.

## 1. Qué exige la consigna (no negociable)

`docs/consigna-tp-reservas-openspec-cicd.pdf`, sección "Integración Continua", pide un
workflow en `.github/workflows/ci.yml` que corra en **cada PR y en cada push a `main`**, y que
haga exactamente esto:

1. Validación / linter de los archivos de OpenSpec.
2. Ejecución de pruebas unitarias o de integración del código base.
3. Bloqueo automático del merge si la validación o las pruebas fallan.

Un entregable evaluado aparte es el **"Historial de Integración"**: PRs cerrados con
ejecuciones **verdes** en GitHub Actions. Esto importa para la secuencia de trabajo: un CI que
nunca se puso verde en un PR real no cuenta como cumplido, aunque el YAML esté commiteado.

## 2. Qué agrega `config.yaml` §12 por encima de la consigna

El equipo decidió sumar un cuarto paso que la consigna no pide explícitamente pero que
`config.yaml` fija como obligatorio:

4. Lint de código (`ESLint`) y chequeo de tipos (`tsc --noEmit`).

Los 4 pasos bloquean el merge si fallan (§12: "un PR con CI en rojo no se mergea nunca").

## 3. Quién y cuándo (según `docs/roadmap-mvp.md`)

- El `ci.yml` **inicial** nace en el change `fundacion-repo` (Fase 1), junto con el resto del
  monorepo (`package.json`, `docker-compose.yml`, `openapi/openapi.yaml` esqueleto). No es un
  change aparte porque §14 de `config.yaml` prohíbe tocar `.github/workflows/` en un PR de
  *feature*, pero `fundacion-repo` no es una feature: es el bootstrap del repo.
- Ese PR **puede tener CI verde en sí mismo**: GitHub Actions usa el workflow del branch head
  en el evento `pull_request`, así que el archivo que agrega `ci.yml` ya se evalúa con ese
  mismo `ci.yml`. No hace falta ninguna excepción a la Definition of Done.
- El job `test` de esa primera versión **no toca la base de datos** — todavía no existe
  `schema.prisma` ni `seed.ts` (llegan en `modelo-dominio`, Fase 2). Si corriera
  `db:migrate`/`db:seed` fallaría por *"Missing script"* y contradiría la premisa de arriba.
- Los pasos que sí necesitan Postgres (migración, seed, tests e2e) se agregan en un change
  **posterior y propio**, `ci-integracion-db`, inmediatamente después de `modelo-dominio`. Va
  separado por la misma regla de §14.
- Después de la primera corrida exitosa de `ci-integracion-db`, se marcan los jobs como
  **required status checks** en la protección de rama de `main` — GitHub solo ofrece esa
  opción una vez que el check corrió al menos una vez. Si se intenta antes, no aparece en la
  lista y es fácil olvidarse de volver a hacerlo.

## 4. Estructura de jobs recomendada

```yaml
# .github/workflows/ci.yml — dispara en pull_request y push a main
jobs:
  spec:
    # openspec validate --strict
    # + linter de openapi/openapi.yaml (Spectral o Redocly — justificar la elección en el
    #   design.md de fundacion-repo, config.yaml §2 prohíbe sumar herramientas sin justificar)

  lint:
    # npm run lint (ambos workspaces)
    # tsc --noEmit (ambos workspaces)

  test:
    # Fase 1 (fundacion-repo): npm run test -w backend, SIN service container de Postgres.
    # Fase 2+ (ci-integracion-db en adelante): agrega el service container, corre
    #   db:migrate + db:seed + tests e2e contra una base real de test.
```

## 5. La decisión pendiente que más cuesta cambiar: fuente de verdad del contrato OpenAPI

`config.yaml` §2 y §3 se contradicen: uno dice que el OpenAPI "se genera desde el backend",
el otro que "se versiona en el repo". La resolución que propone `docs/roadmap-mvp.md` (a
decidir formalmente en el `design.md` de `fundacion-repo`) es **contract-first**:

- `openapi/openapi.yaml` escrito a mano es la fuente de verdad — así el frontend puede arrancar
  sin esperar al backend.
- El job `spec` de CI genera el spec desde `@nestjs/swagger` y lo **diffea contra el YAML
  commiteado**: si el código se desvía del contrato, el job falla.

Si el equipo llega a esta reunión y decide lo contrario (generar desde los controllers), avisar
antes de escribir el job — cambia qué corre en qué momento y quita el paralelismo de la Fase 5
del roadmap (frontend ya no podría arrancar antes que el backend).

## 6. Reglas que no se negocian al tocar este archivo

- **Nunca** editar `.github/workflows/` dentro de un PR de *feature* (`config.yaml` §14). Los
  cambios de CI van en su propio change de OpenSpec (`fundacion-repo`, `ci-integracion-db`, o
  uno nuevo si hace falta).
- Todo cambio al pipeline pasa primero por su change de OpenSpec — la spec manda, el CI sigue
  (Prioridad 2 de `config.yaml` §14).
- No se exige cobertura mínima, pero un PR que toca lógica de negocio sin sumar tests no se
  aprueba (§9) — el job `test` es el que hace cumplir eso mecánicamente.
- Un PR con CI en rojo no se mergea nunca, "aunque funcione localmente" (§12).

## 7. Checklist antes de dar un `ci.yml` (o un cambio sobre él) por terminado

- [ ] Corre en `pull_request` y en `push` a `main`.
- [ ] Los 4 jobs de la sección 2 están presentes (los 3 de la consigna + lint/tipos).
- [ ] Si es la primera versión (Fase 1): el job `test` NO depende de Postgres.
- [ ] Si es `ci-integracion-db` o posterior: el job `test` levanta el service container y corre
      contra una base real, no contra mocks (§9).
- [ ] Cualquier herramienta nueva (linter de OpenAPI, CLI de OpenSpec vía dev-dependency vs.
      `npx`, generador de tipos) está justificada en el `design.md` del change correspondiente.
- [ ] No se tocó `.github/workflows/` desde un PR que no sea el de su propio change.
- [ ] Si corresponde, se marcaron/actualizaron los required status checks en la protección de
      `main` (recién después de la primera corrida verde).
