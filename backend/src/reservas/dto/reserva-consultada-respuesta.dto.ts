import { ApiProperty } from '@nestjs/swagger';

/**
 * Cuerpo de la respuesta de `POST /reservas/consultar` (design.md D4): una vista mínima de
 * la Reserva. Los `@ApiProperty` reproducen los schemas `TurnoReservaRespuesta`,
 * `ZonaReservaRespuesta` y `ReservaConsultadaRespuesta` de `openapi/openapi.yaml`.
 *
 * Los enums de `estado` y `zona.nombre` son **inline**, sin `enumName`: así no se genera un
 * schema global `EstadoReserva` que choque con el de otros changes, y no aplica el falso
 * rojo de `x-enumNames` de `openapi:check` (design.md D4).
 */

export class TurnoReservaRespuesta {
  @ApiProperty({
    description: 'Id del turno.',
    type: String,
    format: 'uuid',
    example: '3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73',
  })
  id!: string;

  @ApiProperty({
    description:
      'Hora local de inicio (`HH:mm`), sin conversión de zona horaria.',
    pattern: '^\\d{2}:\\d{2}$',
    example: '20:00',
  })
  horaInicio!: string;

  @ApiProperty({
    description:
      'Hora local de fin (`HH:mm`). Si es anterior a la de inicio, el turno termina al día siguiente.',
    pattern: '^\\d{2}:\\d{2}$',
    example: '23:30',
  })
  horaFin!: string;
}

export class ZonaReservaRespuesta {
  @ApiProperty({
    description: 'Id de la zona.',
    type: String,
    format: 'uuid',
    example: 'b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19',
  })
  id!: string;

  @ApiProperty({
    description: 'Nombre de la zona.',
    enum: ['STANDARD', 'VIP'],
    example: 'STANDARD',
  })
  nombre!: 'STANDARD' | 'VIP';
}

export class ReservaConsultadaRespuesta {
  @ApiProperty({
    description: 'Código alfanumérico de 8 caracteres.',
    pattern: '^[A-Za-z0-9]{8}$',
    example: 'K7PM3QXA',
  })
  codigoReserva!: string;

  @ApiProperty({
    description: 'Estado actual de la reserva.',
    enum: ['PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'NO_SHOW'],
    example: 'CONFIRMADA',
  })
  estado!: 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA' | 'NO_SHOW';

  @ApiProperty({
    description: 'Fecha de calendario local del restaurante (`YYYY-MM-DD`).',
    type: String,
    format: 'date',
    example: '2026-09-19',
  })
  fecha!: string;

  @ApiProperty({
    description: 'Cantidad de comensales reservados.',
    type: 'integer',
    minimum: 1,
    example: 4,
  })
  comensales!: number;

  @ApiProperty({ type: TurnoReservaRespuesta })
  turno!: TurnoReservaRespuesta;

  @ApiProperty({ type: ZonaReservaRespuesta })
  zona!: ZonaReservaRespuesta;
}
