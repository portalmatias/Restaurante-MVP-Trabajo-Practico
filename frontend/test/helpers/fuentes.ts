import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Utilidades para los tests que leen el código fuente de la interfaz (colores sueltos, clases
// de las superficies de madera). No es un test: Jest solo recoge los archivos `*.test.ts`.
const RAIZ = join(__dirname, "../..");

/** Archivos `.ts`/`.tsx` de `src/components` y `app` (relativos a `frontend/`). */
export function archivosDeLaInterfaz(): string[] {
  const hallados: string[] = [];
  const recorrer = (dir: string) => {
    for (const entrada of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
      const ruta = `${dir}/${entrada.name}`;
      if (entrada.isDirectory()) recorrer(ruta);
      else if (/\.(ts|tsx)$/.test(entrada.name)) hallados.push(ruta);
    }
  };
  recorrer("src/components");
  recorrer("app");
  return hallados.sort();
}

export function leer(rutaRelativa: string): string {
  return readFileSync(join(RAIZ, rutaRelativa), "utf8");
}

/** Índice del `>` que cierra la etiqueta de apertura que empieza en `inicio` (un `<`). */
function finDeApertura(fuente: string, inicio: number): number {
  let llaves = 0;
  let comilla: string | null = null;
  for (let i = inicio + 1; i < fuente.length; i += 1) {
    const c = fuente[i];
    if (comilla) {
      if (c === "\\") i += 1;
      else if (c === comilla) comilla = null;
    } else if (c === '"' || c === "'" || c === "`") comilla = c;
    else if (c === "{") llaves += 1;
    else if (c === "}") llaves -= 1;
    else if (c === ">" && llaves === 0 && fuente[i - 1] !== "=") return i;
  }
  return -1;
}

/**
 * Texto del elemento JSX cuya etiqueta de apertura contiene la posición `indice` (por ejemplo,
 * la de su `className`): desde su `<` hasta el cierre que le corresponde. Cuenta las aperturas y
 * los cierres de la misma etiqueta y descuenta las que se cierran solas (`<span ... />`).
 */
export function subarbolJsx(fuente: string, indice: number): string {
  const inicio = fuente.lastIndexOf("<", indice);
  const etiqueta = /^<([A-Za-z][\w.]*)/.exec(fuente.slice(inicio))?.[1];
  if (inicio === -1 || !etiqueta) throw new Error("No se encontró la etiqueta de apertura.");

  const patron = new RegExp(`<${etiqueta}(?=[\\s>/])|</${etiqueta}>`, "g");
  patron.lastIndex = inicio;
  let profundidad = 0;
  for (let m = patron.exec(fuente); m; m = patron.exec(fuente)) {
    if (m[0].startsWith("</")) {
      profundidad -= 1;
      if (profundidad === 0) return fuente.slice(inicio, m.index + m[0].length);
    } else {
      const fin = finDeApertura(fuente, m.index);
      const autocerrada = fuente[fin - 1] === "/";
      if (autocerrada) {
        if (profundidad === 0) return fuente.slice(inicio, fin + 1);
      } else profundidad += 1;
    }
  }
  throw new Error(`No se encontró el cierre de <${etiqueta}>.`);
}
