import { IsBoolean, IsDate, IsEnum, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { DiaSemana } from '@prisma/client';

export class ActualizarTurnoDto {
  @IsOptional()
  @IsEnum(DiaSemana)
  diaSemana?: DiaSemana;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  horaInicio?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  horaFin?: Date;

  /**
   * Activación/desactivación viaja como parte del mismo `PATCH` de edición, para no
   * multiplicar rutas (design.md, tasks.md 4.4).
   */
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
