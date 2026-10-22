import { readFileSync } from "node:fs";
import { join } from "node:path";

// Spec movimiento-ui: con `prefers-reduced-motion` el cambio de cara de la tablilla es
// instantáneo (el giro es una `transition`). No deben quedar animaciones declaradas sin uso ni
// comentarios que prometan un fundido.
const css = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");

describe("Movimiento en globals.css", () => {
  it("todo @keyframes declarado se usa en alguna regla `animation`", () => {
    const declarados = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
    const sinUso = declarados.filter(
      (nombre) => !new RegExp(String.raw`animation(-name)?:[^;]*\b${nombre}\b`).test(css),
    );

    expect(sinUso).toEqual([]);
  });

  it("no promete un fundido al reducir el movimiento", () => {
    expect(css).not.toMatch(/fundido corto/);
  });
});
