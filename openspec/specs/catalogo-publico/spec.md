# catalogo-publico Specification

## Purpose
Permite que cualquier persona, sin cuenta ni token, obtenga el catálogo de Zonas y de Turnos
activos del restaurante, para elegir sus `id` antes de consultar disponibilidad o crear una
reserva.

Los escenarios usan los datos del seed de `modelo-dominio`: zona `STANDARD` (1 a 8 comensales,
anticipación de 2 horas a 30 días, ventana de cancelación de 2 horas, no requiere confirmación),
zona `VIP` (2 a 12 comensales, anticipación de 24 horas a 60 días, ventana de cancelación de 24
horas, requiere confirmación del admin), y los turnos base almuerzo 12:00–15:00 y cena
20:00–23:30, activos de martes a domingo, con los turnos del lunes inactivos. Las horas son
hora local del restaurante (`America/Argentina/Buenos_Aires`, UTC-3 fijo).

## Requirements

### Requirement: Catálogo público de Zonas
El sistema SHALL exponer `GET /zonas`, accesible sin header `Authorization` ni ningún otro
mecanismo de autenticación, que devuelve la lista completa de Zonas.

#### Scenario: Visitante sin token consulta el catálogo de Zonas
- **WHEN** un visitante sin header `Authorization` consulta `GET /zonas`
- **THEN** el sistema responde `200 OK` con la lista de Zonas

### Requirement: Forma de la respuesta de Zonas
Cada elemento de la lista de `GET /zonas` SHALL contener exactamente estos campos: `id`,
`nombre` (`STANDARD` o `VIP`), `minComensales`, `maxComensales`, `anticipacionMinHoras`,
`anticipacionMaxDias`, `ventanaCancelacionHoras` y `requiereConfirmacionAdmin`. La respuesta
SHALL NOT incluir `aforoMaximo` ni ninguna referencia a las Mesas de la zona: son datos
operativos del salón sin uso para quien todavía no reservó.

#### Scenario: La respuesta no expone aforoMaximo ni mesas
- **WHEN** se consulta `GET /zonas`
- **THEN** ningún elemento de la lista tiene una propiedad `aforoMaximo` ni una propiedad
  `mesas`

#### Scenario: La respuesta trae los campos públicos de la zona VIP
- **WHEN** se consulta `GET /zonas`
- **THEN** el elemento de la zona `VIP` incluye `minComensales: 2`, `maxComensales: 12`,
  `anticipacionMinHoras: 24`, `anticipacionMaxDias: 60`, `ventanaCancelacionHoras: 24` y
  `requiereConfirmacionAdmin: true`

### Requirement: Orden determinístico de Zonas
El sistema SHALL devolver las Zonas de `GET /zonas` ordenadas por `nombre` ascendente, es
decir, `STANDARD` antes que `VIP` (orden de declaración del enum). El orden SHALL ser el mismo
en llamadas repetidas sobre los mismos datos.

#### Scenario: STANDARD aparece antes que VIP
- **WHEN** se consulta `GET /zonas`
- **THEN** el elemento de la zona `STANDARD` aparece antes que el de la zona `VIP`

### Requirement: Catálogo público de Turnos activos
El sistema SHALL exponer `GET /turnos`, accesible sin autenticación, que devuelve únicamente
los Turnos con `activo = true`. Un Turno inactivo SHALL NOT aparecer en la respuesta, y la
respuesta SHALL NOT incluir el campo `activo` (todos los elementos devueltos son, por
definición, activos).

#### Scenario: Visitante sin token consulta el catálogo de Turnos
- **WHEN** un visitante sin header `Authorization` consulta `GET /turnos`
- **THEN** el sistema responde `200 OK` con la lista de Turnos activos

#### Scenario: Los turnos inactivos no aparecen
- **WHEN** los turnos del lunes están inactivos y se consulta `GET /turnos` sin filtro
- **THEN** ningún elemento de la lista tiene `diaSemana: LUNES`

#### Scenario: La respuesta no expone el campo activo
- **WHEN** se consulta `GET /turnos`
- **THEN** ningún elemento de la lista tiene una propiedad `activo`

### Requirement: Forma de la respuesta de Turnos
Cada elemento de la lista de `GET /turnos` SHALL contener exactamente estos campos: `id`,
`diaSemana`, `horaInicio` y `horaFin`.

