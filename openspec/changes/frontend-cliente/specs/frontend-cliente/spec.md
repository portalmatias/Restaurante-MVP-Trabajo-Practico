## Purpose

Permite que una persona sin cuenta reserve una mesa, consulte su reserva por código y email, y
la cancele dentro de la ventana permitida, desde el celular y en voseo rioplatense, mostrando
siempre fechas y horas en hora local del restaurante.

Salvo que un escenario diga otra cosa, los ejemplos usan los datos del seed: zona `STANDARD`
(1 a 8 comensales, anticipación 2 horas a 30 días, ventana de cancelación 2 horas, no requiere
confirmación), zona `VIP` (2 a 12 comensales, anticipación 24 horas a 60 días, ventana de
cancelación 24 horas, requiere confirmación del admin), turnos almuerzo 12:00–15:00 y cena
20:00–23:30 activos de martes a domingo, y turnos del lunes inactivos. Las horas son hora
local del restaurante (`America/Argentina/Buenos_Aires`, UTC-3 fijo).

## ADDED Requirements

### Requirement: Pantalla de inicio del cliente
El sistema SHALL exponer `/reservas` como la puerta de entrada del cliente, con una única
acción principal para empezar una reserva nueva y una acción secundaria para consultar una
reserva ya hecha. La pantalla SHALL NOT mostrar ni mencionar la administración.

#### Scenario: Inicio ofrece las dos acciones del cliente
- **WHEN** una persona visita `/reservas`
- **THEN** la pantalla muestra una acción principal para empezar una reserva
- **AND** muestra una acción secundaria, de menor énfasis visual, para consultar una reserva
  existente

#### Scenario: Inicio no menciona la administración
- **WHEN** una persona visita `/reservas`
- **THEN** ni la pantalla ni su navegación muestran un enlace a `/admin` ni mencionan la
  administración

### Requirement: Elegir fecha, turno, zona y comensales
El sistema SHALL exponer un paso donde la persona elige, en una sola pantalla, la fecha, el
turno, la zona y la cantidad de comensales de la reserva que quiere intentar. Los cuatro datos
SHALL ser obligatorios antes de continuar al resultado de disponibilidad.

#### Scenario: No se puede continuar sin completar los cuatro datos
- **WHEN** la persona intenta continuar habiendo completado solo la fecha y el turno
- **THEN** la pantalla impide avanzar
- **AND** señala qué falta completar, sin recargar la página

#### Scenario: Con los cuatro datos completos se puede continuar
- **WHEN** la persona completó fecha, turno, zona y comensales con valores válidos
- **THEN** la acción para ver el resultado de disponibilidad queda habilitada

#### Scenario: Volver a este paso conserva la selección anterior
- **WHEN** la persona vuelve a este paso desde una acción que ofrece corregir la selección (por
  ejemplo, "no hay lugar" o un rechazo al crear la reserva) con fecha, turno, zona y comensales
  ya elegidos antes
- **THEN** los cuatro campos muestran esos valores ya elegidos, en vez de empezar vacíos
- **AND** si alguno de esos valores ya no es válido (por ejemplo, un turno que dejó de existir),
  el sistema lo ignora y deja ese campo sin seleccionar, en vez de fallar

### Requirement: Solo se ofrecen turnos del día de la semana elegido
Al elegir la fecha, el sistema SHALL ofrecer como opción de turno únicamente los turnos activos
cuyo día de la semana coincide con el día de la semana de esa fecha en el calendario local del
restaurante. Cuando la fecha cambia, el sistema SHALL actualizar la lista de turnos ofrecidos.

#### Scenario: Un sábado ofrece los turnos del sábado
- **WHEN** la persona elige una fecha que cae sábado
- **THEN** la lista de turnos ofrecidos incluye únicamente los turnos activos del sábado

