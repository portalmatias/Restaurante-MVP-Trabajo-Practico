## Why

El formulario de reserva del cliente (`frontend-cliente`, todavía no especificado) necesita los
`id` de zona y de turno: `GET /disponibilidad` y el futuro `POST /reservas` reciben `zonaId` y
`turnoId`, no un nombre. Hoy los únicos endpoints que listan Zonas y Turnos son
`GET /admin/zonas` y `GET /admin/turnos`, protegidos con `JwtAuthGuard` + `RolesGuard`
(`backend/src/zonas/zonas.controller.ts:33`, `backend/src/horarios/horarios.controller.ts:37`).
Un visitante sin cuenta no tiene JWT, así que no puede llamarlos. Ningún change del roadmap
cubre hoy un catálogo público de estos dos recursos.

**Alternativas descartadas:**
- **Hardcodear en el frontend los UUID del seed.** Los `id` son `@default(uuid())`: cambian en
  cada corrida del seed y en cada entorno. Además §6 prohíbe hardcodear los valores de
  configuración de Zona/Turno, y un `id` fijo en el código del frontend es el mismo problema.
- **Que el frontend llame a los endpoints de `/admin` con un token de servicio.** Exigiría
  emitir y distribuir credenciales de administrador al frontend público, exactamente lo que
  §5 evita al no requerir cuenta para el cliente ("Ningún endpoint público expone datos
  personales de otras reservas" aplica en espíritu también a credenciales de admin).

## What Changes

- Se agregan dos endpoints públicos y de solo lectura, sin autenticación: `GET /zonas` y
  `GET /turnos`.
- `GET /zonas` devuelve, por cada Zona, únicamente los campos que el formulario de reserva
  necesita para mostrar y validar la elección de zona: `id`, `nombre`, `minComensales`,
  `maxComensales`, `anticipacionMinHoras`, `anticipacionMaxDias`, `ventanaCancelacionHoras` y
  `requiereConfirmacionAdmin`. **No** expone `aforoMaximo` (dato operativo del salón, sin uso
  para el cliente) ni la relación `mesas` (inventario físico interno).
- `GET /turnos` devuelve, por cada Turno **activo** (`activo = true`), `id`, `diaSemana`,
  `horaInicio` y `horaFin`, ordenados de forma determinística por día de la semana y después
  por `horaInicio`. Acepta un filtro opcional por query `diaSemana`. No incluye Turnos
  inactivos ni el campo `activo` (todos los devueltos ya son `true`).
- Ninguno de los dos endpoints lleva rate limiting: igual que `GET /disponibilidad`
  (`backend/src/disponibilidad/disponibilidad.controller.ts:33`), no reciben un código de
  reserva ni exponen datos personales, así que no aplica la razón de §5 para el throttling.
- No hay cambios de schema, migraciones, variables de entorno ni dependencias nuevas: los dos
  endpoints leen `Zona` y `Turno`, ya existentes desde `modelo-dominio`, con Prisma.

### Fuera de alcance

- **El formulario de reserva en sí** (`frontend-cliente`): este change solo habilita el
  catálogo que ese formulario va a consumir.
- **Cualquier cambio a `GET /admin/zonas` o `GET /admin/turnos`**: siguen intactos, protegidos
  y con su forma de respuesta actual (incluye `aforoMaximo`/`activo`).
- **Alta, baja o edición de Zonas o Turnos**: ya resuelto por `gestion-salon`; este change es
  de solo lectura.

## Capabilities

### New Capabilities
- `catalogo-publico`: catálogo público y de solo lectura de Zonas y Turnos activos, sin
  autenticación, para que un cliente sin cuenta obtenga los `id` que necesita al consultar
  disponibilidad o crear una reserva.

### Modified Capabilities
_Ninguna._ No se modifica ningún requisito de `disponibilidad` (única spec archivada hoy en
`openspec/specs/`); este change solo agrega una forma nueva y más acotada de leer Zona y Turno,
ya existentes desde `modelo-dominio`.

## Impact

- **Depende de:** `modelo-dominio` (modelos `Zona` y `Turno`, ya mergeados) y `gestion-salon`
  (`ZonasService`/`HorariosService`, ya mergeados con `ZonasModule`/`HorariosModule`
  registrados en `AppModule`). No depende de `disponibilidad` ni de `reservas-crear`.
- **Desbloquea:** `frontend-cliente`, que necesita este catálogo para poblar el selector de
  zona y turno del formulario de reserva antes de poder llamar a `GET /disponibilidad`.
- **Código afectado (en la implementación):** un controller público nuevo por módulo
  (`backend/src/zonas/`, `backend/src/horarios/`) que reutiliza `ZonasService`/
  `HorariosService` existentes — ver `design.md` para la decisión de ubicación exacta y las
  alternativas descartadas —, DTOs de respuesta nuevos con `@nestjs/swagger`, y los tests
  correspondientes. No se toca `ZonasController` ni `HorariosController` (los admin), ni sus
  guards.
- **API / `openapi/openapi.yaml`:** agrega `GET /zonas` y `GET /turnos`. En este PR de spec el
  fragmento vive en `design.md`, no en el YAML (§3: `openapi:check` pondría CI en rojo con un
  path sin controller). Se copia al YAML en el PR de implementación, junto con los controllers.
- **Dependencias npm:** ninguna.