#### Scenario: La respuesta trae los campos públicos del turno
- **WHEN** se consulta `GET /turnos`
- **THEN** cada elemento de la lista tiene `id`, `diaSemana`, `horaInicio` y `horaFin`, y
  ningún otro campo

### Requirement: Formato de horaInicio y horaFin
`horaInicio` y `horaFin` SHALL viajar en el mismo formato que ya usa `GET /admin/turnos`: una
fecha-hora ISO 8601 con la fecha fija en `1970-01-01`, que codifica la hora local del
restaurante (config.yaml §7) y no un instante UTC real. Este change no introduce un formato de
hora nuevo para el mismo campo.

#### Scenario: Hora de la cena en el formato del contrato existente
- **WHEN** se consulta `GET /turnos` y se ubica el turno de cena del sábado
- **THEN** `horaInicio` es `1970-01-01T20:00:00.000Z` y `horaFin` es
  `1970-01-01T23:30:00.000Z`, igual que en `GET /admin/turnos` para el mismo Turno

### Requirement: Orden determinístico de Turnos
El sistema SHALL devolver los Turnos de `GET /turnos` ordenados primero por `diaSemana`, en
orden de calendario semanal (`LUNES` a `DOMINGO`), y dentro del mismo día por `horaInicio`
ascendente. El orden SHALL ser el mismo en llamadas repetidas sobre los mismos datos.

#### Scenario: Los turnos de un mismo día quedan ordenados por hora de inicio
- **WHEN** el martes tiene turno de almuerzo (12:00) y de cena (20:00), ambos activos
- **AND** se consulta `GET /turnos`
- **THEN** el turno de almuerzo del martes aparece antes que el de cena del martes

#### Scenario: Los días quedan ordenados de lunes a domingo
- **WHEN** se consulta `GET /turnos` con turnos activos de martes a domingo
- **THEN** los turnos de `MARTES` aparecen antes que los de `MIERCOLES`, y estos antes que los
  de `JUEVES`, en ese orden hasta `DOMINGO`

### Requirement: Filtro opcional por día de la semana
`GET /turnos` SHALL aceptar un parámetro de query opcional `diaSemana`. Cuando está presente,
el sistema SHALL devolver únicamente los Turnos activos de ese día. Cuando está ausente, SHALL
devolver los Turnos activos de todos los días. Un valor que no sea uno de los siete días SHALL
responder `400 Bad Request`.

#### Scenario: Filtrar por un día con turnos activos
- **WHEN** se consulta `GET /turnos?diaSemana=SABADO`
- **THEN** la respuesta contiene únicamente los turnos activos del sábado

#### Scenario: Filtrar por un día sin turnos activos
- **WHEN** se consulta `GET /turnos?diaSemana=LUNES` y los turnos del lunes están inactivos
- **THEN** el sistema responde `200 OK` con una lista vacía

#### Scenario: Valor de diaSemana inválido
- **WHEN** se consulta `GET /turnos?diaSemana=FERIADO`
- **THEN** el sistema responde `400 Bad Request`

#### Scenario: Filtro vacío es un valor inválido
- **WHEN** se consulta `GET /turnos?diaSemana=` (parámetro presente pero vacío)
- **THEN** el sistema responde `400 Bad Request`

### Requirement: Una lista vacía es 200, no 404
Si no hay Zonas configuradas, o no hay ningún Turno activo (con o sin el filtro `diaSemana`),
el sistema SHALL responder `200 OK` con una lista vacía. La ausencia de resultados no SHALL
tratarse como un recurso no encontrado.

#### Scenario: Sin turnos activos para el día pedido
- **WHEN** se consulta `GET /turnos?diaSemana=LUNES` y no hay turnos activos ese día
- **THEN** el sistema responde `200 OK` con `[]`, no `404 Not Found`

### Requirement: Los endpoints administrativos no cambian
`GET /admin/zonas` y `GET /admin/turnos` SHALL seguir exigiendo un JWT válido con rol `ADMIN`
y SHALL seguir devolviendo su forma de respuesta actual, incluidos `aforoMaximo` y `activo`.
Este change no modifica su comportamiento, sus guards ni su contrato.

#### Scenario: El listado admin de Zonas sigue protegido
- **WHEN** se consulta `GET /admin/zonas` sin header `Authorization`
- **THEN** el sistema responde `401 Unauthorized`

#### Scenario: El listado admin de Turnos sigue protegido
- **WHEN** se consulta `GET /admin/turnos` sin header `Authorization`
- **THEN** el sistema responde `401 Unauthorized`
