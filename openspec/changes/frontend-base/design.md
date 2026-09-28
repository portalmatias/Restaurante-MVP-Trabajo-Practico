## Context

`frontend/` es hoy el scaffold sin tocar de `fundacion-repo`: Next.js 16.3.4 (App Router),
React 19.2.8, TypeScript 5.9.3 y Tailwind v4 vía `@tailwindcss/postcss`, con
`app/layout.tsx`/`app/page.tsx` de ejemplo. No hay ningún test runner instalado en
`frontend/` (`frontend/package.json` no tiene `jest`, `vitest` ni `@testing-library/*`; el
backend sí usa Jest 30 + `ts-jest`). El monorepo tiene una única config de ESLint en la raíz
(`eslint.config.mjs`) con un bloque específico para `frontend/**` que ya extiende
`eslint-config-next`. `openapi/openapi.yaml` hoy tiene mergeados `/`, `/disponibilidad`,
`/auth/login`, `/admin/zonas(/{id})`, `/admin/mesas(/{id})` y `/admin/turnos(/{id})`;
`POST /reservas` está en el PR #40, todavía no mergeado.

`frontend/AGENTS.md` (heredado, regenerado por `next dev`) advierte que esta versión de
Next.js puede diferir de los datos de entrenamiento del asistente y remite a
`node_modules/next/dist/docs/`. Las decisiones de este documento que dependen de una API de
Next.js están verificadas contra esos docs locales (Next 16.3.4), no contra memoria de
entrenamiento; se cita el archivo consultado en cada caso.

Ver `proposal.md` por el motivo del change y su alcance. Este documento cubre el cómo.

## Goals / Non-Goals

**Goals:**
- Fijar el mecanismo de generación de tipos del cliente HTTP desde `openapi/openapi.yaml`
  (pendiente desde la nota "Corrección (2026-09-14)" de `docs/roadmap-mvp.md` §9).
- Dejar un sistema de tokens y unas primitivas de UI reutilizables para que
  `frontend-cliente` y `frontend-admin` no tengan que decidirlos de nuevo.
- Dejar instalado y configurado un test runner para `frontend/` (hoy no existe ninguno).

**Non-Goals:**
- Implementar las pantallas reales de reserva o de administración (`frontend-cliente`,
  `frontend-admin`).
- Modo oscuro (ver Open Questions).
- Autenticación o cualquier lógica de sesión en el frontend.
- Tipar o consumir `POST /reservas`: no está en `openapi/openapi.yaml` todavía.
- Configurar CI para correr los tests de frontend o el chequeo de tipos generados: es un
  cambio sobre `.github/workflows/ci.yml`, prohibido dentro de un PR de feature (§14).

## Decisions

### D1: Mobile-first como enfoque de estilos, no solo como breakpoint agregado
**Decisión:** las hojas de estilo se escriben mobile-first: las clases de Tailwind sin
prefijo son las que rigen en el viewport más chico (375px), y `sm:`/`md:`/`lg:` (min-width)
solo suman o ajustan estilos para viewports más anchos. Nunca se escribe primero para
escritorio y se "arregla" mobile con un breakpoint de ancho máximo.

**Motivo:** el flujo del cliente (`frontend-cliente`, que consume esta base) se usa
mayoritariamente desde el celular — es el caso de uso real de reservar una mesa. Diseñar
mobile-first evita que el layout de escritorio contamine con estilos que después hay que
anular en mobile, y es además el modelo por defecto de Tailwind (las utilidades sin prefijo
ya son mobile; agregar prefijos de min-width es la forma nativa de "sumar", nunca de
"restar").

**Viewports de verificación** (no son breakpoints de CSS, son los anchos contra los que se
prueba manualmente y en tests): 375px (mobile de referencia), 768px (tablet), 1024px
(notebook chica) y 1440px (escritorio). Los breakpoints de Tailwind v4 usados son los que
trae por defecto (`sm` 640px, `md` 768px, `lg` 1024px); no hace falta un breakpoint a medida
para 375px porque es el estilo base sin prefijo.

**Alternativas consideradas:**
- *Desktop-first (`max-width`)*: es el patrón que ya trae de fábrica el `page.tsx` de
  `create-next-app` (usa `sm:` para ajustar de mobile hacia arriba, en rigor ya es
  mobile-first, pero no de forma consciente). Se descarta como *filosofía* de diseño porque
  el caso de uso principal es mobile y un enfoque desktop-first tiende a dejar el layout
  chico como un recorte, no como el diseño principal.

