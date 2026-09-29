import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Formato del código de reserva que publica el contrato (`^[A-Za-z0-9]{8}$`). Acepta
 * mayúsculas y minúsculas: la búsqueda no distingue (design.md D2), aunque el código se
 * genera siempre en mayúsculas.
 */
const FORMATO_CODIGO = /^[A-Za-z0-9]{8}$/;

/**
 * Body de `POST /reservas/consultar` (design.md D1). Es el par código + email completo:
 * ambos tienen que coincidir con la misma Reserva. Los `@ApiProperty` tienen que generar
 * exactamente el schema `ConsultarReservaDto` de `openapi/openapi.yaml`: `openapi:check`
 * compara los dos documentos de forma literal.
 *
 * Los mensajes de validación van en español (config.yaml §8) y nombran el campo, porque un
 * `400` por campo faltante tiene que decir cuál falta. Ninguno revela si un código existe.
 */
export class ConsultarReservaDto {
  @ApiProperty({
    description:
      'Código alfanumérico de 8 caracteres. Se compara sin distinguir mayúsculas y minúsculas.',
    pattern: '^[A-Za-z0-9]{8}$',
    example: 'K7PM3QXA',
  })
  @IsString({ message: 'codigo debe ser un texto de 8 caracteres' })
  @Matches(FORMATO_CODIGO, {
    message: 'codigo debe ser alfanumérico de 8 caracteres',
  })
  codigo!: string;

  @ApiProperty({
    description:
      'Email con el que se hizo la reserva. Se compara sin distinguir mayúsculas y minúsculas.',
    type: String,
    format: 'email',
    maxLength: 254,
    example: 'ana.perez@example.com',
  })
  @IsEmail({}, { message: 'email debe ser un email válido' })
  @MaxLength(254, { message: 'email debe tener como máximo 254 caracteres' })
  email!: string;
}
