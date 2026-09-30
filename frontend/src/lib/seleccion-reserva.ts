import type { components } from "./api/schema";
import { diaSemanaDeFechaLocal, leerFechaIso } from "./fecha-hora";

type ZonaPublica = components["schemas"]["ZonaPublicaRespuestaDto"];
type TurnoPublico = components["schemas"]["TurnoPublicoRespuestaDto"];

/** Selección del asistente de reserva, tal como viaja en la URL de cada paso (design.md D1). */
export type SeleccionReserva = {
  fecha: string;
  turnoId: string;
  zonaId: string;
  comensales: number;
};

/** Los mismos cuatro valores como llegan de `searchParams`: texto sin validar. */
export type SeleccionCruda = {
  fecha?: string;
  turnoId?: string;
  zonaId?: string;
  comensales?: string;
};

/**
 * URL de un paso del asistente con la selección como query. Omite los valores ausentes, así
 * "Volver a empezar" (sin selección) devuelve la ruta sola.
 */
export function urlConSeleccion(ruta: string, seleccion: Partial<SeleccionReserva>): string {
  const params = new URLSearchParams();
  if (seleccion.fecha !== undefined) params.set("fecha", seleccion.fecha);
  if (seleccion.turnoId !== undefined) params.set("turnoId", seleccion.turnoId);
  if (seleccion.zonaId !== undefined) params.set("zonaId", seleccion.zonaId);
  if (seleccion.comensales !== undefined) params.set("comensales", String(seleccion.comensales));
  const query = params.toString();
  return query === "" ? ruta : `${ruta}?${query}`;
}

/**
 * `true` si `fecha` es una fecha `YYYY-MM-DD` que existe en el calendario y no es anterior a
 * `hoy` (el mínimo que admite el selector). Es una ayuda de navegación: la anticipación de cada
 * zona la valida siempre el servidor.
 */
export function esFechaElegible(fecha: string, hoy: string): boolean {
  try {
    leerFechaIso(fecha);
  } catch {
    return false;
  }
  return fecha >= hoy;
}

/** Entero positivo escrito en decimal, sin signo, espacios ni parte fraccionaria. */
function leerEnteroPositivo(texto: string | undefined): number | undefined {
  return texto !== undefined && /^[1-9]\d*$/.test(texto) ? Number(texto) : undefined;
}

/**
 * Valores iniciales del Paso 1 a partir de la URL (design.md D3 Pantalla 2). Todo valor que no
 * es coherente se ignora, sin acotarlo ni fallar, en el orden en que cada uno depende del
 * anterior: fecha, zona, turno (existe y es del día de la fecha) y comensales (entero dentro
 * del rango de la zona).
 */
export function resolverSeleccionInicial(
  cruda: SeleccionCruda,
  catalogo: { zonas: readonly ZonaPublica[]; turnos: readonly TurnoPublico[]; hoy: string },
): Partial<SeleccionReserva> {
  const fecha =
    cruda.fecha !== undefined && esFechaElegible(cruda.fecha, catalogo.hoy) ? cruda.fecha : undefined;
  const zona = catalogo.zonas.find((candidata) => candidata.id === cruda.zonaId);
  const turno = catalogo.turnos.find(
    (candidato) =>
      candidato.id === cruda.turnoId && fecha !== undefined && candidato.diaSemana === diaSemanaDeFechaLocal(fecha),
  );
  const comensales = leerEnteroPositivo(cruda.comensales);
  const comensalesEnRango =
    zona !== undefined &&
    comensales !== undefined &&
    comensales >= zona.minComensales &&
    comensales <= zona.maxComensales
      ? comensales
      : undefined;

  return {
    fecha,
    zonaId: zona?.id,
    turnoId: turno?.id,
    comensales: comensalesEnRango,
  };
}
