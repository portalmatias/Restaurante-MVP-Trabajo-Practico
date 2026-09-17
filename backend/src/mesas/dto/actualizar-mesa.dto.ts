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
  @ValidateIf((_, value) => value !== undefined)
  @IsUUID()
  zonaId?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  capacidad?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/\S/, {
    message: 'La etiqueta no puede estar vacía ni contener solo espacios.',
  })
  etiqueta?: string;
}
