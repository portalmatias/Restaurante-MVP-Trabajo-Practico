import Link from "next/link";
import { buttonVariants } from "../ui/button";

// Reusa las clases base de Button (altura mínima, anillo de foco, transición) con la variante
// `ghost` (sin relleno) y `fullWidth: false` (un enlace de navegación no debe ocupar todo el
// ancho de la fila, a diferencia de un botón primario). `min-w-11` y el subrayado en hover son
// propios de la navegación, no de `buttonVariants`.
const navLinkClassName = buttonVariants({
  variant: "ghost",
  fullWidth: false,
  className: "min-w-11 underline-offset-4 hover:underline",
});

/** Encabezado compartido de todas las páginas (layout de `app/`). */
export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-md text-lg font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Reservas del Restaurante
        </Link>
        {/* Sin enlace a `/admin`: el personal entra por URL directa (design.md D11). */}
        <nav
          aria-label="Navegación principal"
          className="-ml-3 flex flex-wrap items-center gap-1 sm:ml-0"
        >
          <Link href="/reservas" className={navLinkClassName}>
            Reservas
          </Link>
          <Link href="/reservas/consultar" className={navLinkClassName}>
            Consultar reserva
          </Link>
        </nav>
      </div>
    </header>
  );
}
