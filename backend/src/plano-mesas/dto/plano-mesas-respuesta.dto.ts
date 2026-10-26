import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { FormaMesa, NombreZona } from '@prisma/client';

import { MotivoNoDisponible } from '../../disponibilidad/dto/disponibilidad-respuesta.dto';
import { EstadoMesaPlano } from '../estado-mesa';

/**
 * Respuesta de `GET /plano-mesas` (change `plano-mesas`, design.md D2 y D3). El nombre de cada
 * clase es el nombre del schema en `openapi/openapi.yaml` y cada texto tiene que coincidir letra
 * por letra con el YAML (`openapi:check`).
 *
 * Solo estas propiedades: ni ids de mesa ni datos de reservas (D3). Un test de integración
 * compara las claves exactas de la respuesta.
 */

@ApiSchema({
  description:
    'Una mesa de la zona con su ubicación en el plano y su estado para la consulta. No incluye datos de las reservas.',
})
export class MesaPlano {
  @ApiProperty({
    type: String,
    description: 'Identificador legible de la mesa, único en el restaurante.',
    example: 'S3',
  })
  etiqueta!: string;

  @ApiProperty({
    type: 'integer',
    description: 'Comensales que entran en la mesa.',
    minimum: 1,
    example: 4,
  })
  capacidad!: number;

  @ApiProperty({
    description: 'Forma con la que se dibuja la mesa.',
    enum: FormaMesa,
    enumName: 'FormaMesa',
  })
  forma!: FormaMesa;

  @ApiProperty({
    type: 'integer',
    nullable: true,
    description:
      'Columna de la esquina superior izquierda de la mesa en la grilla, desde 0. Nulo si la mesa no está ubicada en el plano.',
    minimum: 0,
    example: 5,
  })
  posX!: number | null;

  @ApiProperty({
    type: 'integer',
    nullable: true,
    description:
      'Fila de la esquina superior izquierda de la mesa en la grilla, desde 0. Nulo si la mesa no está ubicada en el plano.',
    minimum: 0,
    example: 0,
  })
  posY!: number | null;

  @ApiProperty({
    type: 'integer',
    description: 'Ancho de la mesa en celdas.',
    minimum: 1,
    example: 2,
  })
  ancho!: number;

  @ApiProperty({
    type: 'integer',
    description: 'Alto de la mesa en celdas.',
    minimum: 1,
    example: 2,
  })
  alto!: number;

  @ApiProperty({
    description:
      'Estado de la mesa para la fecha, el turno y los comensales consultados: `LIBRE` (no está ocupada y alcanza), `OCUPADA` (tiene una reserva pendiente o confirmada en ese turno y esa fecha) o `NO_ALCANZA` (no está ocupada, pero su capacidad es menor que los comensales).',
    enum: EstadoMesaPlano,
    enumName: 'EstadoMesaPlano',
  })
  estado!: EstadoMesaPlano;
}

@ApiSchema({
  description:
    'Plano de una zona con el estado de cada mesa y el mismo veredicto que `GET /disponibilidad`.',
})
export class PlanoMesasRespuesta {
  @ApiProperty({
    description: 'Zona del plano.',
    enum: NombreZona,
    example: 'STANDARD',
  })
  zona!: NombreZona;

  @ApiProperty({
    type: 'integer',
    description: 'Columnas de la grilla del plano de la zona.',
    minimum: 1,
    example: 12,
  })
  columnas!: number;

  @ApiProperty({
    type: 'integer',
    description: 'Filas de la grilla del plano de la zona.',
    minimum: 1,
    example: 8,
  })
  filas!: number;

  @ApiProperty({
    type: Boolean,
    description:
      'Igual que en `GET /disponibilidad`: `true` si y solo si `motivos` está vacío.',
    example: true,
  })
  disponible!: boolean;

  @ApiProperty({
    type: 'integer',
    description:
      'Igual que en `GET /disponibilidad`: comensales que todavía entran en ese turno y esa fecha.',
    minimum: 0,
    example: 36,
  })
  lugaresRestantes!: number;

  @ApiProperty({
    description:
      'Igual que en `GET /disponibilidad`: todas las reglas que impiden la reserva. Vacío si hay lugar.',
    type: [MotivoNoDisponible],
  })
  motivos!: MotivoNoDisponible[];

  @ApiProperty({
    description:
      'Todas las mesas de la zona, en orden natural de etiqueta (S2 antes que S10).',
    type: [MesaPlano],
  })
  mesas!: MesaPlano[];
}
