import { ApiProperty } from '@nestjs/swagger';
import { DiaSemana } from '@prisma/client';

/**
 * Forma de un Turno tal como lo devuelve la API — únicamente para documentar el contrato
 * OpenAPI (`@ApiResponse`); `HorariosService` sigue devolviendo el modelo de Prisma
 * directamente, esta clase no se usa en tiempo de ejecución. `horaInicio`/`horaFin` viajan
 * como fecha-hora completa (`@db.Time` de Prisma serializado por `JSON.stringify` como
 * ISO 8601 con fecha fija 1970-01-01), igual que ya hace el resto del contrato.
 */
export class TurnoRespuestaDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ enum: DiaSemana, example: DiaSemana.VIERNES })
  diaSemana!: DiaSemana;

  @ApiProperty({ example: '1970-01-01T20:00:00.000Z' })
  horaInicio!: string;

  @ApiProperty({ example: '1970-01-01T23:30:00.000Z' })
  horaFin!: string;

  @ApiProperty({ example: true })
  activo!: boolean;
}
