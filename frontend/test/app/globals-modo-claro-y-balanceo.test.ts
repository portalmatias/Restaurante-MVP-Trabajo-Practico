import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");

// Cuerpo de la primera regla cuyo selector es exactamente `selector` (sin media queries).
function cuerpoDe(selector: string): string {
  const escapado = selector.replace(/[.*+?^${}()|[\]\:>]/g, "\$&");
  const m = css.match(new RegExp(String.raw`(?:^|\n)${escapado}\s*\{([^}]*)\}`));
  return m?.[1] ?? "";
}

// Spec identidad-visual-ichigo, «Solo modo claro»: con `prefers-color-scheme: dark` la interfaz
// mantiene los colores claros, porque globals.css declara `color-scheme: light` y no define valores
// alternativos.
describe("Solo modo claro (globals.css)", () => {
  it("declara color-scheme: light", () => {
    expect(css).toMatch(/color-scheme:\s*light\s*;/);
  });

  it("no define valores alternativos para el esquema oscuro", () => {
    expect(css).not.toMatch(/prefers-color-scheme/);
    expect(css).not.toMatch(/color-scheme:\s*[^;]*dark/);
    expect(css).not.toMatch(/(^|[\s,{}])\.dark\b|\[data-theme=["']?dark/m);
    expect(css).not.toMatch(/@custom-variant\s+dark/);
  });
});

// Spec movimiento-ui, «El balanceo se pausa»: con el puntero sobre una tablilla de la landing su
// estilo calculado tiene `animation-play-state: paused`. jsdom no evalúa `:hover`, así que se
// comprueba la regla que lo declara y que la animación base es continua.
describe("El balanceo se pausa (globals.css)", () => {
  it("la animación base de .balanceo es continua", () => {
    expect(cuerpoDe(".balanceo")).toMatch(/animation:\s*balanceo\b[^;]*\binfinite\b/);
  });

  it(".balanceo:hover declara animation-play-state: paused", () => {
    expect(cuerpoDe(".balanceo:hover")).toMatch(/animation-play-state:\s*paused\s*;/);
  });
});
