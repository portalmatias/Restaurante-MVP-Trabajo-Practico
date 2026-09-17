import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { DisponibilidadService } from './disponibilidad.service';
import { ConsultarDisponibilidadDto } from './dto/consultar-disponibilidad.dto';
import { DisponibilidadRespuesta } from './dto/disponibilidad-respuesta.dto';
import { ErrorRespuesta } from './dto/error-respuesta.dto';

/**
 * `GET /disponibilidad` (design.md D1, D3 y D8). El controller no tiene lógica: valida la
 * query con el DTO y delega en el service.
 *
 * Los decoradores de este archivo son el otro lado de `openapi/openapi.yaml`:
 * `npm run openapi:check` compara literalmente los dos documentos (D2 de `fundacion-repo`),
 * así que cualquier cambio de texto acá tiene que ir también al YAML.
 */
@ApiTags('disponibilidad')
@Controller('disponibilidad')
export class DisponibilidadController {
  constructor(private readonly disponibilidadService: DisponibilidadService) {}

  @ApiOperation({
    summary: 'Consultar disponibilidad',
    description:
      'Indica si hay lugar para una cantidad de comensales en una fecha, un turno y una zona. Consulta una sola combinación y es una foto del momento: no reserva ni bloquea nada, y la validación real ocurre al crear la reserva. Evalúa siempre todas las reglas y devuelve todas las que fallan. Que no haya lugar no es un error: la respuesta es `200` con `disponible` en `false`. Es una ruta pública, sin autenticación.',
  })
  @ApiOkResponse({
    description:
      'La consulta es válida. Informa si hay lugar, cuántos comensales entran todavía y, si no hay lugar, todos los motivos.',
    type: DisponibilidadRespuesta,
    examples: {
      disponible: {
        summary: 'Hay lugar (STANDARD, 4 comensales, pasado mañana)',
        value: {
          disponible: true,
          lugaresRestantes: 40,
          motivos: [],
        },
      },
      noDisponible: {
        summary: 'No hay lugar (VIP, 1 comensal, almuerzo de mañana)',
        value: {
          disponible: false,
          lugaresRestantes: 20,
          motivos: [
            {
              codigo: 'ANTICIPACION_MINIMA',
              mensaje:
                'En la zona VIP se reserva con al menos 24 horas de anticipación.',
            },
            {
              codigo: 'COMENSALES_FUERA_DE_RANGO',
              mensaje: 'La zona VIP admite de 2 a 12 comensales por reserva.',
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
    examples: {
      parametrosInvalidos: {
        summary: 'Fecha con hora y comensales en cero',
        value: {
          statusCode: 400,
          message: [
            'fecha debe ser una fecha de calendario con formato YYYY-MM-DD, sin hora',
            'comensales debe ser un número entero mayor o igual a 1',
          ],
          error: 'Bad Request',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'El turno o la zona indicados no existen.',
    type: ErrorRespuesta,
    examples: {
      turnoInexistente: {
        summary: 'El turno no existe',
        value: {
          statusCode: 404,
          message:
            'No existe un turno con id 3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73',
          error: 'Not Found',
        },
      },
      zonaInexistente: {
        summary: 'La zona no existe',
        value: {
          statusCode: 404,
          message:
            'No existe una zona con id b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19',
          error: 'Not Found',
        },
      },
    },
  })
  @Get()
  consultar(
    @Query() query: ConsultarDisponibilidadDto,
  ): Promise<DisponibilidadRespuesta> {
    // El controller no evalúa reglas ni consulta la base (design.md D1).
    return this.disponibilidadService.consultar(query);
  }
}