### D2: Tokens semánticos con Tailwind v4 `@theme`, sin hex crudo en componentes
**Decisión:** los colores del sistema de diseño se declaran una sola vez, como variables CSS
en `app/globals.css`, y se exponen a las utilidades de Tailwind con un bloque `@theme inline`
(el mismo mecanismo que ya usa el scaffold para `--background`/`--foreground`, extendido con
el resto de la paleta):

```css
:root {
  --primary: #171717;
  --primary-foreground: #ffffff;
  --secondary: #404040;
  --secondary-foreground: #ffffff;
  --accent: #a16207;
  --accent-foreground: #ffffff;
  --background: #ffffff;
  --foreground: #171717;
  --card: #ffffff;
  --card-foreground: #171717;
  --muted: #e8ecf0;
  --muted-foreground: #475569;
  --border: #e5e5e5;
  --destructive: #dc2626;
  --destructive-foreground: #ffffff;
  --ring: #171717;
}

@theme inline {
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  /* ...resto igual, uno por token: --color-<nombre>: var(--<nombre>) */
}
```

Las variables fuente de `:root` (`--primary`) tienen un nombre distinto del token de
Tailwind (`--color-primary`), igual que en el scaffold (`--background` y
`--color-background`): si se llamaran igual, `@theme inline` declararía cada token en
función de sí mismo, una referencia circular. Además, así un tema futuro (por ejemplo modo
oscuro) solo sobreescribe las variables fuente.

Con esto, los componentes usan clases como `bg-primary`, `text-primary-foreground`,
`border-border` o `ring-ring`, nunca `bg-[#171717]` ni un `style={{ color: '#171717' }}`. Se
elimina el bloque `@media (prefers-color-scheme: dark)` que trae el scaffold: el MVP es
**solo modo claro** (ver Non-Goals y Open Questions).

**Alternativas consideradas:**
- *CSS-in-JS (styled-components, vanilla-extract)*: agrega una dependencia nueva y un
  runtime o build step adicional para un problema que Tailwind v4 ya resuelve de forma
  nativa con `@theme`. Se descarta por §2 (no sumar dependencias sin justificarlo, y acá no
  hay justificación: `@theme` ya cubre el caso).
- *Config de Tailwind v3 (`tailwind.config.ts` con `theme.extend.colors`)*: es el mecanismo
  de la versión anterior de Tailwind. La v4 (ya instalada) mueve la configuración de tema a
  CSS con `@theme`; usar el patrón viejo iría contra cómo ya está armado el scaffold.

### D3: Tipografía Inter con `next/font`, auto-hosteada
**Decisión:** una sola familia (Inter, pesos 400 a 700) cargada con `next/font/google`,
igual que el scaffold ya hace con Geist. Verificado en este Next 16.3.4 (no asumido de
memoria): `node_modules/next/font/google/index.d.ts` existe y
`node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md` documenta
`next/font/google` como la forma vigente de auto-hostear Google Fonts en build, sin `<link>`
externo ni `@import` en runtime.

**Alternativas consideradas:**
- *`@import` de Google Fonts en CSS*: contradice el requisito explícito de auto-hosteo en
  build y agrega una petición externa en cada carga de página.
- *Dos familias (una para títulos, otra para texto)*: el estilo suizo pedido es minimalista;
  una sola familia con variación de peso alcanza y evita cargar un segundo archivo de fuente.

### D4: Primitivas de UI propias sobre Tailwind, no una librería de componentes
**Decisión:** `Button`, `Input`, `Label`, `Field` (con slot de error), `Card`, `Select` y
`Alert` se escriben como componentes propios en `frontend/src/components/ui/`, sobre
Tailwind y los tokens de D2, siguiendo el patrón container-presentational (estos son
presentacionales; los contenedores con estado/datos son responsabilidad de
`frontend-cliente`/`frontend-admin`).

**Alternativa considerada — shadcn/ui:** se evaluó porque es una opción habitual en proyectos
Next.js + Tailwind. Se descarta para este MVP porque (a) copia código fuente al repo más
Radix UI como dependencia de runtime por cada primitiva usada — varias dependencias nuevas
que requerirían justificarse una por una contra §2 sin necesidad real todavía, dado que este
change solo entrega esqueletos; y (b) el set de primitivas pedido es chico (7 componentes) y
no justifica adoptar un sistema completo antes de que `frontend-cliente`/`frontend-admin`
muestren qué necesitan de verdad. Si en esos changes surge una necesidad de componentes más
compleja (por ejemplo, un `Dialog` o un `Combobox` con manejo de foco no trivial), es
razonable reabrir esta decisión ahí, con la necesidad concreta delante.

