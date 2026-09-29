import { ApiPropertyOptional } from '@nestjs/swagger';
import { DiaSemana } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

/**
 * Query de `GET /turnos` (change `catalogo-publico`, D5). A diferencia de
 * `CrearTurnoDto.diaSemana`, acá el campo es opcional: sin `@IsOptional()`, un
 * `GET /turnos` sin query respondería `400`. Un valor vacío (`?diaSemana=`) no es
 * `undefined`, así que igual llega a `@IsEnum` y responde `400`.
 */
export class ListarTurnosPublicosDto {
  @ApiPropertyOptional({
    enum: DiaSemana,
    description: 'Filtra los Turnos activos devueltos por día de la semana.',
    example: DiaSemana.SABADO,
  })
  @IsOptional()
  @IsEnum(DiaSemana)
  diaSemana?: DiaSemana;
}
