import type { ReactNode } from "react";

/**
 * Sello de estado del panel. El significado nunca depende solo del color: cada tono lleva su
 * nombre escrito y una forma propia (relleno, contorno grueso, contorno punteado, contorno
 * fino) más un pictograma. El rojo del sello solo aparece como relleno con texto hinoki claro
 * o como texto sobre hinoki o sobre la tablilla clara, nunca sobre madera oscura.
 */
export type TonoSello =
  | "pendiente"
  | "confirmada"
  | "cancelada"
  | "ausente"
  | "holgado"
  | "casi-lleno"
  | "completo"
  | "sobrecupo"
  | "sin-aforo"
  | "activo"
  | "inactivo";

type Forma = "reloj" | "check" | "cruz" | "barra" | "alerta" | "cuadro" | "exceso";

const TONOS: Record<TonoSello, { clases: string; forma: Forma }> = {
  // Pide acción: contorno rojo grueso.
  pendiente: { clases: "border-2 border-accent text-accent", forma: "reloj" },
  // Firme: relleno sumi.
  confirmada: { clases: "border border-foreground bg-foreground text-primary-foreground", forma: "check" },
  // Cerrada sin servicio: contorno punteado, tinta apagada.
  cancelada: { clases: "border border-dashed border-border text-muted-foreground", forma: "cruz" },
  ausente: { clases: "border border-border bg-muted text-foreground", forma: "barra" },
  holgado: { clases: "border border-border text-foreground", forma: "check" },
  "casi-lleno": { clases: "border-2 border-accent text-accent", forma: "alerta" },
  // Sello pleno: la tablilla agotada.
  completo: { clases: "border border-accent bg-accent text-accent-foreground", forma: "cuadro" },
  // Por encima del aforo: mismo relleno pleno, pero con borde grueso y un triángulo lleno, para que
  // en escala de grises no se confunda con «Completo» (cuadro) ni con «Casi lleno» (triángulo hueco).
  sobrecupo: { clases: "border-2 border-accent bg-accent text-accent-foreground", forma: "exceso" },
  // Sin aforo configurado: contorno punteado y tinta apagada, sin el check de «Con lugar».
  "sin-aforo": { clases: "border border-dashed border-border text-muted-foreground", forma: "barra" },
  activo: { clases: "border border-border text-foreground", forma: "check" },
  inactivo: { clases: "border border-dashed border-border text-muted-foreground", forma: "barra" },
};

function Pictograma({ forma }: { forma: Forma }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      className="shrink-0"
    >
      {forma === "reloj" ? (
        <>
          <circle cx="8" cy="8" r="6" />
          <path d="M8 4.5V8l2.5 1.5" />
        </>
      ) : null}
      {forma === "check" ? <path d="M3 8.5l3.5 3.5L13 4.5" /> : null}
      {forma === "cruz" ? <path d="M4 4l8 8M12 4l-8 8" /> : null}
      {forma === "barra" ? <path d="M3 8h10" /> : null}
      {forma === "alerta" ? <path d="M8 2.5l6 11H2l6-11zM8 7v3" /> : null}
      {forma === "exceso" ? <path d="M8 2.5l6 11H2l6-11z" fill="currentColor" /> : null}
      {forma === "cuadro" ? <rect x="3.5" y="3.5" width="9" height="9" fill="currentColor" /> : null}
    </svg>
  );
}

export function Sello({ tono, children }: { tono: TonoSello; children: ReactNode }) {
  const { clases, forma } = TONOS[tono];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-medium ${clases}`}
    >
      <Pictograma forma={forma} />
      {children}
    </span>
  );
}
