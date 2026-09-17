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
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  minComensales?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  maxComensales?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  anticipacionMinHoras?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  anticipacionMaxDias?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  ventanaCancelacionHoras?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  requiereConfirmacionAdmin?: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  aforoMaximo?: number;
}
