import { ApiProperty } from '@nestjs/swagger';

import {
  TurnoReservaRespuesta,
  ZonaReservaRespuesta,
} from './reserva-consultada-respuesta.dto';

/**
 * Mesa asignada a la Reserva. Solo la ve el admin (design.md D6 de `reserva-consultar`): la
 * consulta pública no expone la mesa.
 */
export class MesaReservaRespuesta {
  @ApiProperty({
    description: 'Id de la mesa.',
    type: String,
    format: 'uuid',
    example: 'e1a7c3f5-2d94-4b60-8a1e-9f3c6b0d7a52',
  })
  id!: string;

  @ApiProperty({
    description: 'Etiqueta de la mesa en el salón.',
    example: 'V2',
  })
  etiqueta!: string;
}

/**
 * Reserva completa para el listado de administrador (design.md D6): a diferencia de
 * `ReservaConsultadaRespuesta`, incluye el `id` interno (lo usan `reserva-vip` y
 * `cancelacion-turnos`), los datos de contacto del cliente y la mesa asignada.
 */
export class ReservaAdminRespuesta {
  @ApiProperty({
    description:
      'Identificador interno de la reserva, el que usan las demás rutas de admin.',
    type: String,
    format: 'uuid',
    example: '9c4e1d70-3a2b-4c58-b1f6-7e0a5d2c8b34',
  })
  id!: string;

  @ApiProperty({
    description: 'Código alfanumérico de 8 caracteres.',
    pattern: '^[A-Za-z0-9]{8}$',
    example: 'R2WN8HDE',
  })
  codigoReserva!: string;

  @ApiProperty({
    description: 'Estado actual de la reserva.',
    enum: ['PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'NO_SHOW'],
    example: 'PENDIENTE',
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
    example: 6,
  })
  comensales!: number;

  @ApiProperty({
    description: 'Nombre de quien reservó.',
    example: 'Ana Pérez',
  })
  nombreCliente!: string;

  @ApiProperty({
    description: 'Email de quien reservó, tal cual se guardó.',
    type: String,
    format: 'email',
    example: 'ana.perez@example.com',
  })
  emailCliente!: string;

  @ApiProperty({
    description: 'Teléfono de contacto, en formato libre.',
    example: '+54 9 11 5555-1234',
  })
  telefonoCliente!: string;

  @ApiProperty({ type: TurnoReservaRespuesta })
  turno!: TurnoReservaRespuesta;

  @ApiProperty({ type: ZonaReservaRespuesta })
  zona!: ZonaReservaRespuesta;

  @ApiProperty({ type: MesaReservaRespuesta })
  mesa!: MesaReservaRespuesta;

  @ApiProperty({
    description: 'Instante de creación de la reserva, en UTC.',
    type: String,
    format: 'date-time',
    example: '2026-09-17T14:32:10.000Z',
  })
  createdAt!: string;
}
