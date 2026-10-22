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

  // Tarea 3.8 (movimiento-ui): el bloque de movimiento reducido apaga las animaciones de la
  // landing, y el estado base de esas clases es el final (nada queda oculto sin animación).
  const ANIMADAS = [".tinta-entrada", ".balanceo", ".revelar", ".marco-organico", ".deriva"];
  // La clase exacta: `.deriva` no debe coincidir con `.deriva-x`.
  const conClase = (clase: string) => new RegExp(`${clase.replace(".", "\\.")}(?![\\w-])`);

  it("prefers-reduced-motion pone animation: none en las cinco clases animadas", () => {
    // Cada bloque termina en la llave que cierra al principio de una línea.
    const bloques = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\r?\n\}/g)].map(
      (m) => m[1],
    );
    const conNone = bloques.find((bloque) => /animation:\s*none/.test(bloque));

    expect(conNone).toBeDefined();
    const selectores = (conNone as string).split("{")[0];
    for (const clase of ANIMADAS) {
      expect(selectores).toMatch(conClase(clase));
    }
  });

  it("ninguna regla base de esas clases fija opacity: 0", () => {
    const sinKeyframes = css.replace(/@keyframes[\s\S]*?\r?\n\}/g, "");
    const reglas = [...sinKeyframes.matchAll(/([^{}]+)\{([^{}]*)\}/g)];

    for (const [, selector, cuerpo] of reglas) {
      if (ANIMADAS.some((clase) => conClase(clase).test(selector))) {
        expect(cuerpo).not.toMatch(/opacity:\s*0(\s|;|$)/);
      }
    }
  });
});
