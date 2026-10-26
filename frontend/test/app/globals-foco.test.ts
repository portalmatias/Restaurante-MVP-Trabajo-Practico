import { readFileSync } from "node:fs";
import { join } from "node:path";

// Contraste del anillo de foco contra cada fondo donde puede dibujarse (spec «Contrastes» de
// identidad-visual-ichigo; WCAG 2.2, criterio 1.4.11, mínimo 3:1 para componentes de interfaz).
const css = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");

function token(nombre: string): string {
  const hallado = new RegExp(String.raw`--${nombre}:\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!hallado) throw new Error(`Falta el token --${nombre} en globals.css.`);
  return hallado[1];
}

function luminancia(hex: string): number {
  const canales = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canales.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [mayor, menor] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (mayor + 0.05) / (menor + 0.05);
}

describe("Anillo de foco", () => {
  it.each(["background", "card", "muted"])("el rojo `ring` supera 3:1 sobre %s", (fondo) => {
    expect(contraste(token("ring"), token(fondo))).toBeGreaterThanOrEqual(3);
  });

  it("el rojo `ring` NO alcanza 3:1 pegado a la madera: por eso existe `ring-madera`", () => {
    expect(contraste(token("ring"), token("madera"))).toBeLessThan(3);
  });

  it("`ring-madera` supera 3:1 sobre la madera y está expuesto como color de Tailwind", () => {
    expect(contraste(token("ring-madera"), token("madera"))).toBeGreaterThanOrEqual(3);
    expect(css).toMatch(/--color-ring-madera:\s*var\(--ring-madera\)/);
  });
});

// Los comentarios de globals.css citan contrastes medidos (tarea 2.4 del rediseño): un valor
// desactualizado engaña a quien elige colores, así que se comparan con el cálculo real.
describe("Contrastes citados en los comentarios de globals.css", () => {
  const coma = (n: number) => n.toFixed(2).replace(".", ",");

  it("`border` sobre `background` mide lo que dice el comentario", () => {
    const medido = coma(contraste(token("border"), token("background")));
    expect(css).toContain(`${medido}:1 (mínimo de bordes de controles: 3:1)`);
  });

  it("el rojo sobre la madera mide lo que dicen los comentarios", () => {
    const medido = coma(contraste(token("ring"), token("madera")));
    expect(css).toContain(`oscura (${medido}:1)`);
    expect(css).toContain(`el rojo \`ring\` mide ${medido}:1`);
  });

  it("el rojo del sello sobre background y card mide lo que dice el comentario", () => {
    const fondo = coma(contraste(token("accent"), token("background")));
    const tarjeta = coma(contraste(token("accent"), token("card")));
    expect(fondo).toBe("5,69");
    expect(tarjeta).toBe("6,51");
    expect(css).toContain(`sobre background   ${fondo}:1 y sobre card ${tarjeta}:1`);
  });
});
