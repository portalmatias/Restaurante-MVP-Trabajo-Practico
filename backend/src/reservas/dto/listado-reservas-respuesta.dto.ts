import { ApiProperty } from '@nestjs/swagger';

import { ReservaAdminRespuesta } from './reserva-admin-respuesta.dto';

/** Página de Reservas y el total que cumple los filtros (design.md D6). */
export class ListadoReservasRespuesta {
  @ApiProperty({
    description: 'Reservas de la página, en orden cronológico.',
    type: [ReservaAdminRespuesta],
  })
  items!: ReservaAdminRespuesta[];

  @ApiProperty({
    description:
      'Cantidad total de reservas que cumplen los filtros, sin paginar.',
    type: 'integer',
    minimum: 0,
    example: 1,
  })
  total!: number;

  @ApiProperty({
    description: 'Tamaño de página aplicado.',
    type: 'integer',
    example: 20,
  })
  limit!: number;

  @ApiProperty({
    description: 'Desplazamiento aplicado.',
    type: 'integer',
    example: 0,
  })
  offset!: number;
}
