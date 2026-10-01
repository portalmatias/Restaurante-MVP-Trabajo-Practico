import Link from "next/link";
import { buttonVariants } from "../../src/components/ui/button";

/**
 * Inicio del cliente (design.md D3 Pantalla 1): contenido estático, sin datos ni estados de
 * carga o error. Una acción principal para reservar y otra, de menor énfasis, para consultar.
 */
export default function ReservasPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:py-16">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Reservá tu mesa</h1>
      <p className="text-base text-muted-foreground">
        Elegí fecha, turno y zona, y reservá sin necesidad de crear una cuenta.
      </p>
      <Link href="/reservas/nueva" className={buttonVariants({ variant: "primary", size: "lg" })}>
        Reservá ahora
      </Link>
      <Link
        href="/reservas/consultar"
        className={buttonVariants({ variant: "ghost", fullWidth: false, className: "self-start underline" })}
      >
        ¿Ya reservaste? Consultá o cancelá tu reserva
      </Link>
    </div>
  );
}
