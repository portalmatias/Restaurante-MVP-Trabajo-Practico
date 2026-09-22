import { ApiProperty, ApiSchema } from '@nestjs/swagger';

/**
 * Cuerpo de error por defecto de NestJS, publicado como schema para poder referenciarlo
 * desde el `400` y el `404` del contrato. No hay filtro de excepciones propio (D8).
 */
@ApiSchema({
  description:
    'Cuerpo de error por defecto de NestJS. En un `400` del `ValidationPipe`, `message` es la lista de problemas encontrados; en un `404`, es un único texto.',
})
export class ErrorRespuesta {
  @ApiProperty({
    type: 'integer',
    description: 'Código HTTP de la respuesta.',
    example: 404,
  })
  statusCode!: number;

  @ApiProperty({
    description:
      'Detalle del error. Un texto, o una lista de textos si son varios.',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message!: string | string[];

  @ApiProperty({
    type: String,
    description: 'Nombre estándar del código HTTP.',
    example: 'Not Found',
  })
  error!: string;
}
