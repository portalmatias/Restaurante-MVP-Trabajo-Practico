import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { archivosDeLaInterfaz, leer } from "../helpers/fuentes";

// Spec «Procedencia documentada de las imágenes» de identidad-visual-ichigo (tareas 5.2 y 5.4
// del rediseño): lo que hay en `public/ichigo/` coincide con lo que dice `PROCEDENCIA.md`.
const CARPETA = join(__dirname, "../../public/ichigo");
const TOPE_BYTES = 300 * 1000;

const doc = readFileSync(join(CARPETA, "PROCEDENCIA.md"), "utf8");
// Para las frases: el documento corta las líneas a mano, y una frase puede quedar en dos.
const prosa = doc.replace(/\s+/g, " ");
const archivos = readdirSync(CARPETA).filter((nombre) => nombre !== "PROCEDENCIA.md");
const webp = archivos.filter((nombre) => nombre.endsWith(".webp")).sort();

type Fila = { archivo: string; tamano: string; uso: string; prompt: string };

/** Filas de la tabla: | `archivo.webp` | AxB | uso | prompt | */
function filasDeLaTabla(): Fila[] {
  return doc
    .split("\n")
    .filter((linea) => /^\|\s*`[^`]+\.[a-z]+`\s*\|/.test(linea))
    .map((linea) => {
      const celdas = linea.split("|").slice(1, -1).map((c) => c.trim());
      return {
        archivo: celdas[0].replace(/`/g, ""),
        tamano: celdas[1],
        uso: celdas[2],
        prompt: celdas.slice(3).join("|"),
      };
    });
}

/** Ancho y alto de un WebP (VP8 con pérdida, VP8L sin pérdida o VP8X extendido). */
function dimensionesWebp(bytes: Buffer): { ancho: number; alto: number } {
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("No es un archivo WebP.");
  }
  const tipo = bytes.toString("ascii", 12, 16);
  if (tipo === "VP8X") {
    return { ancho: bytes.readUIntLE(24, 3) + 1, alto: bytes.readUIntLE(27, 3) + 1 };
  }
  if (tipo === "VP8 ") {
    return { ancho: bytes.readUInt16LE(26) & 0x3fff, alto: bytes.readUInt16LE(28) & 0x3fff };
  }
  if (tipo === "VP8L") {
    const bits = bytes.readUInt32LE(21);
    return { ancho: (bits & 0x3fff) + 1, alto: ((bits >> 14) & 0x3fff) + 1 };
  }
  throw new Error(`Tipo de WebP desconocido: ${tipo}`);
}

describe("Imágenes de public/ichigo", () => {
  it("hay cinco fotografías .webp y ningún otro formato raster (ni .png)", () => {
    expect(webp).toHaveLength(5);
    expect(archivos.filter((nombre) => /\.(png|jpe?g|gif|avif|bmp|tiff?)$/i.test(nombre))).toEqual([]);
  });

  it("la suma de los pesos es menor que 300 KB", () => {
    const total = webp.reduce((suma, nombre) => suma + statSync(join(CARPETA, nombre)).size, 0);
    expect(total).toBeLessThan(TOPE_BYTES);
  });

  it("cada WebP es un WebP válido (cabecera RIFF/WEBP)", () => {
    for (const nombre of webp) {
      expect(() => dimensionesWebp(readFileSync(join(CARPETA, nombre)))).not.toThrow();
    }
  });
});

describe("PROCEDENCIA.md", () => {
  const filas = filasDeLaTabla();

  it("tiene una fila por cada .webp, y ninguna de más", () => {
    expect(filas.map((f) => f.archivo).sort()).toEqual(webp);
  });

  it("cada fila indica el tamaño, el uso y el prompt", () => {
    for (const fila of filas) {
      expect(fila.tamano).toMatch(/^\d+×\d+$/);
      expect(fila.uso.length).toBeGreaterThan(0);
      expect(fila.prompt.length).toBeGreaterThan(40);
    }
  });

  it("el tamaño de la tabla es el de la imagen del repositorio", () => {
    for (const fila of filas) {
      const { ancho, alto } = dimensionesWebp(readFileSync(join(CARPETA, fila.archivo)));
      expect({ archivo: fila.archivo, tamano: fila.tamano }).toEqual({
        archivo: fila.archivo,
        tamano: `${ancho}×${alto}`,
      });
    }
  });

  it("registra la herramienta y la fecha de origen, y que las fotos son sintéticas", () => {
    expect(prosa).toMatch(/herramienta `generate_image`/);
    expect(doc).toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
    expect(prosa).toMatch(/sintéticas/);
    expect(prosa).toMatch(/Ichigo es un restaurante ficticio/);
    expect(prosa).toMatch(/No son fotos de un local/);
  });

  it("registra la conversión a WebP con su herramienta y su calidad", () => {
    expect(prosa).toMatch(/convirtieron a WebP \(calidad \d+, con [A-Za-z]+\)/);
  });

  it("el peso total que registra coincide con la suma real (con un margen del 5 %)", () => {
    const registrado = /a unos (\d+) KB/.exec(prosa);
    expect(registrado).not.toBeNull();
    const total = webp.reduce((suma, nombre) => suma + statSync(join(CARPETA, nombre)).size, 0);
    const kb = total / 1000;
    expect(Math.abs(Number(registrado?.[1]) - kb) / kb).toBeLessThan(0.05);
  });

  it("cuenta las fotografías como son (cinco)", () => {
    expect(prosa).toMatch(/Las cinco fotografías/);
    expect(webp).toHaveLength(5);
  });
});

describe("Referencias a las imágenes desde la interfaz", () => {
  it("toda ruta /ichigo/… que usa el código existe en la carpeta", () => {
    const referencias = new Set<string>();
    for (const ruta of archivosDeLaInterfaz()) {
      for (const m of leer(ruta).matchAll(/\/ichigo\/([\w-]+\.webp)/g)) referencias.add(m[1]);
    }
    expect(referencias.size).toBeGreaterThan(0);
    for (const nombre of referencias) expect(archivos).toContain(nombre);
  });
});
