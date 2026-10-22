import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// Spec «Tipografías auto-hosteadas» de identidad-visual-ichigo: las fuentes se sirven desde el
// propio sitio con `next/font/local`; ningún archivo puede depender de Google en tiempo de build.
const raiz = join(__dirname, "../..");

function archivosDeCodigo(carpeta: string): string[] {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(carpeta, entrada.name);
    if (entrada.isDirectory()) return archivosDeCodigo(ruta);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(entrada.name) ? [ruta] : [];
  });
}

describe("Tipografías auto-hosteadas", () => {
  it("ningún archivo de app/ ni de src/ importa next/font/google", () => {
    const conGoogle = ["app", "src"]
      .flatMap((carpeta) => archivosDeCodigo(join(raiz, carpeta)))
      .filter((ruta) => readFileSync(ruta, "utf8").includes("next/font/google"))
      .map((ruta) => relative(raiz, ruta).replaceAll("\\", "/"));

    expect(conGoogle).toEqual([]);
  });
});
