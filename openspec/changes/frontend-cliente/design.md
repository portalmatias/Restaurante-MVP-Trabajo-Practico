## Context

Ver `proposal.md` (`Why`) para la motivación y `specs/frontend-cliente/spec.md` para el
comportamiento exigido. Este documento resuelve cómo se arma el flujo sobre lo que ya deja
`frontend-base` (PR #43, sin mergear todavía) y sobre los contratos que los otros changes de
backend dejaron en sus propios `design.md`.

> **Versiones de referencia.** Este documento cita `frontend-base` y `reservas-crear` en la
> versión de sus PRs abiertos, no en la que hoy está en `main`: el proxy `/api` y `url-base.ts`
> (D6), y la decisión D11 (sin enlaces a `/admin` en la interfaz pública), llegan con el PR
> #43; el `400` ante campos de más en `POST /reservas` (D6 de `reservas-crear`, por
> `forbidNonWhitelisted`) llega con el PR #40. Hasta que esos dos se mergeen, la versión de
> `main` de esos documentos dice otra cosa. Por eso 1.1 exige que estén en `main` antes de
> implementar.

**Persona de diseño:** Raúl, 74 años, reserva desde el celular una mesa VIP para sus bodas de
oro y se frustra con respuestas lentas. Todas las decisiones de layout, tipografía y flujo de
esta capability se toman para él: texto grande, botones grandes, una sola tarea por pantalla,
progreso visible, lenguaje simple.

