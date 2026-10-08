"use client";

import { Shippori_Mincho, Zen_Kaku_Gothic_New } from "next/font/google";
import { useEffect } from "react";
import { PantallaDeEstado } from "../src/components/reservas/pantalla-de-estado";
import { Button } from "../src/components/ui/button";
import "./globals.css";

// Reemplaza al layout raíz cuando éste falla: define `<html>` y `<body>` y vuelve a declarar las
// fuentes (next/font las reutiliza). No lleva la cabecera, que es parte del layout que falló.
const mincho = Shippori_Mincho({
  variable: "--font-mincho",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
});

const gothic = Zen_Kaku_Gothic_New({
  variable: "--font-gothic",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
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