#### Scenario: Un lunes sin turnos activos no ofrece ninguno
- **WHEN** la persona elige una fecha que cae lunes y los turnos del lunes están inactivos
- **THEN** la lista de turnos ofrecidos queda vacía
- **AND** la pantalla lo indica en lenguaje simple, en vez de mostrar una lista en blanco

#### Scenario: Cambiar la fecha actualiza los turnos ofrecidos
- **WHEN** la persona ya eligió un turno de un día y después cambia la fecha a un día distinto
- **THEN** la lista de turnos ofrecidos pasa a ser la del nuevo día
- **AND** si el turno elegido antes ya no corresponde a la nueva fecha, la selección de turno
  se limpia

### Requirement: La fecha mínima seleccionable es hoy en el calendario del restaurante
El selector de fecha SHALL impedir elegir una fecha anterior a la fecha actual del calendario
local del restaurante, calculada con el offset fijo de Argentina (UTC-3), sin importar la zona
horaria del dispositivo de quien reserva. Esta restricción es una ayuda de navegación: la
validación de anticipación mínima y máxima de cada zona la hace siempre el servidor al
consultar disponibilidad y al crear la reserva.

#### Scenario: No se puede elegir una fecha pasada
- **WHEN** la persona abre el selector de fecha
- **THEN** ninguna fecha anterior a la de hoy en el calendario del restaurante está disponible
  para elegir

### Requirement: Las reglas de cada zona son visibles antes de elegirla
Al elegir la zona, el sistema SHALL mostrar junto a cada opción el rango de comensales
permitido, la anticipación mínima y máxima para reservar, y si esa zona requiere confirmación
del administrador, usando los datos publicados por el catálogo de zonas.

#### Scenario: La zona VIP muestra que requiere confirmación
- **WHEN** la persona ve la opción de la zona VIP
- **THEN** la pantalla indica el rango de comensales (2 a 12), la anticipación (24 horas a 60
  días) y que esa zona queda pendiente de confirmación del restaurante

#### Scenario: La zona STANDARD no indica confirmación pendiente
- **WHEN** la persona ve la opción de la zona STANDARD
- **THEN** la pantalla indica su rango de comensales y su anticipación
- **AND** no indica que requiera confirmación

### Requirement: La cantidad de comensales se ofrece dentro del rango de la zona elegida
Una vez elegida la zona, el control para elegir la cantidad de comensales SHALL ofrecer solo
valores dentro del rango mínimo y máximo de esa zona. Si la persona cambia de zona después de
haber elegido una cantidad que queda fuera del nuevo rango, el sistema SHALL ajustar la
cantidad elegida al límite más cercano del nuevo rango.

#### Scenario: El rango de comensales sigue a la zona elegida
- **WHEN** la persona elige la zona VIP (2 a 12 comensales)
- **THEN** el control de comensales no permite bajar de 2 ni subir de 12

#### Scenario: Cambiar de zona ajusta una cantidad fuera de rango
- **WHEN** la persona eligió 1 comensal en la zona STANDARD y después cambia a la zona VIP
  (mínimo 2)
- **THEN** la cantidad de comensales se ajusta automáticamente a 2

### Requirement: Resultado de disponibilidad cuando hay lugar
Al confirmar el Paso 1, el sistema SHALL consultar la disponibilidad real para esa
combinación y, si hay lugar, SHALL mostrar cuántos lugares quedan, un resumen de la selección
(fecha en formato largo local, horario del turno en hora local, zona y comensales), y, si la
zona requiere confirmación del administrador, un aviso de que la reserva quedará pendiente
hasta que el restaurante la confirme. SHALL ofrecer una acción para continuar al paso de datos
de contacto.

#### Scenario: Hay lugar en zona STANDARD
- **WHEN** la disponibilidad consultada para la selección da lugar en zona STANDARD
- **THEN** la pantalla muestra los lugares restantes y el resumen de la selección
- **AND** no muestra ningún aviso de confirmación pendiente

