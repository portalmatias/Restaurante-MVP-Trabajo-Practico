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
- La respuesta de la creación y el listado del admin (`GET /admin/reservas`) incluyen
  `notaCliente`, en `null` si no hay nota. La consulta pública (código + email) NO la devuelve.
- En el paso de datos de contacto, el cliente ve el campo «Nota para el restaurante (opcional)»
  con el contador de caracteres. La nota aparece en la confirmación de la reserva recién creada.
- En `/admin/reservas`, cada reserva muestra su nota.
- La nota no se edita después de creada la reserva.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `modelo-dominio`: la entidad Reserva suma la nota del cliente, opcional.
- `reservas-crear`: el body acepta `notaCliente` opcional con su validación, y la respuesta de
  la creación lo incluye.
- `reserva-consultar`: el listado del admin incluye la nota; la vista mínima de la consulta
  pública deja explícito que no la incluye.
- `frontend-cliente`: el paso de datos de contacto suma el campo de la nota; la confirmación la
  muestra.
- `frontend-admin`: el listado de Reservas muestra la nota de cada una.

## Impact

- **Base de datos:** una columna nueva opcional en `Reserva`, con su migración de Prisma. No
  modifica filas existentes.
- **Backend:** `crear-reserva.dto.ts`, las respuestas `reserva-creada-respuesta.dto.ts` y
  `reserva-admin-respuesta.dto.ts`, y el servicio de reservas. La respuesta de la consulta
  pública no cambia.
- **Contrato:** `openapi/openapi.yaml` (campo opcional y anulable en `CrearReservaDto`, y campo
  en las dos respuestas) y los tipos generados del frontend.
- **Frontend:** `formulario-datos-contacto.tsx`, la página y el componente de confirmación
  (`/reservas/nueva/exito`) y `listado-reservas.tsx`.
- **Sin cambios:** el plano de mesas (`GET /plano-mesas`) no expone datos de las reservas y
  sigue sin exponerlos; la disponibilidad, la asignación de mesa y la cancelación no cambian.
- **Datos personales:** la nota puede traer datos sensibles (por ejemplo, de salud). Solo la ven
  el administrador y quien la acaba de enviar (en la respuesta de la creación). Se excluye de la
  consulta pública porque el código y el email no alcanzan como control para datos sensibles
  (el código es un identificador de baja entropía, no un secreto). No va en la URL ni se
  escribe en los logs.
- **Autoría:** lo implementa otro integrante del equipo (Lusso Facundo o Werkmeister
  Federico), para repartir el historial.
