/**
 * Lectura presentacional de un aforo (`ocupado` sobre `maximo`): porcentaje, lugares libres y
 * un nivel con nombre. No decide ninguna regla de negocio: el tope duro y el cálculo del aforo
 * viven en `lib/aforo` y en el backend; esto solo traduce esos dos números a algo escaneable.
 */

export type NivelAforo = "holgado" | "casi-lleno" | "completo" | "sobrecupo" | "sin-aforo";

export const ETIQUETA_NIVEL: Record<NivelAforo, string> = {
  holgado: "Con lugar",
  "casi-lleno": "Casi lleno",
  completo: "Completo",
  sobrecupo: "Sobrecupo",
  "sin-aforo": "Sin aforo",
};

/** Desde este porcentaje de ocupación una zona pasa a «Casi lleno». */
export const UMBRAL_CASI_LLENO = 80;

export type LecturaAforo = {
  nivel: NivelAforo;
  /** Porcentaje entero de ocupación, redondeado hacia abajo y sin tope (110 de 40 es 275). 0 si no hay aforo. */
  porcentaje: number;
  /** Lugares libres, nunca negativos. */
  libres: number;
  /** Ancho de la barra, entre 0 y 100. */
  ancho: number;
};

export function leerAforo(ocupado: number, maximo: number): LecturaAforo {
  if (maximo <= 0) {
    return { nivel: "sin-aforo", porcentaje: 0, libres: 0, ancho: ocupado > 0 ? 100 : 0 };
  }
  const razon = (ocupado / maximo) * 100;
  // Entero hacia abajo y calculado con enteros: ni el redondeo ni la coma flotante lo adelantan
  // (39 de 49 es 79 %, no 80 %; 199 de 200 es 99 %, no 100 %).
  const porcentaje = Math.floor((ocupado * 100) / maximo);
  const libres = Math.max(0, maximo - ocupado);
  const ancho = Math.min(100, Math.max(0, razon));
  let nivel: NivelAforo = "holgado";
  if (ocupado > maximo) nivel = "sobrecupo";
  else if (ocupado === maximo) nivel = "completo";
  else if (porcentaje >= UMBRAL_CASI_LLENO) nivel = "casi-lleno";
  return { nivel, porcentaje, libres, ancho };
}
