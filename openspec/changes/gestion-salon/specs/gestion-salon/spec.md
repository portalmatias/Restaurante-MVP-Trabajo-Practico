## Purpose

Da al administrador las operaciones para configurar el salón antes y durante la operación del
restaurante: consultar y ajustar los parámetros de cada Zona, y dar de alta, editar o dar de
baja Mesas y Turnos, sin tocar las entidades de dominio ya definidas en `modelo-dominio`.

## ADDED Requirements

### Requirement: Rutas de gestión de salón protegidas por autenticación de administrador
El sistema SHALL exigir un JWT válido de rol `ADMIN` (ver capability `auth-admin`) para
acceder a cualquier ruta bajo `/admin/zonas`, `/admin/mesas` o `/admin/turnos`.

#### Scenario: Solicitud sin token rechazada
- **WHEN** se solicita cualquier ruta de `/admin/zonas`, `/admin/mesas` o `/admin/turnos` sin
  header `Authorization`
- **THEN** el sistema responde `401 Unauthorized` sin ejecutar la operación

### Requirement: Listado de Zonas
El sistema SHALL exponer `GET /admin/zonas`, que devuelve las Zonas existentes con su
configuración completa (rango de comensales, anticipación mínima y máxima, ventana de
cancelación, si requiere confirmación del admin, y aforo máximo).

#### Scenario: Listado devuelve la configuración vigente
- **WHEN** el admin solicita `GET /admin/zonas`
- **THEN** el sistema devuelve las Zonas persistidas con sus valores de configuración actuales

### Requirement: Actualización de configuración de Zona
El sistema SHALL exponer `PATCH /admin/zonas/:id` para actualizar el rango de comensales,
la anticipación mínima y máxima, la ventana de cancelación, si requiere confirmación del admin,
y el aforo máximo de una Zona existente. El sistema SHALL rechazar una actualización cuyo
mínimo de comensales resulte mayor que el máximo.

#### Scenario: Actualización exitosa persiste los nuevos valores
- **WHEN** el admin envía `PATCH /admin/zonas/:id` con valores válidos de configuración
- **THEN** el sistema persiste los nuevos valores y los siguientes `GET` los reflejan

#### Scenario: Rango de comensales inválido rechazado
- **WHEN** el admin envía una actualización donde el mínimo de comensales es mayor que el
  máximo
- **THEN** el sistema rechaza la actualización sin modificar la Zona

### Requirement: Alta y baja de Zona no soportadas
El sistema SHALL restringir las Zonas a las dos ya existentes (`STANDARD`, `VIP`) y no SHALL
exponer ninguna operación para crear o eliminar una Zona, dado que `nombre` es un valor de un
enum fijo de dos elementos (ver `modelo-dominio`).

#### Scenario: No existe ruta para crear ni eliminar Zonas
- **WHEN** se intenta crear o eliminar una Zona a través de la API de administración
- **THEN** el sistema no expone ninguna operación para hacerlo

### Requirement: Alta de Mesa
El sistema SHALL exponer `POST /admin/mesas`, que recibe una Zona, una capacidad y una
etiqueta identificatoria, y crea la Mesa si la Zona existe y la capacidad es un entero
positivo.

#### Scenario: Alta exitosa
- **WHEN** el admin crea una Mesa con una Zona existente y una capacidad positiva
- **THEN** el sistema crea la Mesa y la devuelve con un identificador

#### Scenario: Alta con Zona inexistente rechazada
- **WHEN** el admin intenta crear una Mesa referenciando una Zona que no existe
- **THEN** el sistema rechaza la creación

#### Scenario: Alta con capacidad no positiva rechazada
- **WHEN** el admin intenta crear una Mesa con capacidad cero o negativa
- **THEN** el sistema rechaza la creación

### Requirement: Listado de Mesas
El sistema SHALL exponer `GET /admin/mesas`, que devuelve las Mesas existentes y SHALL
permitir filtrar el listado por Zona.

#### Scenario: Listado filtrado por Zona
- **WHEN** el admin solicita `GET /admin/mesas` indicando una Zona
- **THEN** el sistema devuelve únicamente las Mesas que pertenecen a esa Zona

### Requirement: Edición de Mesa preserva las Reservas activas
El sistema SHALL exponer `PATCH /admin/mesas/:id` para editar la etiqueta, la capacidad y la
Zona de una Mesa. El sistema SHALL rechazar un cambio de Zona o una reducción de capacidad
que deje a una Reserva activa (`PENDIENTE` o `CONFIRMADA`) existente sobre esa Mesa violando
los invariantes 2 o 3 de `modelo-dominio` (capacidad excedida, o Mesa fuera de la Zona de la
Reserva).

#### Scenario: Edición de etiqueta o aumento de capacidad sin restricciones
- **WHEN** el admin edita la etiqueta de una Mesa, o aumenta su capacidad
- **THEN** el sistema aplica el cambio sin más validación que los datos de entrada

#### Scenario: Reducción de capacidad por debajo de una Reserva activa rechazada
- **WHEN** una Mesa tiene una Reserva activa con una cantidad de comensales determinada
- **AND** el admin intenta reducir la capacidad de la Mesa por debajo de esa cantidad
- **THEN** el sistema rechaza la edición

#### Scenario: Cambio de Zona con Reserva activa rechazado
- **WHEN** una Mesa tiene una Reserva activa
- **AND** el admin intenta cambiarla a una Zona distinta
- **THEN** el sistema rechaza la edición

### Requirement: Baja de Mesa bloqueada si tiene Reservas activas
El sistema SHALL exponer `DELETE /admin/mesas/:id` y SHALL rechazar la eliminación si la Mesa
tiene alguna Reserva activa (`PENDIENTE` o `CONFIRMADA`) asociada.

#### Scenario: Baja exitosa sin Reservas activas
- **WHEN** el admin elimina una Mesa sin Reservas activas asociadas
- **THEN** el sistema la elimina

#### Scenario: Baja rechazada por Reservas activas
- **WHEN** el admin intenta eliminar una Mesa que tiene al menos una Reserva activa asociada
- **THEN** el sistema rechaza la eliminación

### Requirement: Alta de Turno
El sistema SHALL exponer `POST /admin/turnos`, que recibe día de la semana, hora de inicio y
hora de fin, y crea el Turno activo por defecto.

#### Scenario: Alta exitosa queda activa por defecto
- **WHEN** el admin crea un Turno sin indicar explícitamente si está activo
- **THEN** el sistema lo crea con `activo = true`

### Requirement: Listado de Turnos
El sistema SHALL exponer `GET /admin/turnos`, que devuelve los Turnos existentes con su día,
horario y estado de actividad.

#### Scenario: Listado incluye Turnos activos e inactivos
- **WHEN** el admin solicita `GET /admin/turnos`
- **THEN** el sistema devuelve todos los Turnos, indicando para cada uno si está activo

### Requirement: Edición de Turno
El sistema SHALL exponer `PATCH /admin/turnos/:id` para editar el día de la semana y el
horario de un Turno existente.

#### Scenario: Edición exitosa persiste el nuevo horario
- **WHEN** el admin edita el día o el horario de un Turno existente
- **THEN** el sistema persiste los nuevos valores

### Requirement: Activación y desactivación de Turno
El sistema SHALL exponer una operación para activar o desactivar un Turno (`activo`), sin
eliminarlo, dado que las Reservas existentes lo referencian.

#### Scenario: Desactivación no elimina el Turno
- **WHEN** el admin desactiva un Turno
- **THEN** el sistema lo marca `activo = false` y lo sigue devolviendo en `GET /admin/turnos`
