import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsUUID,
  Matches,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * `fecha` es una fecha de calendario local del restaurante, sin hora (design.md D4). El
 * patrón es el mismo que publica el contrato en `openapi/openapi.yaml`.
 */
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Comprueba que la fecha además de tener el formato correcto **exista**: rechaza
 * `2026-02-30` y los años de dos dígitos que `Date.UTC` reinterpreta como 19xx
 * (design.md → Trampas de fechas). El formato lo valida `@Matches`, así que acá una
 * fecha con formato inválido se deja pasar para no duplicar el mismo mensaje.
 */
@ValidatorConstraint({ name: 'esFechaDeCalendarioExistente', async: false })
export class EsFechaDeCalendarioExistente implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    if (typeof valor !== 'string' || !FORMATO_FECHA.test(valor)) return true;
    const [anio, mes, dia] = valor.split('-').map(Number);
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
    return (
      fecha.getUTCFullYear() === anio &&
      fecha.getUTCMonth() === mes - 1 &&
      fecha.getUTCDate() === dia
    );
  }

  defaultMessage(): string {
    return 'fecha debe ser una fecha de calendario que exista';
  }
}

/**
 * Query params de `GET /disponibilidad` (design.md D8). Los `@ApiProperty` tienen que
 * generar exactamente los `parameters` que declara `openapi/openapi.yaml`: el chequeo de
 * deriva `npm run openapi:check` compara los dos documentos de forma literal.
 *
 * La validación depende de un `ValidationPipe` global con `transform: true` en `main.ts`
 * (D8): sin él, `@Type(() => Number)` no convierte y el `400` no se produce.
 */
export class ConsultarDisponibilidadDto {
  @ApiProperty({
    description:
      'Fecha de calendario local del restaurante, sin hora (`YYYY-MM-DD`). Un instante con hora (por ejemplo `2026-09-15T12:00:00Z`) o una fecha inexistente se rechazan con `400`.',
    type: String,
    format: 'date',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
    example: '2026-09-15',
  })
  @Matches(FORMATO_FECHA, {
    message:
      'fecha debe ser una fecha de calendario con formato YYYY-MM-DD, sin hora',
  })
  @Validate(EsFechaDeCalendarioExistente)
  fecha!: string;

  @ApiProperty({
    description: 'Id del turno a consultar.',
    type: String,
    format: 'uuid',
    example: '3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73',
  })
  @IsUUID()
  turnoId!: string;

  @ApiProperty({
    description: 'Id de la zona a consultar.',
    type: String,
    format: 'uuid',
    example: 'b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19',
  })
  @IsUUID()
  zonaId!: string;

  @ApiProperty({
    description:
      'Cantidad de comensales de la reserva que se quiere hacer. Entero, mínimo 1.',
    type: 'integer',
    minimum: 1,
    example: 1,
  })
  @Type(() => Number)
  @IsInt({
    message: 'comensales debe ser un número entero mayor o igual a 1',
  })
  @Min(1, {
    message: 'comensales debe ser un número entero mayor o igual a 1',
  })
  comensales!: number;
}