#### Scenario: Hay lugar en zona VIP muestra el aviso de pendiente
- **WHEN** la disponibilidad consultada para la selección da lugar en zona VIP
- **THEN** la pantalla muestra el resumen de la selección
- **AND** muestra un aviso, en lenguaje simple, de que la reserva va a quedar pendiente de
  confirmación

### Requirement: Resultado de disponibilidad cuando no hay lugar
Si la disponibilidad consultada no da lugar, el sistema SHALL mostrar todos los motivos
informados por la consulta, cada uno traducido a un texto en español para personas (no el
código técnico), y SHALL ofrecer una acción para volver al Paso 1 conservando los valores ya
elegidos para que la persona solo tenga que corregir lo que hace falta. SHALL NOT ofrecer una
acción para continuar al paso de datos de contacto.

#### Scenario: No hay lugar por un solo motivo
- **WHEN** la disponibilidad consultada no da lugar por aforo de zona
- **THEN** la pantalla muestra un texto en español explicando que la zona está completa para
  ese turno y esa fecha
- **AND** ofrece volver a elegir con la fecha, el turno, la zona y la cantidad de comensales
  ya seleccionados

#### Scenario: No hay lugar por varios motivos a la vez
- **WHEN** la disponibilidad consultada informa más de un motivo (por ejemplo, turno inactivo y
  comensales fuera de rango)
- **THEN** la pantalla muestra un texto para cada motivo informado, sin omitir ninguno

### Requirement: El resultado de disponibilidad se reevalúa en cada visita
El sistema SHALL volver a consultar la disponibilidad real cada vez que se carga o se refresca
el resultado, o se llega a él navegando hacia adelante, en vez de reutilizar un resultado
guardado. Un regreso con el botón "atrás" del navegador PUEDE mostrar el resultado tal como se
vio antes (el navegador reutiliza la página); el cupo real se vuelve a validar al confirmar la
reserva, que informa los motivos si ya no hay lugar.

#### Scenario: Refrescar la pantalla de resultado vuelve a consultar
- **WHEN** la persona refresca la pantalla de resultado de disponibilidad
- **THEN** el sistema consulta la disponibilidad de nuevo antes de mostrar el resultado

#### Scenario: Volver con "atrás" y confirmar cuando ya no hay lugar
- **WHEN** la persona vuelve con "atrás" a un resultado que mostraba lugar, y al confirmar la
  reserva ya no queda cupo
- **THEN** el sistema informa los motivos por los que no se pudo reservar, sin perder los datos
  de contacto ya escritos

### Requirement: Acceso a un paso del asistente sin la selección previa
Si se accede al resultado de disponibilidad o al paso de datos de contacto sin una selección
previa completa y válida (fecha, turno, zona y comensales), el sistema SHALL redirigir al Paso
1 en vez de mostrar un error técnico o una pantalla vacía.

#### Scenario: Acceder al resultado sin haber elegido nada
- **WHEN** se accede directamente a la pantalla de resultado de disponibilidad sin haber
  completado el Paso 1
- **THEN** el sistema redirige al Paso 1

#### Scenario: La selección apunta a un turno o una zona que ya no existen
- **WHEN** se accede al resultado de disponibilidad con un turno o una zona que ya no existen
  (por ejemplo, desde un enlace viejo) y la consulta de disponibilidad responde que no se
  encuentran
- **THEN** el sistema redirige al Paso 1 conservando los datos que siguen siendo válidos y sin
  mostrar un error técnico

### Requirement: Paso de datos de contacto
El sistema SHALL exponer un paso donde la persona ingresa su nombre, su email y su teléfono
para completar la reserva, después de un resultado de disponibilidad con lugar. SHALL mostrar
el resumen de la selección hecha en el Paso 1 para que la persona no tenga que recordarla.

#### Scenario: El resumen de la selección está visible al ingresar los datos
- **WHEN** la persona llega al paso de datos de contacto desde un resultado con lugar
- **THEN** la pantalla muestra la fecha, el turno, la zona y la cantidad de comensales ya
  elegidos

