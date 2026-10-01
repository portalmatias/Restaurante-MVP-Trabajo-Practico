import createClient from "openapi-fetch";
import { borrarSesion, leerSesion } from "../auth/session";
import { toApiResult } from "./client";
import type { ApiResult } from "./errors";
import type { paths } from "./schema";
import { urlBaseApi } from "./url-base";

/**
 * Cliente HTTP de las pantallas de `/admin/...` (design.md D2): una instancia propia de
 * `createClient`, separada del `apiClient` público, para que ninguna llamada pública lleve un
 * header `Authorization` y ninguna llamada de admin salga sin él.
 */
export const adminClient = createClient<paths>({ baseUrl: urlBaseApi() });

adminClient.use({
  onRequest({ request }) {
    // Sin sesión vigente no se agrega el header: el backend responde 401 y
    // `toAdminApiResult` lo traduce en la redirección al login (D4).
    const sesion = leerSesion();
    if (sesion) {
      request.headers.set("Authorization", `Bearer ${sesion.accessToken}`);
    }
    return request;
  },
});

type ManejadorSesionVencida = () => void;

let manejadorSesionVencida: ManejadorSesionVencida | undefined;

/**
 * Registra qué hacer cuando una llamada de admin responde que la sesión ya no sirve (D4). Lo
 * registra el layout protegido con la navegación de Next; se inyecta en vez de usar
 * `window.location` para poder probarlo sin un navegador real. Devuelve la función que lo
 * desregistra.
 */
export function registrarManejadorSesionVencida(manejador: ManejadorSesionVencida): () => void {
  manejadorSesionVencida = manejador;
  return () => {
    if (manejadorSesionVencida === manejador) {
      manejadorSesionVencida = undefined;
    }
  };
}

/**
 * `toApiResult` sobre `adminClient` (D2): mismo mapeo de errores, más el manejo de la sesión.
 * Un `401` (token ausente, vencido o inválido) o un `403` (token válido sin rol `ADMIN`)
 * descartan la sesión guardada y disparan la redirección al login: con ese token ninguna
 * pantalla de admin puede funcionar. Solo si la sesión guardada sigue siendo la del pedido.
 */
export async function toAdminApiResult<T>(
  promise: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<ApiResult<T>> {
  // Token con el que salió este pedido (la llamada ya se hizo al evaluar el argumento).
  const tokenDelPedido = leerSesion()?.accessToken;
  let status: number | undefined;
  const resultado = await toApiResult(
    promise.then((crudo) => {
      status = crudo.response.status;
      return crudo;
    }),
  );
  if (status === 401 || status === 403) {
    // Una respuesta atrasada de un pedido hecho con un token anterior no debe borrar la sesión
    // nueva (por ejemplo, si el admin volvió a iniciar sesión mientras ese pedido seguía en
    // curso): solo se descarta si la sesión guardada es la misma con la que salió el pedido.
    const sesionActual = leerSesion();
    if (!sesionActual || sesionActual.accessToken === tokenDelPedido) {
      borrarSesion();
      manejadorSesionVencida?.();
    }
  }
  return resultado;
}
