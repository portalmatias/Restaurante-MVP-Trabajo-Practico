## Why

En el paso 2 de la reserva (`/reservas/nueva/resultado`) el cliente solo se entera de si hay
lugar y cuántos comensales entran (`GET /disponibilidad`: `disponible`, `lugaresRestantes`,
`motivos`). No ve el salón. Para un restaurante de omakase como Ichigo, donde la barra, las
mesas bajas y el sector VIP son parte de la experiencia, poder mirar el salón y ver qué mesas
están libres, cuáles ocupadas y cuáles no alcanzan para su grupo da confianza y ayuda a
entender por qué "hay lugar" o "no hay lugar".

Hoy no existe nada que lo permita: `Mesa` solo tiene `id`, `zonaId`, `capacidad` y `etiqueta`
(no hay posición ni forma), y ningún endpoint público dice **qué mesa** está libre (la API
solo agrega la ocupación en un número). Hay que modelar el plano, exponerlo de forma pública
sin filtrar datos de terceros y dibujarlo de forma accesible.

## What Changes

- **Modelo de datos** (migración aditiva y compatible hacia atrás): `Mesa` suma posición en
  una grilla lógica (`posX`, `posY`, opcionales), tamaño (`ancho`, `alto`) y `forma`; `Zona`
  suma las dimensiones de su grilla (`planoColumnas`, `planoFilas`). Las mesas existentes y las
  que cree el admin sin posición siguen funcionando: simplemente no se dibujan y aparecen
  como "sin ubicar" en la lista textual.
- **Seed**: define un layout inicial razonable para las 5 mesas STANDARD y las 4 VIP.
- **Nuevo endpoint público de solo lectura** `GET /plano-mesas` (parámetros `fecha`, `turnoId`,
  `zonaId`, `comensales`) que devuelve las dimensiones del plano de la zona, las mesas con
  etiqueta, capacidad, posición, forma y estado `LIBRE | OCUPADA | NO_ALCANZA`, y el mismo
  veredicto de disponibilidad que `GET /disponibilidad` (`disponible`, `lugaresRestantes`,
  `motivos`). Reutiliza `cargarContexto`, `evaluarReglas` y `calcularLugaresRestantes`
  (`backend/src/disponibilidad/`): el plano deriva el estado de cada mesa de la misma lista
  `mesasLibres` que usan la regla `SIN_MESA_DISPONIBLE` y el *best fit* de la creación, de modo
  que no puede contradecir a la reserva real.
- **Seguridad**: la respuesta no incluye ids de reservas, códigos, nombres, emails, teléfonos
  ni cantidad de comensales por mesa; solo el estado. Tiene límite de solicitudes propio y
  `Cache-Control: no-store`.
- **Frontend**: en `/reservas/nueva/resultado` se agrega el plano de la zona elegida con la
  estética Kakefuda existente (tablillas de madera, tokens de `frontend/app/globals.css`), con
  alternativa textual en lista, sin depender solo del color, compatible con
  `prefers-reduced-motion`, legible en celular y con estados de carga, error y `429`.
- **Contrato**: `openapi/openapi.yaml` incorpora `GET /plano-mesas` y sus esquemas; el cliente
  tipado del frontend se regenera (`npm run api:types`).
- **No** cambia ninguna regla de negocio ni la asignación: sigue siendo automática (*best fit*)
  al confirmar la reserva. El plano es **informativo**.

## Capabilities

### New Capabilities
- `plano-mesas`: consulta pública del plano de una zona con el estado de cada mesa para una
  fecha, un turno y una cantidad de comensales, y su presentación accesible en el paso 2 de la
  reserva.

### Modified Capabilities
- `modelo-dominio`: se agregan, como requisitos nuevos, la posición/forma de las mesas y las
  dimensiones del plano de la zona, con sus valores por defecto y su carga en el seed. No se
  modifica ningún requisito existente (la `Entidad Mesa` conserva sus campos).

## Non-goals

- **Elegir la mesa desde el plano.** Cambiaría invariantes de negocio (ver `design.md`, D9 y
  pregunta abierta 1): hoy la mesa nunca llega en el input de la reserva.
- Editor de plano para el admin (queda como change siguiente; ver `design.md`, D6).
- Combinar mesas, rotación de mesas dentro de un turno o varios pisos.
- Mostrar quién ocupa una mesa o cuántos comensales tiene (dato de terceros).

## Impact

- **Backend**: nuevo módulo `plano-mesas` (controller, service, DTOs), migración Prisma,
  cambios en `prisma/seed.ts`; `DisponibilidadModule` ya exporta lo necesario (se agrega la
  exportación de los helpers si hiciera falta).
- **Contrato**: `openapi/openapi.yaml` (+1 path, +3 esquemas); `openapi:check` y
  `openapi:lint` deben seguir en verde.
- **Frontend**: `resultado/page.tsx`, componente nuevo de plano, `schema.d.ts` regenerado.
- **Sin** variables de entorno nuevas, **sin** dependencias nuevas, **sin** cambios en
  `.github/workflows/`.
