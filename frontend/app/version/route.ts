// Versión desplegada del frontend (D1 y D7 de openspec/changes/verificacion-version-desplegada).
//
// El CD pide esta ruta al sitio público después de cada despliegue y compara el SHA con el que
// acaba de desplegar (scripts/cd/verificar-version.mjs). El SHA lo fija frontend/Dockerfile al
// construir la imagen (`BUILD_SHA`); en desarrollo no existe y se responde «desconocido».
//
// Es pública a propósito: el repositorio es público, el SHA no es un secreto y la ruta no
// recibe nada del pedido (ni la query ni el cuerpo), así que no refleja entrada de nadie. No
// agregar acá ningún otro dato (versiones de Node o de Next, variables de entorno, fechas).
//
// `force-dynamic`: Next no la prerrenderiza en el build, que dejaría el valor del momento de
// construir. La variable se lee en cada pedido. Los métodos que no se exportan (POST, PUT,
// PATCH, DELETE) los resuelve Next con `405`. Verificado contra
// node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md.
export const dynamic = "force-dynamic";

const FORMATO_SHA = /^[0-9a-f]{40}$/;

export function GET() {
  const valor = process.env.BUILD_SHA ?? "";
  // Un valor con otro formato no se repite en la respuesta: se informa como desconocido.
  const sha = FORMATO_SHA.test(valor) ? valor : "desconocido";

  // `no-store`: ni el navegador ni una capa de borde (Cloudflare) la reutilizan. Si alguna regla
  // de la zona la cachea igual, la comprobación del CD lo detecta.
  return Response.json({ sha }, { headers: { "Cache-Control": "no-store" } });
}
