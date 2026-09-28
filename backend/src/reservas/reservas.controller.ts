import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  fechaCalendarioAIso,
  fechaCalendarioDesdeIso,
} from '../common/timezone';
import { ErrorRespuesta } from '../disponibilidad/dto/error-respuesta.dto';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { ReservaCreadaRespuesta } from './dto/reserva-creada-respuesta.dto';
import { ReservaRechazadaRespuesta } from './dto/reserva-rechazada-respuesta.dto';
import { ReservasService } from './reservas.service';

/**
 * `POST /reservas` (design.md D1, D2 de `fundacion-repo`). El controller no tiene lógica de
 * negocio (§7): valida el body con `CrearReservaDto` y delega en `ReservasService.crearReserva`.
 *
 * Los decoradores de este archivo son el otro lado de `openapi/openapi.yaml`:
 * `npm run openapi:check` compara literalmente los dos documentos, así que cualquier cambio de
 * texto acá tiene que ir también al YAML.
 */
/**
 * `@SkipThrottle()`: igual razón que `DisponibilidadController` (misma línea de código, que
 * también documenta esta decisión). `auth-admin` registró `ThrottlerGuard` como `APP_GUARD`
 * global (`THROTTLE_LIMIT` peticiones por `THROTTLE_TTL`), pero config.yaml §5 solo exige
 * throttling para las rutas que reciben un código de reserva de baja entropía (consulta y
 * cancelación) como defensa contra la enumeración por fuerza bruta. Crear una reserva no recibe
 * ningún código: lo genera. El design.md de este change deja la limitación de esta ruta
 * explícitamente en Open Questions, así que hoy no debe quedar acotada por el límite genérico
 * del admin.
 */
@SkipThrottle()
@ApiTags('Reservas')
@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  @ApiOperation({
    summary: 'Crear una reserva',
    description:
      'Crea una reserva sin cuenta para una fecha, un turno, una zona y una cantidad de comensales. Evalúa las mismas reglas que la consulta de disponibilidad en el momento de crear, asigna automáticamente la mesa libre más chica que alcance y genera el código de reserva. Queda `PENDIENTE` si la zona requiere confirmación del admin y `CONFIRMADA` si no. El cliente no elige mesa, estado ni código: si los manda, se responde 400. Es una ruta pública, sin autenticación.',
    security: [],
  })
  @ApiCreatedResponse({
    type: ReservaCreadaRespuesta,
    description:
      'Reserva creada. Devuelve el código que el cliente usa para consultarla o cancelarla.',
    examples: {
      standard: {
        summary: 'STANDARD, queda confirmada',
        value: {
          codigoReserva: 'K7PM3QXA',
          estado: 'CONFIRMADA',
          fecha: '2026-09-19',
          turnoId: '3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73',
          zonaId: 'b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19',
          comensales: 4,
        },
      },
      vip: {
        summary: 'VIP, queda pendiente de confirmación',
        value: {
          codigoReserva: 'R2WN8HDE',
          estado: 'PENDIENTE',
          fecha: '2026-09-19',
          turnoId: '3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73',
          zonaId: '5d2a9c41-7e3b-4f6a-a1d8-0c9b2e7f4a63',
          comensales: 6,
        },
      },
    },
  })
  @ApiBadRequestResponse({
    type: ErrorRespuesta,
    description:
      'El body está mal formado: falta un campo, la fecha no es `YYYY-MM-DD` o no existe, un id no es UUID, `comensales` no es un entero mayor o igual a 1, el email no es válido o el nombre o el teléfono están vacíos o son demasiado largos, o el body trae un campo que no es de los siete (por ejemplo `mesaId` o `estado`).',
    examples: {
      bodyInvalido: {
        summary: 'Email inválido y comensales en cero',
        value: {
          statusCode: 400,
          message: [
            'emailCliente debe ser un email válido',
            'comensales debe ser un número entero mayor o igual a 1',
          ],
          error: 'Bad Request',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    type: ErrorRespuesta,
    description: 'El turno o la zona indicados no existen.',
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
    },
  })
  @ApiConflictResponse({
    type: ReservaRechazadaRespuesta,
    description:
      'No se pudo crear la reserva. Si alguna regla de negocio lo impide, `motivos` trae todas las que fallan, en el mismo orden y con los mismos códigos que la consulta de disponibilidad. Si el problema fue un choque con otras reservas hechas al mismo tiempo, `motivos` puede venir vacío y conviene reintentar.',
    examples: {
      reglas: {
        summary: 'Anticipación y comensales fuera de rango en VIP',
        value: {
          statusCode: 409,
          message: 'No se pudo crear la reserva',
          error: 'Conflict',
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
      concurrencia: {
        summary: 'Demasiadas reservas simultáneas para ese turno',
        value: {
          statusCode: 409,
          message:
            'Hay muchas reservas en curso para ese turno y esa fecha. Intentá de nuevo en unos segundos.',
          error: 'Conflict',
          motivos: [],
        },
      },
    },
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crear(@Body() dto: CrearReservaDto): Promise<ReservaCreadaRespuesta> {
    // El input se arma campo por campo desde el DTO (design.md D6): así `mesaId`, `estado` o
    // `codigoReserva` del body nunca llegan al service, aunque en la práctica el
    // `ValidationPipe` global (`whitelist` + `forbidNonWhitelisted`) ya los rechaza antes con
    // `400`. `fecha` se convierte con `Date.UTC`, igual que `cargarContexto` (Trampas de
    // fechas): nunca con `new Date(dto.fecha)`, que dependería de la zona horaria del proceso.
    const reserva = await this.reservasService.crearReserva({
      turnoId: dto.turnoId,
      zonaId: dto.zonaId,
      fecha: fechaCalendarioDesdeIso(dto.fecha),
      comensales: dto.comensales,
      nombreCliente: dto.nombreCliente,
      emailCliente: dto.emailCliente,
      telefonoCliente: dto.telefonoCliente,
    });

    // D7: la respuesta pública no expone `id` ni `mesaId`. `zonaId` no sale de `reserva` (el
    // modelo no lo tiene: la zona de una Reserva sale de su Mesa) sino del mismo `dto` ya
    // validado, porque best fit solo asigna mesas de la zona pedida.
    return {
      codigoReserva: reserva.codigoReserva,
      estado: reserva.estado as 'PENDIENTE' | 'CONFIRMADA',
      fecha: fechaCalendarioAIso(reserva.fecha),
      turnoId: reserva.turnoId,
      zonaId: dto.zonaId,
      comensales: reserva.comensales,
    };
  }
}
