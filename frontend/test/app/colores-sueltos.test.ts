import { archivosDeLaInterfaz, leer } from "../helpers/fuentes";

// Spec «Tokens semánticos de la identidad Kakefuda», escenario «Ningún componente fija un color
// propio»: los componentes y las pantallas consumen los tokens de `globals.css` a través de
// utilidades de Tailwind y no escriben un color propio (tarea 5.5 del rediseño).
const LITERAL_DE_COLOR =
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\(/g;

describe("Colores sueltos fuera de globals.css", () => {
  it("el recorrido ve los archivos de la interfaz (no pasa en vacío)", () => {
    const archivos = archivosDeLaInterfaz();
    expect(archivos.length).toBeGreaterThan(20);
    expect(archivos).toContain("app/page.tsx");
    expect(archivos).toContain("src/components/ui/tablilla.tsx");
  });

  it("ningún componente ni pantalla escribe un literal de color", () => {
    const encontrados = archivosDeLaInterfaz().flatMap((ruta) =>
      [...leer(ruta).matchAll(LITERAL_DE_COLOR)].map((m) => `${ruta}: ${m[0]}`),
    );
    expect(encontrados).toEqual([]);
  });

  it("el patrón reconoce cada forma de literal que la spec prohíbe", () => {
    const prohibidos = [
      "#fff",
      "#E8DCC4",
      "#E8DCC4cc",
      "rgb(0 0 0)",
      "rgba(0,0,0,.5)",
      "hsl(20 30% 40%)",
      "oklch(0.5 0.1 30)",
    ];
    for (const ejemplo of prohibidos) {
      expect(ejemplo.match(LITERAL_DE_COLOR)).not.toBeNull();
    }
    expect('href="#contenido"'.match(LITERAL_DE_COLOR)).toBeNull();
  });
});
