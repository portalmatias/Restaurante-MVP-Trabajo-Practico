import { IsInt, IsString, Matches, IsUUID, Min } from 'class-validator';

export class CrearMesaDto {
  @IsUUID()
  zonaId!: string;

  @IsInt()
  @Min(1)
  capacidad!: number;

  /**
   * `@Matches(/\S/)` en vez de (o además de) `@IsNotEmpty()`: `IsNotEmpty` solo rechaza
   * el string vacío `''`, no una etiqueta de solo espacios (`'   '`), que se persistía tal
   * cual.
   */
  @IsString()
  @Matches(/\S/, {
    message: 'La etiqueta no puede estar vacía ni contener solo espacios.',
  })
  etiqueta!: string;
}
