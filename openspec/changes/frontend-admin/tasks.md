## 1. Prerrequisitos (bloqueante)

- [ ] 1.1 Confirmar que `frontend-base` (#43) sigue mergeado en `main` y crear
      `feature/frontend-admin` desde ese `main`. Verificar que existen
      `frontend/src/components/ui/{button,field,input,label,select,card,alert}.tsx`,
      `frontend/src/components/layout/site-header.tsx` y
      `frontend/src/lib/api/{client.ts,errors.ts,url-base.ts,schema.d.ts}`.
- [ ] 1.2 Releer esos archivos reales y anotar cualquier diferencia respecto de lo que asume
      `design.md` (D2 cita `createClient`/`urlBaseApi`/`toApiResult`; D8 cita `ErrorApi`/
      `mapErrorApi`) y respecto de las primitivas de `frontend-base` que usan las secciones 3,
      6 y 7 de este archivo (`Button` con `variant: 'primary'|'secondary'|'destructive'|'ghost'`;
      `Field`/`Select` con `label`/`error`). Si algo cambió, usar la forma real y anotarlo en
      la descripción del PR, sin renombrar nada del lado de `frontend-base`.
- [ ] 1.3 Confirmar con un login manual (`curl` o el backend real) que `POST /auth/login`
      responde `accessToken` con el admin del seed, y que `openapi-typescript` ya generó
      `paths['/auth/login']`, `paths['/admin/zonas']`, `paths['/admin/mesas']`,
      `paths['/admin/turnos']` y `paths['/admin/reservas']` en `schema.d.ts`. Si no están,
      correr `npm run api:types -w frontend` contra el `openapi/openapi.yaml` de `main`.
- [ ] 1.4 Confirmar el estado de `reserva-vip` y `cancelacion-turnos` con
      `gh pr list --state merged` y `git log origin/main --oneline`. Si alguno ya mergeó su
      implementación, sus secciones (6, 7) dejan de estar bloqueadas: avisar en la
      descripción del PR y completarlas contra el cliente tipado real en vez de dejarlas
      pendientes.

## 2. Sesión y cliente HTTP de admin (Grupo A, parte 1)

- [ ] 2.1 Crear `frontend/src/lib/auth/session.ts`: `guardarSesion(accessToken)` decodifica
      `exp` del payload del JWT (sin verificar firma) normalizando primero la segunda parte
      del token a base64 estándar (JWT usa base64**url**: reemplazar `-`→`+` y `_`→`/`,
      completar con `=` hasta múltiplo de 4) y recién ahí llamar a `atob()` — `atob()` sobre
      el string base64url crudo falla o decodifica mal apenas el payload trae `-`/`_`, que
      pasa seguido (son caracteres válidos de base64url). Después hace
      `sessionStorage.setItem`. `leerSesion()` (lee y valida que no haya vencido; si venció,
      la borra y devuelve `null`) y `borrarSesion()`. Verificar con tests unitarios: guardar y
      leer devuelve el mismo token; un JWT real (firmado por el backend, con `-`/`_` en el
      payload) decodifica el `exp` correcto; una sesión con `exp` en el pasado no se
      devuelve; leer sin sesión guardada devuelve `null`.
- [ ] 2.2 Crear `frontend/src/lib/api/admin-client.ts`: instancia propia de `createClient<paths>`
      (D2) con `.use({ onRequest })` que agrega `Authorization: Bearer <token>` leyendo
      `leerSesion()`; si no hay sesión, no agrega el header (deja que el backend responda
      `401`, que D4 traduce en redirección). Exportar `toAdminApiResult`, calcado de
      `toApiResult` de `frontend-base` sobre este cliente. Verificar con un test que, con una
      sesión guardada, la request saliente tiene el header, y que sin sesión no lo tiene.
- [ ] 2.3 Extender `toAdminApiResult` (o un envoltorio alrededor) para que, ante un `401` de
      cualquier llamada, llame a `borrarSesion()` y dispare la redirección de D4 (una función
      inyectada o un evento, no un `window.location` directo, para que el test de 2.3 no
      dependa de un navegador real). Verificar con un test: una respuesta `401` simulada borra
      la sesión y dispara la redirección.

## 3. Login (Grupo A, parte 2)

- [ ] 3.1 Crear `frontend/app/admin/login/page.tsx`: formulario con `Field` (email) e `Input`
      tipo `password` con su propio `Field`, botón `Button` que se deshabilita mientras la
      solicitud está en curso. Al enviar, llama a `toAdminApiResult(adminClient.POST('/auth/login', ...))`.
      Verificar con un test de componente: completar y enviar el formulario deshabilita el
      botón hasta que la promesa resuelve.
- [ ] 3.2 Implementar los cuatro casos de la spec "Login de administrador": éxito (guarda la
      sesión con `guardarSesion` y redirige a `/admin`), `401` (mensaje genérico, sin guardar
      sesión), `400` (errores de validación junto a los campos, vía `Field`/`error`), `429`
      (mensaje de límite de intentos, distinto del genérico de `401`). Verificar con tests que
      mockean `admin-client` para cada uno de los cuatro códigos.

## 4. Layout protegido y navegación de admin (Grupo A, parte 3)

- [ ] 4.1 Reorganizar `frontend/app/admin/` en un grupo de rutas: `login/page.tsx` (sin el
      guard) y `(protegido)/layout.tsx` + `(protegido)/page.tsx` (el dashboard, moviendo el
      contenido actual de `admin/page.tsx`) para que Next no agregue el segmento
      `(protegido)` a la URL. Verificar que `/admin` y `/admin/login` siguen resolviendo a
      esas rutas (`npm run build -w frontend` sin error de rutas).
- [ ] 4.2 Implementar `(protegido)/layout.tsx` como Client Component (D4): al montarse, llama
      a `leerSesion()`; si es `null`, redirige a `/admin/login` con `next/navigation` antes de
      renderizar los hijos (mostrar nada o un estado de carga breve, nunca el contenido
      protegido). Si hay sesión, renderiza una barra de navegación propia (enlaces a
      dashboard, `/admin/salon`, `/admin/reservas`, y el botón "Cerrar sesión" que llama a
      `borrarSesion()` y redirige) y despliega `children` debajo. Verificar con un test de
      componente: sin sesión guardada, redirige y no renderiza los hijos; con sesión
      guardada, los renderiza.
- [ ] 4.3 Test de componente de "Cerrar sesión": activarlo borra la sesión (verificar con
      `leerSesion()` después) y redirige a `/admin/login`.
- [ ] 4.4 Test de integración de guard: simular una llamada de un hijo que devuelve `401` a
      través de `toAdminApiResult` y verificar que dispara la misma redirección que 4.2, sin
      que el componente hijo tenga que manejarlo por su cuenta.

## 5. Dashboard de aforo (Grupo B)

- [ ] 5.1 Implementar `(protegido)/page.tsx`: selector de fecha (`Input type="date"`) y de
      Turno (`Select`, poblado desde `GET /admin/turnos` — ya disponible por `gestion-salon`,
      sin depender de `catalogo-publico`, que es para las rutas públicas), con la fecha de
      hoy y el primer Turno activo como valores iniciales.
- [ ] 5.2 Crear la función pura `calcularAforo(zonas, reservasActivas)` en
      `frontend/src/lib/aforo/calcular-aforo.ts` (D5): agrupa por Zona los comensales de
      `reservasActivas` (ya se asume que el caller filtró por `CONFIRMADA`/`PENDIENTE`, D5),
      devuelve `{ porZona: Record<zonaId, {ocupado, maximo}>, global: {ocupado} }` — sin
      `maximo` en `global`, D5 no tiene de dónde sacarlo hoy. Verificar con tests unitarios:
      los cuatro escenarios de la spec (con Reservas activas, con `CANCELADA`/`NO_SHOW`
      excluidas por el caller antes de llegar acá, sin Reservas, y con varias Zonas sumando
      al global).
- [ ] 5.3 Pedir `GET /admin/zonas` **una sola vez**, al montar la pantalla (D5: son los
      aforos máximos configurados, no dependen de la fecha ni del Turno elegidos). Cada vez
      que cambian la fecha o el Turno seleccionados, disparar **dos** llamadas a
      `GET /admin/reservas` (`?fecha=...&turnoId=...&estado=CONFIRMADA&limit=100` y
      `...&estado=PENDIENTE&limit=100`, D5 — nunca una sola llamada sin `estado`: incluiría
      Reservas `CANCELADA`/`NO_SHOW` acumuladas y podría superar el `limit` sin que las
      Reservas activas quepan), pasar sus resultados junto con las Zonas ya cargadas a
      `calcularAforo`, y mostrar el resultado: por Zona con su máximo ("X / Y comensales"),
      global solo con la ocupación (sin "/ máximo", D5). Verificar con un test de
      integración de componente, mockeando `admin-client`, que: `GET /admin/zonas` se pide
      una sola vez aunque el selector de fecha cambie varias veces, y cada cambio de fecha
      dispara las dos consultas de Reservas y actualiza los números mostrados.

## 6. CRUD de salón (Grupo C)

- [ ] 6.1 Crear `frontend/app/admin/salon/page.tsx` con tres secciones (Zonas, Mesas,
      Turnos), cada una como su propio componente cliente en
      `frontend/src/components/admin/` (por ejemplo `zonas-panel.tsx`,
      `mesas-panel.tsx`, `turnos-panel.tsx`) para no tener un archivo único gigante.
- [ ] 6.2 Zonas: listar (`GET /admin/zonas`) en una tabla y editar cada una con un formulario
      (`PATCH /admin/zonas/:id`) con los siete campos de la spec: `minComensales`,
      `maxComensales`, `anticipacionMinHoras`, `anticipacionMaxDias`,
      `ventanaCancelacionHoras`, `requiereConfirmacionAdmin` y `aforoMaximo`. Verificar con
      tests: edición exitosa actualiza la fila; `400` por rango de comensales inválido
      muestra el error junto al campo, sin actualizar la fila.
- [ ] 6.3 Mesas: listar con filtro opcional por Zona (`GET /admin/mesas?zonaId=...`), alta
      (`POST /admin/mesas`) y edición (`PATCH /admin/mesas/:id`). Verificar con tests: alta
      exitosa agrega la fila; `409` por etiqueta duplicada muestra el error junto al campo de
      etiqueta; `404` por Zona inexistente muestra el error correspondiente.
- [ ] 6.4 Baja de Mesa con el patrón de confirmación en dos pasos de D6 (`DELETE
      /admin/mesas/:id`). Verificar con tests: confirmar la baja quita la fila; cancelar en
      el paso de confirmación no envía ninguna solicitud; `409` por Reservas asociadas
      muestra el motivo y la fila sigue.
- [ ] 6.5 Turnos: listar (`GET /admin/turnos`), alta (`POST /admin/turnos`) con selector de
      día de la semana y campos de hora `HH:mm`, y edición (`PATCH /admin/turnos/:id`)
      incluida la activación/desactivación. Verificar con tests: alta exitosa agrega la
      fila con sus horas en `HH:mm`; `409` por Turno duplicado muestra el error; desactivar
      un Turno lo deja en el listado marcado como inactivo, no lo quita.

## 7. Listado de Reservas (Grupo D)

- [ ] 7.1 Crear `frontend/app/admin/reservas/page.tsx`: filtros (fecha, estado, Zona, Turno)
      que reflejan su estado en la query string (mismo criterio que D1 de `frontend-cliente`:
      reconstruible desde la URL, sin email en ningún parámetro — acá ni siquiera aplica,
      este listado no maneja el email del cliente en la URL) y una tabla con código, estado,
      fecha, Turno, Zona, comensales y contacto.
- [ ] 7.2 Paginación sobre `limit`/`offset` de `GET /admin/reservas`, conservando los filtros
      activos al cambiar de página. Verificar con un test: cambiar de página con filtros
      activos pide la página siguiente con los mismos filtros en la query de la API.
- [ ] 7.3 Estado vacío cuando `items` viene vacío (mensaje, no tratarlo como error) y `400`
      de filtros mal formados (no debería ocurrir con los controles de la UI, pero cubrir el
      caso por si un valor de la URL llega editado a mano). Verificar con tests de ambos
      casos.

## 8. Confirmar/rechazar Reserva VIP (Grupo E — bloqueado por `reserva-vip`)

- [ ] 8.1 Confirmar que `reserva-vip` mergeó su implementación (si no, esta sección queda
      pendiente: no escribir tipos a mano ni agregar `PATCH /admin/reservas/:id/confirmar`/
      `.../rechazar` a mano en `schema.d.ts`). Verificar con `gh pr list --state merged` y
      regenerar `schema.d.ts` (`npm run api:types -w frontend`) recién cuando el path exista
      en el `openapi/openapi.yaml` de `main`.
- [ ] 8.2 Agregar los botones de confirmar/rechazar sobre cada fila `PENDIENTE` del listado
      de 7.1, con el patrón de confirmación en dos pasos de D6 para rechazar (confirmar no lo
      necesita: no es destructivo en el mismo sentido, se puede rechazar después si fue un
      error... revisar con el equipo si también amerita confirmación antes de implementar).
      Verificar con tests: confirmar actualiza el estado de la fila a `CONFIRMADA`; rechazar
      (tras confirmar el paso de confirmación) la actualiza a `CANCELADA`; un `409` muestra
      el conflicto y refresca el estado real de la fila.
- [ ] 8.3 Ocultar ambos botones en filas que no están `PENDIENTE`. Verificar con un test.

## 9. Marcar no show (Grupo F — bloqueado por `cancelacion-turnos`)

- [ ] 9.1 Confirmar que `cancelacion-turnos` mergeó su implementación (mismo criterio que
      8.1, para `PATCH /admin/reservas/:id/no-show`).
- [ ] 9.2 Agregar el botón de marcar `NO_SHOW` sobre cada fila `CONFIRMADA` del listado de
      7.1, con el patrón de confirmación en dos pasos de D6. Verificar con tests: confirmar
      actualiza el estado de la fila a `NO_SHOW`; un `409` (turno todavía no terminado)
      muestra el motivo y la fila sigue `CONFIRMADA`.
- [ ] 9.3 Ocultar el botón en filas que no están `CONFIRMADA`. Verificar con un test.

## 10. Cierre (Definition of Done, `config.yaml` §13)

- [ ] 10.1 `openspec validate frontend-admin --strict` pasa. Si los grupos 8/9 quedaron
      bloqueados (8.1/9.1 sin cumplirse), no marcar sus tareas como hechas: documentar en la
      descripción del PR que ese alcance queda para un PR de seguimiento cuando sus backends
      mergeen, igual que hizo `reserva-consultar` con el service antes del controller.
- [ ] 10.2 El change no toca `backend/`, `openapi/openapi.yaml` ni agrega variables de
      entorno. Verificar con `git diff main --stat -- backend openapi .env.example` vacío.
- [ ] 10.3 Tests en verde: `npm run test -w frontend`, `npm run build -w frontend` y
      `npm run typecheck -w frontend`.
- [ ] 10.4 `npm run lint` (raíz) en limpio, sin warnings nuevos en `frontend/**`.
- [ ] 10.5 Checklist manual de accesibilidad y responsive (mismo criterio que 8.6 de
      `frontend-base`): contraste, sin scroll horizontal en 375/768/1024/1440px, foco visible
      navegando con teclado en `/admin/login`, el dashboard, `/admin/salon` y
      `/admin/reservas`, documentado en la descripción del PR.
- [ ] 10.6 CI en verde en el PR `feature/frontend-admin`.
- [ ] 10.7 PR con descripción en español, enlazado a `openspec/changes/frontend-admin/`, con
      la nota de 10.1 sobre los grupos bloqueados si corresponde, y aprobado por un
      compañero distinto del autor.
- [ ] 10.8 Después del merge, archivar el change con `openspec archive frontend-admin` en su
      propio PR **solo si los grupos 8 y 9 quedaron completos**; si quedaron bloqueados,
      dejar el change activo con sus tareas pendientes hasta que `reserva-vip` y
      `cancelacion-turnos` mergeen y se pueda completarlas en un PR de seguimiento.
