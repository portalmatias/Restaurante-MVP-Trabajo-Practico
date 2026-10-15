import type { Metadata } from "next";
import Link from "next/link";
import { PantallaDeEstado } from "../src/components/reservas/pantalla-de-estado";
import { buttonVariants } from "../src/components/ui/button";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <PantallaDeEstado tablilla="No encontrada" detalle="404" titulo="No encontramos esa página">
      <p className="max-w-[48ch] text-base text-muted-foreground">
        El enlace puede estar incompleto o la página ya no existe. Podés volver al inicio o
        reservar tu lugar desde cero.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/" className={buttonVariants({ variant: "primary", size: "lg" })}>
          Volver al inicio
        </Link>
        <Link href="/reservas/nueva" className={buttonVariants({ variant: "secondary", size: "lg" })}>
          Reservá una mesa
        </Link>
      </div>
    </PantallaDeEstado>
  );
}
