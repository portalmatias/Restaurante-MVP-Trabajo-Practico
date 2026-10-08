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

/**
 * Encabezado compartido de todas las páginas (layout de `app/`): la viga de la que cuelgan las
 * tablillas. El nombre va a la izquierda y la navegación a la derecha, sobre un canto de madera.
 */
export function SiteHeader() {
  return (
    <header className="border-b-2 border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 px-4 py-1">
        <Link
          href="/"
          className="inline-flex min-h-11 items-baseline gap-2 rounded-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="font-wordmark text-3xl tracking-[0.08em]">Ichigo</span>
          <span aria-hidden="true" lang="ja" className="hidden font-display text-sm text-muted-foreground sm:inline">
            いちご
          </span>
        </Link>
        {/* Sin enlace a `/admin`: el personal entra por URL directa (design.md D11). */}
        <nav aria-label="Navegación principal" className="-mx-3 flex items-center gap-0.5 text-sm sm:mx-0 sm:-mr-3">
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