### Requirement: Validación en línea de los datos de contacto
El sistema SHALL validar nombre, email y teléfono antes de enviarlos, y SHALL mostrar el error
de un campo junto a ese campo apenas la persona termina de completarlo, sin esperar a que
intente enviar el formulario. Mientras el envío está en curso, la acción de enviar SHALL
mostrar un estado de carga y SHALL impedir un segundo envío.

#### Scenario: Un email inválido se marca al salir del campo
- **WHEN** la persona escribe un email sin arroba y pasa al siguiente campo
- **THEN** el campo de email muestra un error en línea, sin haber enviado el formulario todavía

#### Scenario: El botón de enviar se deshabilita mientras se procesa
- **WHEN** la persona envía el formulario con datos válidos
- **THEN** la acción de enviar muestra que está procesando y no puede volver a presionarse
  hasta que la respuesta llegue

### Requirement: Rechazo por reglas de negocio al crear la reserva
Si crear la reserva es rechazado porque ya no cumple las reglas de negocio (por ejemplo, otra
persona ocupó el último lugar entre la consulta y el envío), el sistema SHALL mostrar todos los
motivos informados, con el mismo texto en español que usa el resultado de disponibilidad, y
SHALL ofrecer una acción para volver al Paso 1 con la selección anterior, sin descartar los
datos de contacto ya escritos.

#### Scenario: Alguien ocupa el último lugar antes de confirmar
- **WHEN** la creación de la reserva es rechazada porque ya no hay lugar
- **THEN** la pantalla muestra el motivo en español
- **AND** ofrece volver a elegir fecha, turno, zona o comensales

### Requirement: Choque de concurrencia al crear la reserva
Si la creación es rechazada por un choque entre creaciones simultáneas y no por una regla de
negocio puntual, el sistema SHALL mostrar un mensaje en español que invite a reintentar en
unos segundos, sin exponer detalle técnico del choque, y SHALL conservar los datos de contacto
ya escritos para que la persona pueda reintentar sin volver a tipearlos.

#### Scenario: Rechazo sin un motivo de negocio puntual
- **WHEN** la creación de la reserva es rechazada sin que la respuesta traiga un motivo de
  negocio
- **THEN** la pantalla muestra un mensaje que invita a reintentar
- **AND** los campos de nombre, email y teléfono conservan lo ya escrito

### Requirement: Turno o zona inexistentes al crear la reserva
Si el turno o la zona elegidos ya no existen al momento de crear la reserva, el sistema SHALL
mostrar un mensaje en español indicando que hay que volver a empezar la selección, y SHALL
ofrecer una acción que lleve al Paso 1 sin la selección anterior.

#### Scenario: El turno elegido ya no existe
- **WHEN** la creación de la reserva responde que el turno no existe
- **THEN** la pantalla muestra un mensaje pidiendo elegir de nuevo
- **AND** la acción ofrecida lleva al Paso 1 vacío, no al resultado anterior

### Requirement: Error de servidor o de red al crear o consultar
Ante un error de servidor o de red al crear la reserva, al consultar disponibilidad, al
consultar una reserva o al cancelarla, el sistema SHALL mostrar un mensaje genérico en español
que no repita ningún detalle técnico ni ningún texto que haya podido enviar el servidor, y
SHALL ofrecer una acción para reintentar la misma operación sin perder los datos ya
ingresados en el formulario correspondiente.

#### Scenario: El servidor no responde al crear la reserva
- **WHEN** la creación de la reserva falla por un error de servidor o de red
- **THEN** la pantalla muestra un mensaje genérico de error
- **AND** los datos de contacto ya escritos siguen presentes en el formulario
- **AND** se ofrece una acción para reintentar el envío

#### Scenario: El servidor no responde al consultar una reserva
- **WHEN** la consulta de una reserva falla por un error de servidor o de red
- **THEN** la pantalla muestra un mensaje genérico de error
- **AND** el código y el email ya tipeados siguen presentes en el formulario
- **AND** se ofrece una acción para reintentar la consulta

