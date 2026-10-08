---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["app/reservas","app/admin"]
---

# Ichigo: Kakefuda (superficie: inicio y flujo de reserva del cliente)

Modo: Persuade en el inicio; Operate en el flujo de reserva, la consulta y el panel de admin.
Audiencia y acción: comensal en celular que quiere reservar un omakase sin cuenta. Acción: elegir fecha, turno y comensales y dejar sus datos.
Prueba y contenido: no hay fotos, chef, premios ni precios; solo ilustración propia y datos reales del catálogo (turnos, zonas, lugares libres).
Momento memorable: dar vuelta una tablilla.
Sin decidir: logotipo definitivo y fotografía.

## Direction contract

THESIS: La reserva es una pared de tablillas de madera (kakefuda): cada turno de la noche es una tablilla colgada y elegir es dar vuelta una. Rechaza el arreglo de la categoría: hero con foto, formulario al costado y fila de tarjetas iguales.

OWN-WORLD: Fondo hinoki claro `#E8DCC4` con tinta sumi `#1F1813`; tablillas con borde fino de madera `#8A6A43` (3,66:1), un agujero y un cordón; el único rojo es el sello (`#9A2A19` como texto, `#B2321F` como relleno), nunca sobre madera oscura. Tipografía: Shippori Mincho para nombres, fechas y títulos; Zen Kaku Gothic New para la interfaz; texto horizontal y centrado en las tablillas (decisión del equipo: la legibilidad va antes que la escritura vertical tradicional). Esquinas casi rectas (2px), sin sombras salvo el contacto bajo la tablilla colgada. Sin degradados ni vidrio.

STORY: El visitante entiende que los lugares de la noche son pocos y están contados; cree que es una experiencia íntima en una barra; reserva eligiendo fecha, dando vuelta una tablilla de turno y dejando sus datos, sin cuenta.

FIRST VIEWPORT: En 390px, el nombre Ichigo chico arriba a la izquierda, una línea grande con la fecha elegida y debajo una viga de madera de la que cuelgan 3 o 4 tablillas verticales con el turno y los lugares libres; la acción «Reservar» es la tablilla activa, dada vuelta, con el botón fijo al pie. En 1440px la viga cruza todo el ancho con 5 o 6 tablillas grandes y el selector de fecha bajo el nombre. Las tablillas agotadas cuelgan boca abajo (sin texto) con el sello «completo».

FORM: Pared de tablillas (kakefuda), posición 1 de mi lista, seed `5b385a21`. Interacción firma: la tablilla gira en 3D al elegirla; con `prefers-reduced-motion` cambia con un fundido.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
