## Context

Motivación y alcance: ver `proposal.md`. La dirección visual completa («Kakefuda») está en
`frontend/.impeccable/surfaces/app-page-tsx.md` y el contexto de producto en
`frontend/PRODUCT.md`, ambos solo en la rama `feature/diseno-frontend` (no están en `main` ni en
este PR; versionarlos es la pregunta 5). Esta spec no depende de ellos para ser verificable.
Este documento fija las decisiones técnicas y sus alternativas.

Estado del que se parte: `frontend-base` define tokens en blanco y negro, Inter y una paleta
neutra; `frontend-cliente` y `frontend-admin` funcionan sobre ellos. El stack es Next.js 16 (App
Router) con Tailwind 4, solo modo claro. El rediseño no toca `frontend/src/lib/**`, la API ni
el contrato OpenAPI.

### Cómo se redactó esta spec (honestidad de proceso)

La spec se escribió **después** del prototipo, lo que invierte el orden que pide
`config.yaml` §14 (la spec manda, el código sigue). Riesgos de eso: que los requisitos se
ajusten al código en vez de a una necesidad, y que lo que el prototipo hace mal quede
«legalizado». Para compensarlo:

- Los requisitos describen comportamiento observable y umbrales verificables (contraste,
  tamaño táctil, `prefers-reduced-motion`), no la estructura del código.
- Los contrastes se recalcularon de forma independiente al redactar (no se copiaron de los
  comentarios del CSS). La diferencia menor encontrada, `border` sobre `background`, da 3,66:1 y
  no 3,7:1; el requisito exige 3:1 y no depende del redondeo.
- Donde el prototipo **no cumple** lo que la spec exige, no se adaptó la spec: se dejó una
  tarea explícita en `tasks.md` (sección 2). Hoy se conocen estos desvíos: `app/global-error.tsx`
  importa `next/font/google` (contradice la decisión D1); el estado `completa` de `Tablilla`
  existe pero ninguna pantalla lo usa todavía; su paso 1 de «Así se reserva» omite la zona; las acciones de fila
  del admin usan `pointer: fine` y no excluyen los equipos híbridos; y el aviso del login dice
  «Tu sesión venció» aun cuando el backend rechazó la sesión por otro motivo.
- **Desviación única de `config.yaml` §14, prioridad 2.** Escribir la spec después del código
  invierte «la spec manda, el código sigue». No se la considera precedente: se pide al equipo
  que la acepte de forma expresa al aprobar este PR, y el PR de implementación se valida contra
  las tareas pendientes de `tasks.md`, no contra el código existente.
- `tasks.md` no marca nada como hecho: el código existe, pero nadie lo verificó contra esta
  spec. Cada tarea de verificación es un trabajo pendiente del PR de implementación.
- Un compañero distinto del autor del prototipo debe revisar la spec antes de aprobar la
  implementación.

## Goals / Non-Goals

**Goals**
- Una identidad visual coherente, sobria y reproducible desde tokens, sin colores sueltos.
- Accesibilidad verificable, con una sola referencia por criterio: WCAG 2.1 AA para contraste de
  texto (1.4.3), contraste de componentes (1.4.11) y uso del color (1.4.1); y, como criterios
  del equipo que van más allá de AA en 2.1, objetivos táctiles de 44×44px (2.5.5, nivel AAA) y
  movimiento apagable (2.3.3, nivel AAA). El 2.5.8 de WCAG 2.2 (AA, 24px) se cita solo como piso
  de la excepción de D10.
- Mobile-first real: el flujo se completa con una mano y la acción principal se ve primero.
- Cero dependencias nuevas y cero servicios externos en tiempo de ejecución.

**Non-Goals**
- Plano de mesas (change `plano-mesas`), editor de contenido del admin, modo oscuro.
- Cambiar reglas de negocio, endpoints o textos de error que vienen de la API.
- Fotografía real o logotipo definitivo: el equipo no los tiene.

## Decisions

### D1. Fuentes locales con `next/font/local`, no `next/font/google`
Las tres familias (Shippori Mincho, Zen Kaku Gothic New, Yuji Syuku; todas OFL) viven como
`woff` en `frontend/src/fonts/` junto al texto de su licencia, recortadas a los caracteres que
la interfaz usa. Con `next/font/google` el servidor de desarrollo descargaba más de cien
fragmentos (los CJK se parten por rango Unicode) y terminaba en timeout.

