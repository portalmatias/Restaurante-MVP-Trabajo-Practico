import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

// D3 (design.md): una sola familia, Inter, pesos 400 a 700, auto-hosteada con next/font/google.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: "variable",
});

export const metadata: Metadata = {
  title: "Reservas de Restaurante",
  description:
    "Consultá disponibilidad, reservá una mesa y gestioná tus reservas.",
};

const navLinkClassName =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 text-sm font-medium text-foreground underline-offset-4 transition-colors duration-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <header className="border-b border-border">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-md text-lg font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Reservas del Restaurante
            </Link>
            <nav
              aria-label="Navegación principal"
              className="-ml-3 flex flex-wrap items-center gap-1 sm:ml-0"
            >
              <Link href="/reservas" className={navLinkClassName}>
                Reservas
              </Link>
              <Link href="/admin" className={navLinkClassName}>
                Administración
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
        <footer className="border-t border-border">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm text-muted-foreground">
            Sistema de Reservas de Restaurante — Trabajo Práctico académico.
          </div>
        </footer>
      </body>
    </html>
  );
}
