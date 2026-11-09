## ADDED Requirements

### Requirement: Reservas de demostración del seed
El seed de desarrollo SHALL incluir, además de las reservas de ejemplo existentes, dos reservas
pensadas para mostrar reglas a mano:

- una reserva `CONFIRMADA` con fecha pasada fija, en un turno cuyo día de la semana coincide con
  esa fecha, para que el admin pueda marcarla `NO_SHOW`;
- una reserva activa (`PENDIENTE` o `CONFIRMADA`) en una mesa VIP, ubicada en el turno activo más
  próximo cuyo inicio queda en el futuro y a menos de `ventanaCancelacionHoras` de la zona VIP
  (24 h) desde el momento en que corre el seed, para que cancelarla sea rechazado por la ventana.

Si ningún turno activo empieza en ese intervalo, el seed SHALL omitir la segunda reserva, avisarlo
en la consola y terminar sin error. Ambas reservas SHALL respetar los invariantes del dominio
(turno activo del día de la semana de la fecha, mesa de la zona, capacidad) y el seed SHALL seguir
siendo idempotente: correrlo de nuevo no duplica filas, vuelve a ubicar la reserva VIP según el
momento de la nueva corrida y no pisa el estado de una reserva que ya se transicionó.

#### Scenario: Reserva lista para marcar NO_SHOW
- **WHEN** se corre el seed sobre una base vacía
- **THEN** existe una reserva `CONFIRMADA` cuyo turno ya terminó y cuyo turno coincide con el día
  de la semana de su fecha
- **AND** el admin puede marcarla `NO_SHOW`

#### Scenario: Reserva VIP dentro de la ventana de cancelación
- **WHEN** se corre el seed en un momento en que algún turno activo empieza dentro de las próximas
  24 h
- **THEN** existe una reserva activa en una mesa VIP cuyo turno empieza después de ese momento y a
  menos de 24 h
- **AND** el turno elegido es el de inicio más próximo entre los que cumplen esa condición
- **AND** cancelarla con su código y email responde que está fuera de la ventana de cancelación

#### Scenario: Sin turno dentro de la ventana
- **WHEN** se corre el seed en un momento en que ningún turno activo empieza dentro de las
  próximas 24 h (por ejemplo, un domingo a las 23:00, hora de Argentina)
- **THEN** el seed no crea la reserva VIP de la ventana, imprime un aviso en la consola y termina
  sin error

#### Scenario: Seed idempotente con las reservas de demostración
- **WHEN** se corre el seed dos veces seguidas
- **THEN** cada reserva de demostración existe una sola vez
- **AND** una reserva de demostración que alguien ya marcó `NO_SHOW` o `CANCELADA` conserva ese
  estado