**Estado del que se parte:**
- `frontend-base` D2/D3 fijan los tokens (`primary` #171717, `secondary` #404040, `accent`
  #A16207, `background`/`card` #FFFFFF, `muted` #E8ECF0 con `muted-foreground` #475569,
  `border` #E5E5E5, `destructive` #DC2626) y la tipografía Inter. Su spec ya exige contraste
  ≥4.5:1 para `accent` sobre el fondo que define (y, por ser una relación simétrica, la misma
  pareja invertida —`accent-foreground` sobre `accent`— tiene el mismo valor de contraste sin
  necesidad de volver a medirla).
- `frontend-base` D4 deja `Button`, `Input`, `Label`, `Field`, `Card`, `Select` y `Alert` en
  `frontend/src/components/ui/`, todas con altura mínima de 44px (`min-h-11`) y `text-sm`
  (14px) para el texto de `Button`, y `text-base` (16px) para `Input`/`Select`. Su Open
  Questions deja explícitamente pendiente un `Dialog` "si surge una necesidad concreta" — este
  change es esa necesidad.
- `frontend-base` D5/D6/D7 dejan `apiClient` (`openapi-fetch` tipado desde
  `openapi/openapi.yaml`), `toApiResult`/`mapErrorApi` (`ApiResult<T>`/`ErrorApi` con los
  casos `validacion` (400, lista de mensajes), `no-encontrado` (404), `conflicto` (409, con
  `motivos: MotivoNoDisponible[]`) y `desconocido` (5xx/red, mensaje genérico fijo)), y
  `urlBaseApi()` (`/api` en el navegador, `NEXT_PUBLIC_API_URL` directo en Server Components).
  Sus mensajes hoy son de tuteo/formales ("Intente de nuevo…"), no de voseo.
- El cliente tipado (D5 de `frontend-base`) solo tiene tipos para los paths presentes en
  `openapi/openapi.yaml` **en el momento de generarlos**. Hoy (28/09/2026) ese archivo tiene
  `/disponibilidad`, `/auth/login` y las rutas de `/admin/*`. `POST /reservas`,
  `POST /reservas/consultar`, `POST /reservas/{codigo}/cancelar`, `GET /zonas` y `GET /turnos`
  existen solo como fragmentos en `design.md` de sus changes (`reservas-crear` PR #40 abierto;
  `reserva-consultar` y `cancelacion-turnos`, specs mergeadas, implementación pendiente;
  `catalogo-publico`, spec en PR #44, implementación pendiente). Hasta que cada uno mergee su
  controller y su fragmento pase al YAML, no existe un tipo real para ese path: escribir
  contra él antes es escribir contra un tipo que no está. Por eso el trabajo se agrupa (D10).
- Contratos consumidos, ya fijados en sus `design.md` (no se repiten acá salvo lo que este
  documento necesita decidir):
  - `GET /disponibilidad` (mergeado): `disponible`, `lugaresRestantes`, `motivos[]` con
    `codigo` (`CodigoMotivo`) y `mensaje`.
  - `GET /zonas` (`catalogo-publico`): `id`, `nombre`, `minComensales`, `maxComensales`,
    `anticipacionMinHoras`, `anticipacionMaxDias`, `ventanaCancelacionHoras`,
    `requiereConfirmacionAdmin`. Sin `aforoMaximo` ni mesas.
  - `GET /turnos` (`catalogo-publico`): `id`, `diaSemana`, `horaInicio`, `horaFin`, solo
    turnos `activo: true`, ordenados por día y hora. `horaInicio`/`horaFin` viajan como ISO
    8601 con fecha fija `1970-01-01` (ej. `'1970-01-01T20:00:00.000Z'`): codifican la hora
    **local** del restaurante, no un instante UTC real. Filtro opcional `diaSemana`.
  - `POST /reservas` (`reservas-crear`): body `fecha` (`YYYY-MM-DD`), `turnoId`, `zonaId`,
    `comensales`, `nombreCliente`, `emailCliente`, `telefonoCliente`. `201` con
    `codigoReserva`, `estado` (`PENDIENTE`/`CONFIRMADA`), `fecha`, `turnoId`, `zonaId`,
    `comensales` (sin `id` ni mesa). `400` con `message` como lista de textos con el nombre
    del campo en formato `camelCase` al frente (ej. `"emailCliente debe ser un email
    válido"`). `404` turno o zona inexistentes. `409` con `motivos` (puede venir `[]` si el
    rechazo fue un choque de concurrencia, no una regla).
  - `POST /reservas/consultar` (`reserva-consultar`): body `{ codigo, email }`. `200` con
    `codigoReserva`, `estado`, `fecha`, `comensales`, `turno { id, horaInicio, horaFin }`,
    `zona { id, nombre }` (sin `ventanaCancelacionHoras`: ese dato vive en `GET /zonas`, no en
    la consulta). `404` único, igual si falla el código o el email. `429` por límite global.
  - `POST /reservas/{codigo}/cancelar` (`cancelacion-turnos`): body `{ email }`. `204` sin
    cuerpo. `404` igual que la consulta. `409` fuera de la ventana de cancelación o estado no
    cancelable. `429` por límite.

## Goals / Non-Goals

**Goals:**
- Fijar la arquitectura de rutas y de estado del asistente de reserva: qué vive en la URL, qué
  vive en memoria de cliente, y por qué (uno de los puntos que pide explícitamente el pedido).
- Especificar, pantalla por pantalla, layout, jerarquía, espaciado, qué token usa cada
  elemento, escala tipográfica y los cuatro estados (carga, vacío, error, éxito), en términos
  de código, sin depender de Figma.
- Fijar cómo se calcula y se muestra la hora local a partir de los datos UTC/hora-local que
  entrega la API, sin sumar una librería de fechas.
- Agrupar las tareas por prerrequisito de backend, para que cada grupo se pueda implementar en
  cuanto su endpoint mergee, sin tipos escritos a mano ni paths ficticios en el YAML.

**Non-Goals:**
- No define el flujo de `frontend-admin` (FedeWerk) ni ninguna pantalla de `/admin`.
- No cambia ningún contrato de API: consume los fragmentos que ya fijaron `catalogo-publico`,
  `reservas-crear`, `reserva-consultar` y `cancelacion-turnos`.
- No agrega modo oscuro, autenticación de cliente ni un backend-for-frontend propio.
- No reimplementa ninguna regla de negocio del backend (aforo, anticipación, ventana de
  cancelación) como validación autoritativa: donde este documento usa esas reglas del lado del
  cliente (D9), es siempre una ayuda de navegación, nunca la fuente de verdad.

## Decisions

### D1: El estado del asistente de reserva vive en la URL, no en memoria de cliente ni en `sessionStorage`

**Decisión:** cada paso del flujo de reserva es una ruta propia bajo `/reservas/nueva/...`, y
la selección hecha hasta ese paso viaja como parámetros de query en la URL, no como estado de
React sin reflejar ni como `sessionStorage`. Cada pantalla es una función pura de su URL: se
reconstruye leyendo sus propios parámetros, sin depender de haber pasado por la pantalla
anterior en la misma sesión del navegador.

```
/reservas                         Inicio
/reservas/nueva                   Paso 1: fecha, turno, zona, comensales
/reservas/nueva/resultado         Paso 2: resultado de disponibilidad (hay lugar / no hay lugar)
  ?fecha=&turnoId=&zonaId=&comensales=
/reservas/nueva/datos             Paso 3: datos de contacto
  ?fecha=&turnoId=&zonaId=&comensales=
/reservas/nueva/exito             Paso 4: reserva registrada
  ?codigo=&estado=&fecha=&turnoId=&zonaId=&comensales=
/reservas/consultar                Consultar, detalle, confirmar cancelación y cancelada
  ?codigo=                         (el email NUNCA se refleja en la URL, ver D1.2)
```

Server Components por defecto (§7): cada página bajo `/reservas/nueva/*` es un Server
Component que lee `searchParams`, valida su forma, y arma la consulta a la API (directo al
backend, `urlBaseApi()` fuera del navegador). La interactividad de cada paso (el formulario en
sí) es un Client Component chico que la página del servidor renderiza con los datos ya
resueltos (zonas, turnos, o el resultado de disponibilidad) como props. Al confirmar un paso,
el Client Component arma la URL del paso siguiente con `router.push` — no hace la consulta de
disponibilidad él mismo salvo en el paso de creación (D1.1).

**Por qué la URL y no `sessionStorage` ni estado de cliente:**
- Un refresh, un enlace guardado o el botón "atrás" del navegador siguen mostrando el paso
  correcto con los mismos datos, sin una capa de persistencia propia que mantener. Para la
  persona (alguien que puede recibir una llamada a mitad de la reserva) esto importa más que
  en un flujo de escritorio.
- El resultado de disponibilidad (Paso 2) se reevalúa en cada visita porque es "una foto del
  momento" (`config.yaml` §6): con la URL como estado, un refresh vuelve a consultar
  naturalmente, sin lógica de invalidación de caché propia. Excepción aceptada: al volver con
  "atrás", Next reutiliza la página ya renderizada (Client Cache, back/forward), así que puede
  verse un cupo viejo. No se agrega un `router.refresh()` al restaurar la página: el
  `POST /reservas` vuelve a validar el cupo y su `409` con motivos ya está manejado en el Paso 3.
- Cada página es un Server Component puro que arma su propia consulta: no hace falta levantar
  un Client Component gigante para todo el asistente ni gestionar hidratación de un estado
  complejo, alineado con "Server Components por defecto" de §7.

**Alternativa considerada — un único Client Component con `useState` para los cuatro pasos,
sin cambiar de ruta:** se descarta. Pierde todo el progreso ante un refresh accidental (el
caso de uso central de la persona), convierte todo el asistente en una isla de cliente cuando
la mayor parte de cada pantalla es contenido servido (resumen, catálogo, resultado), y no dejar
rastro en la URL le quita al usuario la posibilidad de volver atrás con el navegador sin perder
lo elegido.

**Alternativa considerada — `sessionStorage` con una sola ruta dinámica:** se descarta. Agrega
una capa de persistencia con su propio esquema, versión y limpieza (qué pasa si cambia la forma
de los datos guardados entre un deploy y otro) para resolver algo que la URL ya resuelve gratis
y sin código adicional. Tampoco es compartible por enlace ni funciona igual si la persona abre
el paso 3 en una pestaña nueva.

**Trade-off asumido:** la URL de cada paso expone la selección (fecha, turno, zona,
comensales) en texto plano. Ninguno de esos datos es sensible (son las mismas cuatro cosas que
ya expone `GET /disponibilidad` como query pública, sin autenticación), así que no hay
información nueva expuesta.

#### D1.1: El paso de datos de contacto sí hace la llamada que crea la reserva

A diferencia de los demás pasos, `/reservas/nueva/datos` es el único que ejecuta una mutación
(`POST /reservas`). Por eso su formulario es un Client Component que llama al `apiClient` a
través del proxy `/api` (navegador → mismo origen, D6 de `frontend-base`), no un dato que el
Server Component de la página le pase ya resuelto. Los cuatro parámetros de query de ese paso
(`fecha`, `turnoId`, `zonaId`, `comensales`) se completan en el body junto con nombre, email y
teléfono; el cliente nunca envía un `mesaId` ni un `estado` propio (D6 de `reservas-crear` los
rechaza con `400` igual, pero el formulario no ofrece esos campos).

#### D1.2: El email nunca se refleja en la URL

**Decisión:** `/reservas/consultar` administra sus propios sub-estados (formulario, detalle,
confirmar cancelación, cancelada) como estado de un único Client Component, sin una ruta por
sub-estado. La URL solo puede reflejar el `codigo` (`?codigo=ABCD1234`, para que un refresh
prellene el formulario), nunca el email.

**Por qué:** `reserva-consultar` D1 y `cancelacion-turnos` eligieron `POST` con el email en el
body precisamente para que no quede en una URL, en logs de acceso, ni en el historial del
navegador. Si este change reflejara el email en su propia URL para poder usar rutas por
sub-estado (como sí hace el resto del asistente en D1), repetiría del lado del frontend
exactamente el riesgo que el backend evitó del lado de la API — más grave todavía, porque el
historial del navegador es compartido en un dispositivo familiar, mientras que un log de
acceso no lo es.

**Trade-off asumido:** un refresh en el detalle o en la confirmación de cancelación vuelve al
formulario (con el código prellenado, pidiendo el email de nuevo), en vez de reconstruir la
vista exacta. Es aceptable — y hasta deseable: evita que el detalle de una reserva quede visible
para la próxima persona que abra el navegador con el botón "adelante", con solo apretar
"atrás" primero.

**Alternativa considerada — mantener toda la selección en la URL salvo el email, pidiendo el
email de nuevo antes de cada acción sensible (ver detalle, confirmar cancelación):** se
descarta por fricción: obligaría a volver a tipear el email entre el detalle y la confirmación
de cancelar, dos pasos seguidos del mismo flujo, sin ganar nada sobre guardarlo en memoria de
ese único componente mientras la pestaña sigue abierta.

### D2: Fecha y hora local con `Date`/`Intl` nativos, sin librería nueva

**Decisión:** no se agrega ninguna dependencia de fechas (`date-fns`, `dayjs`, `luxon`). Todo
el cálculo se resuelve con `Date`, `Date.UTC` e `Intl.DateTimeFormat`, siguiendo la misma
convención que ya fija `config.yaml` §7 para el resto del proyecto (`getUTC*`/`Date.UTC`,
nunca métodos de zona horaria local del proceso). Cuatro funciones puras, testeables sin red
ni DOM:

- `fechaLocalDeHoy(ahora: Date): string` → `YYYY-MM-DD` del día de hoy en el calendario del
  restaurante, usada como mínimo del selector de fecha (spec "La fecha mínima seleccionable es
  hoy…"). Se calcula sumando el offset fijo de Argentina (`-3` horas, igual convención que
  `backend/src/common/timezone.ts`, sin volver a introducir la zona horaria IANA
  configurable que el equipo ya descartó) al instante recibido y leyendo el resultado con
  `getUTC*`.
- `diaSemanaDeFechaLocal(fecha: string): DiaSemana` → día de la semana de una fecha
  `YYYY-MM-DD`, calculado con `Date.UTC(y, m - 1, d).getUTCDay()` y mapeado a `LUNES`…
  `DOMINGO`. Alimenta el filtro de turnos por día (spec "Solo se ofrecen turnos del día de la
  semana elegido").
- `formatearFechaLargaEs(fecha: string): string` → arma un `Date` con `Date.UTC` a partir de
  `YYYY-MM-DD` y lo formatea con
  `new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year:
  'numeric', timeZone: 'UTC' })`. Fijar `timeZone: 'UTC'` es lo que hace que el resultado no
  dependa del huso horario del dispositivo: como la fecha ya se construyó como una fecha de
  calendario pura (medianoche UTC de ese día), pedirle a `Intl` que la lea en UTC devuelve
  exactamente esa fecha, nunca el día anterior o siguiente según dónde esté la persona.
- `formatearHoraTurno(horaIso: string): string` → un turno trae su hora como
  `'1970-01-01T20:00:00.000Z'` (D3 de `catalogo-publico`): ya es la hora local del restaurante
  codificada con fecha fija, no un instante que haya que convertir. Se lee con
  `new Date(horaIso).getUTCHours()`/`getUTCMinutes()`, con cero a la izquierda, sin ninguna
  conversión de huso horario — convertirla sería el error que ya corrigió
  `cancelacion-turnos` (Context, primera corrección post-review) para el backend.

**Alternativa considerada — `Intl.DateTimeFormat` con `timeZone: 'America/Argentina/Buenos_Aires'`
para calcular "hoy" en vez de sumar el offset a mano:** es una alternativa válida (Argentina no
tiene horario de verano desde 2009, así que el resultado sería idéntico) y más legible en el
sitio de uso. Se descarta solo por consistencia con la convención ya elegida por el resto del
proyecto (offset fijo con `getUTC*`, no `Intl` para aritmética de calendario — el equipo ya
tuvo esa discusión en `cancelacion-turnos` y la resolvió así), reservando `Intl` para dar
formato de salida (`formatearFechaLargaEs`), no para calcular fechas.

**Alternativa considerada — sumar `date-fns-tz` o similar para el cálculo del offset:** se
descarta por `config.yaml` §2 (no sumar dependencias sin necesidad real) — un desplazamiento de
horas fijo y un formateador de salida no justifican una librería, y el proyecto entero ya
resuelve esto con `Date` nativo.

### D3: Diseño visual pantalla por pantalla

Paleta y tipografía: las ya definidas por `frontend-base` (D2/D3), sin agregar ni cambiar
ningún token. Uso específico de este change:
- **Dorado (`accent`, `#A16207`) reservado para dos cosas:** el código de reserva y cualquier
  indicador de la zona VIP o de estado "pendiente de confirmación". No se usa para nada más
  (ni títulos, ni botones primarios), para que mantenga su valor de señal.
- **Texto de cuerpo en 16px como mínimo** (`text-base`, ya el tamaño por defecto de `Input`/
  `Select`/`Field` en `frontend-base`). Las pantallas de este change usan `text-base` también
  para párrafos de contenido que en el landing de `frontend-base` usan `text-sm` (14px, por
  ejemplo la lista "Cómo funciona"): decisión explícita por la persona (74 años), no un cambio
  a `frontend-base`.
- **Acciones principales en 18px y 56px de alto:** ver D4 (extensión de `Button`).
- **Un progreso claro, sin ambigüedad de "cuánto falta":** `ux-guidelines.csv` (Feedback ▸
  Progress Indicators, severidad media) pide un indicador de paso para procesos de varios
  pasos. Se agrega `<PasosReserva pasoActual={1|2|3} total={3} />`: un texto ("Paso 1 de 3"),
  que es la única indicación accesible, y tres puntos decorativos con `aria-hidden`, mostrado en `/reservas/nueva`, `/reservas/nueva/resultado`
  (solo cuando hay lugar) y `/reservas/nueva/datos`. La pantalla de éxito no lleva número de
  paso: es el cierre del flujo, no un paso más.

#### Pantalla 1 — Inicio (`/reservas`)

Reemplaza el placeholder de `frontend-base`. Layout de una columna, centrado, máximo
`max-w-2xl` (mismo contenedor que ya usa `app/page.tsx`):
1. Título (`h1`, `text-2xl sm:text-3xl font-semibold text-foreground`): "Reservá tu mesa".
2. Un párrafo (`text-base text-muted-foreground`) explicando en una línea qué se puede hacer.
3. Acción principal: `Button` `variant="primary"` `size="lg"` (D4), ancho completo en mobile,
   texto "Reservá ahora" → `/reservas/nueva`.
4. Acción secundaria, con menor peso visual: `buttonVariants({ variant: 'ghost' })` o un
   enlace de texto subrayado, "¿Ya reservaste? Consultá o cancelá tu reserva" →
   `/reservas/consultar`. Ver también D6 (enlace en el encabezado).

Estados: esta pantalla no tiene carga ni error (es contenido estático). Sin cambios de
`Card` "Cómo funciona" del `frontend-base` salvo el tamaño de texto (D3, arriba).

#### Pantalla 2 — Paso 1: ¿Cuándo y cuántos? (`/reservas/nueva`)

Server Component que hace `GET /zonas` y `GET /turnos` (directo al backend) y pasa los datos a
un Client Component `FormularioSeleccion`. Layout de una columna, campos apilados incluso en
`sm:` (es un formulario secuencial, no se beneficia de una grilla — D1 de `frontend-base`,
mobile-first, no obliga a usar el ancho extra solo porque está disponible):

También lee `fecha`, `turnoId`, `zonaId` y `comensales` de `searchParams` para prellenar
`FormularioSeleccion` cuando se llega con una selección previa: el `Button` "Cambiar fecha,
turno o zona" de la Pantalla 3 ("no hay lugar") y el `Button` "Volver a elegir" de la Pantalla 4
(`409` con `motivos`) navegan acá con esos cuatro parámetros para que la persona no tenga que
volver a elegir todo. La regla es una sola: **todo valor que no sea coherente se ignora** sin
romper el render, y ese campo queda sin seleccionar, como si no se hubiera pasado. Se valida en
este orden, porque cada paso depende del anterior:

1. `fecha`: se ignora si no es `YYYY-MM-DD`, si no existe en el calendario o si queda fuera del
   rango que admite el selector (antes del día local de hoy).
2. `zonaId`: se ignora si no está en `GET /zonas`.
3. `turnoId`: se ignora si no está en `GET /turnos` **o** si su `diaSemana` no coincide con el
   de la `fecha` ya validada (la misma regla que limpia el turno al cambiar la fecha). Sin
   `fecha` válida, también se ignora.
4. `comensales`: se ignora si no es un entero o si queda fuera del rango de la zona ya
   validada; sin zona válida, se ignora. No se acota al rango: acotar cambiaría en silencio lo
   que eligió la persona.

1. `<PasosReserva pasoActual={1} total={3} />`.
2. Título (`h1`, `text-2xl font-semibold`): "¿Cuándo y para cuántos?".
3. Campo fecha: un `<input type="date">` envuelto con la misma asociación de etiqueta que
   `Field` (D2 de `frontend-base`; `Field` no soporta `type="date"` como prop tipada hoy, así
   que este paso usa `Input` con `type="date"` dentro de un `Field`-like wrapper propio si
   hace falta, ver Open Questions), con `min` en `fechaLocalDeHoy()` (D2). Tamaño de fuente
   nativo del input, ya `text-base` por `Input`.
4. Campo turno: `Select` (de `frontend-base`) con las opciones que devuelve
   `diaSemanaDeFechaLocal(fecha)` filtrando la lista de `GET /turnos`, mostrando
   `formatearHoraTurno(horaInicio)`–`formatearHoraTurno(horaFin)` como texto de cada opción
   (ej. "12:00 a 15:00"). Deshabilitado hasta elegir fecha. Vacío (spec "Un lunes sin turnos
   activos") → en vez de un `Select` vacío, un texto en `Alert` `variant="info"`: "No hay
   turnos disponibles ese día. Elegí otra fecha.", con el `Select` oculto.
5. Campo zona: dos `Card` seleccionables (`role="radiogroup"`/`radio`, mismo patrón semántico
   que un grupo de opciones) en vez de un `Select`, porque cada zona necesita mostrar varias
   líneas de reglas (spec "Las reglas de cada zona son visibles antes de elegirla"), lo que un
   `<option>` de un `<select>` nativo no puede hacer. Cada `Card` muestra: nombre de la zona
   (`text-lg font-semibold`), rango de comensales, anticipación mínima/máxima, y, si
   `requiereConfirmacionAdmin`, una insignia con fondo `bg-accent text-accent-foreground`
   ("Queda pendiente de confirmación"). La `Card` de la zona elegida usa `border-accent
   border-2` si es VIP-pendiente o `border-primary border-2` si no, para marcar la selección
   sin depender solo del color (también lleva un ícono de check, `aria-hidden`, y
   `aria-checked` en el control, que es el atributo de estado de `role="radio"`).
6. Campo comensales: un stepper (`-` / número / `+`) con los mismos botones `Button`
   `variant="secondary"` de 44×44px mínimo (ux-guidelines Touch ▸ Touch Target Size/Touch
   Spacing: gap de 8px entre los tres controles), acotado al rango de la zona elegida (spec
   "La cantidad de comensales se ofrece dentro del rango de la zona elegida"). Deshabilitado
   hasta elegir zona.
7. `Button` `variant="primary"` `size="lg"` "Ver disponibilidad", deshabilitado hasta que los
   cuatro campos sean válidos (spec "No se puede continuar sin completar los cuatro datos"),
   que arma la URL de `/reservas/nueva/resultado` con los cuatro parámetros y navega
   (`router.push`). Mientras el botón está deshabilitado, debajo aparece un texto breve en
   `text-muted-foreground` dentro de una región `aria-live="polite"` que lista qué falta
   completar (ej. "Falta elegir: turno y zona"), para que la persona sepa qué hacer sin tener
   que adivinar por qué el botón no responde; el texto desaparece en cuanto los cuatro campos
   quedan completos.

Sin estado de carga propio (no llama a la API todavía, salvo la carga inicial de zonas/turnos
que resuelve el Server Component antes de renderizar — Next.js la cubre con
`app/reservas/nueva/loading.tsx`, un esqueleto simple con `aria-busy`, siguiendo la guía de
Next.js de usar `loading.tsx` para el estado de carga de una ruta en vez de manejarlo a mano
con `useState`).

#### Pantalla 3 — Resultado de disponibilidad (`/reservas/nueva/resultado`)

Server Component. Sin `searchParams` válidos (spec "Acceso a un paso del asistente sin la
selección previa") → `redirect('/reservas/nueva')` de Next.js, sin renderizar nada más.
`app/reservas/nueva/resultado/loading.tsx` propio (mismo criterio que la Pantalla 2) mientras
se resuelven, en paralelo, `GET /disponibilidad` y los datos del resumen: `GET /zonas`
(nombre de la zona y `requiereConfirmacionAdmin`, de donde sale el aviso de pendiente, porque
`GET /disponibilidad` no lo trae) y `GET /turnos` (horario del turno). Si `GET /disponibilidad`
responde `404` (turno o zona que ya no existen, por ejemplo con una URL vieja), se redirige al
Paso 1 con los parámetros restantes, donde los IDs inválidos se ignoran (Pantalla 2).

1. `<PasosReserva pasoActual={2} total={3} />` (solo si hay lugar; ver más abajo).
2. **Hay lugar:** título "¡Hay lugar!" (`h1`, `text-2xl font-semibold text-foreground`), un
   `Card` con el resumen (fecha con `formatearFechaLargaEs`, turno con `formatearHoraTurno`,
   zona, comensales, lugares restantes), y si `requiereConfirmacionAdmin`, un `Alert`
   `variant="info"` con fondo sobre `muted` y texto que menciona el aviso de pendiente
   (ux-guidelines Feedback ▸ Confirmation Messages: mensaje breve, no un párrafo largo).
   `Button` `variant="primary"` `size="lg"` "Continuar" → `/reservas/nueva/datos` con los
   mismos cuatro parámetros.
3. **No hay lugar:** sin `<PasosReserva>` (no es un paso hacia adelante: es un callejón sin
   salida que hay que resolver volviendo atrás). Título "No hay lugar para esa combinación"
   (`h1`), un `Alert` `variant="error"` por cada motivo (lista, no texto concatenado — spec
   "No hay lugar por varios motivos a la vez"), con el texto en español que ya trae
   `MotivoNoDisponible.mensaje` de la API (no hace falta traducir `codigo` a mano: el mensaje
   ya viene en español desde el backend, D del contrato de `disponibilidad`). `Button`
   `variant="secondary"` `size="lg"` "Cambiar fecha, turno o zona" →
   `/reservas/nueva?fecha=&turnoId=&zonaId=&comensales=` (los mismos valores, para prellenar
   el Paso 1 en vez de vaciarlo).
4. **Error de servidor o de red:** `Alert` `variant="error"` con el mensaje genérico de
   `ApiResult` (`tipo: 'desconocido'`, ya en voseo tras D7) y un `Button` "Reintentar" que
   vuelve a pedir la misma ruta (`router.refresh()` de Next.js, sin perder los parámetros de
   la URL).

#### Pantalla 4 — Tus datos (`/reservas/nueva/datos`)

Server Component que valida `searchParams` (mismo criterio de redirección que la Pantalla 3) y
renderiza un Client Component `FormularioDatosContacto` con esos cuatro valores.

1. `<PasosReserva pasoActual={3} total={3} />`.
2. `Card` de resumen (igual contenido que la Pantalla 3, sin lugares restantes) — spec "El
   resumen de la selección está visible al ingresar los datos".
3. Formulario con `Field` de `frontend-base` para nombre, email y teléfono, cada uno con
   validación `onBlur` (ux-guidelines Forms ▸ Inline Validation: "Validar en blur para la
   mayoría de los campos", no solo al enviar) usando el mismo mecanismo de `error`/
   `aria-describedby` que `Field` ya implementa. `type="email"` y `type="tel"` en los
   `Input` subyacentes (ux-guidelines Forms ▸ Input Types / Mobile Keyboards: teclado
   apropiado por tipo de dato).
4. Si el envío falla con errores de validación que no se pueden asociar a nombre/email/
   teléfono (por ejemplo, si la URL fue editada a mano y `turnoId` ya no es un UUID válido:
   ver D8), un resumen de errores fijo arriba del formulario (ux-guidelines Forms/
   Accessibility ▸ Focusable Error Summary): `<div role="alert" tabIndex={-1}>` con foco
   programático al aparecer, listando los mensajes.
5. `Button` `variant="primary"` `size="lg"` "Confirmar reserva", con estado de carga
   (ux-guidelines Feedback ▸ Submit Feedback: "mostrar carga y después éxito/error") que
   deshabilita el botón y cambia su texto a "Confirmando…" mientras la promesa está pendiente.

**Manejo de errores de creación (D8 detalla el mapeo de 400):**
- `400` → errores en línea por campo cuando el mensaje se puede asociar a
  `nombreCliente`/`emailCliente`/`telefonoCliente`; el resto va al resumen de errores fijo del
  punto 4.
- `409` con `motivos` no vacío → `Alert` `variant="error"` por motivo (mismo componente que la
  Pantalla 3), `Button` "Volver a elegir" → `/reservas/nueva?...` con la selección anterior,
  sin descartar lo ya escrito en el formulario (el Client Component sigue montado, solo
  cambia lo que se muestra encima).
- `409` con `motivos: []` (choque de concurrencia, D9 de `reservas-crear`) → `Alert`
  `variant="error"` con el mensaje de la API ("reintentá en unos segundos") y el mismo
  `Button` de envío, ya rehabilitado, sin navegar a ningún lado.
- `404` → `Alert` `variant="error"` con mensaje fijo ("Esa fecha, turno o zona ya no están
  disponibles. Empecemos de nuevo.") y `Button` "Volver a empezar" → `/reservas/nueva` (sin
  parámetros: a diferencia del `409`, acá la selección en sí ya no es válida).
- `5xx`/red → mismo patrón que la Pantalla 3 (D del contrato de `frontend-base`), sin perder
  lo tipeado (el formulario sigue montado; el error se muestra encima).

#### Pantalla 5 — Reserva registrada (`/reservas/nueva/exito`)

Server Component (sin `searchParams` válidos → `redirect('/reservas/nueva')`). Es la única
pantalla del asistente con una isla de interactividad chica adentro de un árbol servido: el
resto de la pantalla no necesita `"use client"`.

1. Título "¡Listo! Tu reserva está " + ("confirmada" | "pendiente de confirmación") según
   `estado` (`h1`, `text-2xl font-semibold`).
2. Bloque de código, el único lugar de toda la interfaz con fondo `bg-muted` y borde
   `border-accent`: etiqueta pequeña arriba ("Tu código de reserva", `text-sm
   text-muted-foreground`), el código en `text-3xl font-bold tracking-widest text-accent`
   centrado, y debajo un botón de copiar (Client Component `BotonCopiarCodigo`,
   `variant="ghost"`, ícono SVG de copiar con `aria-hidden` + texto "Copiar código";
   confirmación de copiado con un `Alert` `variant="info"` momentáneo o un cambio de texto del
   botón a "¡Copiado!" durante unos segundos — ux-guidelines Interaction ▸ Success Feedback).
3. Si `estado === 'PENDIENTE'`, un `Alert` `variant="info"` explicando que el restaurante
   todavía tiene que confirmarla.
4. Texto fijo, sin condicional: "Guardá este código: junto con tu email, es la única forma de
   consultar o cancelar tu reserva." — nunca se menciona un email de confirmación (spec "La
   pantalla no promete un email"; ver Context, `reservas-crear` Open Questions: no hay
   proveedor de email en el MVP).
5. `Card` de resumen (fecha, turno, zona, comensales) — este paso vuelve a resolver
   `GET /zonas`/`GET /turnos` (directo, Server Component) para traducir `turnoId`/`zonaId` a
   nombre/horario legibles, igual que la Pantalla 3.
6. `Button` `variant="secondary"` "Volver al inicio" → `/reservas`.

#### Pantalla 6 a 9 — Consultar, detalle, confirmar cancelación, cancelada (`/reservas/consultar`)

Un único Client Component (`ConsultaReserva`) con un estado de sub-vista
(`'formulario' | 'detalle'`) y el diálogo de cancelación superpuesto sobre `'detalle'` (D5).
No hay Server Component intermedio salvo el `page.tsx` que lee el `?codigo=` inicial (D1.2) y
lo pasa como valor por defecto.

1. **Formulario** (spec "Formulario para consultar una reserva"): `Field` para código
   (`maxLength={8}`, mayúsculas automáticas al tipear para que coincida visualmente con el
   ejemplo que recibió el cliente, aunque la comparación del backend ya ignora mayúsculas) y
   `Field` `type="email"` para email, `Button` `variant="primary"` `size="lg"` "Buscar mi
   reserva". `404` → `Alert` `variant="error"` con el mensaje genérico (spec "Reserva no
   encontrada al consultar"), sin indicar cuál dato falló. `429` → `Alert` con el mensaje de
   espera. `5xx`/red → mismo patrón que el resto.
2. **Detalle** (spec "Detalle de una reserva consultada"): título con el estado (badge de
   color: `CONFIRMADA`/`PENDIENTE` con los mismos tonos que la Pantalla 5, `CANCELADA`/
   `NO_SHOW` con `bg-muted text-muted-foreground`), `Card` de resumen (fecha, turno, zona,
   comensales — sin nombre/email/teléfono, spec "El detalle no repite datos de contacto").
   Si `puedeCancelarSegunVentana(...)` (D9) da `true` y el estado es `CONFIRMADA` o
   `PENDIENTE`: `Button` `variant="destructive"` `size="lg"` "Cancelar mi reserva" que abre el
   diálogo. Un enlace de texto "Consultar otra reserva" vuelve a `'formulario'`.
3. **Confirmar cancelación** (D5, diálogo nativo): repite el resumen, `Button`
   `variant="destructive"` "Sí, cancelar" y `Button` `variant="secondary"` "Volver" (que solo
   cierra el diálogo). Mientras la cancelación está en curso, "Sí, cancelar" muestra el mismo
   patrón de carga que la Pantalla 4. Un error (`404`/`409`/`429`/`5xx`) se muestra como
   `Alert` `variant="error"` **dentro del diálogo**, que permanece abierto (spec "Errores al
   confirmar la cancelación").
4. **Cancelada:** al recibir `204`, el diálogo se cierra, el estado local de la reserva pasa a
   `CANCELADA` sin volver a consultar el servidor (la respuesta `204` ya confirma el cambio), y
   el detalle se re-renderiza sin la acción de cancelar más un `Alert` `variant="info"` "Tu
   reserva fue cancelada." arriba del resumen.

### D4: `Button` suma un `size` opcional, de forma aditiva

**Decisión:** se extiende `buttonVariants`/`Button` de `frontend-base` con un prop `size?: 'md'
| 'lg'`, default `'md'` (el comportamiento actual, sin cambios: `min-h-11 text-sm`). `'lg'` da
`min-h-14 text-lg` (56px de alto, 18px de texto), el tamaño que la persona necesita para sus
acciones principales (Reservar, Continuar, Confirmar, Cancelar, Buscar). El resto de la firma
(`variant`, `fullWidth`, `className`) no cambia.

**Por qué extender en vez de aplicar `text-lg`/`min-h-14` como `className` en cada sitio de
uso:** `buttonVariants` ya arma `min-h-11` y `text-sm` como parte de sus clases base (antes de
`variantClasses` y antes de `className`), no como parte de `variantClasses`. Dos utilidades de
Tailwind que fijan la misma propiedad (`text-sm`/`text-lg`, o `min-h-11`/`min-h-14`) conviven
en el mismo elemento sin que el orden en que aparecen en el atributo `class` decida cuál gana
— la que gana depende del orden en que Tailwind las generó en la hoja de estilos final, no del
orden en el string. Confiar en ese orden para "pisar" un tamaño ya presente es fecha para un
bug silencioso (el botón se ve chico en un navegador y anda bien en otro según el build).
Sacar el tamaño de las clases base a una tabla `sizeClasses` indexada por `size`, igual que ya
existe `variantClasses` indexado por `variant`, es la misma técnica que el propio archivo ya
usa, sin ambigüedad de especificidad.

**Alternativa considerada — un componente nuevo y separado (`BotonGrande`) en vez de extender
`Button`:** se descarta. Duplicaría el resto de la lógica de `Button` (variantes de color,
`focus-visible`, `disabled`, `type` por defecto) para una sola propiedad que varía. `variant`
ya resuelve un problema análogo (varias formas del mismo botón) con una tabla, no con
componentes separados.

**Regresión a cubrir:** los tests de accesibilidad de `Button` que ya trae `frontend-base`
(`frontend/test/components/ui/`) no deberían cambiar: `size` por defecto preserva el
comportamiento actual byte a byte en las clases relevantes (`min-h-11 text-sm`).

### D5: `Dialog` como primitiva nueva, sobre el elemento nativo `<dialog>`

**Decisión:** se agrega `frontend/src/components/ui/dialog.tsx`, la primitiva que
`frontend-base` dejó como Open Question ("si en esos changes surge una necesidad de
componentes más compleja... es razonable reabrir esta decisión ahí"). Se implementa sobre el
elemento `<dialog>` nativo del navegador (`showModal()`/`close()`), sin ninguna dependencia
nueva: `<dialog>` ya atrapa el foco de teclado dentro de sus controles y devuelve el foco al
elemento que lo abrió al cerrarse — exactamente lo que pide la spec ("El diálogo de cancelación
atrapa el foco" / "Cerrar el diálogo devuelve el foco") sin implementar un focus trap a mano
(ux-guidelines Interaction ▸ Focus States exige un foco visible también dentro del modal — se
cubre reusando el mismo `focus-visible:ring-2 focus-visible:ring-ring` de las demás
primitivas dentro del diálogo, no un estilo de foco propio). Cierra también con `Escape` de
forma nativa.

**Alcance real de ese comportamiento nativo** (medido en un navegador real al cierre,
`tasks.md` 7.2):

- **Atrapado de foco.** Mientras el diálogo está abierto, el contenido de la página queda
  inerte: Tab y Shift+Tab nunca llegan a un control que esté detrás. El recorrido no es un
  ciclo cerrado dentro del diálogo: después del último control, el foco pasa por la interfaz
  del propio navegador y vuelve al primero. Eso es lo que la spec exige ("El diálogo de
  cancelación atrapa el foco"); no se implementa un ciclo propio para evitar esa parada.
- **Devolución de foco.** El navegador devuelve el foco al control que abrió el diálogo
  solo si ese control sigue existiendo. Al cerrar con "Volver" o con Escape, vuelve a
  "Cancelar mi reserva". Al confirmar con éxito, ese botón deja de mostrarse (la reserva ya
  está `CANCELADA`), así que `ConsultaReserva` lleva el foco al aviso "Tu reserva fue
  cancelada." (spec "Confirmar la cancelación lleva el foco al aviso"). Sin eso, el foco
  quedaría en el documento sin ningún elemento.

**Límite conocido de `jsdom` al probar esto:** `jsdom` (el DOM que usa la suite de RTL, ver
`config.yaml` §9) no implementa la semántica modal real de `HTMLDialogElement`: no vuelve
inerte el contenido detrás del diálogo, no atrapa el foco con Tab/Shift+Tab dentro de sus
controles, y no devuelve el foco al elemento que lo abrió al cerrarse — son comportamientos que
el navegador real sí da con `showModal()`/`close()`, pero que `jsdom` no simula. Por eso la
suite automatizada de `Dialog` (`tasks.md` 3.3) solo prueba lo que `jsdom` sí puede probar (que
se llama a `showModal()`/`close()`, con esos métodos stubeados en `HTMLDialogElement.prototype`;
el nombre accesible; y que los botones disparan sus callbacks), y el atrapado de foco y la
devolución de foco (spec "El diálogo de cancelación atrapa el foco" / "Cerrar el diálogo
devuelve el foco") quedan como verificación manual en un navegador real, parte del checklist de
cierre (`tasks.md` 7.2) — no una brecha de cobertura ignorada, sino la frontera real de lo que
este entorno de test puede demostrar. No se agrega una dependencia nueva (como Playwright) solo
para cerrar esa brecha: el caso de uso es acotado (un solo diálogo) y esta misma decisión ya
descartó sumar dependencias de runtime para esta primitiva.

**Alternativa considerada — Radix UI `Dialog` u otra librería de diálogos accesibles:** es lo
que `frontend-base` D4 ya había descartado para el set inicial de primitivas, por sumar una
dependencia de runtime por cada primitiva usada. El elemento nativo `<dialog>` da el mismo
comportamiento de accesibilidad (foco atrapado, retorno de foco, cierre con `Escape`, capa
superpuesta con `::backdrop`) sin sumar código de terceros, para un único caso de uso
(confirmar una cancelación) que no necesita animaciones ni composición avanzada.

**Alternativa considerada — un `<div>` con `role="dialog"` y un focus trap escrito a mano:** se
descarta: reimplementaría manualmente lo que el elemento nativo ya da (incluida la trampa de
casos borde como Tab/Shift+Tab en los extremos), con más superficie para un bug de
accesibilidad que exactamente el tipo de control que la spec exige probar.

### D6: `SiteHeader` suma un segundo enlace, sin tocar D11 de `frontend-base`

**Decisión:** se agrega un segundo `Link` en la navegación de `SiteHeader`
("Consultar reserva" → `/reservas/consultar`), con las mismas clases de
`navLinkClassName` que ya usa el enlace "Reservas". D11 de `frontend-base` (sin enlace a
`/admin` en la navegación pública) no cambia: se preserva explícitamente en la spec de este
change ("Sin enlaces a la administración").

**Por qué en el encabezado y no solo en la pantalla de Inicio:** alguien que ya reservó y
vuelve más tarde a cancelar no necesariamente pasa por `/reservas` primero; tenerlo en el
encabezado, visible desde cualquier pantalla del flujo de reserva, evita un callejón sin
salida si abandonó el asistente a mitad de camino.

### D7: Migración a voseo de los mensajes de `frontend-base`

**Decisión:** se reemplazan los textos fijos de `frontend/src/lib/api/errors.ts` (mensaje
genérico de 5xx: "Intente de nuevo más tarde." → "Intentá de nuevo más tarde.") y de
`mensajeDeRechazo` en `client.ts` ("La solicitud se canceló." → sin cambio, ya es impersonal y
no tiene verbo en segunda persona; "No se pudo conectar con el servidor." → sin cambio, mismo
motivo; "Ocurrió un error inesperado." → sin cambio) a voseo donde corresponda. Los tests
existentes de `frontend-base` sobre `mapErrorApi`/`toApiResult` (`frontend/test/lib/api/`)
verifican el `tipo` y la estructura del resultado, no el texto literal del mensaje genérico
carácter por carácter — se confirma esto como parte de la tarea (si algún test sí fija el
texto exacto, se actualiza ese test en el mismo cambio, nunca se deja en rojo).

**Alcance:** solo se tocan los mensajes que están en segunda persona formal o impersonal y que
la persona va a leer (mensajes de error mostrados en una pantalla). No se tocan los
identificadores técnicos, los nombres de tipos ni los comentarios en español neutro que ya
sigue §8.

### D8: Cómo se enrutan a un campo los mensajes de validación del `400`

**Problema:** `ApiResult` para un `400` expone `mensajes: string[]` en texto plano (D7 de
`frontend-base`), con el formato que ya usa `class-validator` en el backend: el nombre del
campo del DTO al frente del mensaje (ej. `"emailCliente debe ser un email válido"`,
`"nombreCliente no debe estar vacío"`). No hay una respuesta estructurada campo → mensaje en
el contrato (ninguno de los changes de backend la define).

**Decisión:** una función pura,
`agruparPorCampo(mensajes: string[], campos: Record<string, string>): { porCampo:
Record<string, string[]>; generales: string[] }`, donde `campos` mapea el nombre del campo del
DTO (`nombreCliente`, `emailCliente`, `telefonoCliente`, los únicos tres editables en el Paso
4) a la clave del formulario. Un mensaje que empieza con uno de esos nombres de campo
(`mensaje.startsWith(nombreDeCampo)`) se agrupa bajo ese campo; el resto (por ejemplo, un
`turnoId`/`comensales` mal formado por una URL editada a mano) cae en `generales` y se muestra
en el resumen de errores fijo (D3, Pantalla 4, punto 4).

**Por qué no depender de un contrato estructurado:** cambiar la forma del error a
`{ campo, mensaje }[]` es una decisión de contrato de `reservas-crear`, que ya mergeó su spec
con la forma actual (`message: string[]`) y no es una decisión que este change de frontend
pueda tomar por su cuenta. La función de agrupación es una capa de traducción acotada y
testeable (una tabla de casos: mensaje de ejemplo → campo esperado), no una suposición sobre
un contrato que no existe.

**Riesgo asumido:** si el texto exacto de un mensaje de `class-validator` cambia (por ejemplo,
al traducir sus mensajes a un idioma o redacción distinta en un change de backend futuro), la
agrupación puede dejar de reconocer ese campo y el mensaje cae en `generales` — nunca se
pierde el mensaje, en el peor caso se muestra en el lugar menos específico. Se anota en Open
Questions como algo a resolver con un contrato estructurado si el equipo lo prioriza.

### D9: La ventana de cancelación se estima en el cliente solo para decidir si se ofrece el botón

**Decisión:** `puedeCancelarSegunVentana(fecha: string, horaInicioTurno: string,
ventanaCancelacionHoras: number, ahora: Date): boolean` calcula el instante UTC de inicio del
turno (`fecha` + `horaInicioTurno` + offset fijo de Argentina, la misma idea que
`inicioTurnoUtc` del backend) y compara si a `ahora` le faltan al menos `ventanaCancelacionHoras`
para ese instante. Se usa **únicamente** para decidir si se muestra el botón "Cancelar mi
reserva" en el detalle (spec "La acción de cancelar solo se ofrece cuando es plausible");
`ventanaCancelacionHoras` sale de `GET /zonas` (Grupo A), buscando la zona por `zona.id` del
detalle consultado.

**Por qué es una ayuda de navegación y no una validación duplicada:** el servidor vuelve a
validar la ventana en `POST /reservas/{codigo}/cancelar` (`cancelacion-turnos`) y puede
rechazar con `409` aunque la pantalla haya ofrecido el botón (por ejemplo, si pasaron varios
minutos entre que se mostró el detalle y que se confirmó la cancelación, justo en el borde de
la ventana). La spec lo dice explícitamente ("es una ayuda de navegación... el servidor puede
rechazar la cancelación aunque la pantalla la haya ofrecido") y D "Errores al confirmar la
cancelación" ya cubre ese `409` mostrándolo dentro del diálogo. No reemplaza ninguna validación
del backend: si se elimina esta función por completo, el sistema sigue siendo correcto (solo
ofrecería el botón de más en casos límite); es un beneficio de UX, no una garantía.

**Trade-off asumido:** esta función reimplica, del lado del cliente, la forma del cálculo de
`inicioTurnoUtc` del backend (offset fijo + fecha + hora local). Es una duplicación deliberada
y acotada a un solo cálculo de fecha ya resuelto por D2, para una decisión que solo afecta si
se muestra un botón — no una regla de negocio que el cliente decida por su cuenta. Si el
offset de Argentina cambiara algún día (fuera del alcance de este MVP), habría que actualizarlo
en los dos lugares; se anota en Open Questions.

**Manejo de falla al resolver `ventanaCancelacionHoras`:** buscar la zona por `zona.id` en
`GET /zonas` puede no dar una respuesta usable de dos formas: la petición falla (`5xx` o red), o
responde `200` pero esa `zona.id` ya no aparece en la lista (caso límite: la zona se eliminó
entre que se consultó el detalle y que se renderiza esta pantalla). En los dos casos,
`puedeCancelarSegunVentana` no tiene con qué evaluarse. La regla es la misma que ya rige toda
acción condicionada por una regla que no se pudo comprobar: nunca se ofrece una acción cuya
condición no se pudo verificar. En vez del botón "Cancelar mi reserva", el detalle muestra un
`Alert` `variant="info"` ("No pudimos verificar si todavía podés cancelar. Probá de nuevo en
unos minutos.") con un `Button` "Reintentar" que vuelve a pedir `GET /zonas` sin recargar la
página ni perder el detalle ya mostrado. El resto del detalle (estado, resumen) sigue
mostrándose con normalidad: es solo la acción de cancelar la que queda en suspenso hasta poder
verificarse.

### D10: Grupos de trabajo por prerrequisito de backend

Ya introducidos en `proposal.md` (Impact). Se detallan acá para ordenar `tasks.md`:

| Grupo | Pantallas | Necesita mergeado |
|---|---|---|
| Utilidades y primitivas | D2 (fechas), D4 (`Button` `size`), D5 (`Dialog`), D6 (header), D7 (voseo) | Nada del backend: son puras o ya están mergeadas (`frontend-base` en progreso, pero estas piezas no dependen de sus endpoints) |
| A — Reservar | Inicio, Paso 1, Resultado, Datos, Éxito | `catalogo-publico` (`GET /zonas`, `GET /turnos`) y `reservas-crear` (`POST /reservas`, PR #40) |
| B — Consultar | Formulario + Detalle de `/reservas/consultar` | `reserva-consultar` (`POST /reservas/consultar`) |
| C — Cancelar | Confirmar cancelación + cancelada, dentro de `/reservas/consultar` | `cancelacion-turnos` (`POST /reservas/{codigo}/cancelar`) y, para D9, `GET /zonas` del Grupo A |

Cada grupo, al implementarse, corre `npm run api:types -w frontend` (D5 de `frontend-base`)
después de que su endpoint mergee y su fragmento pase al YAML — nunca antes. Hasta entonces,
ese grupo se desarrolla contra una fachada de datos de prueba local (fixtures en el propio
test, no un mock del cliente tipado) para que sus componentes de presentación y sus pruebas de
RTL no queden bloqueados por el orden de merge de los otros equipos; la llamada real al
`apiClient` se conecta recién cuando el tipo existe.

### D11: Sin dependencias nuevas

Confirmado por D2 (fechas: `Date`/`Intl` nativos) y D5 (diálogo: elemento `<dialog>` nativo).
Ningún otro punto de este documento introduce una librería. `lucide-react` (íconos), que
`frontend-base` dejó como Open Question para "si `frontend-cliente` la necesita": este change
solo necesita dos íconos (copiar, check de zona elegida), ambos como SVG inline escritos a
mano en el propio componente (spec/D "Iconografía accesible" de `frontend-base` solo exige que
sea un SVG, `aria-hidden` cuando es decorativo, y nombre accesible cuando es el único
contenido de un control — un `<svg>` de dos trazos no justifica sumar una librería de íconos
completa para dos usos).

## Risks / Trade-offs

- **[Riesgo]** `catalogo-publico`, `reservas-crear`, `reserva-consultar` y `cancelacion-turnos`
  no tienen implementación mergeada todavía (Context) → **Mitigación:** D10 agrupa el trabajo
  por prerrequisito; cada grupo puede avanzar con fixtures locales antes de que su endpoint
  exista y se conecta al cliente tipado real recién cuando el fragmento pasa al YAML, sin
  tipos a mano ni paths ficticios.
- **[Riesgo]** `frontend-base` (layout, primitivas, cliente HTTP) tampoco tiene implementación
  mergeada (PR #43 abierto) → **Mitigación:** es la dependencia más temprana de todas; ningún
  grupo de este change puede arrancar su implementación real antes de que exista
  `frontend/src/components/ui/` y `frontend/src/lib/api/`. `tasks.md` lo deja como
  prerrequisito explícito de la sección 1.
- **[Riesgo]** D8 (agrupar mensajes de `400` por campo) depende de que el texto del mensaje
  empiece con el nombre exacto del campo del DTO → **Mitigación:** ya documentado en D8; un
  mensaje no reconocido cae en el resumen general, nunca se pierde, y queda anotado en Open
  Questions para una mejora futura con contrato estructurado.
- **[Riesgo]** D9 (ventana de cancelación estimada en el cliente) duplica la forma del cálculo
  del backend → **Mitigación:** documentado como duplicación deliberada y acotada; el servidor
  sigue siendo la única fuente de verdad y el `409` de un cálculo desactualizado ya tiene su
  pantalla de error (D3, Pantalla 6-9, punto 3).
- **[Riesgo]** El elemento `<dialog>` nativo (D5) tiene diferencias de soporte de `::backdrop`
  y de animación entre navegadores más viejos → **Mitigación:** el caso de uso (confirmar una
  cancelación) no depende de una animación para ser funcional; sin `::backdrop` estilizado, el
  diálogo sigue siendo modal y accesible, solo pierde el fondo oscurecido. Se verifica
  manualmente en un navegador mobile real como parte del checklist de accesibilidad visual que
  ya establece `frontend-base` D9 (verificación manual, no automatizada).
- **[Trade-off]** D1.2 hace que un refresh en el detalle de una reserva consultada pierda la
  vista y pida el email de nuevo. Ya justificado en D1.2: es una elección de privacidad, no un
  descuido.
- **[Trade-off]** Extender `Button`/`SiteHeader` (D4/D6) acopla este change a la forma exacta
  de esos archivos tal como los deja `frontend-base` D4/D10. Si `frontend-base` cambia esa
  forma antes de mergear, las tareas de este change que los tocan se ajustan al archivo real
  en el momento de implementar, sin bloquear el resto del change (son ediciones acotadas de un
  archivo ya existente, no una reescritura).

## Migration Plan

1. Sin datos ni schema que migrar: es un change de frontend puro, sin `backend/` ni
   `openapi.yaml` propios (los endpoints que consume ya están definidos en sus propios
   changes).
2. Orden de despliegue: `frontend-base` (PR #43) primero; después, en cualquier orden entre
   sí, cada grupo de D10 en cuanto su backend mergee.
3. Rollback: revertir el/los commits del PR de implementación de este change. Ningún grupo
   depende de una migración de datos ni dejó estado persistente propio.

## Open Questions

- **Wrapper de fecha nativa (`<input type="date">`) dentro de `Field`.** `Field` de
  `frontend-base` tipa sus props sobre `InputProps` (que ya acepta cualquier atributo HTML de
  `<input>`, incluido `type="date"`), así que en principio alcanza con
  `<Field type="date" label="Fecha" ... />` sin cambiar `Field`. Queda para la tarea de
  implementación confirmarlo contra el código real de `frontend-base` una vez mergeado (no
  contra este documento), y solo si hace falta algo más (por ejemplo, un formato de
  placeholder distinto entre navegadores) se decide ahí con la necesidad concreta delante.
- **Mensajes de validación por campo con contrato estructurado.** Ver D8: si el equipo decide
  más adelante que `reservas-crear` devuelva `{ campo, mensaje }[]` en vez de `message:
  string[]`, `agruparPorCampo` se simplifica o se elimina. No bloquea este change.
- **Confirmación por email real.** `reservas-crear` Open Questions ya lo deja pendiente (no hay
  proveedor de email en el MVP). Este change asume que nunca hay email y lo dice en la
  Pantalla 5; si el equipo agrega un proveedor de email en un change futuro, esta pantalla
  ajusta su texto en ese momento.
