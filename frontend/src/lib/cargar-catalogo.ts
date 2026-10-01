import { apiClient, toApiResult } from "./api/client";
import type { ErrorApi } from "./api/errors";
import type { components } from "./api/schema";

type ZonaPublica = components["schemas"]["ZonaPublicaRespuestaDto"];
type TurnoPublico = components["schemas"]["TurnoPublicoRespuestaDto"];

export type CatalogoCargado =
  | { zonas: ZonaPublica[]; turnos: TurnoPublico[]; error?: never }
  | { zonas?: never; turnos?: never; error: ErrorApi };

/**
 * Carga zonas y turnos en paralelo para las páginas del asistente de reserva. Sin caché:
 * `router.refresh()` de "Reintentar" tiene que volver a llegar al backend. Si alguna petición
 * falla devuelve un solo `error`; un límite de intentos (429) de cualquiera de las dos gana, para
 * que la página no ofrezca "Reintentar" a quien tiene que esperar.
 */
export async function cargarCatalogo(): Promise<CatalogoCargado> {
  const [zonas, turnos] = await Promise.all([
    toApiResult(apiClient.GET("/zonas", { cache: "no-store" })),
    toApiResult(apiClient.GET("/turnos", { cache: "no-store" })),
  ]);

  if (zonas.error || turnos.error) {
    const errores = [zonas.error, turnos.error].filter((error) => error !== undefined);
    const error = errores.find((candidato) => candidato.tipo === "limite-de-intentos") ?? errores[0];
    return { error };
  }
  return { zonas: zonas.data, turnos: turnos.data };
}
