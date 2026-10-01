import type { components } from "./api/schema";
import { diaSemanaDeFechaLocal, leerFechaIso } from "./fecha-hora";
import { esCodigoReservaValido } from "./reserva-codigo";

type ZonaPublica = components["schemas"]["ZonaPublicaRespuestaDto"];
type TurnoPublico = components["schemas"]["TurnoPublicoRespuestaDto"];
type ReservaCreada = components["schemas"]["ReservaCreadaRespuesta"];

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

function esFechaDeCalendario(fecha: string): boolean {
  try {
    leerFechaIso(fecha);
    return true;
  } catch {
    return false;
  }
}

/**
 * `true` si `fecha` es una fecha `YYYY-MM-DD` que existe en el calendario y no es anterior a
 * `hoy` (el mínimo que admite el selector). Es una ayuda de navegación: la anticipación de cada
 * zona la valida siempre el servidor.
 */
export function esFechaElegible(fecha: string, hoy: string): boolean {
  return esFechaDeCalendario(fecha) && fecha >= hoy;
}

/**
 * Entero positivo escrito en decimal, sin signo, espacios ni parte fraccionaria. Descarta lo que
 * no es un entero seguro (una cadena enorme de dígitos daría `Infinity` o perdería precisión).
 */
function leerEnteroPositivo(texto: string | undefined): number | undefined {
  if (texto === undefined || !/^[1-9]\d*$/.test(texto)) return undefined;
  const numero = Number(texto);
  return Number.isSafeInteger(numero) ? numero : undefined;
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

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Selección completa y con forma válida leída de `searchParams` (Paso 2 en adelante), o
 * `undefined` si falta algún valor, está repetido o no tiene el formato esperado. Solo mira la
 * forma: que la fecha sea pasada, o que el turno o la zona ya no existan, lo informa el
 * servidor al consultar.
 */
export function leerSeleccionDeQuery(
  query: Record<string, string | string[] | undefined>,
): SeleccionReserva | undefined {
  const { fecha, turnoId, zonaId } = query;
  const comensales = leerEnteroPositivo(typeof query.comensales === "string" ? query.comensales : undefined);
  if (
    typeof fecha !== "string" ||
    !esFechaDeCalendario(fecha) ||
    typeof turnoId !== "string" ||
    !FORMATO_UUID.test(turnoId) ||
    typeof zonaId !== "string" ||
    !FORMATO_UUID.test(zonaId) ||
    comensales === undefined
  ) {
    return undefined;
  }
  return { fecha, turnoId, zonaId, comensales };
}

/** Reserva recién creada, tal como viaja en la URL de la pantalla de éxito (design.md D1). */
export type ConfirmacionReserva = SeleccionReserva & {
  codigo: string;
  estado: ReservaCreada["estado"];
};

/**
 * URL de la pantalla de éxito: el código, el estado y la selección que devolvió el servidor.
 * Nunca lleva datos de contacto (nombre, email, teléfono).
 */
export function urlDeExito(confirmacion: ConfirmacionReserva): string {
  const { codigo, estado, ...seleccion } = confirmacion;
  const params = new URLSearchParams({ codigo, estado });
  const query = urlConSeleccion("", seleccion).slice(1);
  return `/reservas/nueva/exito?${params.toString()}&${query}`;
}

/**
 * Confirmación completa y con forma válida leída de `searchParams` (pantalla de éxito), o
 * `undefined` si falta algún valor, está repetido o no tiene el formato esperado.
 */
export function leerConfirmacionDeQuery(
  query: Record<string, string | string[] | undefined>,
): ConfirmacionReserva | undefined {
  const seleccion = leerSeleccionDeQuery(query);
  const { codigo, estado } = query;
  if (
    !seleccion ||
    typeof codigo !== "string" ||
    !esCodigoReservaValido(codigo) ||
    (estado !== "CONFIRMADA" && estado !== "PENDIENTE")
  ) {
    return undefined;
  }
  return { codigo, estado, ...seleccion };
}
