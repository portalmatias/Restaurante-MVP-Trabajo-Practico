import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ErrorRespuesta } from '../disponibilidad/dto/error-respuesta.dto';
import { ListadoReservasRespuesta } from './dto/listado-reservas-respuesta.dto';
import { ListarReservasDto } from './dto/listar-reservas.dto';
import { ReservasService } from './reservas.service';

/**
 * `GET /admin/reservas` (design.md D6, D7 y D8 de `reserva-consultar`).
 *
 * **Por qué es un controller separado de `ReservasController`.** El diseño original
 * planeaba esta ruta dentro de `ReservasController` (`@Controller('reservas')`), pero eso es
 * técnicamente imposible en NestJS: el prefijo de `@Controller()` se aplica a **toda** la
 * clase, y ningún decorador de método puede pedirle a esa clase que ignore su propio
 * prefijo. `GET /admin/reservas` necesita vivir bajo `/admin/reservas`, no bajo
 * `/reservas/admin/reservas`. Se descubrió al implementar (no lo detectó la revisión de la
 * spec) — corregido acá y en `design.md`.
 *
 * El `operationId` se fija explícito como `ReservasController_listar` (en vez del
 * `ReservasAdminController_listar` que generaría Swagger por default) para no romper el
 * contrato ya publicado en `openapi/openapi.yaml`: la ruta sigue siendo conceptualmente
 * parte de la capability `Reservas`, la división en dos archivos es un detalle de
 * implementación de NestJS, no del contrato.
 *
 * La misma restricción de NestJS aplica a las demás rutas bajo `/admin/reservas/...` que
 * agregaron después `cancelacion-turnos` (`PATCH .../no-show`) y `reserva-vip`
 * (`PATCH .../confirmar`, `.../rechazar`): todas viven en esta clase, no en
 * `ReservasController`.
 */
