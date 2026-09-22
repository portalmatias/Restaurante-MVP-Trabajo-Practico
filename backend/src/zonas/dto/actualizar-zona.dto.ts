import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, Min, ValidateIf } from 'class-validator';

/**
 * Todos los campos son opcionales: `PATCH /admin/zonas/:id` solo actualiza los que vienen
 * en el body. La coherencia entre `minComensales` y `maxComensales` (considerando los
 * valores ya persistidos para los campos que no vienen en el `dto`) se valida en
 * `ZonasService.actualizar`, no acá — config.yaml §7: "la lógica de negocio vive en los
 * services", el DTO solo valida forma y tipo de cada campo por separado.
 *
 * `@ValidateIf` en vez de `@IsOptional()` en los siete campos: `@IsOptional()` también
 * deja pasar `null` como si el campo no hubiera venido, y ese `null` termina en un error
 * crudo de Prisma al persistir una columna no nullable. Con `@ValidateIf` un `null`
 * explícito sigue validando (y se rechaza con `400`); solo `undefined` (campo ausente del
 * body) se considera "no cambiar este valor".
 */
export class ActualizarZonaDto {
  @ApiProperty({
    required: false,
    description: 'Mínimo de comensales permitido en una Reserva de esta Zona.',
    example: 2,
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  minComensales?: number;

  @ApiProperty({
    required: false,
    description: 'Máximo de comensales permitido en una Reserva de esta Zona.',
    example: 12,
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  maxComensales?: number;

  @ApiProperty({
    required: false,
    description: 'Anticipación mínima, en horas, para reservar en esta Zona.',
    example: 24,
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  anticipacionMinHoras?: number;

  @ApiProperty({
    required: false,
    description: 'Anticipación máxima, en días, para reservar en esta Zona.',
    example: 60,
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  anticipacionMaxDias?: number;

  @ApiProperty({
    required: false,
    description: 'Ventana de cancelación, en horas, antes del turno reservado.',
    example: 24,
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  ventanaCancelacionHoras?: number;

  @ApiProperty({
    required: false,
    description:
      'Si una Reserva en esta Zona requiere confirmación manual del admin.',
    example: true,
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  requiereConfirmacionAdmin?: boolean;

  @ApiProperty({
    required: false,
    description: 'Aforo máximo simultáneo de esta Zona.',
    example: 20,
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  aforoMaximo?: number;
}