### Requirement: Confirmación de la reserva creada
Al crear la reserva con éxito, el sistema SHALL mostrar el código de reserva con énfasis visual
propio, el estado resultante (confirmada o pendiente de confirmación), y un resumen con fecha,
horario del turno, zona y comensales. SHALL indicar en lenguaje simple que ese código junto con
el email es la única forma de consultar o cancelar la reserva, sin prometer el envío de un
email de confirmación.

#### Scenario: Reserva confirmada muestra su código
- **WHEN** la reserva se crea en zona STANDARD
- **THEN** la pantalla muestra el código de reserva destacado, el estado confirmada, y el
  resumen de fecha, turno, zona y comensales

#### Scenario: Reserva pendiente indica que falta confirmación
- **WHEN** la reserva se crea en zona VIP
- **THEN** la pantalla muestra el código de reserva destacado, el estado pendiente de
  confirmación, y el mismo resumen

#### Scenario: La pantalla no promete un email
- **WHEN** se muestra la confirmación de una reserva recién creada
- **THEN** el texto de la pantalla no afirma que se envió o se va a enviar un email con el
  código

### Requirement: Copiar el código de reserva
La pantalla de confirmación SHALL ofrecer una acción para copiar el código de reserva al
portapapeles, con una confirmación visible de que se copió.

#### Scenario: Copiar el código muestra confirmación
- **WHEN** la persona usa la acción de copiar el código
- **THEN** el código queda en el portapapeles
- **AND** la pantalla muestra una confirmación breve de que se copió

### Requirement: Formulario para consultar una reserva
El sistema SHALL exponer un paso donde la persona ingresa el código de su reserva y el email
con el que reservó para consultar su estado. Ambos campos SHALL ser obligatorios y SHALL
validarse en línea antes de enviar (formato del código, formato del email).

#### Scenario: No se puede consultar sin los dos datos
- **WHEN** la persona intenta consultar habiendo completado solo el código
- **THEN** la consulta no se envía
- **AND** la pantalla señala que falta el email

### Requirement: Reserva no encontrada al consultar
Si el código y el email no corresponden a la misma reserva, el sistema SHALL mostrar el mismo
mensaje genérico sin importar si falló el código, el email, o ambos, sin indicar cuál de los
dos fue el problema.

#### Scenario: Email incorrecto para un código existente
- **WHEN** se consulta con un código que existe pero un email que no corresponde a esa reserva
- **THEN** la pantalla muestra el mismo mensaje de "no se encontró" que si el código no
  existiera, sin indicar cuál dato falló

### Requirement: Detalle de una reserva consultada
Al encontrar la reserva, el sistema SHALL mostrar su estado, y un resumen con fecha, horario
del turno en hora local, zona y comensales. SHALL NOT mostrar el nombre, el email, el teléfono
ni ningún dato de otra reserva.

#### Scenario: El detalle no repite datos de contacto
- **WHEN** se muestra el detalle de una reserva encontrada
- **THEN** la pantalla no muestra el nombre, el email ni el teléfono de quien reservó

### Requirement: La acción de cancelar solo se ofrece cuando es plausible
La pantalla de detalle SHALL ofrecer la acción de cancelar únicamente cuando el estado de la
reserva todavía admite cancelación (confirmada o pendiente de confirmación, nunca cancelada ni
`NO_SHOW`) y la fecha y hora locales del turno todavía están, según una estimación hecha con los
datos ya mostrados, dentro de la ventana de cancelación de su zona. Esta condición es una
ayuda de navegación para no ofrecer una acción que muy probablemente va a fallar: la ventana de
cancelación la valida siempre el servidor al momento de cancelar, y puede rechazar la
cancelación aunque la pantalla la haya ofrecido. Si no se puede calcular esa estimación (por
ejemplo, porque falla la consulta de la que sale la ventana de cancelación de la zona, o esa
zona ya no está en la respuesta), el sistema SHALL NOT ofrecer la acción de cancelar, y SHALL
avisar que no se pudo verificar, con una forma de reintentar la verificación.

