import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { DiaSemana } from '@prisma/client';

/**
 * Forma pública de un Turno activo (change `catalogo-publico`): la allow-list de campos
 * que arma `HorariosService.listarPublicos()`. Solo documenta el contrato OpenAPI; no se
 * usa en tiempo de ejecución. No declara `activo`: todos los devueltos ya lo son.
 */
@ApiSchema({
  description:
    'Forma pública de un Turno activo: sin el campo `activo` (todos los devueltos ya lo son). `horaInicio`/`horaFin` viajan en el mismo formato que ya usa `TurnoRespuestaDto` de `GET /admin/turnos`.',
})
export class TurnoPublicoRespuestaDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ enum: DiaSemana, example: DiaSemana.SABADO })
  diaSemana!: DiaSemana;

  @ApiProperty({ example: '1970-01-01T20:00:00.000Z' })
  horaInicio!: string;

  @ApiProperty({ example: '1970-01-01T23:30:00.000Z' })
  horaFin!: string;
}
