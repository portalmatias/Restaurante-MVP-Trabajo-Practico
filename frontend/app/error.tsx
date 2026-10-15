"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PantallaDeEstado } from "../src/components/reservas/pantalla-de-estado";
import { Button, buttonVariants } from "../src/components/ui/button";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // El detalle queda en la consola y en los registros del servidor; la pantalla no lo muestra.
    console.error(error);
  }, [error]);

  return (
    <PantallaDeEstado tablilla="Algo falló" titulo="No pudimos mostrar esta pantalla">
      <title>Algo salió mal | Ichigo</title>
      <p className="max-w-[48ch] text-base text-muted-foreground">
        Ocurrió un problema de nuestro lado. Probá de nuevo; si sigue igual, volvé al inicio y
        reintentá en unos minutos.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={() => unstable_retry()}>
          Reintentar
        </Button>
        <Link href="/" className={buttonVariants({ variant: "secondary", size: "lg" })}>
          Volver al inicio
        </Link>
      </div>
    </PantallaDeEstado>
  );
}
