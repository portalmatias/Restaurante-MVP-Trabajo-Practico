## Why

`frontend/` hoy es el scaffold vacío que dejó `fundacion-repo`: `create-next-app` con
`app/layout.tsx` y `app/page.tsx` de ejemplo, sin rutas propias, sin sistema visual y sin
cliente HTTP. Ningún change de pantallas (`frontend-cliente`, `frontend-admin`, Fase 5 de
`docs/roadmap-mvp.md` §9) puede empezar sin esa base: no hay dónde montar una pantalla
(`/admin/...` y `/reservas/...`, §7), no hay tokens de diseño que evitar duplicar por cada
feature, y — la razón de fondo — §7 prohíbe escribir a mano los tipos del cliente HTTP
("se derivan del contrato OpenAPI"), pero todavía no existe el mecanismo que los derive. La
nota "Corrección (2026-09-14)" del roadmap deja explícito que ese mecanismo se define acá.

Sin este change, cualquiera de los otros dos frentes de frontend tendría que resolver por su
cuenta el layout, la paleta, la tipografía y la generación de tipos — trabajo duplicado y con
alto riesgo de que cada uno tome una decisión distinta.

## What Changes

- **Sistema de diseño compartido** (Tailwind v4, `@theme`): tokens semánticos como variables
  CSS (`--color-primary`, `--color-background`, `--color-destructive`, etc.), estilo
  minimalista/suizo (alto contraste, grillas, mucho blanco, transiciones 150–250ms,
  `prefers-reduced-motion` respetado), tipografía Inter única vía `next/font` (auto-hosteada,
  sin `@import` externo), y **mobile-first**: los estilos base (sin prefijo de Tailwind)
  apuntan a 375px y los breakpoints `sm:`/`md:`/`lg:` solo agregan o ajustan para pantallas
  más grandes, nunca al revés. Reemplaza los tokens de ejemplo de `create-next-app`
  (`--background`/`--foreground` con `prefers-color-scheme: dark`): el MVP es **solo modo
  claro** (dark mode queda fuera de alcance, ver Open Questions).
- **Layout compartido** con header y footer, usado por todas las rutas.
- **Esqueletos de ruta** `/`, `/admin` y `/reservas`: páginas placeholder que usan el layout y
  enlazan entre sí. Sin lógica de negocio, sin auth, sin las pantallas reales — esas son
  alcance de `frontend-cliente` y `frontend-admin`.
- **Primitivas de UI propias** sobre Tailwind (`Button`, `Input`, `Label`, `Field` con error,
  `Card`, `Select`, `Alert`), pensadas como componentes presentacionales reutilizables
  (patrón container-presentational), en vez de sumar una librería de componentes.
- **Cliente HTTP tipado**, con tipos **generados** desde `openapi/openapi.yaml` (nunca escritos
  a mano, §7): `openapi-typescript` genera un `.d.ts` con un script `api:types`, y
  `openapi-fetch` es el cliente que consume esos tipos. Solo existen tipos para los paths que
  ya están en el YAML (`/`, `/disponibilidad`, `/auth/login`, `/admin/zonas`, `/admin/zonas/{id}`,
  `/admin/mesas`, `/admin/mesas/{id}`, `/admin/turnos` y `/admin/turnos/{id}`); `POST /reservas` (PR #40, todavía no mergeado a `main`) no genera tipos
  hasta que esté en el contrato.
- **Mapeo de errores** del cliente: traduce las formas de error de la API (`ErrorRespuesta` de
  400/404/409, con los `motivos: MotivoNoDisponible[]` del `409` cuando la API los envía) a un resultado tipado que la UI puede
  renderizar sin volver a parsear `unknown`.
- **Testing mínimo** (§9): se suma Jest (vía `next/jest`, coherente con que el backend ya usa
  Jest) + React Testing Library para las primitivas (asociación de label, foco visible, texto
  de error enlazado por `aria-describedby`) y para el mapeo de errores del cliente. Hoy
  `frontend/` no tiene ningún test runner instalado.
- **Accesibilidad como requisito, no como buena intención**: contraste de texto ≥ 4.5:1, foco
  visible en todo elemento interactivo, navegación por teclado, campos con `<label>` visible
  (nunca solo `placeholder`), errores junto al campo, objetivos táctiles ≥ 44×44px, íconos SVG
  (nunca emoji), `lang="es"` en `<html>` (ya está en el scaffold actual) y responsive sin
  scroll horizontal en 375/768/1024/1440.

## Capabilities

### New Capabilities
- `frontend-base`: layout y esqueleto de rutas del frontend, sistema de diseño compartido
  (tokens, tipografía, accesibilidad, mobile-first) y cliente HTTP tipado generado desde
  `openapi/openapi.yaml` con mapeo de errores. Es la base sobre la que se construyen
  `frontend-cliente` y `frontend-admin`.

### Modified Capabilities
_Ninguna._ `openspec/specs/` todavía está vacío — ningún change previo archivó specs sobre
las que declarar un delta. Este change tampoco modifica `openapi/openapi.yaml`: solo genera
tipos a partir de los paths que ya están mergeados, sin agregar ni cambiar ningún endpoint.

## Impact

- **Depende de:** `fundacion-repo` (mergeado: el scaffold de `create-next-app` con Next
  16.3.4, React 19.2.8 y Tailwind v4 ya existe) y de que `openapi/openapi.yaml` tenga al menos
  los paths actuales (`/`, `/disponibilidad`, `/auth/login`, `/admin/zonas`,
  `/admin/zonas/{id}`, `/admin/mesas`, `/admin/mesas/{id}`, `/admin/turnos`,
  `/admin/turnos/{id}`) para tener algo que tipar. No depende de `POST /reservas` (PR #40):
  ese path se tipa solo, en su propio change, cuando se mergee al YAML.
- **Desbloquea:** `frontend-cliente` (pantallas de reserva) y `frontend-admin` (login,
  dashboard, CRUD del salón), que dejan de tener que decidir layout, tokens o cliente HTTP por
  su cuenta.
- **Código afectado:** `frontend/app/layout.tsx` y `app/globals.css` (reescritos), `app/page.tsx`
  (reescrito), `app/admin/page.tsx` y `app/reservas/page.tsx` (nuevos, placeholder),
  `frontend/src/components/ui/` (primitivas nuevas), `frontend/src/lib/api/` (cliente
  generado + wrapper + mapeo de errores), `frontend/test/` (suites nuevas), y los `package.json`
  de `frontend/` y de la raíz (scripts nuevos). No toca `backend/` ni `openapi/openapi.yaml`.
- **API / `openapi/openapi.yaml`:** sin cambios. Este change es puramente consumidor del
  contrato ya existente.
- **Base de datos:** sin migraciones, no aplica.
- **Dependencias npm nuevas** (todas en `frontend/`, justificadas en `design.md` según §2):
  `openapi-typescript` y `openapi-fetch` (generación y consumo tipado del contrato), `jest`,
  `jest-environment-jsdom`, `@testing-library/react`, `@testing-library/dom`,
  `@testing-library/jest-dom`, `ts-node`, `@types/jest` (testing, hoy inexistente en
  `frontend/`). Ver Open Questions por una librería de íconos SVG, todavía no decidida.
- **CI:** este change no toca `.github/workflows/ci.yml` (§14). Si en el futuro se decide
  correr `api:types` o los tests de frontend en CI, es trabajo de un change aparte — ver
  Open Questions de `design.md`.
