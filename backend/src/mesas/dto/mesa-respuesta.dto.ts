import { ApiProperty } from '@nestjs/swagger';
import { FormaMesa } from '@prisma/client';

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

  /** Campos del plano (`plano-mesas-admin`, design.md D4): siempre presentes. */
  @ApiProperty({ type: 'integer', nullable: true, minimum: 0, example: 5 })
  posX!: number | null;

  @ApiProperty({ type: 'integer', nullable: true, minimum: 0, example: 0 })
  posY!: number | null;

  @ApiProperty({ type: 'integer', minimum: 1, example: 2 })
  ancho!: number;

  @ApiProperty({ type: 'integer', minimum: 1, example: 2 })
  alto!: number;

  @ApiProperty({
    description: 'Forma con la que se dibuja la mesa.',
    enum: FormaMesa,
    enumName: 'FormaMesa',
  })
  forma!: FormaMesa;
}
