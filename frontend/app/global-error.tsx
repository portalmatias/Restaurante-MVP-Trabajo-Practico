"use client";

import localFont from "next/font/local";
import { useEffect } from "react";
import { PantallaDeEstado } from "../src/components/reservas/pantalla-de-estado";
import { Button } from "../src/components/ui/button";
import "./globals.css";

// Reemplaza al layout raíz cuando éste falla: define `<html>` y `<body>` y vuelve a declarar las
// fuentes con los mismos archivos locales de src/fonts (next/font las reutiliza). No lleva la
// cabecera, que es parte del layout que falló.
const mincho = localFont({
  variable: "--font-mincho",
  display: "swap",
  preload: false,
  src: [
    { path: "../src/fonts/mincho-400.woff", weight: "400", style: "normal" },
    { path: "../src/fonts/mincho-500.woff", weight: "500", style: "normal" },
    { path: "../src/fonts/mincho-700.woff", weight: "700", style: "normal" },
  ],
});

const gothic = localFont({
  variable: "--font-gothic",
  display: "swap",
  preload: false,
  src: [
    { path: "../src/fonts/gothic-400.woff", weight: "400", style: "normal" },
    { path: "../src/fonts/gothic-500.woff", weight: "500", style: "normal" },
    { path: "../src/fonts/gothic-700.woff", weight: "700", style: "normal" },
  ],
});

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es-AR" className={`${mincho.variable} ${gothic.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <title>Algo salió mal | Ichigo</title>
        <main className="flex flex-1 flex-col">
          <PantallaDeEstado tablilla="Algo falló" titulo="Ichigo no está disponible por ahora">
            <p className="max-w-[48ch] text-base text-muted-foreground">
              Ocurrió un problema inesperado. Probá de nuevo en unos minutos.
            </p>
            <div>
              <Button size="lg" onClick={() => unstable_retry()}>
                Reintentar
              </Button>
            </div>
          </PantallaDeEstado>
        </main>
      </body>
    </html>
  );
}
