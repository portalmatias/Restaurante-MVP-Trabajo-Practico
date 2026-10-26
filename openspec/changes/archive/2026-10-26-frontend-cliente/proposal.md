## Why

`frontend-base` deja el layout, los tokens, las primitivas de UI y el cliente HTTP tipado,
pero las rutas `/reservas/...` son todavía un placeholder sin lógica (`docs/roadmap-mvp.md`
Fase 5). Sin este change, un cliente sin cuenta no tiene forma de reservar, consultar ni
cancelar desde el navegador: solo existen los endpoints del backend. El roadmap asigna
`frontend-cliente` a portalmatias, con alcance fijo: reservar, consultar por código + email,
cancelar, y la conversión UTC → hora local, que `config.yaml` §7 pone explícitamente del lado
del frontend.

El diseño parte de una persona concreta (Raúl, 74 años, reservando una mesa VIP para sus
bodas de oro desde el celular, frustrado por respuestas lentas): pantallas de una sola tarea,
texto grande, botones grandes, indicador de progreso claro y lenguaje simple en voseo
rioplatense. `design.md` fija estas decisiones en términos de código (layout, espaciado,
tokens por elemento, tipografía, estados) porque el equipo no usa Figma.

## What Changes

- Se agregan las pantallas reales bajo `/reservas/...` (Server Components por defecto,
  `"use client"` solo en los pasos interactivos, §7): Inicio, Paso 1 (fecha/turno/zona/
  comensales), Resultado de disponibilidad (hay lugar / no hay lugar), Tus datos, Reserva
  registrada, y Consultar mi reserva (que cubre detalle, confirmación de cancelación y
  reserva cancelada como estados de una misma pantalla, ver `design.md`).
- El estado del asistente de reserva vive en la URL (query string), no en `sessionStorage` ni
  en estado de cliente sin reflejar: cada paso es reconstruible desde sus parámetros, así un
  refresh o un botón "atrás" no pierden la selección. El flujo de consulta/cancelación NO
  refleja el email en la URL (mismo criterio de privacidad que ya aplicó el backend en
  `reserva-consultar` D1 y `cancelacion-turnos`).
- Conversión de fecha/hora a hora local: `fecha` (calendario) se muestra en español largo
  (ej. "sábado 19 de septiembre de 2026") y `horaInicio`/`horaFin` de los Turnos (que ya
  viajan en hora local del restaurante, codificados como ISO con fecha fija 1970-01-01) se
  muestran como `HH:mm`. Todo el parseo usa `getUTC*`/`Date.UTC`, nunca métodos locales
  (§7). No se agrega ninguna librería de fechas: alcanza con `Date` e `Intl.DateTimeFormat`.
- Copy en **voseo rioplatense** ("Reservá tu mesa", "Elegí la fecha", "Revisá tu email") en
  toda pantalla nueva. Se migran a voseo los mensajes neutro-formales de `errors.ts`/
  `client.ts` de `frontend-base` ("Intente de nuevo…" → "Intentá de nuevo…"), conservando
  sus tests en verde.
- Se extienden dos primitivas de `frontend-base` de forma aditiva, sin romper su contrato
  actual: `Button` suma un `size` opcional (`'md'` default, `'lg'` para los CTA principales
  de 56px que pide la persona) y `SiteHeader` suma un segundo enlace ("Consultar reserva"),
  sin agregar nunca un enlace a `/admin` (D11 de `frontend-base` se preserva). Se agrega una
  primitiva nueva, `Dialog`, sobre el elemento nativo `<dialog>` (sin dependencia nueva) para
  el paso de confirmar cancelación, que `frontend-base` había dejado como Open Question.
- Errores cubiertos en las pantallas nuevas: `400` con errores en línea por campo (y un
  resumen accesible cuando el campo no es editable en el paso actual), `404` genérico (código
  o email no coinciden; turno/zona ya no existen), `409` con todos los `motivos` de negocio
  (incluido el caso de que otra persona haya tomado el último lugar entre la consulta y la
  creación), `429` (límite de intentos) y `5xx`/red (mensaje genérico, sin perder los datos
  ya tipeados).

### Fuera de alcance

- El dashboard de administración (`frontend-admin`, FedeWerk).
- Cualquier endpoint que no esté mergeado a `main` en el momento de implementar: las tareas
  quedan agrupadas por prerrequisito (ver Impact) para que cada grupo se implemente en cuanto
  su backend esté disponible, sin escribir tipos a mano ni agregar paths ficticios al YAML.
