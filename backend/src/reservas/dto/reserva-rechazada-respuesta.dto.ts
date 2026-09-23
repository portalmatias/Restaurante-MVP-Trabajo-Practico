import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { MotivoNoDisponible } from '../../disponibilidad/dto/disponibilidad-respuesta.dto';

/**
 * Cuerpo del `409` de `POST /reservas` (design.md D8/D9). Reusa `MotivoNoDisponible` de
 * `disponibilidad` sin redefinirlo: los mismos códigos y mensajes que informa la consulta.
 * `motivos` vacío significa un choque de concurrencia, no una regla de negocio.
 */
@ApiSchema({ description: 'Cuerpo del `409` de la creación de reservas.' })
export class ReservaRechazadaRespuesta {
  @ApiProperty({
    type: 'integer',
    description: 'Siempre 409.',
    example: 409,
  })
  statusCode!: number;

  @ApiProperty({
    type: String,
    description: 'Explicación general en español.',
    example: 'No se pudo crear la reserva',
  })
  message!: string;

  @ApiProperty({
    type: String,
    description: 'Nombre estándar del código HTTP.',
    example: 'Conflict',
  })
  error!: string;

  @ApiProperty({
    type: [MotivoNoDisponible],
    description:
      'Todas las reglas que impiden la reserva, en el orden fijo de `CodigoMotivo`. Vacío solo cuando el rechazo se debe a un choque con reservas simultáneas.',
  })
  motivos!: MotivoNoDisponible[];
}
