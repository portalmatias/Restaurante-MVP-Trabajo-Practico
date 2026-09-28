import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActualizarTurnoDto } from './dto/actualizar-turno.dto';
import { CrearTurnoDto } from './dto/crear-turno.dto';
import { TurnoRespuestaDto } from './dto/turno-respuesta.dto';
import { HorariosService } from './horarios.service';

/**
 * Rutas bajo `/admin/turnos` (nombre de dominio, no `horarios` — ver design.md). `activo`
 * viaja en el mismo `PATCH` de edición que día/horario, sin una ruta aparte de
 * activar/desactivar (design.md, tasks.md 4.4).
 */
@ApiTags('Turnos')
@ApiBearerAuth('bearerAuth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN)
@Controller('admin/turnos')
export class HorariosController {
  constructor(private readonly horariosService: HorariosService) {}

  @ApiOperation({
    summary: 'Alta de Turno',
    description:
      'Si el body no especifica `activo`, el Turno queda `activo: true` por defecto.',
  })
  @ApiCreatedResponse({
    type: TurnoRespuestaDto,
    description: 'El turno se creó.',
  })
  @ApiConflictResponse({
    description: 'Ya existe un turno para ese día y esa hora de inicio.',
  })
  @Post()
  crear(@Body() dto: CrearTurnoDto) {
    return this.horariosService.crear(dto);
  }

  @ApiOperation({
    summary: 'Listado de Turnos',
    description: 'Incluye los Turnos inactivos.',
  })
  @ApiOkResponse({
    type: [TurnoRespuestaDto],
    description: 'Listado de Turnos, incluidos los inactivos.',
  })
  @Get()
  listar() {
    return this.horariosService.listar();
  }

  @ApiOperation({
    summary: 'Edición y activación/desactivación de Turno',
    description:
      '`activo` viaja en el mismo PATCH de edición que día/horario, sin una ruta ' +
      'aparte de activar/desactivar.',
  })
  @ApiOkResponse({
    type: TurnoRespuestaDto,
    description: 'El turno se actualizó.',
  })
  @ApiNotFoundResponse({ description: 'El turno indicado no existe.' })
  @ApiConflictResponse({
    description: 'Ya existe un turno para ese día y esa hora de inicio.',
  })
  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarTurnoDto,
  ) {
    return this.horariosService.actualizar(id, dto);
  }
}
