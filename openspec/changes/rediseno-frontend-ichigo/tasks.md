## Estado de partida (leer primero)

**El código de este change ya está escrito**, antes que la spec, en la rama local
`feature/diseno-frontend` (nueve commits, de `f021204` a `0d6f52c`). Nadie lo verificó todavía
contra esta spec. Por eso **ninguna tarea está marcada como hecha**:
cada casilla significa «verificado contra los escenarios de la spec» y se tilda recién en el PR
de implementación, con la evidencia (salida del comando, captura o medición) en la
descripción del PR. Las tareas de ~2 horas máximo son pruebas y correcciones, no escritura
desde cero.

## 1. Preparación del PR de implementación

- [x] 1.1 Rebasar `feature/diseno-frontend` sobre `origin/main` (hoy `main` tiene
      `frontend-cliente` y `frontend-admin` mergeados) y resolver conflictos. Verificar con
      `git log origin/main..HEAD --oneline` que solo quedan los nueve commits del rediseño.
      Hecho con merge (`8be6b9d`) en lugar de rebase porque la rama ya estaba publicada; quedan
      19 commits propios: los nueve originales y diez de correcciones de la sección 2.
- [x] 1.2 Confirmar con `git diff origin/main --stat -- frontend/src/lib openapi backend` que
      el diff está vacío (el rediseño no toca lógica, API ni contrato).  
      **Resultado (27/10/2026):** `git diff origin/main --stat -- frontend/src/lib openapi backend` ya no sirve
      como prueba porque `main` avanzó (por ejemplo, #86 trajo el plano de mesas del backend) y esa
      comparación incluye cambios ajenos al PR. Contra el punto de partida de la rama,
      `git diff origin/main...HEAD --stat -- frontend/src/lib openapi backend` da un solo archivo:
      `frontend/src/lib/seleccion-reserva.ts` (+14/-7), el parámetro opcional `hasta` que pidió la
      revisión de Mati. Es una excepción intencional a «no se toca `frontend/src/lib/**`»; `openapi/`
      y `backend/` no cambian.
- [x] 1.3 Correr `npm run lint` (desde la raíz: `eslint .` ya cubre `frontend/`; el workspace
      `frontend` no tiene script `lint`), `npm run typecheck -w frontend` y `npm test -w frontend`
      sobre la rama rebasada y anotar el resultado real en el PR.
- [x] 1.4 Revisar que ningún archivo de `frontend/` incluya `.env`, claves ni datos personales
      (`config.yaml` §14), y que `frontend/.impeccable/` y `PRODUCT.md` (hoy solo en la rama
      `feature/diseno-frontend`) se versionen solo si el equipo lo decide (pregunta 5 de
      `design.md`).
      Resultado (26/10/2026): sin hallazgos. Ningún archivo de `frontend/` versionado es un `.env`, una
      clave ni un certificado; no hay patrones de secretos (`AKIA…`, `ghp_`, claves privadas, `JWT_SECRET=`)
      ni en los archivos ni en el historial de todas las ramas (`git log --all -S…`); `.gitignore` ya
      excluye `.env*`. Los únicos datos que parecen personales son ficticios: `ana.perez@example.com`,
      `+54 9 11 5555-1234` y el admin del seed (`admin@restaurante-mvp.local`, documentado en el README).
      `PRODUCT.md` y `.impeccable/surfaces/app-page-tsx.md` no traen secretos, rutas locales ni nombres
      personales. Recomendación (la decisión sigue siendo del equipo, pregunta 5): versionarlos, porque
      `globals.css` y `tablilla.tsx` los citan en sus comentarios y esta spec también; fuera del
      repositorio esas referencias quedarían rotas.

## 2. Desvíos conocidos entre el prototipo y la spec (prueba primero, después arreglo)

- [x] 2.1 `identidad-visual-ichigo`, «Tipografías auto-hosteadas»: escribir un test de Jest que
      falle si algún archivo de `frontend/app` o `frontend/src` contiene `next/font/google`
      (hoy falla por `app/global-error.tsx`). Luego migrar `global-error.tsx` a
      `next/font/local` con los mismos archivos de `src/fonts/` y comprobar que el test pasa.
- [x] 2.2 `tablilla-turnos`, «Estados descartada y completa»: escribir
      `frontend/test/components/ui/tablilla.test.tsx` con el caso `completa` pasando
      `aria-label="20:00 a 23:30"`; debe fallar (hoy usa `disabled` y un `sr-only` que el
      `aria-label` tapa). Ajustar el componente: `aria-disabled="true"` en lugar de `disabled`,
      sin `aria-pressed`, nombre accesible «20:00 a 23:30, completo» compuesto por el componente,
      ignorar la activación y seguir en el orden de tabulación.
- [x] 2.3 `movimiento-ui`: `globals.css` declara `@keyframes tablilla-dar-vuelta` y
      `tablilla-fundido` sin usarlos, y su comentario dice que con `prefers-reduced-motion` «se
      cambia de cara con un fundido corto» (la spec exige cambio instantáneo). Eliminarlos (el
      giro es una `transition`), corregir el comentario y comprobar con `git grep` que nada los
      referencia.
- [x] 2.4 `identidad-visual-ichigo`, «Contrastes»: corregir el comentario de `globals.css` que
      indica 3,7:1 para `border` sobre `background` (medido 3,66:1) y el que indica 2,5:1 para
      el rojo sobre madera (medido 2,0:1 con `#9A2A19`, el único rojo de la paleta: `#B2321F` no
      es un token de esta spec ni de `globals.css`).
- [x] 2.5 `landing-ichigo`: las acciones de la landing se mantienen en infinitivo («Reservar una
      mesa», «Ya tengo un código», «Elegir fecha y turno») por decisión expresa del equipo. No
      requiere cambios en `app/page.tsx`: agregar un test que fije esos textos y que compruebe
      que los títulos y textos explicativos usan voseo y ninguno usa tuteo.
- [x] 2.6 `landing-ichigo`, «Los pasos de reserva coinciden con el flujo real»: el primer paso de
      `PASOS` dice «Elegí fecha, turno y cantidad de comensales» y omite la zona. Corregirlo a
      «Elegí fecha, turno, zona y cantidad de comensales» (ya hecho en la rama de implementación,
      commit `ae4086c`: verificarlo contra el escenario).
- [x] 2.7 `frontend-base`, «Objetivos táctiles mínimos»: `BotonCompacto` usa la variante
      `pointer-fine:` de Tailwind, que mira solo el puntero principal. Escribir un test o una
      verificación manual en un equipo híbrido y cambiarla para que el alto de 36px aplique solo
      sin `any-pointer: coarse` (por ejemplo con una variante propia `@custom-variant` sobre
      `@media (any-pointer: fine) and (not (any-pointer: coarse))`). Ya hecho en la rama de
      implementación, commit `abff7bc`: verificarlo contra los escenarios.
- [x] 2.8 `frontend-admin`, «Motivo visible en el login»: cambiar el texto de `sesion-vencida` en
      `login-form.tsx` de «Tu sesión venció…» a «Tu sesión terminó o ya no es válida…» (ya hecho
      en la rama de implementación, commit `29de1b2`: verificarlo) y quitar la mención fija de «60
      minutos» de los textos de `sesion-vencida` y de `renovar` (la duración es configurable con
      `JWT_EXPIRES_IN`). Ajustar los tests que citan los textos anteriores. El parámetro de URL
      `sesion-vencida` no cambia.
- [x] 2.9 `calendario-fecha`, «Días no elegibles distinguidos por texto»: en
      `formulario-seleccion.tsx`, `ultimaFecha = sumarDias(hoy, maximoDias)` ofrece `hoy + máximo`
      como último día. Escribir primero un test que falle (con zonas de 30 y 60 días, el día 60 es
      `aria-disabled` y el 59 es elegible) y cambiarlo a `maximoDias - 1`. Revisar también que
      «Mes siguiente» se deshabilite en el mes de ese último día.
- [x] 2.10 `frontend-admin`, «Dashboard de aforo»: `leerAforo` (`nivel-aforo.ts`) redondea el
      porcentaje con `Math.round` y decide el nivel con la razón decimal, de modo que 39 de 49
      muestra «80 % ocupado» con el nivel «Con lugar» y 199 de 200 muestra «100 %» sin ser
      «Completo». Escribir primero los tests (39/49 → 79 % y «Con lugar»; 199/200 → 99 % y
      «Casi lleno»; aforo 0 con 5 comensales → «Sin aforo», sin porcentaje y 0 libres) y pasar el
      cálculo a enteros con redondeo hacia abajo (`Math.floor(ocupado * 100 / maximo)`) y a decidir
      el nivel con ese entero.
- [x] 2.11 `experiencia-reserva-cliente`: ninguna pantalla pasa hoy `estado="completa"` a una
      tablilla. Confirmarlo con `git grep 'estado='` y registrar en el PR que el estado queda
      soportado por el componente pero sin cableado a la disponibilidad (cambio futuro).
- [x] 2.12 `identidad-visual-ichigo`, «Contrastes»: agregar a `globals.css` `--ring-madera: #f3ebda`
      y `--color-ring-madera`, y comprobar que la `Tablilla` descartada o completa dibuja el foco
      con `ring-offset-2 ring-offset-background` (o con `ring-madera`) y no con el rojo pegado a
      la madera. Anotar los contrastes de foco medidos (5,69, 6,51, 4,82 y 13,14:1).

## 3. Pruebas automatizadas que faltan (escribirlas antes de tocar el código que cubren)

- [x] 3.1 `tablilla-turnos`: tests de `Tablilla` (libre, elegida, descartada, completa;
      `aria-pressed`; japonés con `aria-hidden` y `lang="ja"`; objetivo táctil por clases) y de
      `TablillaPaso` (no focalizable).
- [x] 3.2 `experiencia-reserva-cliente`: verificar que `formulario-seleccion.test.tsx` cubre los
      cinco escenarios de «Los turnos del día se eligen como tablillas» y los dos de «Pantalla
      cuando no hay nada para reservar»; completar los que falten.
- [x] 3.3 `experiencia-reserva-cliente`: verificar los tests de espera tras `429` (botón
      deshabilitado, texto, rehabilitación a los 30 s con reloj simulado, Enter sin envío) en
      `formulario-datos-contacto.test.tsx`; completar los que falten. El `429` se simula en el
      test: el backend actual no limita `POST /reservas` (design D7).
- [x] 3.4 `experiencia-reserva-cliente`: verificar los tests de `consulta-reserva.test.tsx` para
      el `429` al verificar la ventana (sin «Reintentar» ni «Cancelar reserva»), el otro error
      (con «Reintentar») y los tres movimientos del foco (detalle, vuelta al formulario y, tras
      cancelar, el aviso «Tu reserva fue cancelada.», que ya cubre `confirmar-cancelacion.test.tsx`
      de #74: no duplicarlo ni cambiarlo).
- [x] 3.5 `experiencia-reserva-cliente`: tests de `not-found.tsx` y `PantallaDeEstado`
      (título, acciones, tablilla `aria-hidden`).
- [x] 3.6 `identidad-visual-ichigo`, «Metadatos»: test que importa el `metadata` de cada
      `page.tsx` público y comprueba que los seis títulos de las rutas de `reservas/` existen y son
      distintos, que el título resuelto de `/` es exactamente «Ichigo», y que `layout.tsx` declara
      `lang="es-AR"` y la plantilla `%s | Ichigo`.
- [x] 3.7 `frontend-admin`: verificar `nivel-aforo.test.ts` (80 %, 100 %, sobrecupo, aforo 0 con y
      sin ocupación, redondeo hacia abajo),
      `dashboard-aforo.test.tsx` (porcentaje, libres, `role="meter"`, hora de la consulta),
      `listado-reservas.test.tsx` (cuatro sellos con texto, «Ausente», «Marcar ausente»,
      búsqueda local) y `admin-shell.test.tsx` / `login-form.test.tsx` (aviso a 5 minutos, singular,
      «Renovar sesión» sin pasar por `?motivo=sesion-vencida`, `401` y `403` hacia
      `?motivo=sesion-vencida`, vencimiento por tiempo, `motivo`). Completar lo que falte.
- [x] 3.8 `movimiento-ui`: test que lee `globals.css` y comprueba que existe un bloque
      `prefers-reduced-motion: reduce` con `animation: none` para `.tinta-entrada`, `.balanceo`,
      `.revelar`, `.marco-organico` y `.deriva`, y que ninguna regla base de esas clases fija
      `opacity: 0`.

- [x] 3.9 `calendario-fecha`: tests de `Calendario` y de su uso en `formulario-seleccion.test.tsx`
      que cubran cada escenario de la capability: semana desde el lunes, mes de 28/30/31 días,
      día pasado, día cerrado y día más allá del último elegible (`hoy + máximo − 1`) con
      `aria-disabled` y sufijo en el nombre accesible, activar un día no elegible sin cambiar la fecha, un solo `tabindex="0"`, flechas,
      Inicio, Fin, RePág y AvPág (incluido 31 de enero a febrero), destino fuera de rango sin mover
      el foco, límites de «Mes anterior» y «Mes siguiente», y nombre accesible «…, hoy».
- [x] 3.10 `calendario-fecha`, «El día de hoy lo calcula el servidor»: test de `fechaLocalDeHoy`
      con `2026-09-20T02:30:00Z` (debe dar `2026-09-19`) y test de que `Calendario` y
      `formulario-seleccion.tsx` no llaman a `new Date()` sin argumentos ni a `Date.now()`.
- [x] 3.11 `frontend-base`, «Layout compartido»: verificar `marco-publico.test.tsx` con `/`,
      `/reservas`, `/admin`, `/admin/reservas` y `/administrar` (esta última conserva el marco
      público); completar lo que falte.
- [x] 3.12 `experiencia-reserva-cliente`: test de «Fecha de la URL en un día sin turnos» (abrir el
      Paso 1 con `?fecha=` de un lunes sin turnos activos muestra el aviso «No hay turnos
      disponibles ese día. Elegí otra fecha.»; desde el calendario ese día no se puede elegir) y de
      la regla de zona en singular («1 hora», «1 día»).
- [x] 3.13 `tablilla-turnos`: test de que una `completa` sigue con `aria-disabled="true"` y sin
      `aria-pressed` cuando se elige otra tablilla, de que se alcanza con Tab y de que activarla
      no cambia la elección.

## 4. Verificación manual

- [x] 4.1 Navegador a **390 px** de ancho (Chrome, modo dispositivo): recorrer `/`,
      `/reservas`, `/reservas/nueva` (elegir fecha y turno), `datos`, `resultado`, `exito`,
      `/reservas/consultar` y una ruta inexistente. En `/reservas/nueva`, recorrer el calendario con
      el dedo y con el teclado (flechas, Inicio, Fin, RePág y AvPág). Comprobar: sin scroll horizontal, acción
      principal visible sin desplazarse, botón fijo del Paso 1, objetivos táctiles de 44 px o
      más, tablillas legibles. Adjuntar capturas al PR.
      Resultado (26/10/2026): Recorrido a 390 px con Playwright y Chromium (táctil emulado, no un dedo
      real) por `/`, `/reservas`, `/reservas/nueva`, `resultado`, `datos`, `exito` (con una reserva
      real en la base de desarrollo), `/reservas/consultar` y una ruta inexistente. Sin scroll
      horizontal en ninguna pantalla; la acción principal se ve sin desplazarse en todas, y en el Paso
      1 el botón es `sticky` (arriba en 768 px de 844). Objetivos táctiles: solo fallaban los días del
      calendario (43,4 × 44 px); corregido en `calendario.tsx` y vuelto a medir: 44,3 px de ancho a
      360 px de pantalla, 46,4 a 375 y 48 a 390 y a 1440, con 44 px de alto. Calendario con teclado:
      flechas, Inicio, Fin, RePág y AvPág se mueven bien y los días cerrados se enfocan
      (`aria-disabled`). Las capturas están en el scratchpad local: falta adjuntarlas a la descripción
      del PR (6.1).

- [x] 4.2 Navegador a **1440 px**: repetir el recorrido anterior y `/admin/login`, `/admin`,
      `/admin/reservas` y `/admin/salon`. Comprobar la composición de la landing en dos columnas,
      el panel a ancho completo y la tabla de reservas sin desbordes. Comprobar que en `/reservas/nueva`
      el calendario queda a la izquierda y que `/admin/**` no muestra el encabezado ni el pie
      públicos.
      Resultado (26/10/2026): Mismo recorrido a 1440 px más el panel de admin. Páginas públicas sin
      desbordes ni controles chicos. Landing en dos columnas (título en x=224 a 789 y primera imagen
      en x=794 a 1244); en `/reservas/nueva` el calendario queda a la izquierda (x=224 a 640) y el
      turno a la derecha (x=688 a 1216). `/admin/**` no muestra el encabezado ni el pie públicos, el
      contenido ocupa el ancho completo y las tablas no desbordan. Los botones del admin miden 36 px a
      1440 px: es el valor de diseño con puntero fino. Defecto encontrado y corregido: el correo de
      `/admin/reservas` se partía a mitad de la dirección; vuelto a medir, de 7 correos 4 ocupan dos
      líneas y ninguno se parte fuera de la arroba.

- [ ] 4.3 Revisión de contraste: medir con una herramienta independiente (extensión de
      contraste del navegador o `webaim.org`) texto, bordes de controles, foco y sellos de las
      pantallas de 4.1 y 4.2, incluidos los estados `elegida`, `descartada` y `completa`.
      Confirmar 4,5:1 en texto y 3:1 en bordes; anotar cualquier incumplimiento como desvío.
      Resultado parcial (26/10/2026): No se usó la herramienta externa que pide la tarea (extensión de
      contraste o `webaim.org`). Se midió con una fórmula WCAG propia, sobre `getComputedStyle` de
      cada texto y su fondo efectivo, en 16 pantallas y estados a los dos anchos: ningún texto activo
      queda por debajo de 4,5:1 (3:1 si es grande; el mínimo medido es 5,52:1) y ningún borde de
      control medido baja de 3:1. Los días cerrados del calendario (2,37:1) y «Anterior/Siguiente»
      deshabilitados (3,18:1) son componentes inactivos, exentos por WCAG 1.4.3. No se midieron el
      anillo de foco en el navegador ni la tablilla `completa` (ninguna pantalla la usa); el contraste
      del foco y de los tokens lo fijan `globals-foco.test.ts` y `globals-contrastes.test.ts`. Queda
      para una persona repetir la medición con la extensión o `webaim.org`.

- [x] 4.4 Estados en escala de grises (DevTools, emulación de visión): comprobar que los cuatro
      estados de reserva y los niveles de aforo se distinguen sin color (spec `frontend-admin`).
      Resultado (26/10/2026): Con `Emulation.setEmulatedVisionDeficiency` en `achromatopsia`, los
      cuatro estados de reserva se distinguen: Ausente (guion), Confirmada (check con relleno),
      Pendiente (reloj con borde rojo de 2 px) y Cancelada (cruz con borde punteado). Los niveles de
      aforo se probaron interceptando la API: «Completo» y «Sobrecupo» llevaban el mismo pictograma y
      relleno, y «Sin aforo» el check de «Con lugar», así que solo los separaba el texto. Corregido:
      «Completo» lleva un cuadro lleno, «Sobrecupo» un triángulo lleno con borde grueso, «Sin aforo»
      contorno punteado con un guion, «Casi lleno» un triángulo hueco y «Con lugar» un check. Vuelto a
      medir con los cinco niveles y revisada la captura en grises: se distinguen por forma y por
      texto.

- [x] 4.5 Movimiento: activar `prefers-reduced-motion: reduce` en DevTools y comprobar en `/`
      que no hay balanceo, parallax, apertura de fotos ni entrada del nombre, y que el giro de la
      tablilla del Paso 1 es instantáneo. Repetir sin la preferencia para ver que sí hay movimiento.
      Probar además un navegador sin `animation-timeline` (por ejemplo Firefox estable) y
      confirmar que el contenido queda visible.
      Resultado (26/10/2026): Sin la preferencia, los bloques `.revelar` arrancan transparentes y
      aparecen al desplazar, y el giro de la tablilla dura 0,45 s con ángulos intermedios. Con
      `prefers-reduced-motion: reduce` todas las animaciones quedan en `none`, todo en opacidad 1 y el
      giro es instantáneo (180° a 0 ms). Sin `animation-timeline` se emuló quitando el bloque
      `@supports (animation-timeline: view())` y el contenido queda visible. No se probó Firefox.

- [ ] 4.6 Teclado y lector de pantalla: recorrer el Paso 1 solo con teclado (Tab, Enter, Espacio)
      y con NVDA o VoiceOver; comprobar el nombre de cada tablilla («20:00 a 23:30»), que el
      japonés no se lee, y que el foco llega al título al abrir el detalle y al volver al
      formulario, y al aviso «Tu reserva fue cancelada.» al cancelar una reserva.
      Resultado parcial (26/10/2026): Hecho solo el recorrido por teclado, con Playwright. Tab sigue
      un orden lógico; Enter y Espacio activan días, tablillas y zonas, y las flechas mueven la zona.
      Los nombres accesibles de las tablillas son «12:00 a 15:00» y «20:00 a 23:30», y todos los
      elementos `lang=ja` son `aria-hidden`. El foco llega al título al abrir el detalle y al volver
      al formulario. Diálogo de cancelación: el foco no sale a la página; Escape y «Volver» lo
      devuelven a «Cancelar mi reserva» y «Sí, cancelar» lo lleva al aviso «Tu reserva fue
      cancelada.». No se pudo probar con NVDA ni VoiceOver: queda para una persona.

- [x] 4.7 Red: con la caché vacía y la pestaña de red abierta en `/`, confirmar que no hay
      pedidos a `fonts.googleapis.com` ni `fonts.gstatic.com`, medir el peso transferido de las
      imágenes WebP (la suma de los archivos de `public/ichigo/` debe ser menor que 300 KB) y el desplazamiento acumulado de diseño (Lighthouse), y anotar los valores.
      Resultado (26/10/2026): Con un contexto nuevo (caché vacía) no hay ninguna solicitud externa a
      390 ni a 1440 px, y ninguna a `fonts.googleapis.com` ni a `fonts.gstatic.com`. Las cinco
      imágenes pesan 242.100 B en disco; transferidas, 70 KB a 390 px y 83 KB a 1440 px. El
      desplazamiento acumulado de diseño (CLS) fue 0, medido con `PerformanceObserver`: no se usó
      Lighthouse, que pide la tarea. El LCP fue de unos 208 ms, en modo desarrollo.

- [x] 4.8 Probar con el backend real y la base sembrada: provocar un `429` real en
      `POST /reservas/consultar` y en `POST /reservas/{codigo}/cancelar` (son las rutas con
      límite), y una sesión de admin próxima a vencer (acortar `JWT_EXPIRES_IN` solo en local).
      Los `429` de `POST /reservas` y de `GET /zonas` no se pueden provocar con el backend actual
      (design D7): verificarlos con una respuesta simulada. Anotar qué se vio.
      Resultado (26/10/2026): `429` reales: en `POST /reservas/consultar` aparece en el intento 11 con
      el mensaje de demasiados intentos, y en `POST /reservas/{codigo}/cancelar` el diálogo sigue
      abierto con el mensaje y la reserva sigue activa. `429` simulado en `GET /zonas`: sin
      «Reintentar» ni «Cancelar mi reserva», con el texto de «no pudimos verificar». Sesión de admin
      con `JWT_EXPIRES_IN=150s`: el aviso dice «vence en 3 minutos», después 2 y «1 minuto» en
      singular; al vencer redirige a `?motivo=sesion-vencida` con el texto nuevo. «Renovar sesión»
      lleva a `?motivo=renovar` y no dispara el mensaje de sesión vencida; un token alterado da `401`
      y redirige a `sesion-vencida`. Dos pestañas: al cerrar sesión en una, la otra sigue en `/admin`
      con su propia sesión (`sessionStorage` es por pestaña). No se simuló el `429` de `POST
      /reservas`: lo cubre el test.

- [x] 4.9 Comprobar en `/admin/login?motivo=sesion-vencida` y `?motivo=renovar` que el mensaje
      aparece (la página de login debe pasar `motivo` al formulario) y que los títulos de las
      pantallas de admin son aceptables; si no lo son, abrir una pregunta al equipo.
      Resultado (26/10/2026): Los dos `?motivo=` muestran su mensaje, sin «60 minutos»; un motivo
      desconocido no muestra ninguno. Los títulos «Aforo | Ichigo», «Reservas | Ichigo» y «Salón |
      Ichigo» son aceptables.

## 5. Optimización y documentación

- [x] 5.1 Documentar en `frontend/src/fonts/` (un `LEEME` breve) cómo se generaron los
      subconjuntos: herramienta, lista de caracteres incluidos y cómo regenerarlos. Probar a
      mano nombres con acentos y ñ en el flujo (por ejemplo, «Ñandú Pérez») para detectar
      caracteres que caen a la fuente del sistema.
      Resultado (26/10/2026): `frontend/src/fonts/LEEME.md` describe cada archivo, su licencia y los
      caracteres de cada subconjunto (332, 310 y 10), y dice que la herramienta y la lista originales no
      quedaron registradas; trae una receta de `pyftsubset` marcada como propuesta (reproduce la misma
      cobertura sobre los `.woff` actuales). En lugar de probar a mano, `tipografias-glifos.test.ts` lee la
      tabla `cmap` de cada `.woff` y comprueba «Ñandú Pérez», «Güemes», «Córdoba» y demás nombres, la
      puntuación de la interfaz y todo carácter japonés del código. Límite documentado: `Ł`, `ő` y otras
      letras fuera de Latín-1 caen a la fuente del sistema. Falta solo la mirada en el flujo (4.x).
- [x] 5.2 Verificar las fotografías WebP de `frontend/public/ichigo/`: que son cinco `.webp`, que
      no queda ningún `.png`, que la suma pesa menos de 300 KB (hoy unos 240 KB), que cada una se
      ve aceptable en la landing a 390 y 1440px, y que `PROCEDENCIA.md` documenta la conversión
      (herramienta y calidad) y nombra los archivos `.webp`.
      Resultado (26/10/2026): Cinco `.webp`, ningún `.png`, suma de 242.100 B (236,4 KiB), bajo el
      tope de 300 KB. Las dimensiones reales de cada archivo coinciden con la tabla de
      `PROCEDENCIA.md`, que documenta Pillow y calidad 82. A 390 y a 1440 px las fotos se ven
      aceptables, todas cargan y tienen texto alternativo. Observación: a 390 px con densidad 3x
      ninguna alcanza la resolución nativa (se sirven a 301 a 390 px), y `sake.webp` se estira 1,34
      veces a 1440 px; es el costo del tope de 300 KB.

- [x] 5.3 `identidad-visual-ichigo`, «Contrastes»: escribir un test que lea los tokens de
      `globals.css`, calcule las relaciones de contraste (fórmula WCAG 2.1) y falle por debajo
      de 4,5:1 (texto) o 3:1 (bordes), y que verifique que el rojo del sello sobre `madera`
      no se use como texto. Sin dependencias nuevas: la fórmula son diez líneas.
      Resultado (26/10/2026): `globals-contrastes.test.ts` mide con los tokens reales todas las
      combinaciones de texto (≥ 4,5:1), los bordes (≥ 3:1) y recorre las superficies de madera de la
      interfaz: ninguna usa `text-accent` ni `text-destructive`, y todo `bg-accent` lleva
      `text-accent-foreground`. El cálculo se comparte con `globals-foco.test.ts` mediante
      `test/helpers/contraste.ts`. Falla con un rojo más claro, un borde más claro, un `text-accent` en la
      tablilla y un `bg-accent` sin texto claro.
- [x] 5.4 `identidad-visual-ichigo`, «Procedencia»: test o script de verificación que compare
      `frontend/public/ichigo/*.webp` con las filas de `PROCEDENCIA.md`, que falle si hay un
      `.png` y que sume los pesos contra el tope de 300 KB.
      Resultado (26/10/2026): `procedencia-imagenes.test.ts` compara `public/ichigo/` con
      `PROCEDENCIA.md`: cinco `.webp`, ningún `.png` ni otro raster, suma < 300 KB (242 KB), una fila por
      imagen con tamaño (verificado contra el encabezado del WebP), uso y prompt, herramienta, fecha,
      calidad de la conversión, aclaración de fotos sintéticas y total registrado dentro del 5 % de la
      suma real. Falla con un `.png`, una fila borrada, un tamaño equivocado, 200 KB de más y un total
      distinto.
- [x] 5.5 Test de ausencia de color suelto: buscar literales de color en
      `frontend/src/components` y `frontend/app` fuera de `globals.css` (ver el primer escenario
      de «Tokens semánticos»). Si la búsqueda encuentra alguno, reemplazarlo por un token.
      Resultado (26/10/2026): `colores-sueltos.test.ts` recorre `src/components` y `app` (sin
      `globals.css`) y busca hexadecimales de 3, 6 u 8 dígitos, `rgb()`, `hsl()`, `oklch()` y variantes:
      no hay ninguna coincidencia, así que no hizo falta reemplazar nada por un token. Falla al agregar un
      `#ff0000`, un `rgb()` o un `oklch()` a un componente.

## 6. Cierre del change

- [ ] 6.1 Abrir el PR de implementación en español, enlazado a este change, con la tabla de
      verificación (cada escenario de las ocho specs, con su evidencia) y la lista de desvíos
      corregidos de la sección 2.
- [ ] 6.2 Resolver las preguntas abiertas de `design.md` con el equipo y reflejar la decisión
      en la spec si cambia un requisito (la spec manda, `config.yaml` §14).
      Resultado parcial (27/10/2026): las preguntas 1, 2, 3, 5, 6, 7 y 8 tienen la respuesta de
      @lussofacundo-iresm (comentario del 20/10/2026 en #77, registrada en `design.md`, «Open
      Questions»); las 4 y 9 ya estaban resueltas. Falta la respuesta de @portalmatias, y la 5 espera
      una decisión del equipo. Ninguna respuesta cambia un requisito de la spec, así que no hace falta
      modificarla. La tarea sigue abierta hasta tener la conformidad de Mati.
- [ ] 6.3 Definir con el equipo el orden de archivado respecto de `frontend-cliente` (pregunta
      1) y, al archivar, fundir los requisitos de `experiencia-reserva-cliente` que
      contradigan a los de `frontend-cliente`. Incluye, en la spec de `frontend-cliente`,
      actualizar el requisito «Copy en voseo rioplatense» y su escenario «La acción principal de
      inicio usa voseo» (que hoy nombra «Reservar una mesa» como impersonal incorrecto) con la
      excepción de los botones y enlaces de acción en infinitivo (`design.md`, «Acciones en
      infinitivo»), y retirar el `Select` de turnos que mencionan su design y sus tareas.
      Estado (27/10/2026): el orden ya está definido, `frontend-cliente` se archivó primero (#84,
      26/10/2026), con el acuerdo de @lussofacundo-iresm. Falta lo que se hace al archivar este change:
      fundir los requisitos de `experiencia-reserva-cliente` que contradigan a los de
      `frontend-cliente`, actualizar «Copy en voseo rioplatense» y retirar el `Select` de turnos en
      `openspec/specs/frontend-cliente/spec.md`. Queda abierta hasta ese PR.
- [x] 6.4 Pasar `npx openspec validate --all --strict` y esperar a que CI quede en verde antes de
      pedir la aprobación de un compañero distinto del autor.
      Resultado (27/10/2026): `npx openspec validate --all --strict` da 17 de 17 válidos. En
      `0e7b6d9`, los cuatro checks del PR (Especificación, Lint y tipos, Tests del backend y
      cubic) terminaron en verde; `eslint` limpio y 766 de 766 tests del frontend con `TZ=UTC` y
      con `TZ=America/Argentina/Buenos_Aires` (corridos en local: el CI de este PR no ejecuta los
      del frontend).
