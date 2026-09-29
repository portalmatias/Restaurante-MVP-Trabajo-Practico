import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
  Validate,
} from 'class-validator';
import { EstadoReserva } from '@prisma/client';

import { EsFechaDeCalendarioExistente } from '../../disponibilidad/dto/consultar-disponibilidad.dto';

/** El mismo patrón que publica el contrato (design.md D6 de `reserva-consultar`). */
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Query params de `GET /admin/reservas` (design.md D6 y D7). Todos opcionales; los filtros
 * presentes se combinan con AND (D6). `limit`/`offset` llegan como texto en la query y
 * necesitan `@Type(() => Number)` más `transform: true` en el `ValidationPipe` global para
 * convertirse antes de validar (D7 de `disponibilidad`, ya vigente en `main.ts`).
 *
 * Reutiliza `EsFechaDeCalendarioExistente` de `disponibilidad`: la misma definición de
 * "fecha de calendario válida" que usa la consulta de disponibilidad, sin duplicarla (D6).
 *
 * Los `@ApiProperty`/`@ApiPropertyOptional` de este archivo no generan por sí solos los
 * `parameters` del contrato OpenAPI (el proyecto no usa el plugin CLI de reflection de
 * `@nestjs/swagger`): `ReservasAdminController.listar` los declara explícitos con
 * `@ApiQuery` (mismo patrón que `MesasController.listar`).
 */
export class ListarReservasDto {
  @ApiPropertyOptional({
    description:
      'Fecha de calendario local del restaurante, sin hora (`YYYY-MM-DD`).',
    type: String,
    format: 'date',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
    example: '2026-09-19',
  })
  @IsOptional()
  @Matches(FORMATO_FECHA, {
    message:
      'fecha debe ser una fecha de calendario con formato YYYY-MM-DD, sin hora',
  })
  @Validate(EsFechaDeCalendarioExistente)
  fecha?: string;

  @ApiPropertyOptional({
    description: 'Estado de la reserva.',
    enum: EstadoReserva,
    example: 'PENDIENTE',
  })
  @IsOptional()
  @IsEnum(EstadoReserva, {
    message: `estado debe ser uno de: ${Object.values(EstadoReserva).join(', ')}`,
  })
  estado?: EstadoReserva;

  @ApiPropertyOptional({
    description: 'Id de la zona. Un id inexistente devuelve una lista vacía.',
    type: String,
    format: 'uuid',
    example: '5d2a9c41-7e3b-4f6a-a1d8-0c9b2e7f4a63',
  })
  @IsOptional()
  @IsUUID()
  zonaId?: string;

  @ApiPropertyOptional({
    description: 'Id del turno. Un id inexistente devuelve una lista vacía.',
    type: String,
    format: 'uuid',
    example: '3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73',
  })
  @IsOptional()
  @IsUUID()
  turnoId?: string;

  @ApiPropertyOptional({
    description: 'Cantidad máxima de reservas por página.',
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit no debe ser menor a 1' })
  @Max(100, { message: 'limit no debe ser mayor a 100' })
  limit?: number;

  @ApiPropertyOptional({
    description: 'Cantidad de reservas a saltear desde el inicio del listado.',
    type: 'integer',
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'offset debe ser un número entero' })
  @Min(0, { message: 'offset no debe ser menor a 0' })
  offset?: number;
}
