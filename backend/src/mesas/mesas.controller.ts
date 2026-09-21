import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiConflictResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActualizarMesaDto } from './dto/actualizar-mesa.dto';
import { CrearMesaDto } from './dto/crear-mesa.dto';
import { ListarMesasQueryDto } from './dto/listar-mesas-query.dto';
import { MesaRespuestaDto } from './dto/mesa-respuesta.dto';
import { MesasService } from './mesas.service';

@ApiTags('Mesas')
@ApiBearerAuth('bearerAuth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN)
@Controller('admin/mesas')
export class MesasController {
  constructor(private readonly mesasService: MesasService) {}

  @ApiOperation({
    summary: 'Alta de Mesa',
    description: 'Rechaza con 404 si la Zona indicada no existe.',
  })
  @ApiCreatedResponse({
    type: MesaRespuestaDto,
    description: 'La mesa se creó.',
  })
  @ApiNotFoundResponse({ description: 'La zona indicada no existe.' })
  @Post()
  crear(@Body() dto: CrearMesaDto) {
    return this.mesasService.crear(dto);
  }

  /**
   * `@Query() query: ListarMesasQueryDto` por sí solo no genera el parámetro en el
   * contrato OpenAPI (el proyecto no usa el plugin CLI de `@nestjs/swagger` que infiere
   * query DTOs vía reflection) — `@ApiQuery` explícito es necesario para documentarlo.
   */
  @ApiOperation({
    summary: 'Listado de Mesas',
    description: 'Sin `zonaId` devuelve todas las Mesas de todas las Zonas.',
  })
  @ApiQuery({
    name: 'zonaId',
    required: false,
    type: String,
    description: 'Filtra las Mesas devueltas por Zona.',
  })
  @ApiOkResponse({
    type: [MesaRespuestaDto],
    description: 'Listado de Mesas, opcionalmente filtrado por Zona.',
  })
  @Get()
  listar(@Query() query: ListarMesasQueryDto) {
    return this.mesasService.listar(query.zonaId);
  }

  @ApiOperation({
    summary: 'Edición de Mesa',
    description:
      'Rechaza con 409 si el cambio dejaría inválida una Reserva activa existente ' +
      '(capacidad insuficiente o Zona distinta) — spec: "Edición de Mesa preserva ' +
      'las Reservas activas".',
  })
  @ApiOkResponse({
    type: MesaRespuestaDto,
    description: 'La mesa se actualizó.',
  })
  @ApiNotFoundResponse({ description: 'La mesa o la zona indicada no existe.' })
  @ApiConflictResponse({
    description:
      'La mesa tiene una reserva activa con más comensales que la nueva capacidad, o ' +
      'reservas activas que impiden cambiarla de zona.',
  })
  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarMesaDto,
  ) {
    return this.mesasService.actualizar(id, dto);
  }

  /** `204 No Content` al eliminar — spec: "Baja de Mesa preserva las Reservas activas e históricas". */
  @ApiOperation({
    summary: 'Baja de Mesa',
    description:
      'Elimina físicamente la Mesa solo si no tiene ninguna Reserva asociada, de ' +
      'ningún estado — spec: "Baja de Mesa preserva las Reservas activas e ' +
      'históricas".',
  })
  @ApiNoContentResponse({
    description: 'La mesa se eliminó, sin cuerpo en la respuesta.',
  })
  @ApiNotFoundResponse({ description: 'La mesa indicada no existe.' })
  @ApiConflictResponse({
    description:
      'La mesa tiene reservas asociadas de cualquier estado (PENDIENTE, CONFIRMADA, ' +
      'CANCELADA o NO_SHOW): no se puede eliminar.',
  })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.mesasService.eliminar(id);
  }
}