| Alternativa | Ventaja | Por qué no |
|---|---|---|
| `next/font/google` | Cero archivos en el repo | Más de cien fragmentos y timeout en desarrollo; build y CI dependen de la red de Google |
| Fuentes del sistema (Hiragino, Yu Mincho) | Peso cero | Resultado distinto por sistema operativo; la identidad no se controla |
| Archivos completos de las familias | Sin trabajo de recorte | Megabytes por peso; los CJK completos son inviables |

Costo: ~0,35 MB de `woff` versionados y un recorte manual. Consecuencia aceptada: un carácter
fuera del recorte cae a la fuente del sistema (pila de respaldo en `--font-display`). Si hay que
agregar caracteres, se regenera el subconjunto (tarea 5.1 documenta cómo).

### D2. Tokens semánticos con una capa de «madera»
Se mantiene el mecanismo de `frontend-base` (variables CSS + `@theme inline`), pero con valores
nuevos y un par adicional (`madera`/`madera-foreground`) para la tablilla dada vuelta y la
viga. Regla de uso: el rojo del sello es **texto** solo sobre claros (5,7:1 sobre hinoki, 6,5:1
sobre `card`) y **relleno** sobre oscuros. Medido: el rojo `#9A2A19` sobre `madera` da 2,0:1,
ilegible como texto. `ring` reutiliza el rojo del sello como foco.

Alternativa descartada: un tono más claro de rojo para texto sobre madera. Agrega un token y
una excepción a la regla; se prefirió prohibir ese uso.

### D3. La tablilla es un `<button>` con `aria-pressed`
Un grupo de botones de alternancia en vez de `radio` o `select`: tocar otra tablilla cambia la
elección sin un paso previo de «deseleccionar», y cada tablilla tiene su nombre accesible
(«20:00 a 23:30»). Se evaluó `role="radiogroup"` (mejor semántica de «una sola opción», pero
exige manejo de flechas para ser correcto y el equipo no lo implementó); queda como Open
Question. El giro 3D usa `rotateY` con `backface-visibility`, solo en `transform`, sin
reflujo.

### D4. El español siempre va en horizontal; el japonés vertical es decoración
Riesgo de legibilidad: el texto vertical tradicional (縦書き) con letras latinas rotadas es
difícil de leer, y el público lee español. Decisión del equipo: la legibilidad va antes que la
tradición. El título y el detalle se escriben en horizontal; el equivalente japonés va en
vertical al costado con `aria-hidden` y `lang="ja"`, de modo que no carga información y un
lector de pantalla no lo lee con voz española. Costo: menos fidelidad a un kakefuda real.

### D5. Movimiento: todo CSS, visible por defecto, apagable
Las animaciones atadas al scroll usan `animation-timeline: view()` dentro de `@supports`: sin
soporte, el contenido queda en su estado final (nunca oculto). Los estados iniciales viven solo
dentro de `@keyframes`. Con `prefers-reduced-motion: reduce` hay dos capas: una regla global
que reduce toda duración a 0,01 ms, y `animation: none` explícito para las clases que usan
animaciones infinitas o atadas al scroll (la duración mínima no basta para un bucle). El
panel de admin usa la variante `motion-reduce` de Tailwind.

| Alternativa | Por qué no |
|---|---|
| Librería de animación (Framer Motion, GSAP) | Dependencia nueva, JavaScript de cliente y hidratación para algo que el CSS resuelve; `config.yaml` §2 pide justificar cada librería |
| `IntersectionObserver` propio | JavaScript de cliente; el contenido quedaría oculto hasta que corra |
| Sin movimiento | Pierde el «momento memorable» que pide la dirección de diseño |

Pendiente: `globals.css` declara `tablilla-dar-vuelta` y `tablilla-fundido` pero ninguna regla
los usa (el giro es una `transition`). Se eliminan o se usan en la implementación (tarea 2.3).

