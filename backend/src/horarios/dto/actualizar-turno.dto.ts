import { IsBoolean, IsDate, IsEnum, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { DiaSemana } from '@prisma/client';

import { transformarHoraLocal } from '../hora-local.util';

export class ActualizarTurnoDto {
  /**
   * `@ValidateIf` en vez de `@IsOptional()` en los cuatro campos: `@IsOptional()` también
   * deja pasar `null` como si el campo no hubiera venido, y un `null` termina en un error
   * crudo de Prisma al persistir una columna no nullable. Con `@ValidateIf` un `null`
   * explícito sigue validando y se rechaza con `400`; solo `undefined` (campo ausente del
   * body) se considera "no cambiar este valor".
   */
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(DiaSemana)
  diaSemana?: DiaSemana;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(transformarHoraLocal)
  @IsDate()
  horaInicio?: Date;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(transformarHoraLocal)
  @IsDate()
  horaFin?: Date;

  /**
   * Activación/desactivación viaja como parte del mismo `PATCH` de edición, para no
   * multiplicar rutas (design.md, tasks.md 4.4).
   */
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  activo?: boolean;
}
