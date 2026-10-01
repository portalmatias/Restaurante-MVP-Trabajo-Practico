"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "../ui/alert";
import { Button } from "../ui/button";

export type ErrorConReintentoProps = {
  mensaje: string;
};

/**
 * Error de servidor o de red de una pantalla servida (design.md D3 Pantalla 3, punto 4): el
 * mensaje genérico y un botón que vuelve a pedir la misma ruta, con sus parámetros de URL.
 */
export function ErrorConReintento({ mensaje }: ErrorConReintentoProps) {
  const router = useRouter();
  // `router.refresh()` no devuelve una promesa: la transición marca cuándo termina de recargar.
  const [recargando, iniciarRecarga] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <Alert variant="error" className="text-base">
        {mensaje}
      </Alert>
      <Button
        variant="secondary"
        size="lg"
        disabled={recargando}
        onClick={() => iniciarRecarga(() => router.refresh())}
      >
        Reintentar
      </Button>
    </div>
  );
}
