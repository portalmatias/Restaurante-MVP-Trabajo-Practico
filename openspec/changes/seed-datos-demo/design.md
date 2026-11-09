## Context

El seed de desarrollo (`backend/prisma/seed.ts`) carga el catálogo compartido, el plano y cuatro
reservas de ejemplo con `upsert` por `codigoReserva`, sin pisar `estado` en el `update`. La regla
de cancelación compara el inicio real del turno (`inicioTurnoUtc(fecha, horaInicio)`, hora de
Argentina, offset fijo −3) contra `ventanaCancelacionHoras` de la zona. Los turnos base son
almuerzo (12:00) y cena (20:00), activos de martes a domingo. Motivación: ver proposal.md.

## Goals / Non-Goals

**Goals:**
- Que una demo pueda mostrar el NO_SHOW y la cancelación rechazada sin tocar la base a mano.
- Que la elección del turno dentro de la ventana sea una función pura, testeable sin reloj real.

**Non-Goals:**
- Datos para la ventana de 2 h de STANDARD: alcanza con mostrar la regla en VIP.
- Cambios en el seed de producción o en el catálogo compartido.
- Resetear el estado de las reservas de demostración en cada corrida.

## Decisions

### D1. Dos códigos fijos nuevos: `SEEDPAS2` y `SEEDVTN2`
Siguen el formato real de `generarCodigoReserva()` (8 caracteres del alfabeto sin I, O, 0, 1) y el
patrón `SEED…2` de los existentes, así se reconocen como datos de ejemplo. Son la clave del
`upsert`, como el resto.

### D2. `SEEDPAS2`: fecha pasada fija, no relativa
`2026-01-07` (miércoles), turno `MIERCOLES_CENA`, mesa `S2`, `CONFIRMADA`. Una fecha fija es
reproducible y siempre pasada, igual que `SEEDNSW2`. Alternativa descartada: «ayer», que obliga a
resolver el caso del lunes y cambia la fila en cada corrida sin ganar nada para la demo.

### D3. `SEEDVTN2`: turno calculado con una función pura
Un módulo nuevo, `backend/prisma/reservas-demo.ts`, exporta
`elegirTurnoEnVentana(ahora, turnos, ventanaHoras)`: recorre las fechas calendario de Argentina
desde hoy hasta el día en que termina la ventana, combina cada fecha con los turnos activos de su
día de la semana usando `inicioTurnoUtc` (el mismo cálculo que usa la regla de cancelación) y
devuelve la `{ fecha, turno }` de inicio más próximo con `ahora < inicio < ahora + ventana`, o
`null`. La ventana se lee de la zona VIP cargada por el catálogo, no se repite el 24 en el código.
La reserva queda `CONFIRMADA` en la mesa `V2` (cuadrada, capacidad VIP), con 4 comensales.

Alternativa descartada: crear la reserva con el servicio de reservas. Lo rechazaría la anticipación
mínima, que es justamente igual a la ventana.

### D4. Re-ubicación en cada corrida
El `update` del `upsert` ya escribe `fecha` y `turnoId`, así que volver a correr el seed mueve
`SEEDVTN2` al turno que corresponda a ese momento. `estado` sigue fuera del `update` (invariante de
estados terminales). Si `SEEDVTN2` ya está `CANCELADA` o `NO_SHOW`, no se mueve: quedaría, por
ejemplo, un NO_SHOW con fecha futura (hallazgo R3-001 / R4-001 de la revisión). El seed lo avisa.

### D5. Sin turno posible: aviso y salida limpia
Si la función devuelve `null`, el seed imprime un aviso que explica por qué (no hay turnos activos
dentro de la ventana VIP) y sugiere volver a correrlo más tarde. Si `SEEDVTN2` ya existía de una
corrida anterior, se deja como está y el aviso lo dice, para que nadie la dé por ausente.
Alternativa descartada: ubicarla en un lunes sin turno activo, que rompe el invariante «turno
coincide con el día de la semana».

## Risks / Trade-offs

- [La ventana se cierra con el tiempo] → Al empezar el turno la reserva sigue rechazando la
  cancelación (le quedan menos horas que la ventana), así que la demo funciona igual. Para dejarla
  en el próximo turno, alcanza con volver a correr el seed.
- [Una demo ya marcó `SEEDPAS2` como `NO_SHOW`] → El seed no lo revierte (D4). El README indica
  resetear la base local para repetir la demo.
- [Choque con una reserva creada a mano en `V2` para el mismo turno y fecha] → El seed atrapa la
  violación de exclusividad de mesa, omite `SEEDVTN2` con un aviso que nombra la mesa y termina sin
  error.