### D6. Fotografías sintéticas, versionadas en WebP
Las cinco imágenes se generaron en PNG (~6,9 MB en total, ~1,4 MB cada una) y se versionan ya
convertidas a WebP con Pillow (calidad 82, ~240 KB en total); los PNG no están en el
repositorio. Se generaron una única vez con una
herramienta de IA (`generate_image` de Figma, modelo `gemini-3.1-flash-image`) el 2026-10-07; el
consumo de créditos lo asumió el plan de una persona del equipo. No es una dependencia de
ejecución ni de CI: el repositorio solo contiene los archivos y `PROCEDENCIA.md` con los
prompts. `next/image` además sirve variantes redimensionadas en el runtime. Con WebP en el
repositorio, el tamaño del clon y de los diffs deja de ser un costo relevante.

| Alternativa | Por qué no |
|---|---|
| Fotos de stock | Licencia y apariencia de restaurante real; contradice «nada inventado» |
| Sin fotos | La landing pierde la ambición pedida; es la salida de repliegue si hay objeciones |
| Ilustración SVG propia | Mucho más trabajo; no se descarta como reemplazo futuro |
| Dejar los PNG en el repo | ~7 MB de binarios en el historial; con WebP el peso baja unas 28 veces con una diferencia visual aceptable para una landing ilustrativa (verificarlo es la tarea 5.2) |

Riesgo de honestidad: las imágenes parecen fotos de un local real. Mitigación: el pie de página
declara el proyecto ficticio, `PROCEDENCIA.md` lo explica y los `alt` describen lo que se ve sin
afirmar nada del local.

### D7. Espera de 30 s tras un `429` al crear la reserva
Hoy el backend **no limita** `POST /reservas` (la ruta lleva `@SkipThrottle()` porque no recibe
un código de baja entropía; tampoco limita `GET /zonas`): los `429` reales de la API pública
salen de `POST /reservas/consultar` y `POST /reservas/{codigo}/cancelar`. El cliente maneja
igual el `429` en la creación y en la verificación de la ventana de cancelación, de forma
defensiva: lo puede producir un proxy o un cambio futuro del backend (el límite de la creación
está en las Open Questions del change `reservas-crear`), y reintentar enseguida agravaría un
bloqueo. El botón se deshabilita 30 s con un temporizador del cliente. Por eso la verificación
de estos dos casos (tareas 3.3 y 4.8) se hace con un `429` simulado, no contra el backend real. El valor es una constante
de interfaz, no una regla de negocio ni lo que informa la API (no hay `Retry-After` en el
contrato del MVP); por eso es solo una espera conservadora. En la verificación de la ventana
de cancelación no se ofrece «Reintentar» tras `429`, porque ese botón repetiría la consulta.

### D8. Foco al cambiar de vista
El detalle de una reserva reemplaza al formulario en la misma ruta; al desmontarse el botón que
se tocó, el foco caería en `body`. Se enfoca por programa el `h1` de la vista nueva
(`tabindex="-1"`, sin contorno propio). Alternativa: un contenedor `aria-live`; descartada
porque lee todo el detalle y no ubica al usuario de teclado.

### D9. Estados del panel por texto, forma y pictograma
El sello de estado (`Sello`) lleva nombre escrito + un pictograma SVG + un tratamiento de borde
distinto (relleno, contorno grueso, punteado, fino). Cumple WCAG 1.4.1 (uso del color) sin
depender de la paleta. El nivel de aforo usa los mismos sellos. `NO_SHOW` se muestra como
«Ausente» solo en la interfaz; el identificador de la API no cambia.

### D10. Excepción táctil acotada en el admin
En escritorio las acciones de fila bajan a 36 px para ver más filas por pantalla; si hay algún
puntero grueso disponible (`any-pointer: coarse`, que incluye los equipos híbridos con pantalla
táctil y mouse) siguen en 44 px. `pointer: fine` describe solo el puntero principal y dejaría en
36 px a un híbrido que se toca con el dedo. Es una excepción a `frontend-base` («Objetivos táctiles mínimos»), por eso
queda escrita en el delta de esa capability. 36 px cumple el mínimo de 24 px de WCAG 2.2 AA
(2.5.8) pero no el objetivo de 44 px de AAA; el equipo lo asume para el panel.

### D11. Calendario propio, siempre visible
La fecha se elige en un `Calendario` propio (`frontend/src/components/ui/calendario.tsx`) en vez de
un `<input type="date">`. Razones: el selector nativo no puede mostrar qué días están cerrados
ni cuál es el máximo de anticipación de las zonas, se ve distinto en cada navegador y no admite
la identidad visual; el calendario siempre visible deja ver la disponibilidad de días de un
vistazo y, en pantallas anchas, queda a la izquierda de los turnos. Decisiones:
- Cada día es un `<button>` con nombre accesible completo; los días no elegibles llevan
  `aria-disabled` (siguen enfocables, para no perder el hilo con el teclado) y un sufijo de texto,
  no solo atenuación.