@ApiTags('Reservas')
@ApiBearerAuth('bearerAuth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN)
@Controller('admin/reservas')
export class ReservasAdminController {
  constructor(private readonly reservasService: ReservasService) {}

  /**
   * `@SkipThrottle({ default: false })` + `@Throttle(...)`: un límite propio de 60
   * solicitudes por minuto (D7) — el default global (10) es demasiado bajo para un panel
   * que pagina y cambia filtros. Esta clase no hereda el `@SkipThrottle()` sin argumentos de
   * `ReservasController` (son clases distintas), así que en principio ya estaría sujeta al
   * límite global; el `@SkipThrottle({ default: false })` queda de todos modos, explícito,
   * para que la intención no dependa de ese detalle.
   */
  @SkipThrottle({ default: false })
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    operationId: 'ReservasController_listar',
    summary: 'Listar reservas',
    description:
      'Lista las reservas con sus datos de contacto, la mesa y el identificador que usan las demás rutas de admin. Se puede filtrar por fecha, estado, zona y turno; los filtros se combinan todos juntos. El orden es cronológico (fecha, hora de inicio del turno, fecha de creación, identificador) y está paginado. Un filtro con un identificador inexistente devuelve una lista vacía. Requiere un JWT de rol `ADMIN` y tiene un límite de solicitudes por cliente.',
  })
  @ApiQuery({
    name: 'fecha',
    required: false,
    type: String,
    description:
      'Fecha de calendario local del restaurante, sin hora (`YYYY-MM-DD`).',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: ['PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'NO_SHOW'],
    description: 'Estado de la reserva.',
  })
  @ApiQuery({
    name: 'zonaId',
    required: false,
    type: String,
    description: 'Id de la zona. Un id inexistente devuelve una lista vacía.',
  })
  @ApiQuery({
    name: 'turnoId',
    required: false,
    type: String,
    description: 'Id del turno. Un id inexistente devuelve una lista vacía.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'integer',
    minimum: 1,
    maximum: 100,
    example: 20,
    description: 'Cantidad máxima de reservas por página.',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: 'integer',
    minimum: 0,
    example: 0,
    description: 'Cantidad de reservas a saltear desde el inicio del listado.',
  })
  @ApiOkResponse({
    type: ListadoReservasRespuesta,
    description:
      'Página de reservas. Si ninguna cumple los filtros, `items` viene vacío y `total` es 0.',
  })
  @ApiBadRequestResponse({
    type: ErrorRespuesta,
    description:
      'Un filtro está mal formado: la fecha no es `YYYY-MM-DD` o no existe, el estado no es uno de los cuatro, un id no es UUID, `limit` u `offset` están fuera de rango, o hay parámetros no declarados.',
  })
  @ApiUnauthorizedResponse({
    type: ErrorRespuesta,
    description: 'Token ausente, inválido o expirado.',
  })
  @ApiForbiddenResponse({
    type: ErrorRespuesta,
    description: 'Token válido sin rol `ADMIN`.',
  })
  @ApiTooManyRequestsResponse({
    description:
      'Se superó el límite de solicitudes al listado en la ventana configurada.',
  })
  @Get()
  async listar(
    @Query() query: ListarReservasDto,
  ): Promise<ListadoReservasRespuesta> {
    return this.reservasService.listar(query);
  }

  /**
   * `PATCH /admin/reservas/:id/no-show` (capability `cancelacion-turnos`, design.md
   * "Rutas"). Marca `NO_SHOW` solo si la Reserva está `CONFIRMADA` y su Turno ya terminó
   * (`ReservasService.marcarNoShow`); `204` sin cuerpo al completarse, igual que las bajas
   * de `gestion-salon`. Sin throttling propio: usa el límite global de la app, a diferencia
   * de `listar` (que sí necesita uno más alto por ser un panel que pagina y filtra).
   *
   * `operationId` fijado explícito como `ReservasController_marcarNoShow` (en vez del
   * `ReservasAdminController_marcarNoShow` que generaría Swagger por default): mismo
   * criterio que ya usa `listar` para `ReservasController_listar` — la división en dos
   * controllers es un detalle de implementación de NestJS, no del contrato.
   */
  @ApiOperation({
    operationId: 'ReservasController_marcarNoShow',
    summary: 'Marcar una reserva como ausente (NO_SHOW)',
    description:
      'Transiciona una reserva CONFIRMADA a NO_SHOW. Rechaza con 409 si la reserva no está CONFIRMADA o si su turno todavía no terminó (el instante exacto de fin también se rechaza). Requiere un JWT de rol ADMIN.',
  })
  @ApiNoContentResponse({
    description: 'Reserva marcada NO_SHOW; respuesta sin cuerpo.',
  })
  @ApiBadRequestResponse({
    type: ErrorRespuesta,
    description: 'El identificador de la reserva no es un UUID válido.',
  })
  @ApiUnauthorizedResponse({
    type: ErrorRespuesta,
    description: 'Token ausente, inválido o expirado.',
  })
  @ApiForbiddenResponse({
    type: ErrorRespuesta,
    description: 'Token válido sin rol ADMIN.',
  })
  @ApiNotFoundResponse({
    type: ErrorRespuesta,
    description: 'La reserva indicada no existe.',
  })
  @ApiConflictResponse({
    type: ErrorRespuesta,
    description:
      'La reserva no está CONFIRMADA, o su turno todavía no terminó.',
  })
  @Patch(':id/no-show')
  @HttpCode(HttpStatus.NO_CONTENT)
  async marcarNoShow(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.reservasService.marcarNoShow(id);
  }

  /**
   * `PATCH /admin/reservas/:id/confirmar` (capability `reserva-vip`, design.md "Rutas").
   * Transiciona una Reserva `PENDIENTE` a `CONFIRMADA` (`ReservasService.confirmar`), sin
   * revalidar aforo ni Mesa. `operationId` fijado explícito, mismo criterio que `listar` y
   * `marcarNoShow`.
   */
  @ApiOperation({
    operationId: 'ReservasController_confirmar',
    summary: 'Confirmar una reserva pendiente',
    description:
      'Transiciona una reserva PENDIENTE a CONFIRMADA. Rechaza con 409 si la reserva no está PENDIENTE. No revalida aforo ni disponibilidad de mesa. Requiere un JWT de rol ADMIN.',
  })
  @ApiNoContentResponse({
    description: 'Reserva confirmada; respuesta sin cuerpo.',
  })
  @ApiBadRequestResponse({
    type: ErrorRespuesta,
    description: 'El identificador de la reserva no es un UUID válido.',
  })
  @ApiUnauthorizedResponse({
    type: ErrorRespuesta,
    description: 'Token ausente, inválido o expirado.',
  })
  @ApiForbiddenResponse({
    type: ErrorRespuesta,
    description: 'Token válido sin rol ADMIN.',
  })
  @ApiNotFoundResponse({
    type: ErrorRespuesta,
    description: 'La reserva indicada no existe.',
  })
  @ApiConflictResponse({
    type: ErrorRespuesta,
    description: 'La reserva no está PENDIENTE.',
  })
  @Patch(':id/confirmar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.reservasService.confirmar(id);
  }

  /**
   * `PATCH /admin/reservas/:id/rechazar` (capability `reserva-vip`, design.md "Rutas").
   * Transiciona una Reserva `PENDIENTE` a `CANCELADA` (`ReservasService.rechazar`). A
   * diferencia de `POST /reservas/:codigo/cancelar` (cliente), solo acepta Reservas
   * `PENDIENTE`: una Reserva ya `CONFIRMADA` responde `409`, no se rechaza silenciosamente
   * como si fuera una cancelación.
   */
  @ApiOperation({
    operationId: 'ReservasController_rechazar',
    summary: 'Rechazar una reserva pendiente',
    description:
      'Transiciona una reserva PENDIENTE a CANCELADA. Rechaza con 409 si la reserva no está PENDIENTE (a diferencia de la cancelación del cliente, no acepta reservas CONFIRMADA). Requiere un JWT de rol ADMIN.',
  })
  @ApiNoContentResponse({
    description: 'Reserva rechazada; respuesta sin cuerpo.',
  })
  @ApiBadRequestResponse({
    type: ErrorRespuesta,
    description: 'El identificador de la reserva no es un UUID válido.',
  })
  @ApiUnauthorizedResponse({
    type: ErrorRespuesta,
    description: 'Token ausente, inválido o expirado.',
  })
  @ApiForbiddenResponse({
    type: ErrorRespuesta,
    description: 'Token válido sin rol ADMIN.',
  })
  @ApiNotFoundResponse({
    type: ErrorRespuesta,
    description: 'La reserva indicada no existe.',
  })
  @ApiConflictResponse({
    type: ErrorRespuesta,
    description: 'La reserva no está PENDIENTE.',
  })
  @Patch(':id/rechazar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async rechazar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.reservasService.rechazar(id);
  }
}
