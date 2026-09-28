import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Matches, IsUUID, Min } from 'class-validator';

export class CrearMesaDto {
  @ApiProperty({
    description: 'Id de la Zona a la que pertenece la Mesa.',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsUUID()
  zonaId!: string;

  @ApiProperty({
    description: 'Capacidad de comensales de la Mesa.',
    example: 4,
  })
  @IsInt()
  @Min(1)
  capacidad!: number;

  /**
   * `@Matches(/\S/)` en vez de (o además de) `@IsNotEmpty()`: `IsNotEmpty` solo rechaza
   * el string vacío `''`, no una etiqueta de solo espacios (`'   '`), que se persistía tal
   * cual.
   */
  @ApiProperty({
    description: 'Etiqueta identificatoria de la Mesa, única en todo el salón.',
    example: 'M1',
  })
  @IsString()
  @Matches(/\S/, {
    message: 'La etiqueta no puede estar vacía ni contener solo espacios.',
  })
  etiqueta!: string;
}
