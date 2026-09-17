import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

/**
 * Todos los campos son opcionales: `PATCH /admin/zonas/:id` solo actualiza los que vienen
 * en el body. La coherencia entre `minComensales` y `maxComensales` (considerando los
 * valores ya persistidos para los campos que no vienen en el `dto`) se valida en
 * `ZonasService.actualizar`, no acá — config.yaml §7: "la lógica de negocio vive en los
 * services", el DTO solo valida forma y tipo de cada campo por separado.
 */
export class ActualizarZonaDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  minComensales?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxComensales?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  anticipacionMinHoras?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  anticipacionMaxDias?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  ventanaCancelacionHoras?: number;

  @IsOptional()
  @IsBoolean()
  requiereConfirmacionAdmin?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  aforoMaximo?: number;
}
