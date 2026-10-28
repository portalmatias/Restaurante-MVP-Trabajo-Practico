## 1. Prerrequisitos

- [x] 1.1 Confirmar los hechos de `design.md` (Context) sobre `main`: `frontend/app/` sin
      ruta `version`, sin `middleware.ts` ni `proxy.ts` en `frontend/`, `cd.yml` con el job
      `desplegar` y los códigos de salida 0 y 3 de `desplegar.sh`. Verificar en la documentación
      de la versión instalada de Next (`node_modules/next/dist/docs/`, páginas de *route
      handlers*) que `dynamic = "force-dynamic"` y la lectura de `process.env` por pedido
      funcionan con `output: "standalone"`, que un método no exportado responde `405` y que
      `OPTIONS` sin handler exportado responde `204` con `Allow` incluyendo `GET`, `HEAD` y
      `OPTIONS`. Anotar los enlaces en la descripción del PR.

      Resultado (26/10/2026): confirmado sobre `main` en `c980980`. En la documentación de Next
      16.3.4 (`01-getting-started/15-route-handlers.md`): los `GET` no se cachean por defecto,
      `export const dynamic = 'force-dynamic'` se admite sin Cache Components (que el proyecto no
      activa) y un método no exportado responde `405`.
## 2. El frontend expone la versión (D1, D2)

- [x] 2.1 Escribir primero los tests de `frontend/test/app/version.test.ts` (Jest, entorno
      `node` para la ruta): con `BUILD_SHA` válido responde `200` y `{ sha }` con
      `Cache-Control: no-store` y ninguna otra clave; sin la variable, vacía, corta, en
      mayúscula o con otros caracteres responde `"desconocido"` sin repetir el valor; la
      query y el cuerpo no cambian la respuesta; el valor se lee en cada pedido (cambiar
      `process.env.BUILD_SHA` entre dos llamadas cambia la respuesta); `OPTIONS` responde `204`
      con `Allow` que incluye `GET`, `HEAD` y `OPTIONS` sin necesidad de exportar un handler
      nuevo. Verificar que fallan sin la ruta.
      Resultado (26/10/2026): 13 tests en `frontend/test/app/version.test.ts`; fallaban antes de
      la ruta (módulo inexistente).
- [x] 2.2 Escribir `frontend/app/version/route.ts` (`GET`, con `dynamic = "force-dynamic"`).
      Verificar que los tests pasan y que `npm run typecheck -w frontend` y `npx eslint .`
      quedan limpios.
- [x] 2.3 `frontend/Dockerfile`: `ARG BUILD_SHA=desconocido` y `ENV BUILD_SHA=${BUILD_SHA}` en
      la etapa final, después de los `COPY`. Verificar construyendo la imagen con
      `--build-arg BUILD_SHA=<sha>` y corriendo el contenedor: `GET /version` devuelve el SHA,
      `HEAD` responde `200`, `OPTIONS` responde `204` con `Allow`, `POST` responde `405`, y sin el
      argumento devuelve `"desconocido"`. Verificar que cambiar solo el `BUILD_SHA` reutiliza la
      caché del `npm ci` y de `next build`. Guardar la salida para el PR.

      Resultado (26/10/2026): imagen construida con `--build-arg BUILD_SHA=45e59ac…` y corrida:
      `GET /version` → `200`, `{"sha":"45e59ac5378c8d5eafd32d06442c86e9bd4a1776"}`,
      `Cache-Control: no-store`; `HEAD` → `200`; `POST`, `PUT`, `PATCH` y `DELETE` → `405`; con
      `BUILD_SHA` vacío → `{"sha":"desconocido"}`. Un segundo build con otro SHA reutilizó la
      caché (`npm ci` y `npm run build` en `CACHED`).
## 3. La comprobación (D3 a D6)

- [x] 3.1 Escribir primero `scripts/cd/verificar-version.test.mjs` (`node --test`, sin
      dependencias) para las funciones puras y para el ciclo de consulta contra un servidor
      HTTP local, con intervalos cortos:
      - respuesta con el SHA esperado: éxito al primer intento;
      - respuesta anterior y luego la esperada: éxito tras reintentar dentro del plazo total de
        hasta 5 minutos desde el primer intento;
      - se agota el plazo total con otro SHA: falla con el esperado y el observado;
      - `desconocido`: falla de inmediato, sin reintentar;
      - `404`: reintenta; en `despliegue` falla y en `vuelta-atras` queda «no verificable»;
      - `5xx`, cuerpo que no es JSON, JSON con campos de más o un `sha` mal formado, `3xx`: se
        reintentan y no cuentan como éxito (el `3xx` no se sigue);
      - SHA observado posterior en `despliegue`: éxito con aviso; en `vuelta-atras`: no se
        acepta; SHA observado que GitHub no conoce o es anterior: se reintentan;
      - `SUBDOMINIO` ausente o inválido (con `/`, espacios, `@`, `:` o mayúsculas fuera de
        lugar): falla antes de pedir nada;
      - la URL lleva el parámetro `cb`, con un valor distinto en cada intento, y el encabezado
        `Cache-Control: no-cache`.
      Verificar que fallan sin la implementación.
      Resultado (28/10/2026): 61 tests. Comprobé que detectan roturas: seguir redirecciones, aceptar
      un SHA posterior en vuelta atrás y no mandar `Cache-Control: no-cache` hacen fallar al menos
      un test cada una. Tras alinear con el requisito (parámetro distinto en cada intento y plazo
      total de 5 minutos) se agregaron 5 tests (`cb=<run_id>-<run_attempt>-<consulta>`, distinto
      por consulta y por reejecución, entero desde 1, un pedido con URL propia por reintento y
      corte por plazo total); los 5 fallan con la versión anterior del script.
