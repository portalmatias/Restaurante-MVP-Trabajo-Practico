import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { archivosDeLaInterfaz, leer } from "../helpers/fuentes";
import { codigosDeLaFuente, faltantes } from "../helpers/woff";

// Tarea 5.1 del rediseño: los subconjuntos de frontend/src/fonts/ están recortados a los
// caracteres usados (ver LEEME.md de esa carpeta). Un carácter que el subconjunto no trae cae
// a la fuente del sistema sin avisar, y en un nombre propio («Ñandú Pérez») se nota. Este test
// lee la tabla `cmap` de cada .woff y comprueba la cobertura con los textos reales.
const MINCHO = ["mincho-400.woff", "mincho-500.woff", "mincho-700.woff"];
const GOTHIC = ["gothic-400.woff", "gothic-500.woff", "gothic-700.woff"];

// Nombres y textos que una persona puede escribir en el formulario de reserva.
const NOMBRES = [
  "Ñandú Pérez",
  "Güemes",
  "Córdoba",
  "María Peña",
  "José Núñez",
  "Ibáñez",
  "Ángela Ruiz",
  "Íñigo Úbeda",
  "Sofía Gómez",
  "Müller",
  "Jean-François",
  "O’Connor",
  "Chloë Œuvre",
];
const TEXTO_DE_LA_INTERFAZ = "¿Cuándo y para cuántos? ¡Hay lugar! «Tu reserva» “fue” cancelada — 12:00–15:00 · €";

describe("Cobertura de los subconjuntos tipográficos", () => {
  it("el lector de `cmap` ve la cantidad de caracteres que registra el LEEME (huella)", () => {
    expect(codigosDeLaFuente("mincho-400.woff").size).toBe(332);
    expect(codigosDeLaFuente("gothic-400.woff").size).toBe(310);
    expect(codigosDeLaFuente("marca.woff").size).toBe(10);
  });

  it.each([...MINCHO, ...GOTHIC])("%s trae los nombres con acentos, ñ y diéresis", (archivo) => {
    expect(faltantes(archivo, NOMBRES.join(" "))).toEqual([]);
  });

  it.each([...MINCHO, ...GOTHIC])("%s trae la puntuación y los símbolos de la interfaz", (archivo) => {
    expect(faltantes(archivo, TEXTO_DE_LA_INTERFAZ)).toEqual([]);
  });

  it.each(["0123456789", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"])(
    "las dos familias traen %s",
    (texto) => {
      expect(faltantes(MINCHO[0], texto)).toEqual([]);
      expect(faltantes(GOTHIC[0], texto)).toEqual([]);
    },
  );

  it("los tres pesos de cada familia cubren exactamente los mismos caracteres", () => {
    for (const grupo of [MINCHO, GOTHIC]) {
      const [base, ...otros] = grupo.map((archivo) => [...codigosDeLaFuente(archivo)].sort((a, b) => a - b));
      for (const otro of otros) expect(otro).toEqual(base);
    }
  });

  it("la marca (Yuji Syuku) trae «Ichigo» y «いちご» y nada más que eso", () => {
    expect(faltantes("marca.woff", "Ichigo いちご")).toEqual([]);
    expect(faltantes("marca.woff", "Ñ")).toEqual(["Ñ"]);
  });

  it("todo carácter japonés que escribe el código está en alguna de las fuentes", () => {
    const japones = /[　-ヿ一-鿿]/g;
    const usados = new Set<string>();
    for (const ruta of archivosDeLaInterfaz()) {
      for (const c of leer(ruta).match(japones) ?? []) usados.add(c);
    }
    expect(usados.size).toBeGreaterThan(0);
    const cubiertos = new Set([
      ...codigosDeLaFuente("mincho-400.woff"),
      ...codigosDeLaFuente("gothic-400.woff"),
      ...codigosDeLaFuente("marca.woff"),
    ]);
    const sinGlifo = [...usados].filter((c) => !cubiertos.has(c.codePointAt(0) as number));
    expect(sinGlifo).toEqual([]);
  });

  // Límite documentado en el LEEME: el subconjunto cubre el latín-1 y poco más. Un nombre con
  // letras de otro alfabeto latino o de otra escritura se dibuja con la fuente del sistema.
  it("el detector avisa cuando falta un carácter (control negativo)", () => {
    expect(faltantes("mincho-400.woff", "Łukasz Nagy")).toEqual(["Ł"]);
    expect(faltantes("gothic-400.woff", "Győző")).toEqual(["ő"]);
  });
});

describe("LEEME.md de frontend/src/fonts", () => {
  const carpeta = join(__dirname, "../../src/fonts");
  const leeme = readFileSync(join(carpeta, "LEEME.md"), "utf8").replace(/\s+/g, " ");

  it("nombra cada archivo de la carpeta (fuentes y licencias)", () => {
    const archivos = readdirSync(carpeta).filter((nombre) => nombre !== "LEEME.md");
    expect(archivos.length).toBeGreaterThan(0);
    for (const nombre of archivos) expect(leeme).toContain(nombre);
  });

  it("registra la huella de cada subconjunto, la que mide este test", () => {
    expect(leeme).toContain("332 caracteres");
    expect(leeme).toContain("310 caracteres");
    expect(leeme).toContain("10 caracteres");
  });

  it("dice con franqueza que la herramienta original no quedó registrada", () => {
    expect(leeme).toMatch(/no quedaron registradas/);
  });
});

