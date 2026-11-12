import type { components } from "../../lib/api/schema";

/**
 * Geometría compartida por el plano del cliente y la vista previa del admin (change
 * `plano-mesas-admin`, design.md D5).
 */

/** Lado de una celda de la grilla en unidades del `viewBox` (design.md D5 de `plano-mesas`). */
export const CELDA = 48;
export const MARGEN = 4;

export type Rect = { x: number; y: number; ancho: number; alto: number };

/** Rectángulo de una mesa en el `viewBox`, a partir de su celda de origen y su tamaño en celdas. */
export function rectDeMesa(posX: number, posY: number, ancho: number, alto: number): Rect {
  return {
    x: posX * CELDA + MARGEN,
    y: posY * CELDA + MARGEN,
    ancho: ancho * CELDA - 2 * MARGEN,
    alto: alto * CELDA - 2 * MARGEN,
  };
}

/** Silueta de la mesa: la usan la cara y el canto, que es la misma forma corrida hacia abajo. */
type PropsSilueta = { forma: components["schemas"]["FormaMesa"] } & Rect & {
    className: string;
    fill?: string;
    strokeWidth?: number;
    "data-canto"?: string;
    "data-forma"?: string;
  };

export function Silueta({ forma, x, y, ancho, alto, ...resto }: PropsSilueta) {
  if (forma === "REDONDA") {
    return <ellipse {...resto} cx={x + ancho / 2} cy={y + alto / 2} rx={ancho / 2} ry={alto / 2} />;
  }
  // Esquinas apenas redondeadas, como los radios del tema (`--radius-sm` a `--radius-lg`).
  return <rect {...resto} x={x} y={y} width={ancho} height={alto} rx={forma === "CUADRADA" ? 2 : 4} />;
}
