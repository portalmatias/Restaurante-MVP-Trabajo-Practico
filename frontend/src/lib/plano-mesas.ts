import type { components } from "./api/schema";

export type PlanoMesas = components["schemas"]["PlanoMesasRespuesta"];
export type MesaPlano = components["schemas"]["MesaPlano"];
export type EstadoMesa = components["schemas"]["EstadoMesaPlano"];

const TEXTO_ESTADO: Record<EstadoMesa, string> = {
  LIBRE: "Libre",
  OCUPADA: "Ocupada",
  NO_ALCANZA: "No alcanza",
};

/**
 * Estado de una mesa en palabras, para la lista y la leyenda (design.md D5 y D7). Si el backend
 * agrega un estado antes que este frontend (los despliegues no son simultáneos), el tipo no lo
 * garantiza en ejecución: se muestra un texto neutro en vez de "undefined".
 */
export function textoEstado(estado: EstadoMesa): string {
  return TEXTO_ESTADO[estado] ?? "Sin información";
}

function comensales(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? "comensal" : "comensales"}`;
}

/** Columnas y filas de la grilla de la zona. */
export type Grilla = Pick<PlanoMesas, "columnas" | "filas">;

/**
 * Una mesa se dibuja si tiene posición y entra entera en la grilla de su zona. Una mesa que
 * cambió de zona conserva su posición anterior y puede quedar afuera (design.md, riesgos): se
 * trata como sin ubicar en vez de dibujarla recortada.
 */
function estaUbicada(mesa: MesaPlano, { columnas, filas }: Grilla): boolean {
  return (
    mesa.posX !== null &&
    mesa.posY !== null &&
    mesa.posX >= 0 &&
    mesa.posY >= 0 &&
    mesa.posX + mesa.ancho <= columnas &&
    mesa.posY + mesa.alto <= filas
  );
}

/** Fila de la lista textual: "Mesa S3, para 4 comensales: libre" (design.md D7). */
export function describirMesa(mesa: MesaPlano, grilla: Grilla): string {
  const descripcion = `Mesa ${mesa.etiqueta}, para ${comensales(mesa.capacidad)}: ${textoEstado(mesa.estado).toLowerCase()}`;
  return estaUbicada(mesa, grilla) ? descripcion : `${descripcion} (sin ubicar en el plano)`;
}

/**
 * Resumen del plano con la cantidad de mesas por estado, para el texto con `role="status"`
 * (design.md D7). Cuenta también las mesas sin ubicar y las de un estado desconocido: están en
 * la lista.
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
  const inicio = `En la zona ${zona} hay ${textoLibres} para ${comensales(cantidad)}, ${textoOcupadas}`;
  // Un estado que este frontend no conoce figura en la lista como "sin información": el
  // resumen también lo cuenta, para no contradecirla.
  const desconocidas = mesas.length - libres - ocupadas - noAlcanzan;
  if (desconocidas === 0) return `${inicio} y ${textoNoAlcanzan}.`;
  return `${inicio}, ${textoNoAlcanzan} y ${desconocidas} sin información.`;
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

/**
 * Mesas que se dibujan. Las sin ubicar (sin posición o fuera de la grilla) solo van en la lista
 * (design.md D5), que muestra todas las mesas y las marca con `describirMesa`.
 */
export function mesasUbicadas(mesas: readonly MesaPlano[], grilla: Grilla): MesaPlano[] {
  return mesas.filter((mesa) => estaUbicada(mesa, grilla));
}
