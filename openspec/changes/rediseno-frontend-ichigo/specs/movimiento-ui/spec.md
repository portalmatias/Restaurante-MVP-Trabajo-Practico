## ADDED Requirements

### Requirement: Movimiento implementado solo con CSS
Todo movimiento decorativo de la interfaz (entrada del nombre, balanceo de tablillas, giro de
tablilla, apertura y desplazamiento de fotografías, aparición de secciones) SHALL
implementarse con CSS (animaciones, transiciones y animaciones atadas al scroll) y SHALL NOT
requerir JavaScript de cliente ni una librería de animación. Las animaciones atadas al scroll
SHALL declararse dentro de un bloque `@supports (animation-timeline: view())`.

#### Scenario: Sin dependencias de animación
- **WHEN** se revisan las dependencias de `frontend/package.json` y las importaciones de
  `frontend/app/page.tsx` y `frontend/src/components/layout/marco-foto.tsx`
- **THEN** no hay una librería de animación ni `"use client"` en esos archivos

#### Scenario: Navegador sin soporte de animaciones por scroll
- **WHEN** el navegador no soporta `animation-timeline`
- **THEN** las secciones y fotografías se muestran completas y estáticas, sin quedar ocultas

### Requirement: El contenido es visible por defecto
Ningún contenido SHALL depender de que una animación corra para ser visible o legible. El
estado base (sin animación) de todo elemento animado SHALL ser su estado final.

#### Scenario: Sin animaciones, todo se ve
- **WHEN** se desactivan las animaciones CSS del documento
- **THEN** el nombre, los textos, las tablillas y las fotografías de `/` están visibles con su
  opacidad y posición finales

#### Scenario: Los estados iniciales no ocultan nada fuera de la animación
- **WHEN** se inspecciona la hoja de estilos de `.revelar`, `.tinta-entrada` y `.marco-organico`
- **THEN** las propiedades de estado inicial (opacidad 0, desenfoque, recorte) aparecen solo
  dentro de los `@keyframes`, no en la regla base del elemento

### Requirement: Toda animación se apaga con prefers-reduced-motion
Cuando el sistema operativo o el navegador piden `prefers-reduced-motion: reduce`, el sistema
SHALL apagar todas las animaciones y transiciones decorativas: el balanceo de tablillas, la
apertura y el desplazamiento (parallax) de las fotografías, la entrada del nombre, la aparición
de secciones, el giro de las tablillas y el pulso de los esqueletos de carga. El desplazamiento
suave de la página SHALL volver a ser instantáneo. Las transiciones del panel de admin SHALL
llevar la variante `motion-reduce`.

#### Scenario: El balanceo se apaga
- **WHEN** se abre `/` con `prefers-reduced-motion: reduce`
- **THEN** el estilo calculado de las tablillas de «Los tres tiempos» tiene `animation-name:
  none`

#### Scenario: La foto queda quieta
- **WHEN** se abre `/` con `prefers-reduced-motion: reduce` y se desplaza hasta una fotografía
- **THEN** su recorte y su posición no cambian con el scroll

#### Scenario: La tablilla cambia sin giro
- **WHEN** con `prefers-reduced-motion: reduce` se elige una tablilla en el Paso 1
- **THEN** la elección cambia de cara de inmediato, con una transición menor a 50 ms

#### Scenario: Entrada del nombre
- **WHEN** se abre `/` con `prefers-reduced-motion: reduce`
- **THEN** el `h1` «Ichigo» se muestra nítido y con su espaciado final desde el primer cuadro

### Requirement: El movimiento no comunica estado por sí solo
Un estado de la interfaz (tablilla elegida, completa, descartada) SHALL ser identificable sin
ver ninguna animación: por texto, `aria-pressed`, borde o sello. El balanceo SHALL pausarse al
pasar el puntero sobre la tablilla.

#### Scenario: Estado legible sin movimiento
- **WHEN** se captura una pantalla del Paso 1 con las animaciones apagadas, con un turno elegido
- **THEN** la tablilla elegida se distingue de las demás por el borde marcado y el sello

#### Scenario: El balanceo se pausa
- **WHEN** el puntero está sobre una tablilla de la landing
- **THEN** su estilo calculado tiene `animation-play-state: paused`
