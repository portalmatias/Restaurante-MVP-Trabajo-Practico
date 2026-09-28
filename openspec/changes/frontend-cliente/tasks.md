## 1. Prerrequisitos (bloqueante)

- [ ] 1.1 Confirmar que la implementación de `frontend-base` (PR #43) está mergeada a `main` y
      crear `feature/frontend-cliente` desde ese `main`. No seguir hasta que sea cierto.
      Verificar con `git log origin/main --oneline` y comprobando que existen
      `frontend/src/components/ui/{button,field,input,label,select,card,alert}.tsx` y
      `frontend/src/lib/api/{client.ts,errors.ts,url-base.ts,schema.d.ts}`.
- [ ] 1.2 Releer los archivos reales de 1.1 y anotar cualquier diferencia de nombre, prop o
      firma respecto de lo asumido en `design.md` (D2/D4/D7 citan `buttonVariants`,
      `variantClasses`, `Field`, `mapErrorApi`, `ApiResult`, `mensajeDeRechazo` tal como
      existían el 28/09/2026). Si algo cambió, usar la forma real y anotarlo en la descripción
      del PR, sin renombrar nada del lado de `frontend-base`. Verificar leyendo esos archivos.
- [ ] 1.3 Confirmar el estado de merge de los cuatro backends de los que dependen los Grupos
      A/B/C (`catalogo-publico`, `reservas-crear` PR #40, `reserva-consultar`,
      `cancelacion-turnos`) con `gh pr list --state merged` y `git log origin/main --oneline`.
      Anotar cuáles ya están para saber qué secciones (4, 5, 6) se pueden completar contra el
      cliente tipado real y cuáles quedan con fixtures locales (D10).

## 2. Utilidades puras de fecha y hora (sin dependencia de backend)

- [ ] 2.1 Escribir `frontend/test/lib/fecha-hora.test.ts` con los casos de
      `fechaLocalDeHoy(ahora)`: para un instante UTC que cae después de la medianoche de
      Argentina pero antes de la medianoche UTC (ej. `2026-09-15T02:00:00.000Z`, que en
      Argentina todavía es `2026-09-14`), devuelve `2026-09-14`; para un instante bien entrada
      la tarde en Argentina, devuelve el mismo día que un `toISOString().slice(0,10)` daría.
      Correr con `TZ=UTC` y con `TZ=America/Argentina/Buenos_Aires`. Verificar que la suite
      falla (rojo) con `npm test -w frontend -- fecha-hora`.
- [ ] 2.2 Implementar `fechaLocalDeHoy` en `frontend/src/lib/fecha-hora.ts` con el offset fijo
      de Argentina y `getUTC*`/`Date.UTC` (D2), sin usar `Intl` para el cálculo. Verificar que
      2.1 pasa con las dos zonas horarias del proceso.
- [ ] 2.3 Sumar a la misma suite los casos de `diaSemanaDeFechaLocal(fecha)`: `2026-09-19` →
      `SABADO`, `2026-09-21` → `LUNES`, y los siete días de una semana completa mapean sin
      desfase. Verificar que falla (rojo).
- [ ] 2.4 Implementar `diaSemanaDeFechaLocal` con `Date.UTC(y, m-1, d).getUTCDay()` y el mapeo
      a `DiaSemana`. Verificar que 2.3 pasa.
- [ ] 2.5 Sumar los casos de `formatearFechaLargaEs(fecha)`: `2026-09-19` da un texto que
      contiene "sábado", "19", "septiembre" y "2026"; el resultado no cambia entre
      `TZ=UTC` y `TZ=America/Argentina/Buenos_Aires`, ni entre `TZ=UTC` y una zona horaria muy
      adelantada (ej. `Pacific/Kiritimati`, UTC+14) que sí haría fallar una implementación sin
      `timeZone: 'UTC'` explícito en `Intl.DateTimeFormat`. Verificar que falla (rojo).
- [ ] 2.6 Implementar `formatearFechaLargaEs` (D2). Verificar que 2.5 pasa con las tres zonas
      horarias del proceso.
- [ ] 2.7 Sumar los casos de `formatearHoraTurno(horaIso)`: `'1970-01-01T20:00:00.000Z'` →
      `'20:00'`, `'1970-01-01T08:05:00.000Z'` → `'08:05'` (cero a la izquierda). Verificar que
      falla (rojo).
- [ ] 2.8 Implementar `formatearHoraTurno` con `getUTCHours`/`getUTCMinutes` (D2, sin
      conversión de huso horario). Verificar que 2.7 pasa.
- [ ] 2.9 Escribir los casos de `puedeCancelarSegunVentana(fecha, horaInicioTurno,
      ventanaCancelacionHoras, ahora)` (D9): exactamente `ventanaCancelacionHoras` antes del
      inicio del turno → `true` (borde inclusivo, mismo criterio que adoptó
      `cancelacion-turnos` para el backend); un minuto menos → `false`; un turno que cruza la
      medianoche local calculado igual que `finTurnoUtc` del backend para el caso de
      `horaFin < horaInicio` (aunque acá solo se usa el inicio, agregar el caso de regresión
      para dejar registrado el criterio). Verificar que falla (rojo) con
      `npm test -w frontend -- ventana-cancelacion`.
- [ ] 2.10 Implementar `puedeCancelarSegunVentana` (D9). Verificar que 2.9 pasa con las dos
      zonas horarias del proceso.
- [ ] 2.11 Escribir y luego implementar `agruparPorCampo(mensajes, campos)` (D8): un mensaje
      que empieza con `"emailCliente"` cae en ese campo; uno que empieza con `"turnoId"` (no
      declarado en `campos`) cae en `generales`; una lista vacía da `{ porCampo: {}, generales:
      [] }`. Verificar rojo y después verde con `npm test -w frontend -- agrupar-por-campo`.

## 3. Primitivas y copy compartidos (depende de 1.1/1.2, no de los Grupos A/B/C)

- [ ] 3.1 Escribir el test de regresión de `Button`/`buttonVariants` con `size` por defecto
      (`'md'`): las clases resultantes siguen incluyendo `min-h-11` y `text-sm` exactamente
      como hoy. Sumar el caso `size="lg"` esperando `min-h-14` y `text-lg`. Verificar que el
      caso `size="lg"` falla (rojo) con `npm test -w frontend -- button`.
- [ ] 3.2 Extender `buttonVariants`/`Button` con `size?: 'md' | 'lg'` y una tabla
      `sizeClasses` análoga a `variantClasses` (D4), sin tocar `variant`, `fullWidth` ni
      `className`. Verificar que 3.1 pasa completo, incluidos los tests de accesibilidad de
      `Button` ya existentes de `frontend-base` (`npm test -w frontend -- button`, sin
      regresiones).
- [ ] 3.3 Escribir los tests de `Dialog` (`frontend/test/components/ui/dialog.test.tsx`, RTL
      con `jsdom`): abre con el contenido visible y foco dentro de él; `Escape` lo cierra;
      cerrarlo devuelve el foco al elemento que lo abrió (comprobable en `jsdom` verificando
      `document.activeElement` antes y después). Verificar que falla (rojo).
- [ ] 3.4 Implementar `frontend/src/components/ui/dialog.tsx` sobre `<dialog>` nativo
      (`showModal`/`close`, D5), con las mismas clases de foco visible que el resto de las
      primitivas. Verificar que 3.3 pasa.
- [ ] 3.5 Escribir y luego implementar `PasosReserva` (`frontend/src/components/ui/` o
      `frontend/src/components/reservas/`, a definir por dónde vive el resto de este change):
      con `pasoActual={2}` `total={3}` renderiza un texto que contiene "Paso 2 de 3" y tres
      indicadores, el segundo marcado como actual (`aria-current`). Verificar rojo y luego
      verde con `npm test -w frontend -- pasos-reserva`.
- [ ] 3.6 Escribir el test de `SiteHeader` verificando que, además del enlace a `/reservas` ya
      existente, hay un enlace a `/reservas/consultar` con nombre accesible "Consultar
      reserva", y que ningún enlace apunta a `/admin` (spec "Sin enlaces a la
      administración"). Verificar que falla (rojo) por el enlace nuevo.
- [ ] 3.7 Agregar el enlace a `SiteHeader` (D6), reusando `navLinkClassName`. Verificar que 3.6
      pasa.
- [ ] 3.8 Revisar `frontend/test/lib/api/errors.test.ts` y `client.test.ts` de `frontend-base`:
      si algún test fija el texto exacto de un mensaje genérico, actualizarlo al texto en
      voseo antes de tocar el código (para que quede en rojo por el texto viejo, no en verde
      por casualidad). Migrar los mensajes de `errors.ts`/`client.ts` a voseo (D7). Verificar
      que toda la suite de `frontend/test/lib/api/` pasa después del cambio.

## 4. Grupo A — Reservar (depende de `catalogo-publico` y `reservas-crear` PR #40 mergeados)

- [ ] 4.1 Confirmar que `GET /zonas`, `GET /turnos` y `POST /reservas` están en
      `openapi/openapi.yaml` en `main` (no solo en un `design.md`) y correr
      `npm run api:types -w frontend` para regenerar `schema.d.ts` con esos paths. No seguir
      con las tareas de esta sección si alguno falta: completar 4.1–4.x de las otras
      secciones o esperar. Verificar con
      `grep -n "'/zonas'\|'/turnos'\|'/reservas'" frontend/src/lib/api/schema.d.ts`.
- [ ] 4.2 Reescribir `frontend/app/reservas/page.tsx` (Inicio, D3): título, acción principal
      "Reservá ahora" → `/reservas/nueva`, acción secundaria a `/reservas/consultar`, sin
      lógica de datos. Escribir su test RTL primero (rol de los botones, `href` de cada
      enlace, ausencia de cualquier texto/enlace de administración) y verificar rojo antes de
      escribir la página. Verificar verde con `npm test -w frontend -- reservas/page`.
- [ ] 4.3 Escribir los tests del formulario del Paso 1 (`FormularioSeleccion`, RTL con zonas y
      turnos de fixture, sin red): los cuatro campos son obligatorios para habilitar
      "Ver disponibilidad"; elegir un sábado ofrece solo turnos de sábado; elegir un lunes sin
      turnos activos muestra el aviso y oculta el `Select`; cambiar de fecha limpia un turno
      que ya no corresponde; el stepper de comensales se acota al rango de la zona elegida y
      se ajusta si la zona cambia; enviar arma la URL de `/reservas/nueva/resultado` con los
      cuatro parámetros. Verificar que la suite falla (rojo) con
      `npm test -w frontend -- formulario-seleccion`.
- [ ] 4.4 Implementar `FormularioSeleccion` (D3, Pantalla 2) y el `Server Component`
      `app/reservas/nueva/page.tsx` que hace `GET /zonas`/`GET /turnos` directo al backend y se
      los pasa como props, más `app/reservas/nueva/loading.tsx`. Verificar que 4.3 pasa y que
      `npm run build -w frontend` no falla por un `searchParams`/fetch mal tipado.
- [ ] 4.5 Escribir los tests de `app/reservas/nueva/resultado/page.tsx`: sin los cuatro
      parámetros de query, redirige a `/reservas/nueva`; con "hay lugar", muestra el resumen,
      los lugares restantes y, si `requiereConfirmacionAdmin`, el aviso de pendiente, sin
      mostrarlo si no; con "no hay lugar", muestra un `Alert` por cada motivo informado y el
      botón "Cambiar fecha, turno o zona" con la URL prellenada; en un error de servidor o de
      red, muestra el mensaje genérico y el botón de reintentar. Mockear el cliente tipado a
      nivel de módulo para estos casos (no golpear red real). Verificar rojo con
      `npm test -w frontend -- resultado`.
- [ ] 4.6 Implementar la página de resultado (D3, Pantalla 3) y su `loading.tsx`. Verificar
      que 4.5 pasa.
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

- [ ] 5.1 Confirmar `POST /reservas/consultar` en `openapi/openapi.yaml` de `main` y
      regenerar `schema.d.ts` (`npm run api:types -w frontend`). Verificar con
      `grep -n "reservas/consultar" frontend/src/lib/api/schema.d.ts`.
- [ ] 5.2 Escribir los tests de la sub-vista "formulario" de `ConsultaReserva`: código y email
      obligatorios con validación en línea; un `404` muestra el mensaje genérico sin indicar
      cuál dato falló; un `429` muestra el mensaje de espera; un envío exitoso pasa a la
      sub-vista "detalle" con los datos de la respuesta. Verificar rojo con
      `npm test -w frontend -- consulta-reserva`.
- [ ] 5.3 Escribir los tests de la sub-vista "detalle": muestra estado, fecha (formateada),
      turno (formateado) y zona; no renderiza nombre, email ni teléfono en ningún elemento del
      DOM; un enlace "Consultar otra reserva" vuelve a "formulario". (El gating del botón de
      cancelar según la ventana se cubre en la sección 6, una vez que ese dato esté
      disponible). Verificar rojo.
- [ ] 5.4 Implementar `ConsultaReserva` (sub-vistas "formulario"/"detalle", D3 Pantalla 6-7,
      D1.2 sin reflejar el email en la URL, solo `?codigo=` opcional) y
      `app/reservas/consultar/page.tsx`. Verificar que 5.2 y 5.3 pasan.
- [ ] 5.5 Prueba manual: consultar una reserva `CONFIRMADA` y una `PENDIENTE` del seed con su
      código y su email reales; consultar con un email que no corresponde y verificar el mismo
      mensaje genérico que con un código inexistente.

## 6. Grupo C — Cancelar (depende de `cancelacion-turnos` mergeado; usa `GET /zonas` del Grupo A)

- [ ] 6.1 Confirmar `POST /reservas/{codigo}/cancelar` en `openapi/openapi.yaml` de `main` y
      regenerar `schema.d.ts`. Verificar con
      `grep -n "cancelar" frontend/src/lib/api/schema.d.ts`.
- [ ] 6.2 Sumar a los tests de "detalle" (5.3) los casos de gating del botón de cancelar (D9):
      con una reserva `CANCELADA` no se ofrece; con una `CONFIRMADA` muy por delante de la
      ventana de su zona, se ofrece; con una `CONFIRMADA` dentro de la ventana, no se ofrece.
      Requiere que "detalle" resuelva `GET /zonas` para la `ventanaCancelacionHoras` de la
      zona consultada (mock en el test). Verificar rojo.
- [ ] 6.3 Conectar la resolución de `GET /zonas` y `puedeCancelarSegunVentana` (2.9/2.10) en
      "detalle" para decidir si se muestra el botón "Cancelar mi reserva". Verificar que 6.2
      pasa.
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
      foco visible en cada control nuevo incluido dentro de `Dialog`. Documentar el resultado
      en la descripción del PR.
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
