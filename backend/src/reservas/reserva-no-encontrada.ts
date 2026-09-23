import { NotFoundException } from '@nestjs/common';

/**
 * Texto fijo del `404` cuando no hay una Reserva con ese código **y** ese email. Es el mismo
 * para "el código no existe" y "el email no coincide", y no repite ninguno de los dos datos
 * recibidos: quien consulta no puede deducir si un código existe (config.yaml §5,
 * design.md D3 y D8).
 */
export const RESERVA_NO_ENCONTRADA_MENSAJE =
  'No se encontró una reserva con ese código y email';

/**
 * Arma el `404` genérico. La consulta pública (`reserva-consultar`) y la cancelación por
 * código y email (`cancelacion-turnos`) lo comparten, para que las dos rutas respondan el
 * mismo cuerpo, como exigen sus specs.
 */
export function reservaNoEncontrada(): NotFoundException {
  return new NotFoundException(RESERVA_NO_ENCONTRADA_MENSAJE);
}
