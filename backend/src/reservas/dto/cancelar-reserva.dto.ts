import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';

/**
 * Body de `POST /reservas/:codigo/cancelar` (design.md, "Rutas"). Solo el email: el código
 * va en la URL (`CodigoReservaParamDto`), no acá. Los `@ApiProperty` tienen que generar
 * exactamente el schema `CancelarReservaDto` de `openapi/openapi.yaml` — `openapi:check`
 * compara los dos documentos de forma literal.
 */
export class CancelarReservaDto {
  @ApiProperty({
    description: 'Email registrado en la reserva.',
    type: String,
    format: 'email',
    maxLength: 254,
    example: 'ana.perez@example.com',
  })
  @IsEmail({}, { message: 'email debe ser un email válido' })
  @MaxLength(254, { message: 'email debe tener como máximo 254 caracteres' })
  email!: string;
}
