import { readFileSync } from "node:fs";
import { join } from "node:path";

// Cálculo de contraste WCAG para los tests de la identidad visual: lee los tokens de
// `app/globals.css` y mide la relación de contraste entre dos colores (fórmula de WCAG 2.x,
// luminancia relativa en sRGB). No es un test: Jest solo recoge los archivos `*.test.ts`.
export const globalsCss = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");

/** Valor hexadecimal de `--<nombre>` en `globals.css`; falla si el token no existe. */
export function token(nombre: string): string {
  const hallado = new RegExp(String.raw`--${nombre}:\s*(#[0-9a-fA-F]{6})`).exec(globalsCss);
  if (!hallado) throw new Error(`Falta el token --${nombre} en globals.css.`);
  return hallado[1];
}

export function luminancia(hex: string): number {
  const canales = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canales.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const [mayor, menor] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (mayor + 0.05) / (menor + 0.05);
}
