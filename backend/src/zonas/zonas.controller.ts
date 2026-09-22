import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActualizarZonaDto } from './dto/actualizar-zona.dto';
import { ZonaRespuestaDto } from './dto/zona-respuesta.dto';
import { ZonasService } from './zonas.service';

/**
 * Solo lectura y actualización de configuración — spec: "Alta y baja de Zona no soportadas".
 * `Zona.nombre` es un enum fijo de dos valores, así que no hay `POST`/`DELETE`.
 */
@ApiTags('Zonas')
@ApiBearerAuth('bearerAuth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN)
@Controller('admin/zonas')
export class ZonasController {
  constructor(private readonly zonasService: ZonasService) {}

  @ApiOperation({
    summary: 'Listado de Zonas',
    description:
      'Lista las Zonas del salón — spec: "Alta y baja de Zona no soportadas", solo ' +
      'hay lectura y actualización de configuración.',
  })
  @ApiOkResponse({ type: [ZonaRespuestaDto], description: 'Listado de Zonas.' })
  @Get()
  listar() {
    return this.zonasService.listar();
  }

  @ApiOperation({
    summary: 'Actualizar configuración de una Zona',
    description:
      'Rechaza con 400 si, combinando los campos del body con los ya persistidos, ' +
      'el mínimo de comensales resultante queda por encima del máximo.',
  })
  @ApiOkResponse({
    type: ZonaRespuestaDto,
    description: 'La zona se actualizó.',
  })
  @ApiNotFoundResponse({ description: 'La zona indicada no existe.' })
  @ApiConflictResponse({
    description:
      'No se pudo actualizar la zona por una edición concurrente (conflicto de ' +
      'serialización agotando los reintentos).',
  })
  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarZonaDto,
  ) {
    return this.zonasService.actualizar(id, dto);
  }
}
