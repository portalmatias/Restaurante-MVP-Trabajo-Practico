import { ApiProperty } from '@nestjs/swagger';
import { NombreZona } from '@prisma/client';

/**
 * Forma de una Zona tal como la devuelve la API — únicamente para documentar el contrato
 * OpenAPI (`@ApiResponse`); `ZonasService` sigue devolviendo el modelo de Prisma
 * directamente, esta clase no se usa en tiempo de ejecución.
 */
export class ZonaRespuestaDto {
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

  @ApiProperty({ example: 20 })
  aforoMaximo!: number;
}
