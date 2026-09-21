import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsEnum, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { DiaSemana } from '@prisma/client';

import { transformarHoraLocal } from '../hora-local.util';

export class CrearTurnoDto {
  @ApiProperty({
    enum: DiaSemana,
    description: 'Día de la semana en que rige este Turno.',
    example: DiaSemana.VIERNES,
  })
  @IsEnum(DiaSemana)
  diaSemana!: DiaSemana;

  /** Hora local del restaurante, formato `HH:mm` o `HH:mm:ss` (config.yaml §7). */
  @ApiProperty({
    type: String,
    description:
      'Hora local del restaurante en que empieza el Turno, formato `HH:mm` o `HH:mm:ss`.',
    example: '20:00',
  })
  @Transform(transformarHoraLocal)
  @IsDate()
  horaInicio!: Date;

  @ApiProperty({
    type: String,
    description:
      'Hora local del restaurante en que termina el Turno, formato `HH:mm` o ' +
      '`HH:mm:ss`. Puede ser menor a `horaInicio`: se interpreta como cruce de medianoche.',
    example: '23:30',
  })
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
  @ApiProperty({
    required: false,
    default: true,
    description: 'Si el Turno queda activo al crearse.',
    example: true,
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  activo?: boolean;
}
