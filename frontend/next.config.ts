import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// Next solo carga los `.env*` de su propia carpeta (`frontend/`), pero el `.env` del proyecto
// vive en la raíz del monorepo (config.yaml §10). Se carga con `process.loadEnvFile` de Node,
// sin dependencias nuevas. `npm run dev`/`build` corren con `frontend/` como directorio
// actual, así que la raíz es `..`. Las variables ya exportadas en el entorno (por ejemplo en
// CI) tienen prioridad sobre las del archivo.
const envRaiz = resolve(process.cwd(), "..", ".env");
if (existsSync(envRaiz)) {
  process.loadEnvFile(envRaiz);
}

const nextConfig: NextConfig = {
  // D6 de openspec/changes/frontend-base/design.md: proxy de mismo origen para que el
  // navegador nunca llame directo al backend (evita configurar CORS en backend/). Verificado
  // contra node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/
  // rewrites.md ("Rewriting to an external URL"): un rewrite admite un destino externo y
  // conserva método, query y body.
  async rewrites() {
    const urlBackend = process.env.NEXT_PUBLIC_API_URL;
    if (!urlBackend) {
      throw new Error(
        "Falta NEXT_PUBLIC_API_URL: debe definirse en el .env de la raíz del proyecto (ver .env.example) o en el entorno.",
      );
    }
    return [
      {
        source: "/api/:path*",
        destination: `${urlBackend}/:path*`,
      },
    ];
  },
};

export default nextConfig;
