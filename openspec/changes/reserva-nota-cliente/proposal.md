## Why

Hoy el cliente no tiene cómo avisarle algo al restaurante al reservar: un cumpleaños, que va
con un cochecito o que alguien es celíaco. Lo resuelve llamando por teléfono, o el restaurante
se entera en la puerta. Una nota opcional en la reserva cubre ese caso sin cambiar el flujo y le
da al administrador la información antes de que llegue la gente.

## What Changes

- La Reserva suma una nota del cliente, opcional, de hasta 500 caracteres. Las reservas que ya
  existen quedan sin nota.
- `POST /reservas` acepta el campo opcional `notaCliente`. Una nota vacía o con solo espacios
  se guarda como sin nota, y una de más de 500 caracteres se rechaza con `400`. Los otros siete
  campos siguen igual. El contrato es aditivo: un pedido sin `notaCliente` se comporta como hoy.
- La respuesta de la creación, la consulta pública (código + email) y el listado del admin
  (`GET /admin/reservas`) incluyen `notaCliente`, en `null` si no hay nota.
- En el paso de datos de contacto, el cliente ve el campo «Nota para el restaurante (opcional)»
  con el contador de caracteres. La nota aparece en la confirmación y en el detalle de la
  reserva consultada.
- En `/admin/reservas`, cada reserva muestra su nota.
- La nota no se edita después de creada la reserva.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `modelo-dominio`: la entidad Reserva suma la nota del cliente, opcional.
- `reservas-crear`: el body acepta `notaCliente` opcional con su validación, y la respuesta de
  la creación lo incluye.
- `reserva-consultar`: la vista mínima de la consulta pública y el listado del admin incluyen
  la nota.
- `frontend-cliente`: el paso de datos de contacto suma el campo de la nota; la confirmación y
  el detalle de la reserva consultada la muestran.
- `frontend-admin`: el listado de Reservas muestra la nota de cada una.

## Impact

- **Base de datos:** una columna nueva opcional en `Reserva`, con su migración de Prisma. No
  modifica filas existentes.
- **Backend:** `crear-reserva.dto.ts`, las respuestas `reserva-creada-respuesta.dto.ts`,
  `reserva-consultada-respuesta.dto.ts` y `reserva-admin-respuesta.dto.ts`, y el servicio de
  reservas.
- **Contrato:** `openapi/openapi.yaml` (campo opcional en `CrearReservaDto` y en las tres
  respuestas) y los tipos generados del frontend.
- **Frontend:** `formulario-datos-contacto.tsx`, la pantalla de confirmación,
  `consulta-reserva.tsx` y `listado-reservas.tsx`.
- **Sin cambios:** el plano de mesas (`GET /plano-mesas`) no expone datos de las reservas y
  sigue sin exponerlos; la disponibilidad, la asignación de mesa y la cancelación no cambian.
- **Datos personales:** la nota puede traer datos sensibles (por ejemplo, de salud). Solo la ven
  el administrador y el cliente con su código y su email, y no se escribe en los logs.
- **Autoría:** lo implementa otro integrante del equipo (Lusso Facundo o Werkmeister
  Federico), para repartir el historial.
