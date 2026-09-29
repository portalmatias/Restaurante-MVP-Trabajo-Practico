import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { ZonaPublicaRespuestaDto } from './dto/zona-publica-respuesta.dto';
import { ZonasService } from './zonas.service';

/**
 * `GET /zonas`: catálogo público y de solo lectura (change `catalogo-publico`, D1). Vive en
 * un controller aparte de `ZonasController` porque los guards de ese son de clase; sin
 * `@UseGuards`, ruta pública. El controller no tiene lógica (§7): delega en el service.
 */
/**
 * `@SkipThrottle()`: mismo argumento que `DisponibilidadController` (design.md D6).
 * `config.yaml` §5 pide throttling para las rutas que reciben un código de reserva, como
 * defensa contra la enumeración por fuerza bruta; esta ruta no recibe ninguno ni expone
 * datos personales de una reserva.
 */
@SkipThrottle()
@ApiTags('zonas')
@Controller('zonas')
export class ZonasPublicasController {
  constructor(private readonly zonasService: ZonasService) {}

  @ApiOperation({
    summary: 'Catálogo público de Zonas',
    description:
      'Lista todas las Zonas con los campos no sensibles que necesita el formulario de reserva del cliente, ordenadas por nombre (`STANDARD` antes que `VIP`). No incluye `aforoMaximo` ni las Mesas de la zona. Es una ruta pública, sin autenticación.',
  })
  @ApiOkResponse({
    description: 'Listado de Zonas. Una lista vacía responde `200`, no `404`.',
    type: [ZonaPublicaRespuestaDto],
  })
  @Get()
  listar() {
    return this.zonasService.listarPublicas();
  }
}
