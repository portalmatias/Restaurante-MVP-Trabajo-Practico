import { ApiProperty } from '@nestjs/swagger';
import { FormaMesa } from '@prisma/client';
import {
  IsEnum,
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

  /**
   * Campos del plano (change `plano-mesas-admin`, design.md D1). En `posX` y `posY`, `null`
   * y ausente significan cosas distintas: `null` quita la mesa del plano y la ausencia no toca
   * la posición. Por eso el `@ValidateIf` solo valida cuando hay un valor: `null` pasa el DTO
   * y `MesasService` lo distingue de `undefined`. Que las dos coordenadas vayan juntas lo
   * valida el service (D2).
   */
  @ApiProperty({
    required: false,
    nullable: true,
    type: 'integer',
    minimum: 0,
    description:
      'Columna de la esquina superior izquierda en la grilla de la zona, desde 0. Va junto con posY; los dos en null quitan la mesa del plano. Si se cambia la zona sin indicarla, la mesa queda sin ubicar.',
    example: 8,
  })
  @ValidateIf((dto: ActualizarMesaDto) => dto.posX != null)
  @IsInt()
  @Min(0)
  posX?: number | null;

  @ApiProperty({
    required: false,
    nullable: true,
    type: 'integer',
    minimum: 0,
    description:
      'Fila de la esquina superior izquierda, desde 0. Va junto con posX.',
    example: 5,
  })
  @ValidateIf((dto: ActualizarMesaDto) => dto.posY != null)
  @IsInt()
  @Min(0)
  posY?: number | null;

  /** `ancho`, `alto` y `forma` no admiten `null`: mismo `@ValidateIf` que los campos de arriba. */
  @ApiProperty({
    required: false,
    type: 'integer',
    minimum: 1,
    description: 'Columnas que ocupa la mesa en el plano.',
    example: 3,
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  ancho?: number;

  @ApiProperty({
    required: false,
    type: 'integer',
    minimum: 1,
    description: 'Filas que ocupa la mesa en el plano.',
    example: 2,
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  alto?: number;

  @ApiProperty({
    required: false,
    description: 'Forma con la que se dibuja la mesa.',
    enum: FormaMesa,
    enumName: 'FormaMesa',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(FormaMesa)
  forma?: FormaMesa;
}
