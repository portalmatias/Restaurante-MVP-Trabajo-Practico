import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // D6 de openspec/changes/frontend-base/design.md: proxy de mismo origen para que el
  // navegador nunca llame directo al backend (evita configurar CORS en backend/). Verificado
  // contra node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/
  // rewrites.md ("Rewriting to an external URL"): un rewrite admite un destino externo y
  // conserva método, query y body.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
