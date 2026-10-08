## Estado de partida (leer primero)

**El código de este change ya está escrito**, antes que la spec, en la rama local
`feature/diseno-frontend` (commits `f021204`, `c443151`, `330afac`, `c82cd1b` y `79802c5`).
Nadie lo verificó todavía contra esta spec. Por eso **ninguna tarea está marcada como hecha**:
cada casilla significa «verificado contra los escenarios de la spec» y se tilda recién en el PR
de implementación, con la evidencia (salida del comando, captura o medición) en la
descripción del PR. Las tareas de ~2 horas máximo son pruebas y correcciones, no escritura
desde cero.

## 1. Preparación del PR de implementación

- [ ] 1.1 Rebasar `feature/diseno-frontend` sobre `origin/main` (hoy `main` tiene
      `frontend-cliente` y `frontend-admin` mergeados) y resolver conflictos. Verificar con
      `git log origin/main..HEAD --oneline` que solo quedan los cinco commits del rediseño.
- [ ] 1.2 Confirmar con `git diff origin/main --stat -- frontend/src/lib openapi backend` que
      el diff está vacío (el rediseño no toca lógica, API ni contrato).
- [ ] 1.3 Correr `npm run lint -w frontend`, `npx tsc --noEmit -p frontend` y
      `npm test -w frontend` sobre la rama rebasada y anotar el resultado real en el PR.
- [ ] 1.4 Revisar que ningún archivo de `frontend/` incluya `.env`, claves ni datos personales
      (`config.yaml` §14), y que `frontend/.impeccable/` y `PRODUCT.md` se versionen solo si el
      equipo lo decide (pregunta 5 de `design.md`).

## 2. Desvíos conocidos entre el prototipo y la spec (prueba primero, después arreglo)

- [ ] 2.1 `identidad-visual-ichigo`, «Tipografías auto-hosteadas»: escribir un test de Jest que
      falle si algún archivo de `frontend/app` o `frontend/src` contiene `next/font/google`
      (hoy falla por `app/global-error.tsx`). Luego migrar `global-error.tsx` a
      `next/font/local` con los mismos archivos de `src/fonts/` y comprobar que el test pasa.
- [ ] 2.2 `tablilla-turnos`, «Estados descartada y completa»: escribir
      `frontend/test/components/ui/tablilla.test.tsx` con el caso `completa` pasando
      `aria-label`; verificar si el texto «Completo» llega al nombre accesible (sospecha:
      `aria-label` lo tapa, porque el `sr-only` queda dentro del botón). Si falla, ajustar el
      componente para que el estado se anuncie (por ejemplo, componiendo el nombre).
- [ ] 2.3 `movimiento-ui`: `globals.css` declara `@keyframes tablilla-dar-vuelta` y
      `tablilla-fundido` sin usarlos. Eliminarlos (el giro es una `transition`) y comprobar con
      `git grep` que nada los referencia.
- [ ] 2.4 `identidad-visual-ichigo`, «Contrastes»: corregir el comentario de `globals.css` que
      indica 3,7:1 para `border` sobre `background` (medido 3,66:1) y el que indica 2,5:1 para
      el rojo sobre madera (medido 2,0:1 con `#9A2A19`; 2,5:1 es el rojo de relleno `#B2321F`).
- [ ] 2.5 `experiencia-reserva-cliente`: ninguna pantalla pasa hoy `estado="completa"` a una
      tablilla. Confirmarlo con `git grep 'estado='` y registrar en el PR que el estado queda
      soportado por el componente pero sin cableado a la disponibilidad (cambio futuro).

## 3. Pruebas automatizadas que faltan (escribirlas antes de tocar el código que cubren)

- [ ] 3.1 `tablilla-turnos`: tests de `Tablilla` (libre, elegida, descartada, completa;
      `aria-pressed`; japonés con `aria-hidden` y `lang="ja"`; objetivo táctil por clases) y de
      `TablillaPaso` (no focalizable).
