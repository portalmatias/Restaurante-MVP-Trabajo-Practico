import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { NombreZona } from '@prisma/client';

/**
 * Forma pública de una Zona (change `catalogo-publico`): la allow-list de campos que arma
 * `ZonasService.listarPublicas()`. Solo documenta el contrato OpenAPI; no se usa en tiempo
 * de ejecución. No declara `aforoMaximo` a propósito.
 */
@ApiSchema({
  description:
    'Forma pública de una Zona: sin `aforoMaximo` ni Mesas, datos operativos del salón sin uso para quien todavía no reservó.',
})
export class ZonaPublicaRespuestaDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ enum: NombreZona, example: NombreZona.VIP })
  nombre!: NombreZona;

  @ApiProperty({ example: 2 })
  minComensales!: number;

  @ApiProperty({ example: 12 })
  maxComensales!: number;

  @ApiProperty({ example: 24 })
  anticipacionMinHoras!: number;

  @ApiProperty({ example: 60 })
  anticipacionMaxDias!: number;

  @ApiProperty({ example: 24 })
  ventanaCancelacionHoras!: number;

  @ApiProperty({ example: true })
  requiereConfirmacionAdmin!: boolean;
}
