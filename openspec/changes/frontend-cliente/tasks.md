## 1. Prerrequisitos (bloqueante)

- [x] 1.1 Confirmar que la implementación de `frontend-base` (PR #43) está mergeada a `main` y
      crear `feature/frontend-cliente` desde ese `main`. No seguir hasta que sea cierto.
      Verificar con `git log origin/main --oneline` y comprobando que existen
      `frontend/src/components/ui/{button,field,input,label,select,card,alert}.tsx` y
      `frontend/src/lib/api/{client.ts,errors.ts,url-base.ts,schema.d.ts}`.
- [x] 1.2 Releer los archivos reales de 1.1 y anotar cualquier diferencia de nombre, prop o
      firma respecto de lo asumido en `design.md` (D2/D4/D7 citan `buttonVariants`,
      `variantClasses`, `Field`, `mapErrorApi`, `ApiResult`, `mensajeDeRechazo` tal como
      existían el 28/09/2026). Si algo cambió, usar la forma real y anotarlo en la descripción
      del PR, sin renombrar nada del lado de `frontend-base`. Verificar leyendo esos archivos.
- [x] 1.3 Confirmar el estado de merge de los cuatro backends de los que dependen los Grupos
      A/B/C (`catalogo-publico`, `reservas-crear` PR #40, `reserva-consultar`,
      `cancelacion-turnos`) con `gh pr list --state merged` y `git log origin/main --oneline`.
      Anotar cuáles ya están para saber qué secciones (4, 5, 6) se pueden completar contra el
      cliente tipado real y cuáles quedan con fixtures locales (D10).

## 2. Utilidades puras de fecha y hora (sin dependencia de backend)

- [x] 2.1 Escribir `frontend/test/lib/fecha-hora.test.ts` (casos de `fechaLocalDeHoy`,
      `diaSemanaDeFechaLocal`, `formatearFechaLargaEs` y `formatearHoraTurno`; los casos de
      `puedeCancelarSegunVentana` van en un archivo aparte, `ventana-cancelacion.test.ts`, ver
      2.9) con los casos de `fechaLocalDeHoy(ahora)`: para un instante UTC que cae después de
      la medianoche UTC pero antes de la medianoche de Argentina (ej.
      `2026-09-15T02:00:00.000Z`, que en Argentina todavía es `2026-09-14` a las 23:00),
      devuelve `2026-09-14`; para un instante bien entrada la tarde en Argentina, devuelve el
      mismo día que un `toISOString().slice(0,10)` daría. Correr con `TZ=UTC` y con
      `TZ=America/Argentina/Buenos_Aires`. Verificar que la suite falla (rojo) con
      `npm test -w frontend -- fecha-hora`.
- [x] 2.2 Implementar `fechaLocalDeHoy` en `frontend/src/lib/fecha-hora.ts` con el offset fijo
      de Argentina y `getUTC*`/`Date.UTC` (D2), sin usar `Intl` para el cálculo. Verificar que
      2.1 pasa con las dos zonas horarias del proceso.
- [x] 2.3 Sumar a la misma suite los casos de `diaSemanaDeFechaLocal(fecha)`: `2026-09-19` →
      `SABADO`, `2026-09-21` → `LUNES`, y los siete días de una semana completa mapean sin
      desfase. Verificar que falla (rojo).
- [x] 2.4 Implementar `diaSemanaDeFechaLocal` con `Date.UTC(y, m-1, d).getUTCDay()` y el mapeo
      a `DiaSemana`. Verificar que 2.3 pasa.
- [x] 2.5 Sumar los casos de `formatearFechaLargaEs(fecha)`: `2026-09-19` da un texto que
      contiene "sábado", "19", "septiembre" y "2026"; el resultado no cambia entre
      `TZ=UTC`, `TZ=America/Argentina/Buenos_Aires` y `TZ=Pacific/Kiritimati`. Solo un huso con
      offset negativo (como Argentina) hace fallar una implementación sin `timeZone: 'UTC'`
      explícito en `Intl.DateTimeFormat`: con `TZ=UTC` o con un offset positivo como UTC+14 el
      resultado no cambia, por lo que esos husos no detectan la omisión. Por eso Jest fija
      `TZ=America/Argentina/Buenos_Aires` por defecto (`frontend/jest.config.ts`). Verificar que
      falla (rojo).
- [x] 2.6 Implementar `formatearFechaLargaEs` (D2). Verificar que 2.5 pasa con las tres zonas
      horarias del proceso.
- [x] 2.7 Sumar los casos de `formatearHoraTurno(horaIso)`: `'1970-01-01T20:00:00.000Z'` →
      `'20:00'`, `'1970-01-01T08:05:00.000Z'` → `'08:05'` (cero a la izquierda). Verificar que
      falla (rojo).
- [x] 2.8 Implementar `formatearHoraTurno` con `getUTCHours`/`getUTCMinutes` (D2, sin
      conversión de huso horario). Verificar que 2.7 pasa.
- [x] 2.9 Escribir `frontend/test/lib/ventana-cancelacion.test.ts` (archivo propio, separado de
      `fecha-hora.test.ts`, para que el filtro de Jest por nombre de archivo lo aísle) con los
      casos de `puedeCancelarSegunVentana(fecha, horaInicioTurno, ventanaCancelacionHoras,
      ahora)` (D9): exactamente `ventanaCancelacionHoras` antes del inicio del turno → `true`
      (borde inclusivo, mismo criterio que adoptó `cancelacion-turnos` para el backend); un
      minuto menos → `false`; un turno que cruza la medianoche local calculado igual que
      `finTurnoUtc` del backend para el caso de `horaFin < horaInicio` (aunque acá solo se usa
      el inicio, agregar el caso de regresión para dejar registrado el criterio). Verificar que
      falla (rojo) con `npm test -w frontend -- ventana-cancelacion`.
- [x] 2.10 Implementar `puedeCancelarSegunVentana` (D9). Verificar que 2.9 pasa con las dos
      zonas horarias del proceso.
- [x] 2.11 Escribir y luego implementar `agruparPorCampo(mensajes, campos)` (D8): un mensaje
      que empieza con `"emailCliente"` cae en ese campo; uno que empieza con `"turnoId"` (no
      declarado en `campos`) cae en `generales`; una lista vacía da `{ porCampo: {}, generales:
      [] }`. Verificar rojo y después verde con `npm test -w frontend -- agrupar-por-campo`.

## 3. Primitivas y copy compartidos (depende de 1.1/1.2, no de los Grupos A/B/C)

- [x] 3.1 Escribir el test de regresión de `Button`/`buttonVariants` con `size` por defecto
      (`'md'`): las clases resultantes siguen incluyendo `min-h-11` y `text-sm` exactamente
      como hoy. Sumar el caso `size="lg"` esperando `min-h-14` y `text-lg`. Verificar que el
      caso `size="lg"` falla (rojo) con `npm test -w frontend -- button`.
- [x] 3.2 Extender `buttonVariants`/`Button` con `size?: 'md' | 'lg'` y una tabla
      `sizeClasses` análoga a `variantClasses` (D4), sin tocar `variant`, `fullWidth` ni
      `className`. Verificar que 3.1 pasa completo, incluidos los tests de accesibilidad de
      `Button` ya existentes de `frontend-base` (`npm test -w frontend -- button`, sin
      regresiones).
- [x] 3.3 Escribir los tests de `Dialog` (`frontend/test/components/ui/dialog.test.tsx`, RTL
      con `jsdom`): `jsdom` no implementa la semántica modal real de `HTMLDialogElement`
      (no vuelve inerte el fondo, no atrapa el foco con Tab ni devuelve el foco solo al
      cerrarse — ver D5), así que la suite solo prueba lo que `jsdom` puede probar: stubear
      `HTMLDialogElement.prototype.showModal` y `.close` (jsdom no los implementa) y verificar
      que abrir el diálogo llama a `showModal()` y cerrarlo llama a `close()`; que el diálogo
      expone el nombre accesible/rol esperado; y que los botones de confirmar y cancelar
      disparan sus callbacks (`onConfirm`/`onCancel`) al hacer click; y que un evento `cancel`
      disparado sobre el `<dialog>` (lo que hace el navegador al apretar Escape) llama a
      `onCancel`. El atrapado de foco (Tab
      no sale del diálogo) y la devolución de foco al elemento que lo abrió NO se prueban acá:
      quedan como verificación manual en un navegador real (7.2). Verificar que falla (rojo).
- [x] 3.4 Implementar `frontend/src/components/ui/dialog.tsx` sobre `<dialog>` nativo
      (`showModal`/`close`, D5), con las mismas clases de foco visible que el resto de las
      primitivas. Verificar que 3.3 pasa.
- [x] 3.5 Escribir y luego implementar `PasosReserva` (`frontend/src/components/ui/` o
      `frontend/src/components/reservas/`, a definir por dónde vive el resto de este change):
      con `pasoActual={2}` `total={3}` renderiza un texto que contiene "Paso 2 de 3" (la única
      indicación accesible) y tres puntos decorativos con `aria-hidden`, el segundo con el
      estilo de actual. Verificar rojo y luego
      verde con `npm test -w frontend -- pasos-reserva`.
- [x] 3.6 (hecha en el slice de consultar, cuando la página ya existe) Escribir el test de `SiteHeader` verificando que, además del enlace a `/reservas` ya
      existente, hay un enlace a `/reservas/consultar` con nombre accesible "Consultar
      reserva", y que ningún enlace apunta a `/admin` (spec "Sin enlaces a la
      administración"). Verificar que falla (rojo) por el enlace nuevo.
- [x] 3.7 (hecha en el slice de consultar, junto con 3.6) Agregar el enlace a `SiteHeader` (D6), reusando `navLinkClassName`. Verificar que 3.6
      pasa.
- [x] 3.8 Revisar `frontend/test/lib/api/errors.test.ts` y `client.test.ts` de `frontend-base`:
      si algún test fija el texto exacto de un mensaje genérico, actualizarlo al texto en
      voseo antes de tocar el código (para que quede en rojo por el texto viejo, no en verde
      por casualidad). Migrar los mensajes de `errors.ts`/`client.ts` a voseo (D7). Verificar
      que toda la suite de `frontend/test/lib/api/` pasa después del cambio.

## 4. Grupo A — Reservar (depende de `catalogo-publico` y `reservas-crear` PR #40 mergeados)

- [x] 4.1 Confirmar que `GET /zonas`, `GET /turnos` y `POST /reservas` están en
      `openapi/openapi.yaml` en `main` (no solo en un `design.md`) y correr
      `npm run api:types -w frontend` para regenerar `schema.d.ts` con esos paths. No seguir
      con las tareas de esta sección si alguno falta: completar 4.1–4.x de las otras
      secciones o esperar. Verificar con
      `grep -n "'/zonas'\|'/turnos'\|'/reservas'" frontend/src/lib/api/schema.d.ts`.
- [x] 4.2 Reescribir `frontend/app/reservas/page.tsx` (Inicio, D3): título, acción principal
      "Reservá ahora" → `/reservas/nueva`, acción secundaria a `/reservas/consultar`, sin
      lógica de datos. Escribir su test RTL primero (rol de los botones, `href` de cada
      enlace, ausencia de cualquier texto/enlace de administración) y verificar rojo antes de
      escribir la página. Verificar verde con `npm test -w frontend -- reservas/page`.
- [x] 4.3 Escribir los tests del formulario del Paso 1 (`FormularioSeleccion`, RTL con zonas y
      turnos de fixture, sin red): los cuatro campos son obligatorios para habilitar
      "Ver disponibilidad"; mientras falta algún campo, debajo del botón deshabilitado aparece
      un texto en una región `aria-live="polite"` que lista qué falta completar (ej. "Falta
      elegir: turno y zona"), y ese texto se actualiza a medida que se completan campos hasta
      desaparecer con los cuatro completos; elegir un sábado ofrece solo turnos de sábado;
      elegir un lunes sin turnos activos muestra el aviso y oculta el `Select`; cambiar de
      fecha limpia un turno que ya no corresponde; el stepper de comensales se acota al rango
      de la zona elegida y se ajusta si la zona cambia; recibir `fecha`, `turnoId`, `zonaId` y
      `comensales` válidos como selección inicial (props que la página arma desde
      `searchParams`, ver D3 Pantalla 2) prellena cada control con esos valores; un `turnoId` o
      un `zonaId` inicial que no está en las fixtures de `GET /turnos`/`GET /zonas` se ignora
      sin romper el render, dejando ese campo sin seleccionar; también se ignoran (D3
      Pantalla 2, orden fecha → zona → turno → comensales) una `fecha` mal formada o anterior
      al día local de hoy, un `turnoId` existente pero de otro día de la semana que la
      `fecha`, y un `comensales` no entero o fuera del rango de la zona; enviar arma la URL de
      `/reservas/nueva/resultado` con los cuatro parámetros. Verificar que la suite falla
      (rojo) con `npm test -w frontend -- formulario-seleccion`.
- [x] 4.4 Implementar `FormularioSeleccion` (D3, Pantalla 2) y el `Server Component`
      `app/reservas/nueva/page.tsx` que hace `GET /zonas`/`GET /turnos` directo al backend y se
      los pasa como props, más `app/reservas/nueva/loading.tsx`. Verificar que 4.3 pasa y que
      `npm run build -w frontend` no falla por un `searchParams`/fetch mal tipado.
- [x] 4.5 Escribir los tests de `app/reservas/nueva/resultado/page.tsx`: sin los cuatro
      parámetros de query, redirige a `/reservas/nueva`; con "hay lugar", muestra el resumen,
      los lugares restantes y, si `requiereConfirmacionAdmin`, el aviso de pendiente, sin
      mostrarlo si no; con "no hay lugar", muestra un `Alert` por cada motivo informado y el
      botón "Cambiar fecha, turno o zona" con la URL prellenada; en un error de servidor o de
      red, muestra el mensaje genérico y el botón de reintentar. Mockear el cliente tipado a
      nivel de módulo para estos casos (no golpear red real). Verificar rojo con
      `npm test -w frontend -- resultado`.
- [x] 4.6 Implementar la página de resultado (D3, Pantalla 3) y su `loading.tsx`: además de
      `GET /disponibilidad`, resuelve `GET /zonas` (nombre y `requiereConfirmacionAdmin` para el
      aviso de pendiente) y `GET /turnos` (horario del resumen), y ante un `404` de
      `GET /disponibilidad` redirige al Paso 1. Verificar que 4.5 pasa.
- [ ] 4.7 Escribir los tests de `FormularioDatosContacto`: validación en línea al salir de cada
      campo (nombre vacío, email sin arroba, teléfono vacío); el botón de enviar se deshabilita
      y cambia su texto mientras la promesa está pendiente; un `400` con mensajes que empiezan
      con `emailCliente`/`nombreCliente`/`telefonoCliente` los muestra en línea en el campo
      correspondiente (usando `agruparPorCampo` de 2.11); un `400` con un mensaje que no
      matchea ningún campo conocido aparece en el resumen de errores con foco programático; un
      `409` con `motivos` muestra cada motivo y el botón "Volver a elegir" con la URL de la
      selección anterior, sin vaciar los campos ya escritos; un `409` con `motivos: []` muestra
      el mensaje de reintento sin navegar; un `404` muestra "Volver a empezar" sin parámetros;
      un error de servidor o de red conserva los datos tipeados y ofrece reintentar; un envío
      exitoso navega a `/reservas/nueva/exito` con los seis parámetros de la respuesta.
      Verificar rojo con `npm test -w frontend -- formulario-datos-contacto`.
- [ ] 4.8 Implementar `FormularioDatosContacto` y `app/reservas/nueva/datos/page.tsx` (D3
      Pantalla 4, D8). Verificar que 4.7 pasa.
- [ ] 4.9 Escribir los tests de `app/reservas/nueva/exito/page.tsx`: sin los parámetros
      esperados, redirige a `/reservas/nueva`; `estado=CONFIRMADA` muestra "confirmada" y no
      muestra el aviso de pendiente; `estado=PENDIENTE` muestra el aviso; el texto de la
      pantalla nunca menciona el envío de un email; el código se muestra con la clase de color
      `accent`. Verificar rojo.
- [ ] 4.10 Implementar la página de éxito y `BotonCopiarCodigo` (D3 Pantalla 5): escribir
      primero el test de `BotonCopiarCodigo` (usa `navigator.clipboard.writeText`, muestra
      confirmación momentánea) y verificar rojo antes de implementarlo. Verificar que 4.9 y el
      test del botón de copiar pasan.
- [ ] 4.11 Prueba manual de punta a punta del Grupo A contra el backend real levantado
      localmente (base sembrada): Inicio → Paso 1 → resultado con lugar en STANDARD → datos →
      éxito confirmada; repetir para VIP y verificar el aviso de pendiente; forzar "no hay
      lugar" con una fecha/turno sin cupo del seed. Verificar que las cuatro URLs conservan la
      selección en un refresh manual del navegador en cada paso.

## 5. Grupo B — Consultar (depende de `reserva-consultar` mergeado)

- [x] 5.1 Confirmar `POST /reservas/consultar` en `openapi/openapi.yaml` de `main` y
      regenerar `schema.d.ts` (`npm run api:types -w frontend`). Verificar con
      `grep -n "reservas/consultar" frontend/src/lib/api/schema.d.ts`.
- [x] 5.2 Escribir los tests de la sub-vista "formulario" de `ConsultaReserva`: código y email
      obligatorios con validación en línea; un `404` muestra el mensaje genérico sin indicar
      cuál dato falló; un `429` muestra el mensaje de espera; un error de servidor (`5xx`) y
      una falla de red muestran el mensaje genérico de `toApiResult`/`mapErrorApi` (en voseo,
      D7) y conservan el código y el email ya tipeados en sus campos para poder reintentar sin
      volver a escribirlos; un envío exitoso pasa a la sub-vista "detalle" con los datos de la
      respuesta. Verificar rojo con `npm test -w frontend -- consulta-reserva`.
- [x] 5.3 Escribir los tests de la sub-vista "detalle": muestra estado, fecha (formateada),
      turno (formateado) y zona; no renderiza nombre, email ni teléfono en ningún elemento del
      DOM; un enlace "Consultar otra reserva" vuelve a "formulario". (El gating del botón de
      cancelar según la ventana se cubre en la sección 6, una vez que ese dato esté
      disponible). Verificar rojo.
- [x] 5.4 Implementar `ConsultaReserva` (sub-vistas "formulario"/"detalle", D3 Pantalla 6-7,
      D1.2 sin reflejar el email en la URL, solo `?codigo=` opcional) y
      `app/reservas/consultar/page.tsx`. Verificar que 5.2 y 5.3 pasan.
- [x] 5.5 Prueba manual: consultar una reserva `CONFIRMADA` y una `PENDIENTE` del seed con su
      código y su email reales; consultar con un email que no corresponde y verificar el mismo
      mensaje genérico que con un código inexistente.
      Hecho el 29/09/2026 en Chromium (390 px): `SEEDCNF2` y `SEEDPND2` muestran su detalle sin
      datos de contacto; email ajeno y código inexistente muestran el mismo mensaje genérico, y
      la URL no cambia.

## 6. Grupo C — Cancelar (depende de `cancelacion-turnos` mergeado; usa `GET /zonas` del Grupo A)

- [ ] 6.1 Confirmar `POST /reservas/{codigo}/cancelar` en `openapi/openapi.yaml` de `main` y
      regenerar `schema.d.ts`. Verificar con
      `grep -n "cancelar" frontend/src/lib/api/schema.d.ts`.
- [ ] 6.2 Sumar a los tests de "detalle" (5.3) los casos de gating del botón de cancelar (D9):
      con una reserva `CANCELADA` no se ofrece; con una `CONFIRMADA` muy por delante de la
      ventana de su zona, se ofrece; con una `CONFIRMADA` dentro de la ventana, no se ofrece.
      Requiere que "detalle" resuelva `GET /zonas` para la `ventanaCancelacionHoras` de la
      zona consultada (mock en el test). Sumar también los dos casos de falla al verificar la
      ventana (D9): si `GET /zonas` responde `5xx`/falla de red, o si responde `200` pero sin
      la `zona.id` del detalle consultado (zona ya no existe en la lista), el botón "Cancelar
      mi reserva" NO se ofrece y en su lugar aparece un `Alert` `variant="info"` ("No pudimos
      verificar si todavía podés cancelar. Probá de nuevo en unos minutos.") con un `Button`
      "Reintentar" que vuelve a pedir `GET /zonas`; ninguno de los dos casos rompe el render
      del resto del detalle. Después del reintento: si responde bien, el `Alert` desaparece y
      el botón se muestra u oculta según `puedeCancelarSegunVentana`; si vuelve a fallar, el
      `Alert` sigue visible y el resto del detalle no cambia. Verificar rojo.
- [ ] 6.3 Conectar la resolución de `GET /zonas` y `puedeCancelarSegunVentana` (2.9/2.10) en
      "detalle" para decidir si se muestra el botón "Cancelar mi reserva", incluido el `Alert`
      informativo con "Reintentar" de 6.2 cuando `GET /zonas` falla o no trae la zona buscada
      (D9). Verificar que 6.2 pasa.
- [ ] 6.4 Escribir los tests de la sub-vista "confirmar cancelación" (usa `Dialog` de 3.3/3.4):
      abrir el diálogo con el resumen visible; cerrarlo sin confirmar no envía ninguna
      solicitud y no cambia el estado mostrado; confirmar envía `{ email }` al código de la
      reserva consultada; mientras está pendiente, "Sí, cancelar" muestra estado de carga; un
      `204` cierra el diálogo, pasa el estado local a `CANCELADA` y oculta el botón de
      cancelar; un `404`/`409`/`429`/error de servidor muestra el mensaje dentro del diálogo,
      que permanece abierto y no cambia el estado mostrado. Verificar rojo con
      `npm test -w frontend -- confirmar-cancelacion`.
- [ ] 6.5 Implementar la sub-vista de confirmación dentro de `ConsultaReserva` (D3 Pantalla
      8-9). Verificar que 6.4 pasa y que la suite completa de `ConsultaReserva` (5.2, 5.3, 6.2,
      6.4) sigue en verde junta.
- [ ] 6.6 Prueba manual: cancelar una reserva del seed dentro de la ventana permitida y
      verificar que el detalle pasa a `CANCELADA`; intentar cancelar una reserva cuyo turno ya
      pasó (o crear una reserva de prueba con anticipación mínima y esperar a que la ventana
      venza, si es viable localmente) y verificar el `409` dentro del diálogo.

## 7. Cierre (Definition of Done, `config.yaml` §13)

- [ ] 7.1 `openspec validate frontend-cliente --strict` pasa y todas las tareas de este
      archivo están marcadas o explícitamente pospuestas con su motivo. Verificar con el
      comando y revisando que no quede ningún `- [ ]` sin justificar.
- [ ] 7.2 Verificación manual de accesibilidad visual (mismo criterio que D9 de
      `frontend-base`: sin herramienta automatizada) en 375px, 768px, 1024px y 1440px para las
      nueve pantallas: sin scroll horizontal, contraste de la insignia dorada y del texto sobre
      `muted`, área táctil ≥44×44px del stepper y de los botones `size="lg"` (≥56px de alto),
      foco visible en cada control nuevo incluido dentro de `Dialog`. Sumar, específicamente
      sobre `Dialog` (spec "El diálogo de cancelación atrapa el foco" / "Cerrar el diálogo
      devuelve el foco"; D5 documenta que `jsdom` no puede probar esto, ver 3.3): abrir el
      diálogo de confirmar cancelación en un navegador real y verificar que Tab/Shift+Tab no
      saca el foco de sus controles mientras está abierto, y que cerrarlo (con "Volver", con
      "Sí, cancelar", o con Escape) devuelve el foco al botón "Cancelar mi reserva" que lo
      abrió. Documentar el resultado en la descripción del PR.
- [ ] 7.3 El change no agrega ni modifica `openapi/openapi.yaml` ni `backend/prisma`: no
      aplican migración ni contrato propios. Verificar con `git diff main --stat -- backend
      openapi` vacío.
- [ ] 7.4 No se agregaron variables de entorno ni dependencias nuevas. Verificar con
      `git diff main -- .env.example frontend/package.json` (el segundo, sin cambios en
      `dependencies`/`devDependencies`, solo posibles cambios de `package-lock.json` si
      `api:types` regeneró algo).
- [ ] 7.5 Tests de todas las utilidades puras y de los componentes de este change en verde:
      `npm test -w frontend`, con `TZ=UTC` y con `TZ=America/Argentina/Buenos_Aires`.
- [ ] 7.6 `npm run lint` y `npm run typecheck` (`tsc --noEmit`) en limpio, sin warnings nuevos,
      desde la raíz.
- [ ] 7.7 CI en verde en el PR `feature/frontend-cliente`. Verificar en la pestaña Checks.
- [ ] 7.8 PR con descripción en español, enlazado a `openspec/changes/frontend-cliente/`, con
      el resultado de 7.2, las Open Questions de `design.md` resueltas o explícitamente
      pospuestas, y aprobado por un compañero distinto del autor. Verificar en GitHub.
- [ ] 7.9 Después del merge, archivar el change con `openspec archive frontend-cliente` en su
      propio PR. Verificar que `openspec/specs/frontend-cliente/spec.md` existe en `main`.

## Notas de implementación (para la descripción del PR)

**Prerrequisitos (1.1 a 1.3), estado verificado al 29/09/2026 con `gh pr list --state merged` y
`git log origin/main`:**

- Mergeados a `main`: `frontend-base` (PR #43), `reservas-crear` (PR #40), `reserva-consultar`
  (PR #35) y `cancelacion-turnos` (PR #50). `feature/frontend-cliente` se creó desde `main`
  en `f5058bb`.
- NO mergeado: `catalogo-publico` (PR #51, abierto, CI en verde, pendiente de revisión de un
  compañero). Sin `GET /zonas` ni `GET /turnos` en `openapi/openapi.yaml` de `main`, las
  secciones 4 (Grupo A) y 6 (Grupo C, que usa `GET /zonas` para la ventana) no se pueden
  completar contra el cliente tipado real: quedan con fixtures locales (D10) hasta que ese PR
  mergee. La sección 5 (Grupo B) ya tiene su endpoint en `main`.

**Diferencias entre `design.md` y el código real de `frontend-base` (1.2):**

- Los nombres citados existen tal cual: `buttonVariants`, `variantClasses`, `Field`,
  `mapErrorApi`, `ApiResult`, `mensajeDeRechazo` (este último en `client.ts`, no en
  `errors.ts`, como ya decía D7). No se renombró nada.
- `fullWidth` es una opción de `buttonVariants`, no una prop de `Button` (`ButtonProps` solo
  declara `variant`). `size` se agrega a ambos: a `buttonVariants` como opción y a `Button`
  como prop.
- `min-h-11` y `text-sm` están en las clases base de `buttonVariants`, no en una tabla, como
  anticipaba D4; pasan a `sizeClasses`.
- `DiaSemana` no existe todavía en `schema.d.ts` (llega con `catalogo-publico`, PR #51): se
  define como tipo local en `frontend/src/lib/fecha-hora.ts` con los mismos valores del enum
  de Prisma. Al mergear ese PR conviene reemplazarlo por el tipo generado.
- Las utilidades de `fecha-hora.ts` validan su entrada y lanzan un `Error` claro en vez de dar
  `NaN` o pasar al mes siguiente: `diaSemanaDeFechaLocal` y `formatearFechaLargaEs` exigen una
  fecha `YYYY-MM-DD` que exista en el calendario, y `formatearHoraTurno` exige `HH:mm` o el ISO
  `1970-01-01T...Z` (acepta ambos). El validador de fecha (`leerFechaIso`) y el de hora
  (`leerHoraLocalMs`) se exportan desde `fecha-hora.ts` y los reusa `ventana-cancelacion.ts`.
- `puedeCancelarSegunVentana` vive en `frontend/src/lib/ventana-cancelacion.ts` (D9 no fija
  archivo) y reusa `ARGENTINA_OFFSET_MS`, exportada desde `fecha-hora.ts`. Acepta la hora de
  inicio como `HH:mm` (formato de `POST /reservas/consultar`) o como ISO
  `1970-01-01THH:mm:ss.sssZ` (formato de `GET /turnos`); conserva los segundos y milisegundos del
  ISO (`HH:mm` equivale a `:00`). Una hora mal formada, una `fecha` que no sea `YYYY-MM-DD` o que
  no exista en el calendario (ej. `2026-02-30`) lanzan un `Error`; nunca devuelve `false` por
  `NaN` ni pasa al mes siguiente.

**Observación sobre 2.5:** el caso de `Pacific/Kiritimati` (UTC+14) no puede detectar la falta
de `timeZone: 'UTC'`: la medianoche UTC leída en UTC+14 sigue siendo el mismo día (14:00). Solo
un huso con offset negativo lo detecta: al quitar `timeZone: 'UTC'`, la suite falla con
`TZ=America/Argentina/Buenos_Aires` (2 tests) y pasa con `TZ=UTC` y `TZ=Pacific/Kiritimati`. Por
eso `frontend/jest.config.ts` fija `TZ=America/Argentina/Buenos_Aires` por defecto (solo si el
entorno no define `TZ`, de modo que 7.5 puede seguir corriendo la suite con `TZ=UTC`). Se
verificó con la mutación temporal usando `npm run test -w frontend` sin `TZ` en el entorno. Nota:
hoy `ci.yml` no ejecuta los tests del frontend.

**Desvío de D8 (`agruparPorCampo`):** en vez de `mensaje.startsWith(nombreDeCampo)`, el nombre
del campo debe ser la primera palabra del mensaje. Así una clave corta como `email` no captura
los mensajes de `emailCliente`, ni un campo que solo comparte prefijo. Con los mensajes de
`class-validator` (nombre del campo, espacio, texto) el resultado es el mismo.

**Primitivas y copy compartidos (sección 3):**

- `PasosReserva` vive en `frontend/src/components/reservas/pasos-reserva.tsx` (es propio del
  asistente de reserva, no una primitiva genérica de `ui/`).
- `Dialog` es controlado (`open`) y trae sus dos botones (`textoConfirmar`/`textoCancelar`,
  `onConfirm`/`onCancel`, `confirmando` para deshabilitar la confirmación en curso). Escucha
  `cancel` y `close`. Un `cancel` cancelable (Escape) se evita con `preventDefault` y llama a
  `onCancel` una vez: el cierre lo decide `open` y el navegador no dispara `close` después. Un
  `cancel` no cancelable (Chromium ante Escape repetido sin interacción del usuario) cierra el
  diálogo nativo igual: el evento `close` llama a `onCancel` una vez, para que el padre baje
  `open`, y un `open=true` posterior lo vuelve a mostrar. Los cierres que provoca el propio
  componente (`open=false`, desmontaje, el ciclo montar/limpiar/montar de React Strict Mode) se
  marcan con una referencia y `close` los ignora: no llaman a `onCancel`. Los tests lo cubren; el
  atrapado y la devolución de foco siguen pendientes de la verificación manual 7.2.
- D7 (voseo): solo cambió el mensaje de 5xx de `errors.ts` ("Intentá de nuevo más tarde.").
  Los mensajes de `mensajeDeRechazo` en `client.ts` son impersonales y no se tocaron, como
  ya preveía D7. Los tres tests de `errors.test.ts` que fijaban el texto exacto se
  actualizaron antes que el código (rojo por el texto viejo).

**Grupo B, consultar (sección 5):**

- 5.1: `npm run api:types -w frontend` agregó a `schema.d.ts` solo líneas nuevas (656 líneas, sin
  borrados): `/reservas` (`POST`), `/reservas/consultar`, `/reservas/{codigo}/cancelar` y
  `/admin/reservas` con sus schemas, todos ya mergeados en `main` y todavía ausentes del archivo
  versionado. No apareció ningún diff ajeno a esos contratos.
- El `turno` de `POST /reservas/consultar` trae `horaInicio`/`horaFin` como `HH:mm` (hora local
  ya formateada por el backend), no como ISO `1970-01-01T...` como `GET /turnos` (D2). El
  detalle los muestra tal cual y no usa `formatearHoraTurno`. Para 6.3, `puedeCancelarSegunVentana`
  ya acepta `HH:mm` además del ISO de `GET /turnos`, así que se le puede pasar `turno.horaInicio`
  sin convertir.
- `POST /reservas/consultar` responde `429` sin cuerpo y `mapErrorApi` lo dejaba como el mensaje
  genérico "Ocurrió un error inesperado.". Se agregó a `errors.ts` (aditivo, sin renombrar nada)
  el caso `limite-de-intentos` con el mensaje "Hiciste demasiados intentos. Esperá unos minutos
  antes de volver a intentar.", con su test. Lo reusará la cancelación (6.4).
- `ConsultaReserva` vive en `frontend/src/components/reservas/consulta-reserva.tsx`; el código
  se valida como 8 caracteres alfanuméricos y se pasa a mayúsculas al tipear. El botón
  "Reintentar" aparece solo ante `desconocido` (5xx o red); ante un `404` o un `429` se corrige
  o se espera y se vuelve a enviar con el botón principal. "Consultar otra reserva" es un
  `<button>` con aspecto de enlace (no navega) y vacía el email. `app/reservas/consultar/page.tsx`
  solo prellena `?codigo=` (ignora valores con formato inválido o repetidos) y nunca lee el email.
- 5.5 (prueba manual contra el backend real) se hizo el 29/09/2026; el detalle está en la tarea.
- `ConsultaReserva` deshabilita el código y el email mientras consulta, ignora un nuevo envío si
  ya hay una consulta en curso (referencia, no solo el estado) y deshabilita "Reintentar" mientras
  tanto. Cada consulta lleva un número de solicitud y solo se aplica la respuesta de la vigente;
  con los campos bloqueados y sin reentradas, una respuesta pisada solo puede ocurrir si el
  componente se desmonta a mitad de la consulta, caso en que se descarta. La página usa
  `key={codigoInicial}` para reiniciar el formulario al navegar entre `?codigo=` distintos.
- El detalle de `ConsultaReserva` formatea la fecha con un envoltorio local que, si la utilidad
  lanza (fecha inesperada en un `200`), muestra el valor tal cual llegó en vez de romper la
  pantalla. Las utilidades de `fecha-hora.ts` siguen lanzando.
