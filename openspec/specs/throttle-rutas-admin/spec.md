# throttle-rutas-admin Specification

## Purpose
Fija un límite de solicitudes común para todas las rutas de administración, holgado para el
uso normal del panel pero acotado frente al abuso con un token robado o un cliente defectuoso,
sin relajar los límites que protegen el login y las rutas públicas con código de reserva.

## Requirements

### Requirement: Límite de solicitudes común a las rutas de administración
El sistema SHALL limitar a 60 solicitudes por ventana de 60 segundos, por ruta y por origen,
cada operación de las rutas de administración: `GET /admin/zonas`, `PATCH /admin/zonas/:id`,
`POST /admin/mesas`, `GET /admin/mesas`, `PATCH /admin/mesas/:id`, `DELETE /admin/mesas/:id`,
`POST /admin/turnos`, `GET /admin/turnos`, `PATCH /admin/turnos/:id`, `GET /admin/reservas`,
`PATCH /admin/reservas/:id/confirmar`, `PATCH /admin/reservas/:id/rechazar` y
`PATCH /admin/reservas/:id/no-show`. Superado el límite, el sistema
SHALL responder `429 Too Many Requests` sin ejecutar la operación, y SHALL volver a aceptar
solicitudes de ese origen a esa ruta cuando termine la ventana.

#### Scenario: Solicitudes dentro del límite se atienden
- **WHEN** el admin envía 60 solicitudes a una misma ruta de administración dentro de una
  ventana de 60 segundos
- **THEN** el sistema responde cada una con el código que corresponde a la operación, ninguna
  con `429`

#### Scenario: La solicitud 61 se rechaza
- **WHEN** el admin envía una solicitud número 61 a la misma ruta de administración dentro de
  la misma ventana de 60 segundos
- **THEN** el sistema responde `429 Too Many Requests`

#### Scenario: Una operación rechazada por el límite no modifica datos
- **WHEN** el admin supera el límite de `PATCH /admin/reservas/:id/confirmar` y la solicitud
  siguiente apunta a una Reserva `PENDIENTE`
- **THEN** el sistema responde `429 Too Many Requests` y la Reserva sigue `PENDIENTE`

#### Scenario: El límite de una ruta no consume el de otra
- **WHEN** el admin agotó el límite de una ruta de administración (por ejemplo
  `PATCH /admin/reservas/:id/confirmar`) y envía una solicitud a otra ruta de administración
  (por ejemplo `GET /admin/mesas`) dentro de la misma ventana
- **THEN** el sistema atiende esa otra solicitud con normalidad

#### Scenario: Ráfaga de acciones del panel no se rechaza
- **WHEN** al admin le quedan al menos 20 solicitudes disponibles en la ventana vigente del
  cupo de cada ruta que usa (`PATCH /admin/reservas/:id/confirmar` y
  `PATCH /admin/reservas/:id/rechazar`) y confirma o rechaza 20 Reservas seguidas desde el
  listado en pocos segundos
- **THEN** el sistema atiende cada una sin responder `429`

### Requirement: El login y las rutas públicas con código de reserva conservan su límite
El sistema SHALL mantener sin cambios los límites de las rutas que no son de administración:
`POST /auth/login` SHALL seguir limitado a 5 intentos por ventana de 60 segundos por origen, y
`POST /reservas/consultar` y `POST /reservas/:codigo/cancelar` SHALL seguir con el límite
general configurado (`THROTTLE_LIMIT` por `THROTTLE_TTL`). Ninguna ruta accesible sin token
SHALL quedar con un límite más alto que el que tenía.

#### Scenario: El login sigue rechazando el sexto intento
- **WHEN** un mismo origen envía 6 intentos a `POST /auth/login` dentro de una ventana de 60
  segundos
- **THEN** el sistema responde `429 Too Many Requests` al sexto, aunque las credenciales sean
  correctas

#### Scenario: La consulta pública sigue con el límite general
- **WHEN** un mismo origen supera el límite general configurado en `POST /reservas/consultar`
  dentro de la ventana configurada
- **THEN** el sistema responde `429 Too Many Requests` a la solicitud siguiente, aunque el
  código y el email sean correctos

### Requirement: El contrato documenta el límite de las rutas de administración
El contrato OpenAPI SHALL declarar la respuesta `429 Too Many Requests` en cada operación de
administración alcanzada por el límite común, sin fijar la forma de su cuerpo.

#### Scenario: Toda operación de admin declara la respuesta 429
- **WHEN** se revisa en `openapi/openapi.yaml` cualquier operación bajo `/admin/zonas`,
  `/admin/mesas`, `/admin/turnos` o `/admin/reservas`
- **THEN** la operación declara una respuesta `429` con su descripción