- Tabulación móvil (un solo día con `tabindex="0"`) y flechas, Inicio, Fin, RePág y AvPág,
  siguiendo el patrón de cuadrícula de fechas de WAI-ARIA, sin `role="grid"`: se prefirió una
  tabla de botones simple. Queda como pregunta 7 si el equipo prefiere `grid`.
- Cero dependencias: la aritmética de fechas usa `Date.UTC` y `getUTC*` (`config.yaml` §7); el
  día de hoy se calcula en el servidor con el offset de Argentina y llega como propiedad, de modo
  que el huso del dispositivo no cambie qué días son pasados.
- El límite superior es hoy más el mayor `anticipacionMaxDias` de las zonas; la anticipación
  exacta de cada zona la sigue validando el servidor.

| Alternativa | Por qué no |
|---|---|
| `<input type="date">` | No distingue días cerrados ni el máximo; aspecto y teclado distintos por navegador |
| Librería de calendario (react-day-picker, etc.) | Dependencia nueva que `config.yaml` §2 pide justificar, para un caso que se resuelve con ~300 líneas propias y probables |

### D12. El panel de admin no usa el marco público
`MarcoPublico` decide por la ruta (`/admin` y prefijo `/admin/`) si muestra el encabezado y el
pie públicos; en el panel solo renderiza el contenido, que ya trae su propio encabezado. Se
decidió por la ruta y no con grupos de rutas de Next.js para no mover páginas de `app/` y mantener
el diff acotado. Costo: es un componente de cliente (`usePathname`). Alternativa: dos layouts con
grupos de rutas `(publico)` y `(admin)`, más limpia a largo plazo y más invasiva hoy.

### Acciones en infinitivo: excepción deliberada al «Copy en voseo»
`frontend-cliente` pide copy en voseo rioplatense en toda pantalla nueva, con ejemplos como
«Reservá tu mesa». Este change **no lo aplica a las etiquetas de acción** (botones y enlaces de
llamada a la acción): se mantienen en infinitivo («Reservar una mesa», «Elegir fecha y turno»,
«Volver», «Reintentar», «Confirmar reserva»). Decisión expresa del equipo: es la convención de la
categoría (reservas y comercio), se lee como una acción y no como una orden, y pasar los botones
a imperativo le quita categoría a un restaurante de alta gama. Los títulos, los textos
explicativos y los mensajes siguen en voseo formal. Es una excepción acotada a la regla de
registro, no a la de accesibilidad: el nombre accesible de cada acción sigue siendo claro y
verbal. Alternativa descartada: voseo también en las acciones, por coherencia con
`frontend-cliente`.

### Precedencia sobre `frontend-cliente`
`frontend-cliente` sigue como change sin archivar. Sus requisitos del Paso 1 («Elegir fecha,
turno, zona y comensales», «Solo se ofrecen turnos del día…», «La fecha mínima seleccionable es
hoy…», «Copy en voseo») están redactados sin fijar el tipo de control («opción de turno»,
«selector de fecha»), así que no se contradicen con las tablillas ni con el calendario: esta
capability los **refina** y no los reemplaza. Regla de precedencia, para que haya una sola
autoridad: ante cualquier diferencia de comportamiento del Paso 1, manda `experiencia-reserva-cliente`
(y `calendario-fecha`) sobre `frontend-cliente`. Orden de archivado: primero `frontend-cliente`;
después este change, y al archivarlo se revisa que el texto fundido de ambos no repita ni
contradiga (tarea 6.3). El único punto de superposición real es el aviso de «día sin turnos»,
que `frontend-cliente` ya exigía y `experiencia-reserva-cliente` concreta con su texto.

## Risks / Trade-offs

- [Diff grande: 76 archivos, ~2900 líneas agregadas] → Partir la revisión en los nueve commits ya
  separados (docs, sistema de diseño, landing, flujo del cliente, admin, calendario, frase y
  WebP, marco público, esquinas) y mapear cada uno a una sección de `tasks.md`.
