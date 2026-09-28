import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  Validate,
} from 'class-validator';

import { EsFechaDeCalendarioExistente } from '../../disponibilidad/dto/consultar-disponibilidad.dto';

/** El mismo patrón que publica el contrato en `openapi/openapi.yaml` (design.md D6). */
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Body de `POST /reservas` (design.md D6). Los nombres de campo son los del modelo de #12,
 * para que el service arme el `data` del `INSERT` campo por campo sin un mapeo intermedio.
 *
 * `fecha` reusa el mismo validador que `ConsultarDisponibilidadDto` (una sola definición de
 * fecha de calendario, D4 de `disponibilidad`). `comensales` no lleva `@Type(() => Number)`:
 * a diferencia de la query de `GET /disponibilidad`, el body JSON ya llega como número, y sin
 * `@Type` un `"4"` string se rechaza en vez de convertirse (D6).
 *
 * El `ValidationPipe` global de `main.ts` tiene `whitelist: true` y `forbidNonWhitelisted: true`
 * (1.4), así que un body con un campo fuera de estos siete (`mesaId`, `estado`,
 * `codigoReserva`, ...) se rechaza con `400` antes de llegar al controller (D6).
 *
 * Los `@ApiProperty` tienen que generar exactamente lo que declara `openapi/openapi.yaml`:
 * `npm run openapi:check` compara los dos documentos de forma literal.
 */
@ApiSchema({ description: 'Datos para crear una reserva sin cuenta.' })
export class CrearReservaDto {
  @ApiProperty({
    type: String,
    format: 'date',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
    description:
      'Fecha de calendario local del restaurante, sin hora (`YYYY-MM-DD`).',
    example: '2026-09-19',
  })
  @Matches(FORMATO_FECHA, {
    message:
      'fecha debe ser una fecha de calendario con formato YYYY-MM-DD, sin hora',
  })
  @Validate(EsFechaDeCalendarioExistente)
  fecha!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'Id del turno.',
    example: '3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73',
  })
  @IsUUID()
  turnoId!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'Id de la zona.',
    example: 'b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19',
  })
  @IsUUID()
  zonaId!: string;

  @ApiProperty({
    type: 'integer',
    minimum: 1,
    description: 'Cantidad de comensales. Entero, mínimo 1.',
    example: 4,
  })
  @IsInt({ message: 'comensales debe ser un número entero mayor o igual a 1' })
  @Min(1, {
    message: 'comensales debe ser un número entero mayor o igual a 1',
  })
  comensales!: number;

  /**
   * `@Matches(/\S/)` en vez de (o además de) `@IsNotEmpty()`: `IsNotEmpty` solo rechaza el
   * string vacío `''`, no un nombre de solo espacios (`'   '`) — mismo patrón que
   * `CrearMesaDto.etiqueta`.
   */
  @ApiProperty({
    type: String,
    minLength: 1,
    maxLength: 100,
    description: 'Nombre de quien reserva.',
    example: 'Ana Pérez',
  })
  @IsString()
  @Matches(/\S/, {
    message: 'nombreCliente no puede estar vacío ni contener solo espacios.',
  })
  @MaxLength(100)
  nombreCliente!: string;

  @ApiProperty({
    type: String,
    format: 'email',
    maxLength: 254,
    description:
      'Email de quien reserva. Junto con el código, sirve para consultar o cancelar.',
    example: 'ana.perez@example.com',
  })
  @IsEmail({}, { message: 'emailCliente debe ser un email válido' })
  @MaxLength(254)
  emailCliente!: string;

  @ApiProperty({
    type: String,
    minLength: 1,
    maxLength: 30,
    description: 'Teléfono de contacto, en formato libre.',
    example: '+54 9 11 5555-1234',
  })
  @IsString()
  @Matches(/\S/, {
    message: 'telefonoCliente no puede estar vacío ni contener solo espacios.',
  })
  @MaxLength(30)
  telefonoCliente!: string;
}
