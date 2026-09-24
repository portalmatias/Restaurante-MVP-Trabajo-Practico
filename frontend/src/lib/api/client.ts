import createClient from "openapi-fetch";
import type { paths } from "./schema";
import { urlBaseApi } from "./url-base";
import { mapErrorApi, type ApiResult } from "./errors";

/**
 * Cliente HTTP tipado desde el contrato (`paths` generado por `openapi-typescript`, D5), con
 * la URL base que decide `urlBaseApi()` (D6). Ningún otro lugar del código arma una URL fija
 * hacia el backend.
 */
export const apiClient = createClient<paths>({ baseUrl: urlBaseApi() });

/**
 * Traduce el resultado crudo de una llamada de `apiClient` (`{ data, error, response }`) a
 * `ApiResult<T>`, aplicando el mapeo de `errors.ts` cuando `error` está presente (D7).
 *
 * Se usa envolviendo la llamada ya hecha, por ejemplo
 * `toApiResult(apiClient.GET("/disponibilidad", { params: {...} }))`: la llamada al método
 * tipado ocurre normal, con el chequeo de tipos por path de D5/D6.7 intacto (`params`/`body`
 * requeridos según el path, `data` tipado con el schema de la respuesta 2xx). No se
 * reconstruye `apiClient` como un objeto con sus propios `GET`/`POST`/etc.: `openapi-fetch`
 * tipa esos métodos con genéricos por path (`ClientMethod`, ver
 * `node_modules/openapi-fetch/dist/index.d.ts`) que se pierden si se envuelven método por
 * método sin depender de `openapi-typescript-helpers` (una dependencia nueva no aprobada en
 * `design.md`, verificado con un experimento de `tsc` que aceptaba una llamada inválida y
 * tipaba `data` como `{}`). Envolver la llamada ya invocada, en cambio, no tiene ese problema:
 * `T` se infiere del resultado concreto de esa llamada puntual.
 */
export async function toApiResult<T>(
  promise: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<ApiResult<T>> {
  let resultado: { data?: T; error?: unknown; response: Response };
  try {
    resultado = await promise;
  } catch {
    // `fetch` rechaza sin respuesta (red caída, proxy inalcanzable, petición abortada): se
    // informa como error del resultado y no como una excepción que la UI tenga que atrapar.
    return { error: { tipo: "desconocido", mensaje: "No se pudo conectar con el servidor." } };
  }

  const { data, error, response } = resultado;
  // Se decide por `response.ok` y no solo por `error`: con un error sin cuerpo
  // (`Content-Length: 0`), `openapi-fetch` devuelve `error: undefined`.
  if (!response.ok || error !== undefined) {
    return { error: mapErrorApi(response.status, error) };
  }
  return { data: data as T };
}
