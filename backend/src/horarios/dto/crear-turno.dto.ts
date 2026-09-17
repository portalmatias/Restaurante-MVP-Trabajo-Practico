import { IsBoolean, IsDate, IsEnum, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { DiaSemana } from '@prisma/client';

export class CrearTurnoDto {
  @IsEnum(DiaSemana)
  diaSemana!: DiaSemana;

  /** Hora local del restaurante, sin fecha (config.yaml §7). Se persiste con `@db.Time`. */
  @Type(() => Date)
  @IsDate()
  horaInicio!: Date;

  @Type(() => Date)
  @IsDate()
  horaFin!: Date;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