- Modo oscuro, autenticación de cliente y cualquier lógica de sesión (ya son Non-Goals de
  `frontend-base`, y este change no los reabre).
- Reasignación de mesa, confirmación/rechazo VIP o marcado de `NO_SHOW`: son pantallas de
  `frontend-admin`.

## Capabilities

### New Capabilities
- `frontend-cliente`: el flujo completo del cliente sin cuenta — reservar, consultar por
  código + email y cancelar — sobre las rutas `/reservas/...`, con conversión de fecha/hora a
  hora local y manejo de los errores de la API (400/404/409/429/5xx).

### Modified Capabilities
_Ninguna._ `frontend-base` (spec en `openspec/changes/frontend-base/`, todavía sin archivar)
y `disponibilidad` (única spec archivada en `openspec/specs/`) no cambian ningún requisito:
este change consume sus contratos y extiende dos de sus componentes de forma aditiva
(ver Impact), sin alterar el comportamiento que sus specs ya fijan.

## Impact

- **Depende de (agrupado para permitir implementación incremental):**
  - **Grupo A — reservar** (Inicio, Paso 1, Resultado, Tus datos, Reserva registrada):
    necesita `GET /zonas` y `GET /turnos` (`catalogo-publico`, spec en PR #44, sin
    implementación todavía) y `POST /reservas` (`reservas-crear`, implementación en PR #40
    abierto). `GET /disponibilidad` ya está mergeado.
  - **Grupo B — consultar** (pantalla de consulta y detalle): necesita
    `POST /reservas/consultar` (`reserva-consultar`, spec mergeada, implementación pendiente).
  - **Grupo C — cancelar** (confirmar cancelación y reserva cancelada, dentro de la misma
    pantalla de consulta): necesita `POST /reservas/{codigo}/cancelar`
    (`cancelacion-turnos`, spec mergeada, implementación pendiente) y, para el aviso de
    "todavía podés cancelar", los datos de `GET /zonas` del Grupo A.
  - **`frontend-base`**: layout, tokens, primitivas (`Button`, `Field`, `Input`, `Select`,
    `Card`, `Alert`, `Label`), cliente HTTP tipado (`apiClient`, `toApiResult`) y el proxy
    `/api`. Implementación en PR #43, todavía abierto.
  - El cliente HTTP tipado (D5 de `frontend-base`) solo tiene tipos para los paths presentes
    en `openapi/openapi.yaml` en el momento de regenerarlos: hasta que cada grupo mergee su
    implementación (y su fragmento OpenAPI pase de `design.md` al YAML), ese grupo no puede
    escribirse contra el cliente tipado real. `tasks.md` ordena el trabajo así, sin tipos a
    mano ni paths ficticios.
- **Desbloquea:** el flujo manual de punta a punta de `docs/roadmap-mvp.md` §13 (Fase 5) y
  `entrega-final`.
- **Código afectado (en la implementación):**
  - Nuevo: `frontend/app/reservas/nueva/`, `frontend/app/reservas/nueva/resultado/`,
    `frontend/app/reservas/nueva/datos/`, `frontend/app/reservas/nueva/exito/`,
    `frontend/app/reservas/consultar/`, componentes cliente de cada paso, utilidades puras de
    fecha/hora, y la primitiva `frontend/src/components/ui/dialog.tsx`.
  - Reescrito: `frontend/app/reservas/page.tsx` (placeholder → Inicio real).
  - Extendido (aditivo, sin romper su contrato ni sus tests actuales):
    `frontend/src/components/ui/button.tsx` (prop `size`),
    `frontend/src/components/layout/site-header.tsx` (enlace a consultar),
    `frontend/src/lib/api/errors.ts` y `client.ts` (mensajes en voseo).
- **API / `openapi/openapi.yaml`:** este change no modifica el contrato; consume los paths ya
  fijados en los `design.md` de `catalogo-publico`, `reservas-crear`, `reserva-consultar` y
  `cancelacion-turnos`, y los tipos que `openapi-typescript` genere una vez mergeados.
- **Base de datos:** sin cambios; el frontend no tiene schema propio.
- **Dependencias npm:** ninguna nueva. Fecha/hora se resuelve con `Date` e
  `Intl.DateTimeFormat` (nativos); el diálogo de confirmación usa el elemento `<dialog>`
  nativo. Se justifica en detalle en `design.md` frente a la alternativa de sumar una
  librería.
