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

/** Lo que hace falta saber de una mesa para ubicarla: dónde empieza y cuánto ocupa (desde 0). */
export type Ubicable = Pick<MesaPlano, "posX" | "posY" | "ancho" | "alto">;

/**
 * Una mesa se dibuja si tiene posición y entra entera en la grilla de su zona. Una mesa que
 * cambió de zona conserva su posición anterior y puede quedar afuera (design.md, riesgos): se
 * trata como sin ubicar en vez de dibujarla recortada.
 */
export function entraEnGrilla(mesa: Ubicable, { columnas, filas }: Grilla): boolean {
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
  return entraEnGrilla(mesa, grilla) ? descripcion : `${descripcion} (sin ubicar en el plano)`;
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
export function ordenarMesas<M extends Pick<MesaPlano, "etiqueta">>(mesas: readonly M[]): M[] {
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
  return mesas.filter((mesa) => entraEnGrilla(mesa, grilla));
}

// Formulario de ubicación del admin (change `plano-mesas-admin`, design.md D5). Columna y fila
// se numeran desde 1, como en la pantalla; las coordenadas de la API, desde 0.

/** Valores de inicio (columna o fila, desde 1) con los que una mesa de `tamano` celdas entra. */
export function opcionesInicio(tamano: number, total: number): number[] {
  return Array.from({ length: Math.max(total - tamano + 1, 0) }, (_, i) => i + 1);
}

/** Pasa al último inicio que entra si el tamaño creció; lo vacío sigue vacío. */
export function corregirInicio(
  valor: number | undefined,
  tamano: number,
  total: number,
): number | undefined {
  if (valor === undefined) return undefined;
  return Math.max(Math.min(valor, total - tamano + 1), 1);
}

/** "la columna 6", "las columnas 6 y 7" o "las columnas 6 a 8". */
function rango(inicio: number, tamano: number, singular: string, plural: string): string {
  if (tamano === 1) return `${singular} ${inicio}`;
  const fin = inicio + tamano - 1;
  return tamano === 2 ? `${plural} ${inicio} y ${fin}` : `${plural} ${inicio} a ${fin}`;
}

/** Texto de la vista previa: "S3 ocupa las columnas 6 y 7, filas 1 y 2." */
export function describirUbicacion({
  etiqueta,
  columna,
  fila,
  ancho,
  alto,
}: {
  etiqueta: string;
  columna: number;
  fila: number;
  ancho: number;
  alto: number;
}): string {
  const columnas = rango(columna, ancho, "la columna", "las columnas");
  const filas = rango(fila, alto, "fila", "filas");
  return `${etiqueta} ocupa ${columnas}, ${filas}.`;
}

/**
 * Etiquetas de las `otras` mesas ubicadas que comparten al menos una celda con `mesa`, en orden
 * natural. Tocarse por un lado no cuenta. Es la misma regla que `problemasDeUbicacion` del
 * backend, que no se puede importar desde acá (`config.yaml` §4): solo arma un aviso, la API
 * decide. Quien llama no incluye a la propia mesa entre las `otras`.
 */
export function superposiciones(
  mesa: Ubicable,
  otras: readonly (Ubicable & Pick<MesaPlano, "etiqueta">)[],
): string[] {
  if (mesa.posX === null || mesa.posY === null) return [];
  const { posX, posY } = mesa;
  const superpuestas = otras.filter(
    (otra) =>
      otra.posX !== null &&
      otra.posY !== null &&
      posX < otra.posX + otra.ancho &&
      otra.posX < posX + mesa.ancho &&
      posY < otra.posY + otra.alto &&
      otra.posY < posY + mesa.alto,
  );
  return ordenarMesas(superpuestas).map((otra) => otra.etiqueta);
}