### D5: Generación de tipos con `openapi-typescript` + `openapi-fetch`
**Decisión:** se agregan dos dependencias nuevas a `frontend/package.json`:
- `openapi-typescript` (devDependency): CLI que genera un archivo de tipos TypeScript a
  partir de `openapi/openapi.yaml`. Verificado el comando contra la documentación oficial
  (no de memoria): `npx openapi-typescript ./openapi/openapi.yaml -o
  ./frontend/src/lib/api/schema.d.ts`.
- `openapi-fetch` (dependency): cliente fetch mínimo que consume esos tipos y devuelve
  `{ data, error }` — `data` presente en `2xx`, `error` presente en `4xx`/`5xx` — verificado
  contra la documentación oficial de `openapi-fetch`.

Se agrega el script `api:types` en `frontend/package.json` (y un alias en la raíz,
`api:types`, que lo delega con `-w frontend`, siguiendo el patrón de `db:migrate`/`db:seed`
ya existente). El archivo generado (`frontend/src/lib/api/schema.d.ts`) **se commitea**: así
el build y el chequeo de tipos no dependen de correr un generador en cada instalación, y el
diff del PR que cambia el contrato muestra también el diff de tipos.

**Chequeo de que el archivo generado está al día:** se agrega un script local
`api:types:check` que regenera a un archivo temporal y lo compara (`diff`) contra el
commiteado, fallando si difieren. Este change **no** lo engancha a CI: agregar un paso a
`.github/workflows/ci.yml` es una modificación de workflow, fuera de alcance de un PR de
feature (§14). Queda anotado en Open Questions / como trabajo de un change futuro
(`ci-tipos-frontend` o similar, a decidir por el equipo).

**Alcance de los tipos:** solo existen tipos para los paths presentes en
`openapi/openapi.yaml` en el momento de generarlos. Esto cierra la nota "Corrección
(2026-09-14)" del roadmap: no se generan tipos a partir de fragmentos de `design.md` de
changes todavía no mergeados (como el `POST /reservas` de `reservas-crear`), y no se agregan
paths ficticios al YAML para adelantar tipos.

**Alternativas consideradas:**
- *Tipos escritos a mano*: es exactamente lo que §7 prohíbe.
- *`swagger-typescript-api` / clientes generados completos (`orval`, `hey-api` con cliente
  incluido)*: generan más código del necesario (clientes con Axios, hooks de React Query,
  etc.) para lo que este change necesita, que es solo tipos + un fetch tipado liviano.
  `openapi-fetch` es del mismo autor/ecosistema que `openapi-typescript` y es la opción más
  chica que cumple el requisito de §7 sin sumar un framework de data-fetching que nadie pidió
  todavía.
- *`@nestjs/swagger` client generation (mismo mecanismo que usa el backend para el chequeo de
  deriva)*: genera el spec, no un cliente frontend; no resuelve este problema.

### D6: URL del backend y proxy `/api` en Next para evitar CORS
**Problema:** el frontend corre en `localhost:3000` y el backend en `localhost:3001` (README y
default de `backend/src/main.ts`). Son orígenes distintos y `main.ts` no llama a
`enableCors()`, así que el navegador bloquearía cualquier `fetch` de un componente cliente al
backend. Las llamadas desde Server Components no tienen el problema, porque corren en el
servidor.

**Decisión:** un proxy de mismo origen con `rewrites` de `next.config.ts`:

```ts
async rewrites() {
  return [
    { source: '/api/:path*', destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*` },
  ];
}
```

- En el **navegador**, el cliente HTTP usa `baseUrl: '/api'`: toda llamada va al mismo origen
  del frontend y Next la reenvía al backend. No hay CORS que configurar.
- En el **servidor** (Server Components), el cliente usa `baseUrl: NEXT_PUBLIC_API_URL`
  directo: una URL relativa no sirve fuera del navegador y el salto por el proxy no aporta
  nada.
- Una función `urlBaseApi()` en `frontend/src/lib/api/` elige el valor según
  `typeof window`, y es lo único que decide la URL base; no hay otra URL escrita en el código.
- Verificado contra la guía de esta versión
  (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/rewrites.md`,
  sección "Rewriting to an external URL"): los rewrites admiten un destino externo y
  conservan método, query y body.

