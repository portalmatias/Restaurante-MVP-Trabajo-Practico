import { ApiProperty, ApiSchema } from '@nestjs/swagger';

/**
 * Cuerpo del `201` de `POST /reservas` (design.md D7). Solo lo mínimo que necesita el
 * cliente: sin el `id` interno (lo usan las rutas de admin), sin la mesa asignada (no es un
 * concepto del cliente y el admin la puede reasignar) y sin los datos de contacto (el cliente
 * ya los tiene).
 *
 * `estado` se declara como enum **inline** (sin `enumName`), a propósito: una reserva recién
 * creada solo puede quedar en dos de los cuatro valores de `EstadoReserva`, y generar un
 * schema `EstadoReserva` acá chocaría con el que definan los changes de admin (design.md →
 * Contrato OpenAPI).
 */
@ApiSchema({
  description: 'Reserva recién creada, sin datos internos ni de contacto.',
})
export class ReservaCreadaRespuesta {
  @ApiProperty({
    type: String,
    pattern: '^[A-Za-z0-9]{8}$',
    description:
      'Código alfanumérico de 8 caracteres, único. Junto con el email, identifica la reserva.',
    example: 'K7PM3QXA',
  })
  codigoReserva!: string;

  @ApiProperty({
    type: String,
    enum: ['PENDIENTE', 'CONFIRMADA'],
    description:
      '`PENDIENTE` si la zona requiere confirmación del admin, `CONFIRMADA` si no. Una reserva recién creada nunca está `CANCELADA` ni `NO_SHOW`.',
    example: 'CONFIRMADA',
  })
  estado!: 'PENDIENTE' | 'CONFIRMADA';

  @ApiProperty({
    type: String,
    format: 'date',
    description: 'La misma fecha de calendario local enviada (`YYYY-MM-DD`).',
    example: '2026-09-19',
  })
  fecha!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'Id del turno reservado.',
    example: '3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73',
  })
  turnoId!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'Id de la zona reservada.',
    example: 'b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19',
  })
  zonaId!: string;

  @ApiProperty({
    type: 'integer',
    minimum: 1,
    description: 'Cantidad de comensales reservados.',
    example: 4,
  })
  comensales!: number;
}
