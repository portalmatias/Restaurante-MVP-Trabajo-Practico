/**
 * Validación del layout del plano de una zona (change `plano-mesas`, design.md D1).
 *
 * La base garantiza con CHECK que cada mesa ubicada tiene coordenadas no negativas y tamaño de
 * al menos 1, pero no puede garantizar que la mesa entre en la grilla de su zona (cruza dos
 * tablas) ni que no se superponga con otra (no es una invariante de negocio, solo visual). Lo
 * valida quien escribe posiciones: hoy el seed, mañana el editor del admin (D6).
 *
 * Función pura, sin Prisma: el seed la importa desde acá.
 */

/** Dimensiones de la grilla del plano de una zona, en celdas. */
export interface DimensionesPlano {
  planoColumnas: number;
  planoFilas: number;
}

/** Lo que el layout necesita saber de una mesa: dónde está y cuánto ocupa. */
export interface MesaEnPlano {
  etiqueta: string;
  /** Nulo si la mesa no está ubicada en el plano (entonces se ignora). */
  posX: number | null;
  posY: number | null;
  ancho: number;
  alto: number;
}

interface MesaUbicada extends MesaEnPlano {
  posX: number;
  posY: number;
}

function estaUbicada(mesa: MesaEnPlano): mesa is MesaUbicada {
  return mesa.posX !== null && mesa.posY !== null;
}

/** Dos rectángulos se superponen si comparten al menos una celda (tocarse por un lado no). */
function seSuperponen(a: MesaUbicada, b: MesaUbicada): boolean {
  return (
    a.posX < b.posX + b.ancho &&
    b.posX < a.posX + a.ancho &&
    a.posY < b.posY + b.alto &&
    b.posY < a.posY + a.alto
  );
}

/**
 * Devuelve la lista de problemas del layout, en el orden de `mesas` (vacía si es válido):
 * mesas que se salen de la grilla y pares de mesas que se superponen. Las mesas sin ubicar no
 * se validan. Informa todos los problemas, no solo el primero.
 */
export function validarLayout(
  zona: DimensionesPlano,
  mesas: MesaEnPlano[],
): string[] {
  const problemas: string[] = [];
  const ubicadas = mesas.filter(estaUbicada);

  for (const mesa of ubicadas) {
    if (
      mesa.posX + mesa.ancho > zona.planoColumnas ||
      mesa.posY + mesa.alto > zona.planoFilas
    ) {
      problemas.push(
        `La mesa ${mesa.etiqueta} queda fuera de la grilla de ${zona.planoColumnas} por ${zona.planoFilas}.`,
      );
    }
  }

  for (let i = 0; i < ubicadas.length; i++) {
    for (let j = i + 1; j < ubicadas.length; j++) {
      if (seSuperponen(ubicadas[i], ubicadas[j])) {
        problemas.push(
          `Las mesas ${ubicadas[i].etiqueta} y ${ubicadas[j].etiqueta} se superponen.`,
        );
      }
    }
  }

  return problemas;
}
