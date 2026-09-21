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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActualizarMesaDto } from './dto/actualizar-mesa.dto';
import { CrearMesaDto } from './dto/crear-mesa.dto';
import { ListarMesasQueryDto } from './dto/listar-mesas-query.dto';
import { MesasService } from './mesas.service';

@ApiTags('Mesas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN)
@Controller('admin/mesas')
export class MesasController {
  constructor(private readonly mesasService: MesasService) {}

  @Post()
  crear(@Body() dto: CrearMesaDto) {
    return this.mesasService.crear(dto);
  }

  @Get()
  listar(@Query() query: ListarMesasQueryDto) {
    return this.mesasService.listar(query.zonaId);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarMesaDto,
  ) {
    return this.mesasService.actualizar(id, dto);
  }

  /** `204 No Content` al eliminar — spec: "Baja de Mesa preserva las Reservas activas e históricas". */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.mesasService.eliminar(id);
  }
}
