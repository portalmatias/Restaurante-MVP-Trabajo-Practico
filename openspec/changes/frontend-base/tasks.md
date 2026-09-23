## 1. Prerrequisitos (bloqueante)

- [ ] 1.1 Confirmar que `frontend/` sigue siendo el scaffold sin tocar de `fundacion-repo`
      (Next 16.3.4, React 19.2.8, Tailwind v4, sin `src/`, sin `frontend/test/`) y crear
      `feature/frontend-base` desde `main`. Verificar con
      `git log origin/main --oneline -- frontend` y `cat frontend/package.json` (sin `jest`,
      `openapi-typescript` ni `openapi-fetch` todavía).
- [ ] 1.2 Confirmar en `.env.example` si `NEXT_PUBLIC_API_URL` ya está declarada (D6 de
      `design.md`: `openspec/config.yaml` §10 la lista como variable mínima existente, pero no
      se pudo verificar el archivo durante el planning). Si falta, agregarla en este PR con un
      valor de ejemplo (`http://localhost:3001`) y anotarlo en la descripción del PR (DoD,
      `config.yaml` §13). Verificar con `grep -n NEXT_PUBLIC_API_URL .env.example`.
- [ ] 1.3 Confirmar los paths que hoy tiene `openapi/openapi.yaml` (`/`, `/disponibilidad`,
      `/auth/login`, `/admin/zonas(/{id})`, `/admin/mesas(/{id})`, `/admin/turnos(/{id})`) y
      que `POST /reservas` **no** está mergeado todavía (PR #40). Si ya se mergeó al arrancar
      este change, no cambia nada de este `tasks.md`: ese path simplemente aparece tipado
      también. Verificar con `grep -n "^  /" openapi/openapi.yaml`.
- [ ] 1.4 Leer `frontend/AGENTS.md` y, antes de tocar cualquier API de Next.js en las
      secciones siguientes (fuentes, App Router, testing), consultar la guía correspondiente en
      `node_modules/next/dist/docs/` de este checkout — la versión de Next puede diferir de lo
      esperado. Verificar que existen `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md`
      y `node_modules/next/dist/docs/01-app/02-guides/testing/jest.md` (ya confirmado en
      `design.md`; repetir si `npm install` cambió versiones).

## 2. Testing: instalar y configurar Jest + React Testing Library

- [ ] 2.1 Agregar a `frontend/package.json` las devDependencies `jest`,
      `jest-environment-jsdom`, `@testing-library/react`, `@testing-library/dom`,
      `@testing-library/jest-dom`, `ts-node` y `@types/jest` (D8). Verificar con
      `npm ls jest @testing-library/react -w frontend`.
- [ ] 2.2 Crear `frontend/jest.config.ts` con `next/jest`, `testEnvironment: 'jsdom'` y
      `roots`/`testMatch` apuntando a `frontend/test/` (no al `__tests__/` por defecto de la
      guía de Next, para seguir `config.yaml` §9). Crear `frontend/jest.setup.ts` con
      `import '@testing-library/jest-dom'` y conectarlo con `setupFilesAfterEnv`. Agregar el
      script `"test": "jest"` a `frontend/package.json`. Verificar con
      `npm run test -w frontend -- --listTests` (debe correr sin error y sin listar tests
      todavía).
- [ ] 2.3 Agregar `"test:frontend": "npm run test -w frontend"` a los scripts de la raíz,
      como proxy (sin tocar `.github/workflows/ci.yml`: correrlo en CI es un change aparte,
      Open Questions de `design.md`). Verificar con `npm run test:frontend` desde la raíz.

## 3. Tokens de diseño y layout base (mobile-first)

- [ ] 3.1 Reescribir `frontend/app/globals.css`: reemplazar `--background`/`--foreground` y
      el bloque `@media (prefers-color-scheme: dark)` del scaffold por los tokens semánticos
      completos de D2 (`primary`, `secondary`, `accent`, `background`, `foreground`, `card`,
      `card-foreground`, `muted`, `muted-foreground`, `border`, `destructive`, `ring`) como
      variables CSS y `@theme inline`. Verificar visualmente con `npm run dev -w frontend` que
      `body` usa `bg-background`/`text-foreground` y no queda ningún hexadecimal del scaffold
      original en el archivo: `grep -in "0a0a0a\|ededed" frontend/app/globals.css` sin
      resultados.
- [ ] 3.2 Reescribir `frontend/app/layout.tsx`: quitar Geist, cargar Inter (400–700) con
      `next/font/google` (D3), mantener `lang="es"` en `<html>` (ya está en el scaffold) y
      envolver `children` en un layout con `<header>` y `<footer>` compartidos, escrito
      **mobile-first**: primero las clases sin prefijo pensadas para 375px, después `sm:`/
      `md:`/`lg:` solo para sumar (D1). El header no depende de `hover` para mostrar sus
      enlaces. Verificar a 375px de ancho (DevTools, modo responsive) que no hay scroll
      horizontal y que el header es utilizable sin hacer hover; repetir a 768/1024/1440.
- [ ] 3.3 Verificar con un lector de contraste (DevTools de Chrome/Firefox marcan la relación
      de contraste al inspeccionar un nodo de texto) que cada combinación texto/fondo de la
      paleta (`primary`/`background`, `secondary`/`background`, `accent`/`background`,
      `foreground`/`background`, `card-foreground`/`card`, `muted-foreground`/`muted`,
      `destructive`/`background`) da al menos 4.5:1. Dejar la constancia (captura o nota) en
      la descripción del PR — es verificación manual, D9 de `design.md`.

## 4. Primitivas de UI (TDD: tests primero)

- [ ] 4.1 Escribir `frontend/test/components/ui/field.test.tsx` **antes** de crear el
      componente: un caso donde `Field` con `label="Email"` expone un control accesible por
      `getByRole('textbox', { name: 'Email' })`, y otro donde `Field` con `error="Requerido"`
      expone un control cuyo `aria-describedby` apunta al `id` del nodo que muestra el texto
      "Requerido" junto al campo. Verificar que la suite falla (rojo) con
      `npm run test -w frontend -- field`.
- [ ] 4.2 Implementar `frontend/src/components/ui/label.tsx`, `input.tsx` y `field.tsx` (D4,
      D2: solo clases con tokens, sin hex), con `Field` asociando `<label htmlFor>` al control
      y renderizando el error con `id` + `aria-describedby` cuando existe. Tamaño del control
      con altura mínima 44px. Verificar que la suite de 4.1 pasa.
- [ ] 4.3 Escribir `frontend/test/components/ui/button.test.tsx` **antes** de implementar:
      `Button` renderiza su `children` con rol `button`, expone un anillo de foco visible al
      recibir foco por teclado (clase `focus-visible:*` presente en el DOM), y su variante
      primaria mide al menos 44px de alto (verificable vía la clase de altura aplicada, ya que
      `jsdom` no calcula layout real — D9). Verificar que falla (rojo) con
      `npm run test -w frontend -- button`.
- [ ] 4.4 Implementar `frontend/src/components/ui/button.tsx` con variantes `primary`,
      `secondary` y `destructive` sobre los tokens de D2, `focus-visible:ring-2
      focus-visible:ring-ring`, transición de 150–250ms en `hover`/`focus` respetando
      `prefers-reduced-motion` (`motion-reduce:transition-none` o equivalente), y ancho
      completo en mobile por defecto (`w-full`) con `sm:w-auto` para pantallas más anchas
      (D1). Verificar que la suite de 4.3 pasa.
- [ ] 4.5 Escribir `frontend/test/components/ui/card-select-alert.test.tsx` **antes** de
      implementar, cubriendo: `Card` renderiza su contenido dentro de un contenedor con
      `role="region"` o similar cuando recibe un título accesible; `Select` asocia su `label`
      igual que `Field`; `Alert` con `variant="error"` usa el token `destructive` y expone su
      texto sin depender de un ícono para transmitir el estado (texto por sí solo alcanza,
      D-Iconografía de la spec). Verificar que falla (rojo).
- [ ] 4.6 Implementar `Card`, `Select` y `Alert` en `frontend/src/components/ui/`. Verificar
      que la suite de 4.5 pasa y que ningún archivo de `frontend/src/components/ui/` tiene un
      literal de color: `grep -rniE "#[0-9a-f]{3,6}" frontend/src/components/ui` sin
      resultados fuera de comentarios.
- [ ] 4.7 Verificar manualmente en el navegador, a 375px primero y luego a 768/1024/1440
      (D1, D9), que cada primitiva se ve y se usa correctamente: `Button` de ancho completo en
      mobile, `Field`/`Select` con su error visible sin recortarse, `Card` sin desbordar el
      viewport. Dejar la constancia en la descripción del PR.

## 5. Rutas: layout compartido y esqueletos

- [ ] 5.1 Reescribir `frontend/app/page.tsx`: quitar el contenido de ejemplo de
      `create-next-app` y dejar una landing mínima en español que usa las primitivas de la
      sección 4 y enlaza a `/reservas` y a `/admin` con `next/link`. Mobile-first: los enlaces
      son de ancho completo o fácilmente alcanzables a 375px (D1). Verificar con
      `npm run dev -w frontend` que `/` renderiza sin errores y los dos enlaces navegan.
- [ ] 5.2 Crear `frontend/app/reservas/page.tsx` y `frontend/app/admin/page.tsx` como páginas
      placeholder (Server Components, sin `"use client"`: no tienen interactividad todavía)
      que usan el layout compartido y muestran un texto que indica que la pantalla real llega
      con `frontend-cliente`/`frontend-admin` respectivamente. Sin lógica de negocio, sin
      auth. Verificar que ambas rutas cargan con `npm run dev -w frontend` y comparten el
      mismo header/footer que `/`.
- [ ] 5.3 Verificar sin scroll horizontal en `/`, `/admin` y `/reservas` a 375/768/1024/1440
      (D9, manual). Dejar la constancia en la descripción del PR.

## 6. Cliente HTTP tipado

- [ ] 6.1 Agregar a `frontend/package.json` la devDependency `openapi-typescript` y la
      dependency `openapi-fetch` (D5). Verificar con
      `npm ls openapi-typescript openapi-fetch -w frontend`.
- [ ] 6.2 Agregar el script `"api:types": "openapi-typescript ../openapi/openapi.yaml -o
      src/lib/api/schema.d.ts"` a `frontend/package.json` y un alias
      `"api:types": "npm run api:types -w frontend"` en la raíz. Correrlo una vez y commitear
      `frontend/src/lib/api/schema.d.ts`. Verificar que el archivo generado contiene un tipo
      `paths` con las claves `"/disponibilidad"`, `"/auth/login"`, `"/admin/zonas"`, etc., y
      que **no** contiene `"/reservas"` (todavía no está en el YAML) con
      `grep -n '"/reservas"' frontend/src/lib/api/schema.d.ts` sin resultados (a menos que el
      PR #40 ya se haya mergeado — ver 1.3).
- [ ] 6.3 Agregar el script `"api:types:check"` que regenera a un archivo temporal y compara
      contra el commiteado (D5), fallando si difieren. Verificar corriéndolo dos veces
      seguidas sin tocar el YAML: la segunda corrida no debe reportar diferencias.
- [ ] 6.4 Crear `frontend/src/lib/api/client.ts` exportando un cliente `openapi-fetch` tipado
      con `paths` de `schema.d.ts`, con `baseUrl: process.env.NEXT_PUBLIC_API_URL` (D6). Sin
      URL fija en el código. Verificar con `npm run typecheck -w frontend` en verde.
- [ ] 6.5 Escribir un test de tipos (o un comentario `// @ts-expect-error` verificado por
      `tsc`) que confirme que llamar al cliente con un path inexistente en el contrato (por
      ejemplo `"/reservas"`, mientras no esté mergeado) falla el chequeo de tipos. Verificar
      con `npm run typecheck -w frontend`: debe fallar sin el `@ts-expect-error` y pasar con
      él.

## 7. Mapeo de errores del cliente (TDD: tests primero)

- [ ] 7.1 Escribir `frontend/test/lib/api/errors.test.ts` **antes** de implementar (D7): un
      `ErrorRespuesta` de `400` con `message` como lista de strings mapea a
      `{ tipo: 'validacion', mensajes: [...] }`; uno de `404` con `message` string mapea a
      `{ tipo: 'no-encontrado', mensaje }`; un cuerpo `409` con `motivos` mapea a
      `{ tipo: 'conflicto', motivos }` preservando `codigo` y `mensaje` de cada motivo y su
      orden; cualquier otro caso mapea a `{ tipo: 'desconocido', mensaje }`. Verificar que la
      suite falla (rojo) con `npm run test -w frontend -- errors`.
- [ ] 7.2 Implementar `frontend/src/lib/api/errors.ts` con el tipo `ApiResult<T>` y la función
      de mapeo de D7, usando los tipos de `MotivoNoDisponible`/`CodigoMotivo` generados en
      `schema.d.ts`. Verificar que la suite de 7.1 pasa.
- [ ] 7.3 Envolver el cliente de 6.4 para que sus métodos devuelvan `ApiResult<T>` en vez del
      `{ data, error }` crudo de `openapi-fetch`, aplicando el mapeo de 7.2 cuando `error` está
      presente. Verificar con un test de integración liviano en
      `frontend/test/lib/api/client.test.ts` que mockea `fetch` para devolver un `409` con
      `motivos` y comprueba que el resultado tiene `tipo: 'conflicto'`.

## 8. Cierre (Definition of Done, `config.yaml` §13)

- [ ] 8.1 `openspec validate frontend-base --strict` pasa y todas las tareas de este archivo
      están marcadas. Verificar con el comando y revisando que no quede ningún `- [ ]`.
- [ ] 8.2 El change no agrega migraciones ni toca `backend/` ni `openapi/openapi.yaml`.
      Verificar con `git diff main --stat -- backend openapi` vacío.
- [ ] 8.3 Si 1.2 agregó `NEXT_PUBLIC_API_URL` a `.env.example`, queda en este mismo PR;
      si ya existía, no hay diff. Verificar con `git diff main -- .env.example`.
- [ ] 8.4 Tests de este change en verde: `npm run test -w frontend`. Verificar también
      `npm run build -w frontend` (incluye el chequeo de que `next/font` y el App Router
      compilan) y `npm run typecheck -w frontend` (incluye `next typegen && tsc --noEmit`).
- [ ] 8.5 `npm run lint` (raíz) en limpio, sin warnings nuevos en `frontend/**`. Verificar con
      el comando desde la raíz.
- [ ] 8.6 Checklist manual de accesibilidad y responsive completo y documentado en la
      descripción del PR: contraste (3.3), sin scroll horizontal en los 4 anchos (5.3),
      primitivas usables a 375px primero (4.7), foco visible navegando con teclado en `/`,
      `/admin` y `/reservas`.
- [ ] 8.7 CI en verde en el PR `feature/frontend-base` (los jobs `spec` y `lint` cubren este
      change; el job `test` no lo toca porque no corre nada de `frontend/` todavía — ver Open
      Questions de `design.md`). Verificar en la pestaña Checks.
- [ ] 8.8 PR con descripción en español, enlazado a `openspec/changes/frontend-base/`, con las
      constancias manuales de 3.3/4.7/5.3, las Open Questions de `design.md` resueltas o
      explícitamente pospuestas, y aprobado por un compañero distinto del autor. Verificar en
      GitHub.
- [ ] 8.9 Después del merge, archivar el change con `openspec archive frontend-base` en su
      propio PR. Verificar que `openspec/specs/frontend-base/spec.md` existe en `main`.