#### Scenario: Una reserva ya cancelada no ofrece la acción
- **WHEN** se muestra el detalle de una reserva en estado cancelada
- **THEN** la pantalla no ofrece la acción de cancelar

#### Scenario: Una reserva confirmada bien dentro de la ventana ofrece cancelar
- **WHEN** se muestra el detalle de una reserva confirmada cuyo turno empieza muy por delante
  de la ventana mínima de cancelación de su zona
- **THEN** la pantalla ofrece la acción de cancelar

#### Scenario: Una reserva fuera de la ventana no ofrece cancelar
- **WHEN** se muestra el detalle de una reserva confirmada cuyo turno ya está a menos tiempo
  que la ventana de cancelación de su zona
- **THEN** la pantalla no ofrece la acción de cancelar

#### Scenario: No se puede verificar la ventana de cancelación
- **WHEN** no se puede calcular si el turno de la reserva todavía está dentro de la ventana de
  cancelación de su zona (por ejemplo, por una falla de servidor o de red al obtener los datos
  de esa zona, o porque la zona ya no está en esa consulta)
- **THEN** la pantalla no ofrece la acción de cancelar
- **AND** avisa que no se pudo verificar
- **AND** ofrece una acción para reintentar la verificación

### Requirement: Confirmación antes de cancelar
Al elegir cancelar, el sistema SHALL pedir una confirmación explícita en un diálogo aparte que
repita el resumen de la reserva, antes de enviar la cancelación. El diálogo SHALL poder
cerrarse sin cancelar nada.

#### Scenario: Cerrar el diálogo no cancela la reserva
- **WHEN** la persona abre el diálogo de confirmación y lo cierra sin confirmar
- **THEN** la reserva conserva su estado anterior
- **AND** no se envía ninguna solicitud de cancelación

#### Scenario: Confirmar envía la cancelación
- **WHEN** la persona confirma la cancelación en el diálogo
- **THEN** el sistema envía la solicitud de cancelación con el código y el email ya
  verificados

### Requirement: Cancelación exitosa
Al cancelarse con éxito, el sistema SHALL actualizar el detalle mostrado al estado cancelada,
SHALL ocultar la acción de cancelar, y SHALL mostrar una confirmación de que la cancelación se
completó.

#### Scenario: El detalle refleja la cancelación
- **WHEN** la cancelación se completa con éxito
- **THEN** el detalle mostrado pasa a indicar el estado cancelada
- **AND** la acción de cancelar deja de ofrecerse

### Requirement: Errores al confirmar la cancelación
Si la cancelación es rechazada, el sistema SHALL mostrar el mensaje del rechazo dentro del
mismo diálogo (por ejemplo, que la ventana de cancelación ya venció o que la reserva ya no
está en un estado cancelable), sin cerrar el diálogo automáticamente, y sin dar de baja la
reserva mostrada en el detalle.

#### Scenario: La ventana de cancelación ya venció
- **WHEN** la cancelación es rechazada porque la ventana de la zona ya venció
- **THEN** el diálogo muestra el motivo del rechazo
- **AND** el detalle sigue mostrando el estado anterior de la reserva

### Requirement: Límite de intentos en consulta y cancelación
Si la consulta o la cancelación son rechazadas por exceso de intentos, el sistema SHALL
mostrar un mensaje en español que indique que hay que esperar antes de volver a intentar, sin
tecnicismos.

#### Scenario: Demasiados intentos de consulta
- **WHEN** la consulta de una reserva es rechazada por límite de intentos
- **THEN** la pantalla muestra un mensaje pidiendo esperar antes de reintentar