- [Spec escrita después del código] → Ver «Cómo se redactó esta spec»; revisión cruzada.
- [Calidad de las imágenes WebP (calidad 82)] → Verificación visual y de peso total en la tarea 5.2;
  los PNG originales no se versionan, así que regenerarlos exige volver a usar la herramienta de IA.
- [Las fotos parecen reales] → Declaración de ficticio + `PROCEDENCIA.md`; reemplazo si el proyecto
  sale del ámbito académico.
- [Legibilidad del japonés vertical] → Decorativo, `aria-hidden`; el español nunca va vertical.
- [Fuentes recortadas: caracteres faltantes caen al sistema] → Pila de respaldo y prueba visual
  de las pantallas con acentos y ñ (tarea 5.1).
- [`global-error.tsx` usa `next/font/google`] → Migrar a `next/font/local` (tarea 2.1); mientras
  tanto la pantalla de error de último recurso rompe D1 solo en build.
- [`Tablilla` `completa` sin uso] → Se cubre con test de componente; conectarla a la
  disponibilidad por turno es otro change porque requiere datos de la API que el Paso 1 no
  consulta.
- [Contraste verificado a mano, sin automatizar] → Tarea 5.3 agrega un test que calcula las
  relaciones desde `globals.css`.
- [Movimiento y mareo vestibular] → Apagado con `prefers-reduced-motion`; balanceo de ±5° lento
  y pausable.
- [Sin imágenes propias ni logotipo] → Fuera de alcance; `PRODUCT.md` lo declara «Sin decidir».

## Migration Plan

1. Revisar y aprobar esta spec (PR propio, rama `feature/spec-rediseno-frontend-ichigo`).
2. Rebasar `feature/diseno-frontend` sobre `main`, resolver los desvíos de `tasks.md` §2 y
   abrir el PR de implementación enlazado a este change.
3. Archivar con `openspec archive` al mergear; ver Open Questions sobre `frontend-cliente`.

Reversión: los cambios son solo de presentación. Revertir el merge restaura el aspecto anterior
sin migraciones ni cambios de datos.

## Open Questions

Preguntas para el equipo (ninguna cambia el contrato de la API):

1. **Orden de archivado con `frontend-cliente`.** Esa capability todavía no está en
   `openspec/specs/`, así que este change no pudo hacer `MODIFIED` sobre ella y creó
   `experiencia-reserva-cliente`. La regla de precedencia está en «Precedencia sobre
   `frontend-cliente`»; lo que decide el equipo es si se archiva `frontend-cliente` antes
   (recomendado) y quién revisa el texto fundido al archivar (tarea 6.3).
2. **`radiogroup` o botones con `aria-pressed`** para elegir el turno (D3): ¿el equipo prefiere
   la semántica de radio aun a costa de implementar las flechas?
3. **¿Se acepta la excepción de 36 px** en el admin cuando no hay ningún puntero grueso (D10), o
   se vuelve a 44 px?
4. **Resuelta: WebP** (D6). Las imágenes ya están convertidas en el código; no queda decisión,
   solo verificar peso y calidad (tarea 5.2). Se conserva el número para no renumerar.
5. **Ubicación de `.impeccable/`** y de `PRODUCT.md` (`frontend/`): ¿se versionan o quedan fuera
   del repositorio evaluable? Hoy están dentro de `frontend/`.
6. **Reparto de la revisión:** al ser nueve commits de una sola persona, ¿cómo se reparte la
   autoría y la revisión entre los tres integrantes (`config.yaml` §11)?
7. **`role="grid"` o tabla de botones** en el calendario (D11): ¿el equipo prefiere la semántica
   de cuadrícula de fechas aun a costa de un modo de lectura más complejo para lectores de
   pantalla?
8. **Desviación de `config.yaml` §14** (spec posterior al código): ¿el equipo la acepta de forma
   expresa para este change, con la validación del PR de implementación contra `tasks.md`?
9. **Resuelta: acciones en infinitivo.** El equipo decidió mantener los botones y enlaces de
   acción en infinitivo y usar voseo solo en títulos y textos explicativos. Se registra como
   excepción a «Copy en voseo» de `frontend-cliente` (ver «Acciones en infinitivo»); falta que
   quien archive `frontend-cliente` la refleje en esa spec.
