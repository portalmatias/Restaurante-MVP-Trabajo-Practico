/**
 * Elige la URL base del cliente HTTP (D6 de `design.md`):
 * - En el navegador (`window` presente), `/api`: el proxy de mismo origen que
 *   `next.config.ts` reenvía al backend, así no hace falta CORS.
 * - En el servidor (Server Components), `NEXT_PUBLIC_API_URL` directo: una URL relativa no
 *   sirve fuera del navegador y el salto por el proxy no aporta nada.
 *
 * Es la única función que decide la URL base: no hay otra URL escrita en el código.
 */
export function urlBaseApi(): string {
  if (typeof window !== "undefined") {
    return "/api";
  }

  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_API_URL no está definida: hace falta para armar peticiones desde el servidor (D6).",
    );
  }

  return url;
}
