const FORMATO_CODIGO_RESERVA = /^[A-Za-z0-9]{8}$/;

/** El código de reserva son 8 caracteres alfanuméricos (sin distinguir mayúsculas). */
export function esCodigoReservaValido(codigo: string): boolean {
  return FORMATO_CODIGO_RESERVA.test(codigo);
}
