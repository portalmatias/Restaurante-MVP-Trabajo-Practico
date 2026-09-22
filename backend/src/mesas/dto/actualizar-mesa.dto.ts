import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  Matches,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * `@ValidateIf` en vez de `@IsOptional()` en los tres campos: `@IsOptional()` también
 * deja pasar `null` como si el campo no hubiera venido, y ese `null` termina en un error
 * crudo de Prisma al persistir una columna no nullable. Con `@ValidateIf` un `null`
 * explícito sigue validando (y se rechaza con `400`); solo `undefined` (campo ausente del
 * body) se considera "no cambiar este valor".
 */
export class ActualizarMesaDto {
  @ApiProperty({
    required: false,
    description: 'Id de la nueva Zona a la que pasa a pertenecer la Mesa.',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsUUID()
  zonaId?: string;

  @ApiProperty({
    required: false,
    description: 'Nueva capacidad de comensales de la Mesa.',
    example: 6,
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  capacidad?: number;

  @ApiProperty({
    required: false,
    description:
      'Nueva etiqueta identificatoria de la Mesa, única en todo el salón.',
    example: 'M1',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/\S/, {
    message: 'La etiqueta no puede estar vacía ni contener solo espacios.',
  })
  etiqueta?: string;
}
