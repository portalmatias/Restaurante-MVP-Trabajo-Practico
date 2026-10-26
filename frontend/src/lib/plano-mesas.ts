import type { components } from "./api/schema";

export type PlanoMesas = components["schemas"]["PlanoMesasRespuesta"];
export type MesaPlano = components["schemas"]["MesaPlano"];
export type EstadoMesa = components["schemas"]["EstadoMesaPlano"];

const TEXTO_ESTADO: Record<EstadoMesa, string> = {
  LIBRE: "Libre",
  OCUPADA: "Ocupada",
  NO_ALCANZA: "No alcanza",
};

/** Estado de una mesa en palabras, para la lista y la leyenda (design.md D5 y D7). */
export function textoEstado(estado: EstadoMesa): string {
  return TEXTO_ESTADO[estado];
}

function comensales(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? "comensal" : "comensales"}`;
}

function estaUbicada(mesa: MesaPlano): boolean {
  return mesa.posX !== null && mesa.posY !== null;
}

/** Fila de la lista textual: "Mesa S3, para 4 comensales: libre" (design.md D7). */
export function describirMesa(mesa: MesaPlano): string {
  const descripcion = `Mesa ${mesa.etiqueta}, para ${comensales(mesa.capacidad)}: ${textoEstado(mesa.estado).toLowerCase()}`;
  return estaUbicada(mesa) ? descripcion : `${descripcion} (sin ubicar en el plano)`;
}

/**
 * Resumen del plano con la cantidad de mesas por estado, para el texto con `role="status"`
 * (design.md D7). Cuenta también las mesas sin ubicar: están en la lista.
 */
export function resumirPlano({
  zona,
  comensales: cantidad,
  mesas,
}: {
  zona: string;
  comensales: number;
  mesas: readonly MesaPlano[];
}): string {
  const contar = (estado: EstadoMesa) => mesas.filter((mesa) => mesa.estado === estado).length;
  const libres = contar("LIBRE");
  const ocupadas = contar("OCUPADA");
  const noAlcanzan = contar("NO_ALCANZA");

  const textoLibres = `${libres} ${libres === 1 ? "mesa libre" : "mesas libres"}`;
  const textoOcupadas = `${ocupadas} ${ocupadas === 1 ? "ocupada" : "ocupadas"}`;
  const textoNoAlcanzan = `${noAlcanzan} ${noAlcanzan === 1 ? "que no alcanza" : "que no alcanzan"}`;
  return `En la zona ${zona} hay ${textoLibres} para ${comensales(cantidad)}, ${textoOcupadas} y ${textoNoAlcanzan}.`;
}

/**
 * Mesas por etiqueta en orden natural ("S2" antes que "S10"), con el mismo criterio que el
 * backend (`orden-mesas.ts`): si el orden natural empata (por ejemplo "S1" y "S01"), desempata
 * el texto exacto, así el resultado no depende del orden de entrada.
 */
export function ordenarMesas(mesas: readonly MesaPlano[]): MesaPlano[] {
  return [...mesas].sort(
    (a, b) =>
      a.etiqueta.localeCompare(b.etiqueta, "es", { numeric: true }) ||
      (a.etiqueta < b.etiqueta ? -1 : a.etiqueta > b.etiqueta ? 1 : 0),
  );
}

/** Mesas que se dibujan y mesas sin posición, que solo van en la lista (design.md D5). */
export function separarMesas(mesas: readonly MesaPlano[]): {
  ubicadas: MesaPlano[];
  sinUbicar: MesaPlano[];
} {
  return {
    ubicadas: mesas.filter(estaUbicada),
    sinUbicar: mesas.filter((mesa) => !estaUbicada(mesa)),
  };
}