**Variable de entorno:** se sigue usando `NEXT_PUBLIC_API_URL`, que ya está en
`.env.example` (confirmado por portalmatias el 2026-09-23; el archivo no es legible para el
agente) y en `openspec/config.yaml` §10. **No se agrega ninguna variable nueva.** Los
`rewrites` se evalúan al construir (`next build`), así que en producción la variable tiene
que estar definida en ese momento.

**Carga del `.env` de la raíz:** Next solo lee los `.env*` de `frontend/`, pero el `.env`
del proyecto vive en la raíz del monorepo (§10). `next.config.ts` lo carga con
`process.loadEnvFile` de Node, sin dependencias nuevas; las variables ya exportadas en el
entorno tienen prioridad. Si `NEXT_PUBLIC_API_URL` sigue sin estar definida, `rewrites()` falla
con un mensaje que la nombra, en vez de armar un destino `undefined/...`: un build o un deploy
mal configurados no compilan. La única excepción es `next typegen` (parte de `npm run
typecheck`), que también evalúa los rewrites con la misma fase que `next build` y corre en CI
sin `.env`: ahí solo se avisa y se generan los tipos sin el proxy. Se descartó `@next/env`
(`loadEnvConfig`): la guía de Next pide instalarlo como dependencia propia.

`process.loadEnvFile` requiere Node.js 20.12 o superior (no existe en versiones anteriores de
la serie 20.x); por eso `engines.node` de la raíz queda en `>=20.12` y el README pide "Node.js
20.12 o superior (20 LTS)". CI usa Node 20 (`actions/setup-node@v4` con `node-version: '20'`,
que resuelve siempre a la última versión menor de la serie 20.x), así que ya la cubre. Si
`next.config.ts` detecta `typeof process.loadEnvFile !== "function"` con un `.env` de raíz
presente, corta con un mensaje en español que nombra la versión mínima requerida, en vez de
dejar que Node falle con un `TypeError: process.loadEnvFile is not a function` críptico.

**Alternativa considerada (`app.enableCors()` en el backend):** es el mecanismo estándar,
pero toca `backend/` (fuera del alcance de un change de frontend, iría en uno propio) y
necesita una variable nueva para el origen permitido. El proxy resuelve lo mismo sin tocar el
backend. Si más adelante el frontend y el backend se despliegan en dominios distintos sin
Next de por medio, CORS se puede agregar en ese momento.

### D7: Resultado tipado y mapeo de errores
**Decisión:** un tipo `ApiResult<T>` (discriminado por la presencia de `data` o de `error`)
envuelve toda llamada. Cuando `openapi-fetch` devuelve `error`, una función de mapeo lo
traduce a un tipo `ErrorApi` con una de estas formas. Se apoya solo en lo que ya define
`openapi/openapi.yaml` en `main`: `ErrorRespuesta` (`statusCode`, `message`, `error`) y el
schema `MotivoNoDisponible` de `disponibilidad`:
- `{ tipo: 'validacion', mensajes: string[] }` — `400` con `message` como lista.
- `{ tipo: 'no-encontrado', mensaje: string }` — `404` con `message` como texto único.
- `{ tipo: 'conflicto', mensaje: string, motivos: MotivoNoDisponible[] }` — cualquier `409`.
  Los `409` que hoy tiene el contrato (las rutas de admin de `gestion-salon`) son
  `ErrorRespuesta` con `message` de texto y sin `motivos`: mapean con `motivos: []`. Si el
  cuerpo trae además `motivos` (lo que va a agregar `POST /reservas` de `reservas-crear`), el
  mapeo los conserva en orden. El campo se lee con un chequeo en tiempo de ejecución sobre el
  cuerpo, no con tipos de un contrato todavía no mergeado, así que D5 se sigue cumpliendo.
- `{ tipo: 'desconocido', mensaje: string }` — cualquier otro caso (por ejemplo `500`), para
  no forzar a la UI a manejar un caso que no puede interpretar de forma específica.

Este mapeo vive en `frontend/src/lib/api/errors.ts`, es una función pura y es lo que cubren
los tests de este change (no hay pantallas todavía que consuman `ApiResult`, pero el
contrato de datos sí existe y es lo que `frontend-cliente`/`frontend-admin` van a usar).

### D8: Jest + `next/jest` + React Testing Library, con tests en `frontend/test/`
**Decisión:** se instala Jest (no Vitest), configurado con el transform oficial `next/jest`
(verificado contra `node_modules/next/dist/docs/01-app/02-guides/testing/jest.md` de este
Next 16.3.4: sigue siendo el mecanismo soportado, sin Babel adicional). Dependencias nuevas
en `frontend/package.json`: `jest`, `jest-environment-jsdom`, `@testing-library/react`,
`@testing-library/dom`, `@testing-library/jest-dom`, `ts-node`, `@types/jest`.

