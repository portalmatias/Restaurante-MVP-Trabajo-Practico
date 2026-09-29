import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { ErrorRespuesta } from '../disponibilidad/dto/error-respuesta.dto';
import { ListarTurnosPublicosDto } from './dto/listar-turnos-publicos.dto';
import { TurnoPublicoRespuestaDto } from './dto/turno-publico-respuesta.dto';
import { HorariosService } from './horarios.service';

/**
 * `GET /turnos`: catálogo público y de solo lectura de Turnos activos (change
 * `catalogo-publico`, D1). Vive en un controller aparte de `HorariosController` porque los
 * guards de ese son de clase; sin `@UseGuards`, ruta pública. Sin lógica (§7).
 */
/**
 * `@SkipThrottle()`: mismo argumento que `DisponibilidadController` (design.md D6): la ruta
 * no recibe un código de reserva ni expone datos personales.
 */
@SkipThrottle()
@ApiTags('turnos')
@Controller('turnos')
export class TurnosPublicosController {
  constructor(private readonly horariosService: HorariosService) {}

  @ApiOperation({
    summary: 'Catálogo público de Turnos activos',
    description:
      'Lista los Turnos con `activo: true`, ordenados por día de la semana (lunes a domingo) y, dentro del mismo día, por hora de inicio. Es una ruta pública, sin autenticación.',
  })
  @ApiOkResponse({
    description:
      'Listado de Turnos activos, opcionalmente filtrado por día de la semana. Una lista vacía responde `200`, no `404`.',
    type: [TurnoPublicoRespuestaDto],
  })
  @ApiBadRequestResponse({
    description: '`diaSemana` no es uno de los siete días válidos.',
    type: ErrorRespuesta,
  })
  @Get()
  listar(@Query() dto: ListarTurnosPublicosDto) {
    return this.horariosService.listarPublicos(dto.diaSemana);
  }
}
