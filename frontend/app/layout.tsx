import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SiteHeader } from "../src/components/layout/site-header";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <SiteHeader />
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
