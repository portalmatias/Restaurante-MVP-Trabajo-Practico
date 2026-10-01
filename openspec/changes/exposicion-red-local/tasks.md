## 1. Prerrequisitos

- [x] 1.1 Crear `feature/exposicion-red-local` desde `main` y confirmar que `backend/src/main.ts`,
      `frontend/package.json` y `docker-compose.yml` siguen como los describe `design.md`
      (Context). Si algo cambió, anotarlo en la descripción del PR.
- [ ] 1.2 Reproducir el síntoma antes de tocar nada: con backend y frontend levantados, 5
      intentos fallidos de login por `http://localhost:3000/api` y 1 por
      `http://<IP-de-red>:3000/api` → el último responde `429`. Guardar la salida para el PR.

## 2. Backend: configuración de red compartida (D2, D3)

- [x] 2.0 Actualizar `proxy-addr` a 2.0.8 (corrige GHSA-jqcg-44mw-7w3h, design.md D3) con
      `npm update proxy-addr` desde la raíz: `express` pide `^2.0.7`, así que alcanza el
      lockfile. Verificar con `npm ls proxy-addr` que todas las instancias son 2.0.8 o superior
      (no alcanza con `npm audit`, que no lo reportó).
- [x] 2.1 Crear `backend/src/configurar-red.ts` con `configurarRed(app)`: lee `TRUST_PROXY`;
      vacía o ausente → no llama a `trust proxy`; con valor → lo parte por comas, recorta cada
      elemento y lo valida contra la lista de **formatos permitidos** de D3 (`loopback`,
      `linklocal`, `uniquelocal`, IPv4 simple, subred IPv4 con prefijo `/8` o mayor). Si
      cualquier elemento no cumple, lanza un `Error` que pide declarar los saltos confiables e
      indica los formatos admitidos (los tests verifican las dos partes del mensaje); si todos
      cumplen, pasa la lista a `app.set('trust proxy', lista)`. Verificar con tests unitarios:
      vacía; listas válidas (`loopback`, `10.0.0.5`, `loopback, 10.0.0.0/8`); cada rechazo
      solo (`true`, `*`, `1`, `0.0.0.0/0`, `10.0.0.0/7`, `::/0`, `::/1`,
      `::ffff:10.0.0.0/8`, `::ffff:10.0.0.0/104`, `::1`); y listas mixtas que esconden un
      rechazo (`10.0.0.5,0.0.0.0/0`, `loopback, ::/1`, `10.0.0.5, 1`).
- [ ] 2.2 Usar `configurarRed` en `main.ts` y cambiar `app.listen(PORT)` por
      `app.listen(PORT, HOST || '127.0.0.1')` (con `||`, no `??`: un `HOST=` vacío llega como
      `''` y Node lo toma como todas las interfaces). Verificar levantando el backend, sin
      `HOST` y con `HOST=` vacío: en los dos casos responde en `http://127.0.0.1:3001/zonas` y
      la conexión a `http://<IP-de-red>:3001/zonas` se rechaza.
- [x] 2.3 Arrancar con `TRUST_PROXY=true` y verificar que el proceso termina con el error de
      2.1 sin escuchar en el puerto.

## 3. Backend: origen no falsificable (D2)

- [ ] 3.1 E2E `backend/test/exposicion-red.e2e-spec.ts` (Supertest contra Postgres real, app
      con `configurarRed` y el `ThrottlerGuard` real): 6 intentos de login fallidos, cada uno
      con un `X-Forwarded-For` distinto → los 5 primeros `401` y el sexto `429`. Verificar que
      pasa con `npm run test:e2e -w backend`.
- [ ] 3.2 En el mismo e2e: superar el límite de `POST /reservas/consultar` variando
      `X-Forwarded-For` → `429` en la misma solicitud que sin el encabezado.
- [ ] 3.3 En el mismo e2e, con `TRUST_PROXY` apuntando a la dirección de Supertest
      (`loopback`): un `X-Forwarded-For: <cliente-inventado>, <ip-real>` hace que el límite
      se cuente para `<ip-real>` (agotar el cupo con una IP real no bloquea a otra IP real).
      Verificar que el test falla si se configura `trust proxy` con `true`.

## 4. Frontend y base de datos (D1)

- [x] 4.1 `frontend/package.json`: `dev` y `start` con `--hostname 127.0.0.1`; nuevo `dev:lan`
      con `--hostname 0.0.0.0`. Verificar: con `npm run dev -w frontend`,
      `http://127.0.0.1:3000` y `http://localhost:3000` responden y `http://<IP-de-red>:3000`
      se rechaza; con `dev:lan`, los tres responden. `--hostname 127.0.0.1` escucha solo en
      IPv4: si `localhost` resuelve a `::1` y no responde, anotarlo y aplicar el mismo criterio
      que 4.2 (documentar y usar `http://127.0.0.1:3000` como URL de referencia en el README y
      en `.env.example`).
- [ ] 4.2 Verificar el flujo completo con los nuevos defaults: login de admin, dashboard y una
      consulta pública desde el navegador, y una página con Server Component que llama al
      backend. Si `localhost` resuelve a `::1` y falla contra el backend en `127.0.0.1`,
      cambiar `NEXT_PUBLIC_API_URL` de `.env.example` a `http://127.0.0.1:3001` y repetir.
- [ ] 4.3 `docker-compose.yml`: publicar Postgres en `'127.0.0.1:5432:5432'`. Verificar con
      `docker compose up -d --force-recreate` que el puerto 5432 escucha en `127.0.0.1` y no en
      `0.0.0.0`/`::` (en Windows con `Get-NetTCPConnection -LocalPort 5432 -State Listen`; en
      Linux/macOS con `ss -ltn 'sport = :5432'` o `lsof -iTCP:5432 -sTCP:LISTEN`), y que
      `npm run db:migrate` sigue funcionando.

## 5. Documentación (D4)

- [x] 5.1 `.env.example`: agregar `HOST` (comentado, default `127.0.0.1`) y `TRUST_PROXY`
      (vacío), con la advertencia de no usar `true`. `config.yaml` §10: sumar las dos
      variables. Verificar que `openspec validate --all --strict` sigue pasando.
- [x] 5.2 README: sección "Red y límites de solicitudes" (loopback por defecto, `dev:lan` y su
      riesgo, límites por máquina detrás de `/api`, condición de despliegue con proxy de borde
      que sobrescriba `X-Forwarded-For` y `TRUST_PROXY`, y el paso de recrear el contenedor).
      Verificar releyendo que cubre cada escenario del requisito "Condición de despliegue
      documentada".

## 6. Cierre (Definition of Done, `config.yaml` §13)

- [ ] 6.1 Repetir la reproducción de 1.2: desde la IP de red, la conexión se rechaza (ya no
      hay un tercero que pueda agotar el cupo). Adjuntar antes/después al PR.
- [ ] 6.2 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e -w backend`
      y `openspec validate exposicion-red-local --strict` en verde.
- [x] 6.3 `git diff main --stat -- openapi backend/prisma` vacío (sin cambios de contrato ni de
      schema ni de migraciones, que viven en `backend/prisma`).
- [ ] 6.4 PR en español enlazado a `openspec/changes/exposicion-red-local/`, aprobado por un
      compañero, y CI en verde.
- [ ] 6.5 Después del merge, avisar al equipo que recree el contenedor de Postgres y archivar
      el change con `openspec archive exposicion-red-local` en su propio PR.
