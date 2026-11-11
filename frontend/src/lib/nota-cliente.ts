/** Largo máximo de la nota del cliente, igual que el backend (D2 de `reserva-nota-cliente`). */
export const NOTA_CLIENTE_MAX = 500;

/**
 * Largo de la nota como lo cuenta el backend: en puntos de código y sin los espacios de los
 * bordes (D2 y D5). Un emoji simple cuenta uno; uno compuesto o con selector de variación,
 * varios. `string.length` no sirve porque cuenta unidades UTF-16.
 */
export function largoDeNota(texto: string): number {
  return Array.from(texto.trim()).length;
}

/**
 * Clave de `sessionStorage` donde el formulario deja la nota guardada para la pantalla de
 * confirmación (D5): la nota no puede viajar en la URL, porque puede traer datos de salud.
 */
export function claveNotaDeReserva(codigoReserva: string): string {
  return `reserva-nota:${codigoReserva}`;
}

// `sessionStorage` puede no estar disponible (modo privado, almacenamiento bloqueado): en ese
// caso la confirmación simplemente no muestra la nota (D5), nunca falla.

export function guardarNotaDeReserva(codigoReserva: string, nota: string): void {
  try {
    window.sessionStorage.setItem(claveNotaDeReserva(codigoReserva), nota);
  } catch {
    // Sin almacenamiento disponible: no se muestra la nota en la confirmación.
  }
}

export function leerNotaDeReserva(codigoReserva: string): string | null {
  try {
    return window.sessionStorage.getItem(claveNotaDeReserva(codigoReserva));
  } catch {
    return null;
  }
}

export function borrarNotaDeReserva(codigoReserva: string): void {
  try {
    window.sessionStorage.removeItem(claveNotaDeReserva(codigoReserva));
  } catch {
    // Nada que borrar si el almacenamiento no está disponible.
  }
}