- [ ] 3.2 `experiencia-reserva-cliente`: verificar que `formulario-seleccion.test.tsx` cubre los
      cuatro escenarios de «Los turnos del día se eligen como tablillas» y de «Pantalla cuando no
      hay nada para reservar»; completar los que falten.
- [ ] 3.3 `experiencia-reserva-cliente`: verificar los tests de espera tras `429` (botón
      deshabilitado, texto, rehabilitación a los 30 s con reloj simulado, Enter sin envío) en
      `formulario-datos-contacto.test.tsx`; completar los que falten.
- [ ] 3.4 `experiencia-reserva-cliente`: verificar los tests de `consulta-reserva.test.tsx` para
      el `429` al verificar la ventana (sin «Reintentar» ni «Cancelar reserva»), el otro error
      (con «Reintentar») y los tres movimientos del foco.
- [ ] 3.5 `experiencia-reserva-cliente`: tests de `not-found.tsx` y `PantallaDeEstado`
      (título, acciones, tablilla `aria-hidden`).
- [ ] 3.6 `identidad-visual-ichigo`, «Metadatos»: test que importa el `metadata` de cada
      `page.tsx` público y comprueba que los seis títulos existen y son distintos, y que
      `layout.tsx` declara `lang="es-AR"` y la plantilla `%s | Ichigo`.
- [ ] 3.7 `frontend-admin`: verificar `nivel-aforo.test.ts` (80 %, 100 %, sobrecupo, aforo 0),
      `dashboard-aforo.test.tsx` (porcentaje, libres, `role="meter"`, hora de la consulta),
      `listado-reservas.test.tsx` (cuatro sellos con texto, «Ausente», «Marcar ausente»,
      búsqueda local) y `admin-shell.test.tsx` / `login-form.test.tsx` (aviso a 5 minutos, singular,
      «Renovar sesión», `motivo`). Completar lo que falte.
- [ ] 3.8 `movimiento-ui`: test que lee `globals.css` y comprueba que existe un bloque
      `prefers-reduced-motion: reduce` con `animation: none` para `.tinta-entrada`, `.balanceo`,
      `.revelar`, `.marco-organico` y `.deriva`, y que ninguna regla base de esas clases fija
      `opacity: 0`.

## 4. Verificación manual (nada de esto está hecho)

- [ ] 4.1 Navegador a **390 px** de ancho (Chrome, modo dispositivo): recorrer `/`,
      `/reservas`, `/reservas/nueva` (elegir fecha y turno), `datos`, `resultado`, `exito`,
      `/reservas/consultar` y una ruta inexistente. Comprobar: sin scroll horizontal, acción
      principal visible sin desplazarse, botón fijo del Paso 1, objetivos táctiles de 44 px o
      más, tablillas legibles. Adjuntar capturas al PR.
- [ ] 4.2 Navegador a **1440 px**: repetir el recorrido anterior y `/admin/login`, `/admin`,
      `/admin/reservas` y `/admin/salon`. Comprobar la composición de la landing en dos columnas,
      el panel a ancho completo y la tabla de reservas sin desbordes.
- [ ] 4.3 Revisión de contraste: medir con una herramienta independiente (extensión de
      contraste del navegador o `webaim.org`) texto, bordes de controles, foco y sellos de las
      pantallas de 4.1 y 4.2, incluidos los estados `elegida`, `descartada` y `completa`.
      Confirmar 4,5:1 en texto y 3:1 en bordes; anotar cualquier incumplimiento como desvío.
- [ ] 4.4 Estados en escala de grises (DevTools, emulación de visión): comprobar que los cuatro
      estados de reserva y los niveles de aforo se distinguen sin color (spec `frontend-admin`).
- [ ] 4.5 Movimiento: activar `prefers-reduced-motion: reduce` en DevTools y comprobar en `/`
      que no hay balanceo, parallax, apertura de fotos ni entrada del nombre, y que el giro de la
      tablilla del Paso 1 es instantáneo. Repetir sin la preferencia para ver que sí hay movimiento.
      Probar además un navegador sin `animation-timeline` (por ejemplo Firefox estable) y
      confirmar que el contenido queda visible.
