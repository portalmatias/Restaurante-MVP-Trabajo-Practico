import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CodigoMotivo } from '../reglas/tipos';

/**
 * El mismo texto va en la propiedad `codigo` y en el schema `CodigoMotivo`:
 * `@nestjs/swagger` copia la descripción de la propiedad al schema que extrae con
 * `enumName`, y `openapi/openapi.yaml` declara las dos.
 */
const DESCRIPCION_CODIGO_MOTIVO =
  'Código estable de la regla que falla. El frontend arma el texto para el usuario a partir de este código. Los valores se evalúan y se listan en este orden: `TURNO_INACTIVO` (el turno está inactivo), `TURNO_NO_CORRESPONDE_A_FECHA` (el día de la semana de la fecha no es el del turno), `ANTICIPACION_MINIMA` (falta menos que la anticipación mínima de la zona, o el turno ya pasó), `ANTICIPACION_MAXIMA` (falta más que la anticipación máxima de la zona), `COMENSALES_FUERA_DE_RANGO` (fuera del mínimo o máximo de comensales de la zona), `AFORO_ZONA` (se supera el aforo de la zona), `AFORO_GLOBAL` (se supera el aforo global) y `SIN_MESA_DISPONIBLE` (no queda una mesa libre de la zona con capacidad suficiente).';

/**
 * Forma publicada de un motivo. El nombre de la clase ES el nombre del schema en el
 * contrato (`MotivoNoDisponible`), así que no se puede renombrar sin tocar el YAML.
 * La interfaz homónima de `reglas/tipos.ts` es la que usan las reglas puras.
 */
@ApiSchema({
  description: 'Una regla de negocio que impide la reserva pedida.',
})
export class MotivoNoDisponible {
  @ApiProperty({
    description: DESCRIPCION_CODIGO_MOTIVO,
    enum: CodigoMotivo,
    enumName: 'CodigoMotivo',
  })
  codigo!: CodigoMotivo;

  @ApiProperty({
    type: String,
    description: 'Explicación en español para humanos. No se usa para lógica.',
    example: 'La zona VIP admite de 2 a 12 comensales por reserva.',
  })
  mensaje!: string;
}

/** Cuerpo del `200` de `GET /disponibilidad`. */
@ApiSchema({
  description:
    'Resultado de consultar la disponibilidad de una fecha, un turno y una zona.',
})
export class DisponibilidadRespuesta {
  @ApiProperty({
    type: Boolean,
    description: '`true` si y solo si `motivos` está vacío.',
    example: false,
  })
  disponible!: boolean;

  @ApiProperty({
    type: 'integer',
    description:
      'Comensales (no mesas) que todavía entran en ese turno y esa fecha: el mínimo entre lo que queda del aforo de la zona y lo que queda del aforo global, sin descontar los comensales pedidos. Nunca es negativo.',
    minimum: 0,
    example: 20,
  })
  lugaresRestantes!: number;

  @ApiProperty({
    description:
      'Todas las reglas que impiden la reserva, en el orden fijo de `CodigoMotivo`. Vacío si hay lugar.',
    type: [MotivoNoDisponible],
  })
  motivos!: MotivoNoDisponible[];
}
