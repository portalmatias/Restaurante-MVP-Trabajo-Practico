## MODIFIED Requirements

### Requirement: Entidad Reserva y datos de contacto sin cuenta
El sistema SHALL modelar una Reserva con: Mesa asignada, Turno, fecha, cantidad de
comensales, estado, y los datos de contacto del cliente sin cuenta (nombre, email, teléfono),
más un código de reserva alfanumérico de 8 caracteres, único, generado al crearse. La Reserva
SHALL poder llevar además una nota del cliente, opcional, de hasta 500 caracteres; una Reserva
sin nota la tiene vacía (`null`), y las Reservas existentes antes de este cambio quedan sin nota.

#### Scenario: Código de reserva único
- **WHEN** el sistema genera el código de una nueva Reserva
- **THEN** garantiza que ese código no coincide con el de ninguna otra Reserva existente

#### Scenario: Reservas anteriores sin nota
- **WHEN** se aplica la migración que agrega la nota a una base con Reservas existentes
- **THEN** esas Reservas quedan con la nota en `null` y el resto de sus datos sin cambios
