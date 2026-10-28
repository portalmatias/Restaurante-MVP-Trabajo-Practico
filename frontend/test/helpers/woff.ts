import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

// Lector mínimo de los caracteres que cubre un archivo WOFF 1.0 (tabla `cmap`), sin dependencias:
// sirve para comprobar que los subconjuntos de frontend/src/fonts/ traen los glifos que la
// interfaz necesita. No es un test: Jest solo recoge los archivos `*.test.ts`.
const CARPETA_FUENTES = join(__dirname, "../../src/fonts");

/** Contenido (ya descomprimido) de la tabla `etiqueta` de un WOFF. */
function tabla(woff: Buffer, etiqueta: string): Buffer {
  if (woff.toString("ascii", 0, 4) !== "wOFF") throw new Error("No es un archivo WOFF 1.0.");
  const cantidad = woff.readUInt16BE(12);
  for (let i = 0; i < cantidad; i += 1) {
    const entrada = 44 + i * 20;
    if (woff.toString("ascii", entrada, entrada + 4) !== etiqueta) continue;
    const desplazamiento = woff.readUInt32BE(entrada + 4);
    const comprimido = woff.readUInt32BE(entrada + 8);
    const original = woff.readUInt32BE(entrada + 12);
    const datos = woff.subarray(desplazamiento, desplazamiento + comprimido);
    return comprimido < original ? inflateSync(datos) : datos;
  }
  throw new Error(`El WOFF no tiene la tabla ${etiqueta}.`);
}

/** Puntos de código de un subtabla cmap de formato 4 (BMP) con glifo propio (no el 0). */
function formato4(cmap: Buffer, base: number): Set<number> {
  const segmentos = cmap.readUInt16BE(base + 6) / 2;
  const fin = base + 14;
  const inicio = fin + segmentos * 2 + 2;
  const delta = inicio + segmentos * 2;
  const rango = delta + segmentos * 2;
  const puntos = new Set<number>();
  for (let s = 0; s < segmentos; s += 1) {
    const desde = cmap.readUInt16BE(inicio + s * 2);
    const hasta = cmap.readUInt16BE(fin + s * 2);
    const d = cmap.readUInt16BE(delta + s * 2);
    const r = cmap.readUInt16BE(rango + s * 2);
    for (let c = desde; c <= hasta && c !== 0xffff; c += 1) {
      let glifo: number;
      if (r === 0) glifo = (c + d) & 0xffff;
      else {
        const direccion = rango + s * 2 + r + (c - desde) * 2;
        glifo = cmap.readUInt16BE(direccion);
        if (glifo !== 0) glifo = (glifo + d) & 0xffff;
      }
      if (glifo !== 0) puntos.add(c);
    }
  }
  return puntos;
}

/** Idem para el formato 12 (todo Unicode). */
function formato12(cmap: Buffer, base: number): Set<number> {
  const grupos = cmap.readUInt32BE(base + 12);
  const puntos = new Set<number>();
  for (let g = 0; g < grupos; g += 1) {
    const entrada = base + 16 + g * 12;
    const desde = cmap.readUInt32BE(entrada);
    const hasta = cmap.readUInt32BE(entrada + 4);
    const glifoInicial = cmap.readUInt32BE(entrada + 8);
    for (let c = desde; c <= hasta; c += 1) if (glifoInicial + (c - desde) !== 0) puntos.add(c);
  }
  return puntos;
}

/** Puntos de código que el archivo `src/fonts/<nombre>` dibuja con un glifo propio. */
export function codigosDeLaFuente(nombre: string): Set<number> {
  const cmap = tabla(readFileSync(join(CARPETA_FUENTES, nombre)), "cmap");
  const registros = cmap.readUInt16BE(2);
  const subtablas = new Map<string, number>();
  for (let i = 0; i < registros; i += 1) {
    const plataforma = cmap.readUInt16BE(4 + i * 8);
    const codificacion = cmap.readUInt16BE(6 + i * 8);
    subtablas.set(`${plataforma}-${codificacion}`, cmap.readUInt32BE(8 + i * 8));
  }
  const unicodeCompleto = subtablas.get("3-10") ?? subtablas.get("0-4") ?? subtablas.get("0-6");
  if (unicodeCompleto !== undefined) return formato12(cmap, unicodeCompleto);
  const bmp = subtablas.get("3-1") ?? subtablas.get("0-3") ?? subtablas.get("0-1");
  if (bmp === undefined) throw new Error(`${nombre} no trae una subtabla cmap Unicode.`);
  return formato4(cmap, bmp);
}

/** Caracteres de `texto` que la fuente no cubre (vacío si los cubre todos). */
export function faltantes(nombre: string, texto: string): string[] {
  const cubiertos = codigosDeLaFuente(nombre);
  return [...new Set(texto)].filter((c) => !cubiertos.has(c.codePointAt(0) as number));
}
