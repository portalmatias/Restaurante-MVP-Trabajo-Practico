import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class ActualizarMesaDto {
  @IsOptional()
  @IsUUID()
  zonaId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacidad?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  etiqueta?: string;
}
