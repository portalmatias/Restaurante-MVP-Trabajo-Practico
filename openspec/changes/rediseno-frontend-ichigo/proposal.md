## Why

El frontend funciona (`frontend-base`, `frontend-cliente`, `frontend-admin`) pero es
visualmente genérico: tokens en blanco y negro, tipografía Inter, selector de turnos como
`<select>` y un título de sitio que dice «Reservas de Restaurante». El equipo definió que el
restaurante ficticio se llama **Ichigo** y es un japonés de omakase de alta gama, y pidió un
rediseño con identidad propia. Esa definición de producto vive hoy en `frontend/PRODUCT.md`,
que existe solo en la rama `feature/diseno-frontend` y todavía no está en `main`; por eso este
change repite lo necesario (nombre, tipo de restaurante y alcance) y no depende de ese archivo
para ser verificable.

El rediseño **ya está escrito** en la rama local `feature/diseno-frontend` (nueve commits, de
`f021204` a `0d6f52c`), antes que esta spec. Este change documenta, como requisitos
verificables, lo que esa implementación debe cumplir, para que el PR de implementación se
revise contra una spec y no solo contra el código. Es una **desviación única** de
`config.yaml` §14, prioridad 2 («la spec manda, el código sigue»): se pide al equipo que la
acepte de forma expresa al aprobar este PR, y el PR de implementación se valida contra las
tareas pendientes de `tasks.md`, no contra el código ya existente. `design.md` explica qué se
hizo para compensar haberlo redactado a posteriori.

## What Changes

- **Identidad «Kakefuda».** Tokens semánticos nuevos (hinoki, sumi, sello, madera) con
  contrastes mínimos WCAG 2.1 AA verificables; tipografías auto-hosteadas con licencia OFL
  (Shippori Mincho, Zen Kaku Gothic New y Yuji Syuku solo para el nombre), recortadas a los
  caracteres usados; título del sitio «Ichigo» con plantilla `%s | Ichigo`, `lang="es-AR"` y un
  título propio por pantalla pública del flujo de reserva (las del panel de administración
  quedan fuera de ese requisito).
- **Componentes `Tablilla` y `TablillaPaso`.** El turno se elige dando vuelta una tablilla de
  madera: español horizontal, japonés vertical solo decorativo, semántica `aria-pressed`.
- **Landing mobile-first** con la frase de apertura «Omakase japonés. Cada bocado, una
  sorpresa.», contenido ilustrativo y cinco fotografías **sintéticas** (generadas con IA) en
  formato **WebP** (unos 240 KB en total), cuya procedencia y conversión están en
  `frontend/public/ichigo/PROCEDENCIA.md`.
- **Calendario para elegir la fecha.** El campo de fecha del Paso 1 pasa a ser un calendario
  mensual siempre visible (semana desde el lunes), con días no elegibles distinguidos por texto,
  navegación por teclado, nombre accesible completo por día y el día de hoy calculado por el
  servidor con el offset de Argentina. En pantallas anchas va a la izquierda del resto del paso.
- **El panel de administración no muestra el encabezado ni el pie públicos**: `/admin` y
  `/admin/**` usan solo su propio encabezado.
- **Movimiento solo CSS**, con contenido visible por defecto y toda animación apagada con
  `prefers-reduced-motion`.
- **Flujo del cliente:** turnos como tablillas, estados vacío, error y no encontrado,
  bloqueo temporal tras `429` al crear la reserva, sin «Reintentar» inmediato al verificar la
  ventana de cancelación, y gestión del foco al cambiar de vista y tras cancelar.
- **Panel de admin:** aforo con porcentaje, lugares libres y nivel por zona; estados de reserva
  distinguibles por texto y forma; aviso de sesión por vencer y motivo en el login; el estado
  `NO_SHOW` se muestra como «Ausente».
- No se toca la lógica de negocio, la API ni `frontend/src/lib/**`.

### Fuera de alcance

- El plano de mesas (change `plano-mesas`, aparte).
- Un editor de contenido para la landing o para el admin.
- Modo oscuro (sigue siendo solo modo claro).
- Cambios de contrato OpenAPI, de backend o de reglas de negocio.
- Logotipo definitivo y fotografía propia del local: no existen todavía.

## Capabilities

### New Capabilities
- `calendario-fecha`: el componente `Calendario` y su uso en el Paso 1.
- `identidad-visual-ichigo`: tokens de color y contraste, tipografías auto-hosteadas, metadatos
  del documento (título, plantilla, idioma) y procedencia de las imágenes.
- `tablilla-turnos`: los componentes `Tablilla` (control) y `TablillaPaso` (informativa).
- `landing-ichigo`: la página `/`, mobile-first, con contenido ilustrativo e imágenes WebP.
- `movimiento-ui`: la política de movimiento (CSS puro, `prefers-reduced-motion`).
- `experiencia-reserva-cliente`: lo que el rediseño agrega al flujo del cliente (turnos como
  tablillas, disposición del Paso 1, estados de pantalla, espera tras `429`, foco).

### Modified Capabilities
- `frontend-base`: el idioma del documento pasa a `es-AR` y se exige un título por pantalla;
  el contraste exige también 3:1 en bordes de controles; el objetivo táctil admite una
  excepción acotada en el admin cuando no hay ningún puntero grueso (`any-pointer: coarse`); el
  encabezado y el pie públicos no se muestran en `/admin`.
- `frontend-admin`: el dashboard de aforo suma porcentaje, libres y nivel; el listado
  distingue el estado por texto y forma; `NO_SHOW` se muestra como «Ausente»; se agregan el
  aviso de sesión por vencer y el motivo en el login.

> `frontend-cliente` todavía está como change sin archivar en `openspec/changes/`, por lo que
> no existe como spec vigente y no admite deltas `MODIFIED`. Sus ajustes se registran en la
> capability nueva `experiencia-reserva-cliente`; ver `design.md` (Open Questions) sobre cómo
> reconciliarlas al archivar.

## Impact

- **Código afectado (ya escrito en `feature/diseno-frontend`):** `frontend/app/` (`layout.tsx`,
  `globals.css`, `page.tsx`, `not-found.tsx`, `global-error.tsx`, metadatos de cada ruta de
  `reservas/`), `frontend/src/components/{ui,layout,reservas,admin}/` (incluidos
  `ui/calendario.tsx` y `layout/marco-publico.tsx`), `frontend/src/fonts/`,
  `frontend/public/ichigo/` y las pruebas de `frontend/test/` que cambiaron con los textos.
- **Dependencias npm:** ninguna nueva. Las fuentes se sirven con `next/font/local` (ya viene con
  Next.js) y las imágenes con `next/image`.
- **Peso agregado al repositorio:** ~0,24 MB de fotografías en WebP (convertidas desde PNG de
  ~6,9 MB, que no se versionan) y ~0,35 MB de fuentes `woff`.
- **API / `openapi/openapi.yaml`, base de datos, variables de entorno:** sin cambios.
- **Costos:** las imágenes se generaron una única vez con una herramienta de IA que consumió
  créditos del plan de una persona del equipo; no hay dependencia de ejecución ni de CI.
- **Riesgo de revisión:** el diff de implementación es grande (76 archivos, ~2900 líneas
  agregadas); ver
  `design.md` y `tasks.md` para cómo partir la revisión.
