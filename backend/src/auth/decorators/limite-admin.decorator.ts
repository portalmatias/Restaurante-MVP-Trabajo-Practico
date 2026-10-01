import { applyDecorators } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';

/**
 * Límite de solicitudes común a todas las rutas de administración (D1 y D2 de
 * `throttle-rutas-admin`): 60 solicitudes por ventana de 60 segundos, contadas por ruta y por
 * origen. Es el mismo valor que D7 de `reserva-consultar` ya había fijado para
 * `GET /admin/reservas`, ahora declarado una sola vez para todo el panel.
 *
 * Se aplica **a nivel de clase**, junto a `@UseGuards(JwtAuthGuard, RolesGuard)` y `@Roles`:
 * el reflector de `@nestjs/throttler` usa `getAllAndOverride([handler, classRef])`, así que
 * vale para todos los métodos del controller, incluidos los que se agreguen después. **Todo
 * controller nuevo bajo `/admin/...` tiene que usarlo**: sin él, sus rutas vuelven al límite
 * global de `THROTTLE_LIMIT`, que es lo que les pasó a las 12 operaciones que corrige este
 * change.
 *
 * - `SkipThrottle({ default: false })` deja explícito que estas rutas sí pasan por el
 *   throttler `default`, aunque alguna clase base o un decorador futuro pidiera saltearlo.
 * - `Throttle(...)` reemplaza el límite global solo para estas rutas. El número no sale de
 *   variables de entorno a propósito (D2): es un valor del sitio de llamada, igual que el
 *   `5` del login, y el spec lo fija como verificable.
 *
 * No relaja ninguna ruta accesible sin token: el login (`5/min`) y las rutas públicas con
 * código de reserva (límite global) no usan este decorador.
 */
export const LimiteAdmin = () =>
  applyDecorators(
    SkipThrottle({ default: false }),
    Throttle({ default: { limit: 60, ttl: 60_000 } }),
  );

/**
 * Descripción de la respuesta `429` que declara cada operación alcanzada por `LimiteAdmin()`
 * (`design.md` de `throttle-rutas-admin` → "Contrato OpenAPI"). Tiene que coincidir letra por
 * letra con la de `openapi/openapi.yaml`: `openapi:check` compara `paths` literalmente.
 * `GET /admin/reservas` conserva la suya, que ya estaba publicada antes de este change.
 */
export const DESCRIPCION_429_ADMIN =
  'Se superó el límite de solicitudes a esta ruta en la ventana configurada. Se rechaza antes de validar el token y el body.';