- [x] 3.2 Escribir `scripts/cd/verificar-version.mjs`: funciones puras de decisión (D5) y el
      ciclo de consulta con plazo total hasta 5 minutos desde el primer intento, con pedidos de
      espera acotada configurables; solo HTTPS cuando se arma la URL desde `SUBDOMINIO`; sin
      seguir redirecciones; escribe el resumen en `GITHUB_STEP_SUMMARY` y el resultado en el
      código de salida. La consulta a la API de GitHub (D6) usa `GITHUB_TOKEN` con `contents: read`
      y solo en modo `despliegue`.
- [x] 3.3 `package.json`: agregar `scripts/cd/verificar-version.test.mjs` a la lista explícita
      de `test:scripts` (Node 20 no expande globs). Verificar que `npm run test:scripts` corre
      el archivo nuevo.
      Resultado (26/10/2026): `npm run test:scripts`: 103 de 103 (28/10/2026).
- [ ] 3.4 `cd.yml`:
      - `build-args` del frontend con `BUILD_SHA` (el mismo SHA del tag y de la etiqueta);
      - salida `resultado` del job `desplegar` (`desplegado` o `superada`, según el código de
        salida de `desplegar.sh`);
      - job `verificar` con `needs: [decidir, desplegar]`, `permissions: contents: read`, sin
        `environment`, que corre solo si `desplegar` terminó en éxito y `resultado` es
        `desplegado`, con `SUBDOMINIO`, `SHA`, `MODO`, `RUN_ID` y `RUN_ATTEMPT` pasados por
        variables de entorno (nunca interpolados en el código de un paso); `GITHUB_TOKEN` se usa
        solo con permisos `contents: read` (`contents: read`);
      - acciones de terceros fijadas por SHA, como el resto del archivo.
      Verificar con `actionlint` sin errores. **Dependencia:** hoy `actionlint` termina en `1` sobre
      `cd.yml` por el aviso SC2015 de la validación de `SERVER_PORT`. Corregirlo es la tarea 5.4 del
      change `despliegue-continuo-ec2` (pendiente; la reescritura está en #88, pero falta correr
      `actionlint`). Esta tarea no puede darse por cumplida hasta resolver esa.
      Estado (26/10/2026): implementado (`build-args` con `BUILD_SHA`, salida `resultado` y job
      `verificar`) y el YAML se parseó bien; falta correr `actionlint`, que no está disponible
      en el equipo donde se hizo.
- [ ] 3.5 (verificaciones posteriores al despliegue) Probar el ciclo completo de
      `verificar-version.mjs` contra el sitio de producción real con el SHA que sirve hoy (por
      ejemplo `node scripts/cd/verificar-version.mjs` con las variables del job): al desplegar este
      change por primera vez, producción pasa de no tener `/version` a tenerla, y ese despliegue
      es la prueba de extremo a extremo (ver Migration Plan).

      Estado (26/10/2026): probado contra `https://ichigo.alquilerespunilla.com.ar`, que todavía
      no tiene `/version`: en modo `despliegue` falla con `HTTP 404` tras los intentos y en
      `vuelta-atras` queda «no verificable», sin seguir redirecciones y con el certificado
      verificado. El caso de éxito contra producción falta hasta el primer despliegue con este
      change.
## 4. Documentación y cierre

- [x] 4.1 `docs/despliegue.md`: sección «Cómo comprobar que un cambio del frontend llegó», con
      el `curl` con cache-busting, cómo leer el resultado de `verificar` en Actions y qué hacer
      si el SHA no coincide (revisar el digest desplegado, la regla de caché de Cloudflare y
      purgar si hace falta, relanzar el job). Actualizar la tabla de «Cómo funciona».
      Resultado (26/10/2026): sección en la parte 7 de `docs/despliegue.md` y diagrama de «Cómo
      funciona» con el job `verificar`.
- [x] 4.2 `openspec validate verificacion-version-desplegada --strict` y
      `openspec validate --all --strict` pasan.
      Resultado (26/10/2026): 18 de 18.
- [x] 4.3 `npx eslint .`, `npm run typecheck -w frontend`, `npm run test:frontend` (con
      `TZ=UTC` y con `TZ=America/Argentina/Buenos_Aires`), `npm run test:scripts` y
      `npm run test:deploy` en verde, desde la raíz.
      Resultado (28/10/2026, sobre `main` con el rediseño): `eslint` limpio sobre `scripts/cd`;
      frontend 799 de 799 con `TZ=UTC` y con `TZ=America/Argentina/Buenos_Aires`; `test:scripts`
      103 de 103; `test:deploy` 56 comprobaciones. `typecheck` no marca errores en `/version`; en
      esta copia solo falla por `@playwright/test`, que no estaba instalado (viene de #82).
- [ ] 4.4 PR con descripción en español, enlazado a este change, con el resultado de 2.3, y
      aprobado por un compañero distinto del autor. Aclarar que el job `verificar` solo se puede
      probar de verdad al desplegar.
- [ ] 4.5 Después del primer despliegue con este change, confirmar en Actions que `verificar`
      terminó en verde y que `curl https://<subdominio>/version` devuelve el SHA desplegado.
- [ ] 4.6 (verificaciones posteriores al despliegue) Completar la tarea 3.5 tras el primer
      despliegue y registrarlo en el PR o en el seguimiento correspondiente.
- [ ] 4.7 Después del merge y de archivar `despliegue-continuo-ec2`, archivar este change con
      `openspec archive verificacion-version-desplegada` en su propio PR.
