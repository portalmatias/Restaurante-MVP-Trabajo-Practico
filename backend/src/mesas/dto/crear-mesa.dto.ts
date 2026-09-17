import { IsInt, IsNotEmpty, IsString, IsUUID, Min } from 'class-validator';

export class CrearMesaDto {
  @IsUUID()
  zonaId!: string;

  @IsInt()
  @Min(1)
  capacidad!: number;

  @IsString()
  @IsNotEmpty()
  etiqueta!: string;
}
