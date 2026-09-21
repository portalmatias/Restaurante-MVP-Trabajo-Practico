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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActualizarTurnoDto } from './dto/actualizar-turno.dto';
import { CrearTurnoDto } from './dto/crear-turno.dto';
import { HorariosService } from './horarios.service';

/**
 * Rutas bajo `/admin/turnos` (nombre de dominio, no `horarios` — ver design.md). `activo`
 * viaja en el mismo `PATCH` de edición que día/horario, sin una ruta aparte de
 * activar/desactivar (design.md, tasks.md 4.4).
 */
@ApiTags('Turnos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN)
@Controller('admin/turnos')
export class HorariosController {
  constructor(private readonly horariosService: HorariosService) {}

  @Post()
  crear(@Body() dto: CrearTurnoDto) {
    return this.horariosService.crear(dto);
  }

  @Get()
  listar() {
    return this.horariosService.listar();
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarTurnoDto,
  ) {
    return this.horariosService.actualizar(id, dto);
  }
}
