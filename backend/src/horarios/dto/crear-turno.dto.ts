import { IsBoolean, IsDate, IsEnum, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { DiaSemana } from '@prisma/client';

import { transformarHoraLocal } from '../hora-local.util';

export class CrearTurnoDto {
  @IsEnum(DiaSemana)
  diaSemana!: DiaSemana;

  /** Hora local del restaurante, formato `HH:mm` o `HH:mm:ss` (config.yaml §7). */
  @Transform(transformarHoraLocal)
  @IsDate()
  horaInicio!: Date;

  @Transform(transformarHoraLocal)
  @IsDate()
  horaFin!: Date;

  /**
   * `@ValidateIf` en vez de `@IsOptional()`: `@IsOptional()` también deja pasar `null`
   * (lo trata igual que "ausente"), lo que termina en un error crudo de Prisma al
   * persistir un `null` en una columna no nullable. Con `@ValidateIf` solo se omite la
   * validación cuando el campo directamente no vino en el body (`undefined`); un `null`
   * explícito sigue evaluando `@IsBoolean()` y se rechaza con `400`.
   */
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  activo?: boolean;
}
