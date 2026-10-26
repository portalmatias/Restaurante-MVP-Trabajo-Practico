import { Controller, Get, Header, Query } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';

import { ConsultarDisponibilidadDto } from '../disponibilidad/dto/consultar-disponibilidad.dto';
import { ErrorRespuesta } from '../disponibilidad/dto/error-respuesta.dto';
import { PlanoMesasRespuesta } from './dto/plano-mesas-respuesta.dto';
import { PlanoMesasService } from './plano-mesas.service';

/**
 * Límite propio de `GET /plano-mesas` (design.md D3, confirmado por el equipo el 26/10/2026):
 * 120 solicitudes por ventana de 60 segundos por origen. No es el global de `THROTTLE_LIMIT`
 * (rompería el uso normal: cambiar fecha, turno y comensales son varias consultas) ni
 * `@SkipThrottle()` como `/disponibilidad`, porque el plano hace más consultas a la base. Detrás
 * del proxy `/api` de Next todos los visitantes comparten este cupo.
 */
export const LIMITE_PLANO_MESAS = { limit: 120, ttl: 60_000 };

/**
 * `GET /plano-mesas` (change `plano-mesas`, design.md D2 y D3). Ruta pública de solo lectura:
 * el controller no tiene lógica, valida la query con el mismo DTO que `/disponibilidad` y
 * delega en el service.
 *
 * Los decoradores de este archivo son el otro lado de `openapi/openapi.yaml`:
 * `npm run openapi:check` compara literalmente los dos documentos, así que cualquier cambio de
 * texto acá tiene que ir también al YAML.
 */
@ApiTags('plano-mesas')
@Controller('plano-mesas')
export class PlanoMesasController {
  constructor(private readonly planoMesasService: PlanoMesasService) {}

  @ApiOperation({
    summary: 'Consultar el plano de mesas de una zona',
    description:
      'Devuelve el plano de una zona con el estado de cada mesa para una fecha, un turno y una cantidad de comensales: libre, ocupada o que no alcanza. Es informativo: no reserva ni bloquea nada y la mesa se asigna automáticamente al confirmar la reserva. Incluye el mismo veredicto que `GET /disponibilidad` (`disponible`, `lugaresRestantes`, `motivos`). No expone datos de las reservas, solo el estado de cada mesa. Es una ruta pública, sin autenticación, con límite de solicitudes.',
  })
  @ApiOkResponse({
    description:
      'La consulta es válida. Devuelve la grilla de la zona, el veredicto de disponibilidad y todas las mesas con su estado. Que no haya lugar no es un error.',
    type: PlanoMesasRespuesta,
    examples: {
      conLugar: {
        summary: 'STANDARD, 4 comensales, con la mesa S5 ocupada',
        value: {
          zona: 'STANDARD',
          columnas: 12,
          filas: 8,
          disponible: true,
          lugaresRestantes: 34,
          motivos: [],
          mesas: [
            {
              etiqueta: 'S1',
              capacidad: 2,
              forma: 'REDONDA',
              posX: 0,
              posY: 0,
              ancho: 1,
              alto: 1,
              estado: 'NO_ALCANZA',
            },
            {
              etiqueta: 'S3',
              capacidad: 4,
              forma: 'CUADRADA',
              posX: 5,
              posY: 0,
              ancho: 2,
              alto: 2,
              estado: 'LIBRE',
            },
            {
              etiqueta: 'S5',
              capacidad: 8,
              forma: 'RECTANGULAR',
              posX: 5,
              posY: 3,
              ancho: 4,
              alto: 2,
              estado: 'OCUPADA',
            },
            {
              etiqueta: 'S6',
              capacidad: 4,
              forma: 'RECTANGULAR',
              posX: null,
              posY: null,
              ancho: 1,
              alto: 1,
              estado: 'LIBRE',
            },
          ],
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'La consulta está mal formada: falta un parámetro, la fecha no es `YYYY-MM-DD` o no existe, un id no es UUID, o `comensales` no es un entero mayor o igual a 1.',
    type: ErrorRespuesta,
  })
  @ApiNotFoundResponse({
    description: 'El turno o la zona indicados no existen.',
    type: ErrorRespuesta,
  })
  @ApiTooManyRequestsResponse({
    description:
      'Se superó el límite de consultas del plano en la ventana configurada. Se rechaza antes de validar la consulta y de leer la base.',
    type: ErrorRespuesta,
  })
  @SkipThrottle({ default: false })
  @Throttle({ default: LIMITE_PLANO_MESAS })
  @Header('Cache-Control', 'no-store')
  @Get()
  consultar(
    @Query() query: ConsultarDisponibilidadDto,
  ): Promise<PlanoMesasRespuesta> {
    return this.planoMesasService.consultar(query);
  }
}