`openspec/config.yaml` §9 fija que los tests de frontend viven en `frontend/test/`, no en
`__tests__/` (que es el default que sugiere la guía de Next.js). La config de Jest se ajusta
con `roots`/`testMatch` para buscar en `frontend/test/` en vez del default.

**Motivo de Jest sobre Vitest:** el backend ya usa Jest 30; usar el mismo test runner en todo
el repo evita que los tres integrantes tengan que conocer dos herramientas de testing
distintas para un proyecto académico donde ya hay bastante superficie nueva (Next 16, React
19, Tailwind v4). `next/jest` además es first-party y no requiere configurar un plugin de
Vite para SWC/JSX aparte.

**Alternativa considerada — Vitest:** más rápido y con mejor DX en proyectos Vite-first, pero
acá no hay Vite; requeriría su propio plugin de Next.js (`vitest-tsconfig-paths`, mocks de
`next/font`, etc.) sin ninguna ventaja concreta sobre `next/jest`, que ya viene resuelto por
Next.js mismo.

**Qué cubre este change:** tests de accesibilidad estructural de las primitivas de UI
(asociación de `label`, foco visible vía `:focus-visible`, `aria-describedby` del error) y
del mapeo de errores del cliente (D7). No cubre snapshot testing ni cobertura de las páginas
placeholder (no tienen lógica: serían tests que verifican que Next renderiza JSX, sin valor,
igual que "no hace falta" en §9 para wrappers sin lógica).

### D9: Verificación de escenarios visuales es manual, no un test automatizado
**Decisión:** los escenarios de la spec sobre contraste de color, ausencia de scroll
horizontal en 375/768/1024/1440 y tamaño táctil ≥44×44px se verifican **manualmente** en el
navegador (DevTools, modo responsive, y un verificador de contraste) en cada PR que toque el
layout o las primitivas, documentado como paso de `tasks.md`. No se agrega Playwright,
Puppeteer ni una herramienta de auditoría automatizada (axe-core, Lighthouse CI) en este
change.

**Motivo:** `jsdom` (el entorno de Jest/RTL) no calcula layout real ni pinta píxeles: no
puede medir un área táctil renderizada ni el contraste de un color calculado contra su fondo
real. Resolverlo con una herramienta headless (Playwright/Puppeteer) es una dependencia
nueva no trivial (requiere descargar un navegador) para un chequeo que, en un proyecto de 3
personas con revisión por pares, es razonable hacer a mano en cada PR. Los escenarios que
**sí** son estructurales y no dependen de layout real (asociación de label, `aria-hidden`,
`aria-describedby`, orden de foco, nombre accesible) sí se cubren con RTL, porque ahí jsdom
alcanza. Si el proyecto crece y este chequeo manual se vuelve un cuello de botella, adoptar
Playwright con `@axe-core/playwright` es la alternativa natural — se deja anotado y no se
decide ahora porque no hace falta todavía.

### D10: Estructura de archivos nueva
```
frontend/
├── app/
│   ├── layout.tsx          # reescrito: header/footer, tokens, Inter
│   ├── globals.css         # reescrito: tokens D2, sin dark mode
│   ├── page.tsx            # reescrito: landing con enlaces a /reservas y /admin
│   ├── admin/page.tsx      # nuevo: placeholder
│   └── reservas/page.tsx   # nuevo: placeholder
├── src/
│   ├── components/ui/      # Button, Input, Label, Field, Card, Select, Alert
│   └── lib/api/
│       ├── schema.d.ts     # generado por openapi-typescript, commiteado
│       ├── client.ts       # createClient<paths> de openapi-fetch
│       └── errors.ts       # ApiResult<T> y el mapeo de D7
└── test/
    ├── components/ui/      # tests de accesibilidad de las primitivas
    └── lib/api/            # tests del mapeo de errores
```


### D11: Acceso del personal a `/admin` por URL directa, sin enlaces públicos
**Decisión:** ni el encabezado ni la landing enlazan a `/admin`. El cliente final solo ve el
flujo de reservas; el personal del restaurante entra escribiendo la dirección `/admin` (o desde
un marcador del navegador), donde `frontend-admin` va a mostrar el login.

