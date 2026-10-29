## MODIFIED Requirements

### Requirement: Copy en voseo rioplatense
Todo texto de interfaz dirigido a la persona que reserva SHALL usar voseo rioplatense
("reservá", "elegí", "revisá") en vez de tuteo o de un registro impersonal, con una excepción
acotada: las etiquetas de las acciones (botones y enlaces de llamada a la acción) SHALL estar en
infinitivo («Reservar una mesa», «Volver», «Reintentar»), que es la convención de la categoría
(`rediseno-frontend-ichigo`, `design.md`, «Acciones en infinitivo»). Los títulos, los textos
explicativos y los mensajes SHALL seguir en voseo. La excepción es de registro, no de
accesibilidad: el nombre accesible de cada acción sigue siendo claro y verbal.

#### Scenario: La acción principal de inicio usa voseo
- **WHEN** se muestra la pantalla de inicio con su acción principal
- **THEN** el texto explicativo que la acompaña usa voseo (por ejemplo, "Reservá tu lugar en pocos pasos"),
  no tuteo ni un registro impersonal
- **AND** la etiqueta de la acción, por ser una acción, queda en infinitivo (ver el escenario
  siguiente)

#### Scenario: Las etiquetas de acción van en infinitivo
- **WHEN** se muestra una acción de llamada a la acción, como la principal de inicio
- **THEN** su etiqueta está en infinitivo (por ejemplo, "Reservar una mesa"), no en tuteo
  ("Reserva tu mesa") ni en imperativo

#### Scenario: Un mensaje de error de servidor usa voseo
- **WHEN** se muestra el mensaje genérico de error de servidor o de red
- **THEN** su texto usa una forma de voseo (por ejemplo, "Intentá de nuevo"), no el registro
  formal de usted ("Intente de nuevo") ni el tuteo
