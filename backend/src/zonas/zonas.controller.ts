import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActualizarZonaDto } from './dto/actualizar-zona.dto';
import { ZonasService } from './zonas.service';

/**
 * Solo lectura y actualización de configuración — spec: "Alta y baja de Zona no soportadas".
 * `Zona.nombre` es un enum fijo de dos valores, así que no hay `POST`/`DELETE`.
 */
@ApiTags('Zonas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN)
@Controller('admin/zonas')
export class ZonasController {
  constructor(private readonly zonasService: ZonasService) {}

  @Get()
  listar() {
    return this.zonasService.listar();
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarZonaDto,
  ) {
    return this.zonasService.actualizar(id, dto);
  }
}