### Requirement: Conversión de fecha y hora a hora local
Toda fecha de calendario y todo horario de turno que se muestre en una pantalla del cliente
SHALL mostrarse en hora local del restaurante, calculada a partir de los datos que devuelve la
API con los métodos de fecha basados en UTC, sin depender de la zona horaria configurada en el
dispositivo de quien reserva. Una fecha de calendario SHALL mostrarse en un formato largo en
español (día de la semana, día, mes y año); un horario de turno SHALL mostrarse como hora y
minutos.

#### Scenario: La fecha se muestra en formato largo en español
- **WHEN** se muestra una fecha de calendario en cualquier pantalla del cliente
- **THEN** se muestra con el día de la semana, el día, el mes y el año en español (por
  ejemplo, "sábado 19 de septiembre de 2026")

#### Scenario: El horario de un turno no depende de la zona horaria del dispositivo
- **WHEN** se muestra el horario de la cena (20:00 a 23:30 hora local del restaurante) en un
  dispositivo configurado en una zona horaria distinta a la de Argentina
- **THEN** la pantalla sigue mostrando "20:00" y "23:30", sin corrimiento

### Requirement: Copy en voseo rioplatense
Todo texto de interfaz dirigido a la persona que reserva, incluidas las etiquetas de las
acciones principales, SHALL usar voseo rioplatense ("reservá", "elegí", "revisá") en vez de
tuteo o de un registro impersonal.

#### Scenario: La acción principal de inicio usa voseo
- **WHEN** se muestra la acción principal de la pantalla de inicio
- **THEN** su texto usa una forma de voseo (por ejemplo, "Reservá tu mesa"), no de tuteo
  ("Reserva tu mesa") ni impersonal ("Reservar una mesa")

#### Scenario: Un mensaje de error de servidor usa voseo
- **WHEN** se muestra el mensaje genérico de error de servidor o de red
- **THEN** su texto usa una forma de voseo (por ejemplo, "Intentá de nuevo"), no la forma de
  tuteo que usa hoy `frontend-base` ("Intente de nuevo")

### Requirement: Sin enlaces a la administración
Ninguna pantalla nueva de este change, ni la navegación compartida, SHALL mostrar un enlace o
una mención a la administración del restaurante.

#### Scenario: Ninguna pantalla del cliente enlaza a /admin
- **WHEN** se recorren todas las pantallas nuevas de este change
- **THEN** ninguna contiene un enlace a `/admin`

### Requirement: Accesibilidad heredada en toda pantalla nueva
Todo control interactivo de una pantalla nueva de este change (campo, botón, selector, diálogo)
SHALL cumplir los mismos requisitos de accesibilidad que ya fija `frontend-base` para sus
primitivas: etiqueta visible asociada al control, foco de teclado visible, área táctil de al
menos 44×44px, y mensaje de error asociado con `aria-describedby` cuando corresponda. El
diálogo de confirmación de cancelación, además, SHALL atrapar el foco de teclado mientras está
abierto: la navegación por teclado SHALL NOT llegar a ningún control de la página que queda
detrás. Al cerrarse sin confirmar, SHALL devolver el foco al control que lo abrió. Al
confirmarse la cancelación, ese control deja de existir, y el foco SHALL pasar al aviso de
que la reserva fue cancelada.

#### Scenario: El diálogo de cancelación atrapa el foco
- **WHEN** el diálogo de confirmación de cancelación está abierto
- **THEN** la navegación por teclado con Tab y Shift+Tab no llega a ningún control de la
  página que queda detrás del diálogo

#### Scenario: Cerrar el diálogo devuelve el foco
- **WHEN** el diálogo de confirmación se cierra sin confirmar, con "Volver" o con Escape
- **THEN** el foco de teclado vuelve al control que abrió el diálogo

#### Scenario: Confirmar la cancelación lleva el foco al aviso
- **WHEN** la cancelación se confirma con éxito y el diálogo se cierra
- **THEN** el foco de teclado pasa al aviso "Tu reserva fue cancelada."
