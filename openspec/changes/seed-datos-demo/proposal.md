## Why

El recorrido de punta a punta de `entrega-final` (tarea 6.1) no pudo mostrar a mano dos reglas
desde el frontend con los datos del seed de desarrollo (issue #111):

1. **Cancelar fuera de la ventana → rechazado.** En las dos zonas, `anticipacionMinHoras` es igual
   a `ventanaCancelacionHoras` (2 h STANDARD, 24 h VIP): una reserva recién creada siempre queda
   dentro de la ventana, y el seed no trae ninguna reserva activa cuyo turno empiece antes de que
   termine la ventana.
2. **Marcar NO_SHOW.** La única reserva pasada del seed (`SEEDNSW2`) ya está en `NO_SHOW`; no hay
   ninguna `CONFIRMADA` con el turno terminado.

Las dos reglas ya tienen tests. Lo que falta son datos para poder mostrarlas en una demo.

## What Changes

- **Reserva `CONFIRMADA` pasada:** el seed de desarrollo suma una reserva `CONFIRMADA` con una fecha
  pasada fija, en un turno que coincide con el día de la semana de esa fecha, lista para que el
  admin la marque `NO_SHOW`.
- **Reserva VIP dentro de la ventana:** el seed suma una reserva VIP activa en el próximo turno
  activo que empiece dentro de las próximas 24 h, calculado al correr el seed. Cancelarla desde el
  frontend devuelve el rechazo por ventana. Cada corrida del seed la vuelve a ubicar en el turno
  que corresponda a ese momento.
- **Sin turno posible → se omite:** si ningún turno activo empieza dentro de las próximas 24 h
  (por ejemplo, del domingo a la noche al lunes al mediodía, porque los lunes no hay turnos), el
  seed no crea esa reserva y lo avisa en la consola, sin fallar.
- **README:** la lista de reservas de ejemplo del seed suma las dos nuevas y para qué sirven.

Solo cambia el seed de desarrollo. El seed de producción (`seed-produccion.ts`) y el catálogo
compartido no se tocan.

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `modelo-dominio`: se agrega el requisito «Reservas de demostración del seed», que fija qué
  reservas de ejemplo trae el seed de desarrollo para mostrar el NO_SHOW y la cancelación
  rechazada.

## Impact

- `backend/prisma/seed.ts` y un módulo nuevo en `backend/prisma/` con el cálculo del turno dentro
  de la ventana.
- Un test de integración nuevo en `backend/test/`.
- `README.md` (sección del seed).
- Sin cambios en la API, el esquema de Prisma, las migraciones ni producción.
