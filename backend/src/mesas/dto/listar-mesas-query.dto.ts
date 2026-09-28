import { IsOptional, IsUUID } from 'class-validator';

/**
 * A diferencia de un body JSON, un query param de una URL no tiene forma de representar
 * `null` — o viene como string, o está ausente. `@IsOptional()` alcanza acá (no hace falta
 * el `@ValidateIf` que sí usan los DTOs de body de este módulo).
 */
export class ListarMesasQueryDto {
  @IsOptional()
  @IsUUID()
  zonaId?: string;
}
