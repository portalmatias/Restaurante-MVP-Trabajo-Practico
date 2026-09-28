import { ApiProperty } from '@nestjs/swagger';

/**
 * Forma de una Mesa tal como la devuelve la API — únicamente para documentar el contrato
 * OpenAPI (`@ApiResponse`); `MesasService` sigue devolviendo el modelo de Prisma
 * directamente, esta clase no se usa en tiempo de ejecución.
 */
export class MesaRespuestaDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  zonaId!: string;

  @ApiProperty({ example: 4 })
  capacidad!: number;

  @ApiProperty({ example: 'M1' })
  etiqueta!: string;
}
