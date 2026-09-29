import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

/** Mismo formato que publica el contrato para el código de reserva (design.md). */
const FORMATO_CODIGO = /^[A-Za-z0-9]{8}$/;

/**
 * Valida `:codigo` en `POST /reservas/:codigo/cancelar` (un path param, no un DTO de body,
 * pero igual pasa por el `ValidationPipe` global: config.yaml §7, "todo input de API se
 * valida con un DTO"). Un formato inválido responde `400`, no `404` — un código bien
 * formado pero inexistente sí es `404` (design.md).
 */
export class CodigoReservaParamDto {
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
}