**Motivo:** al cliente no le sirve ver la entrada de administración y suma ruido visual en una
interfaz pensada para reservar rápido desde el celular.

**No es una medida de seguridad.** Esconder el enlace solo ordena la interfaz: quien conozca la
URL llega igual a `/admin`. Lo que protege la administración son los guards de JWT y de rol del
backend (`auth-admin`), que rechazan cualquier petición sin credenciales válidas.

**Alternativa considerada:** un enlace discreto en el pie ("Acceso del personal"). Se pospone:
se agrega solo si el personal lo necesita.

## Risks / Trade-offs

- **Next 16 / React 19 con APIs distintas a lo esperado** → mitigado consultando
  `node_modules/next/dist/docs/` antes de implementar cada API tocada en este change
  (`next/font`, App Router, `next/jest`); ya verificado para las decisiones de este
  documento. `tasks.md` repite esta verificación como paso explícito antes de escribir cada
  pieza de código en `apply`.
- **Dependencias nuevas sin uso previo en el repo** (`openapi-typescript`, `openapi-fetch`,
  todo el stack de testing de frontend) → mitigado fijando versiones exactas en
  `package-lock.json` al instalar y agregando una tarea explícita en `tasks.md` para correr
  `npm run build -w frontend` y la suite de tests antes de dar el change por cerrado.
- **Archivo de tipos generado puede quedar desactualizado** si alguien edita
  `openapi/openapi.yaml` sin correr `api:types` → mitigado con el script
  `api:types:check` (D5); el riesgo residual es que nadie lo corra a mano porque no está en
  CI todavía — anotado en Open Questions.
- **Verificación manual de accesibilidad visual (D9) depende de que se haga de verdad** →
  mitigado dejándola como paso explícito con checklist en `tasks.md`, igual que ya se hace
  con las suites que corren "localmente hasta que `ci-integracion-db` esté" en
  `reservas-crear`.
- **Mobile-first es una convención de escritura, no algo que ESLint pueda forzar hoy** → no
  hay un lint rule para "no uses `max-`/desktop-first" en Tailwind v4 out of the box.
  Mitigado con revisión por pares (§11: todo PR necesita una aprobación) usando esta decisión
  (D1) como criterio explícito de revisión.

## Migration Plan

No hay datos ni schema que migrar (sin cambios en `backend/`, sin `openapi.yaml`, sin
Prisma). Pasos de despliegue de este change:
1. Instalar las dependencias nuevas de `frontend/package.json` (`npm install` desde la raíz).
2. Correr `npm run api:types -w frontend` una vez para generar `schema.d.ts` y commitearlo.
3. Reescribir `app/layout.tsx`, `app/globals.css` y `app/page.tsx`; crear
   `app/admin/page.tsx` y `app/reservas/page.tsx`.
4. Crear las primitivas de `src/components/ui/` y el cliente de `src/lib/api/`.
5. Configurar Jest (`jest.config.ts`, `jest.setup.ts`) apuntando a `frontend/test/`.

**Rollback:** revertir el/los commits del PR. No hay estado persistente ni migración que
revertir aparte del código.

## Open Questions

- **Librería de íconos SVG:** este change no necesita íconos todavía (las páginas son
  placeholders y `Alert`/`Button` funcionan solo con texto y color). Si `frontend-cliente` o
  `frontend-admin` necesitan íconos (por ejemplo, un ícono de éxito/error en `Alert`, o un
  menú compacto en mobile si la navegación crece), decidir ahí si se suma `lucide-react`
  (SVG, tree-shakeable, sin runtime pesado) y justificarla contra §2 en ese momento, con la
  necesidad concreta delante.
- **Modo oscuro:** confirmado como Non-Goal para este MVP. Si el equipo decide más adelante
  que sí hace falta, es un change aparte que vuelve a tocar D2 (agregaría un segundo set de
  valores por token y la media query que este change quita).
- **CI para `api:types:check` y para los tests de frontend:** hoy `.github/workflows/ci.yml`
  no corre nada de `frontend/` salvo lint y `tsc --noEmit` (dentro de `npm run lint` / `npm
  run typecheck`, ya wireados desde `fundacion-repo`). Agregar un paso de CI que corra
  `npm run test -w frontend` y/o `api:types:check` es una modificación de workflow y, por
  §14, va en un change propio — a decidir por el equipo cuándo se prioriza.
- **Confirmación de `NEXT_PUBLIC_API_URL` en `.env.example`:** ver D6. Pendiente de
  verificar con acceso normal al archivo (bloqueado en este entorno de planning).