- [ ] 4.6 Teclado y lector de pantalla: recorrer el Paso 1 solo con teclado (Tab, Enter, Espacio)
      y con NVDA o VoiceOver; comprobar el nombre de cada tablilla («20:00 a 23:30»), que el
      japonés no se lee, y que el foco llega al título al abrir el detalle, volver al formulario y
      cancelar una reserva.
- [ ] 4.7 Red: con la caché vacía y la pestaña de red abierta en `/`, confirmar que no hay
      pedidos a `fonts.googleapis.com` ni `fonts.gstatic.com`, medir el peso transferido de las
      imágenes y el desplazamiento acumulado de diseño (Lighthouse), y anotar los valores.
- [ ] 4.8 Probar con el backend real y la base sembrada: provocar un `429` en la creación de
      reserva y en la verificación de cancelación, y una sesión de admin próxima a vencer
      (acortar `JWT_EXPIRES_IN` solo en local). Anotar qué se vio.
- [ ] 4.9 Comprobar en `/admin/login?motivo=sesion-vencida` y `?motivo=renovar` que el mensaje
      aparece (la página de login debe pasar `motivo` al formulario) y que los títulos de las
      pantallas de admin son aceptables; si no lo son, abrir una pregunta al equipo.

## 5. Optimización y documentación

- [ ] 5.1 Documentar en `frontend/src/fonts/` (un `LEEME` breve) cómo se generaron los
      subconjuntos: herramienta, lista de caracteres incluidos y cómo regenerarlos. Probar a
      mano nombres con acentos y ñ en el flujo (por ejemplo, «Ñandú Pérez») para detectar
      caracteres que caen a la fuente del sistema.
- [ ] 5.2 Medir el peso de `frontend/public/ichigo/*.png` y probar la conversión a WebP
      (calidad ~80). Si la diferencia visual es aceptable, reemplazar los archivos, actualizar
      las rutas y `PROCEDENCIA.md`; si no, dejar registrado por qué se mantiene el PNG.
- [ ] 5.3 `identidad-visual-ichigo`, «Contrastes»: escribir un test que lea los tokens de
      `globals.css`, calcule las relaciones de contraste (fórmula WCAG 2.1) y falle por debajo
      de 4,5:1 (texto) o 3:1 (bordes), y que verifique que el rojo del sello sobre `madera`
      no se use como texto. Sin dependencias nuevas: la fórmula son diez líneas.
- [ ] 5.4 `identidad-visual-ichigo`, «Procedencia»: test o script de verificación que compare
      `frontend/public/ichigo/*` con las filas de `PROCEDENCIA.md`.
- [ ] 5.5 Test de ausencia de color suelto: buscar literales de color en
      `frontend/src/components` y `frontend/app` fuera de `globals.css` (ver el primer escenario
      de «Tokens semánticos»). Si la búsqueda encuentra alguno, reemplazarlo por un token.

## 6. Cierre del change

- [ ] 6.1 Abrir el PR de implementación en español, enlazado a este change, con la tabla de
      verificación (cada escenario de las siete specs, con su evidencia) y la lista de desvíos
      corregidos de la sección 2.
- [ ] 6.2 Resolver las preguntas abiertas de `design.md` con el equipo y reflejar la decisión
      en la spec si cambia un requisito (la spec manda, `config.yaml` §14).
- [ ] 6.3 Definir con el equipo el orden de archivado respecto de `frontend-cliente` (pregunta
      1) y, al archivar, fundir los requisitos de `experiencia-reserva-cliente` que
      contradigan a los de `frontend-cliente`.
- [ ] 6.4 Pasar `npx openspec validate --all --strict` y esperar a que CI quede en verde antes de
      pedir la aprobación de un compañero distinto del autor.
