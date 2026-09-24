import createClient from "openapi-fetch";
import type { paths } from "./schema";
import { urlBaseApi } from "./url-base";

/**
 * Cliente HTTP tipado desde el contrato (`paths` generado por `openapi-typescript`, D5), con
 * la URL base que decide `urlBaseApi()` (D6). Ningún otro lugar del código arma una URL fija
 * hacia el backend.
 */
export const apiClient = createClient<paths>({ baseUrl: urlBaseApi() });
