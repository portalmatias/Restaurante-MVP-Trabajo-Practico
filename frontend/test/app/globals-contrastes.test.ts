import { archivosDeLaInterfaz, leer, subarbolJsx } from "../helpers/fuentes";
import { contraste, token } from "../helpers/contraste";

// Spec «Contrastes mínimos WCAG 2.1 AA de la paleta» de identidad-visual-ichigo (tarea 5.3 del
// rediseño): todo se mide con los valores reales de `app/globals.css`, no con copias.
const TEXTO_MINIMO = 4.5;
const BORDE_MINIMO = 3;

const FONDOS = ["background", "card", "muted"] as const;

describe("Contraste de texto de las combinaciones definidas (WCAG 2.1 AA, 1.4.3)", () => {
  const combinaciones: [string, string][] = [
    ...FONDOS.flatMap((f): [string, string][] => [
      ["foreground", f],
      ["card-foreground", f],
      ["muted-foreground", f],
      ["secondary", f],
      ["accent", f],
      ["destructive", f],
    ]),
    ["primary-foreground", "primary"],
    ["secondary-foreground", "secondary"],
    ["accent-foreground", "accent"],
    ["destructive-foreground", "destructive"],
    ["madera-foreground", "madera"],
  ];

  it.each(combinaciones)("%s sobre %s alcanza 4,5:1", (texto, fondo) => {
    expect(contraste(token(texto), token(fondo))).toBeGreaterThanOrEqual(TEXTO_MINIMO);
  });

  it("`muted-foreground` es el mismo color que `secondary`, como dice la spec", () => {
    expect(token("muted-foreground")).toBe(token("secondary"));
  });

  it("`foreground` sobre `madera` NO alcanza 4,5:1: por eso no se usa así (1,12:1)", () => {
    const medido = contraste(token("foreground"), token("madera"));
    expect(medido).toBeLessThan(TEXTO_MINIMO);
    expect(medido.toFixed(2)).toBe("1.12");
  });
});

describe("Contraste de bordes de controles (WCAG 2.1, 1.4.11)", () => {
  it.each(["background", "card"])("`border` contra %s alcanza 3:1", (fondo) => {
    expect(contraste(token("border"), token(fondo))).toBeGreaterThanOrEqual(BORDE_MINIMO);
  });

  it("los valores son los que cita la spec (3,66 y 4,19)", () => {
    expect(contraste(token("border"), token("background")).toFixed(2)).toBe("3.66");
    expect(contraste(token("border"), token("card")).toFixed(2)).toBe("4.19");
  });
});

// El rojo del sello es texto solo sobre background, card o muted; sobre madera es un relleno
// `bg-accent` con texto `text-accent-foreground` (escenario «El rojo del sello nunca es texto
// sobre madera oscura»). Se recorren las superficies de madera de la interfaz.
describe("El rojo del sello sobre la madera oscura", () => {
  const ROJO_COMO_TEXTO = /\btext-(?:accent|destructive)(?![-\w])/;
  const CLASES = /className=(?:"([^"]*)"|\{`([^`]*)`\})/g;

  /** Superficies de madera: elementos con `bg-madera` y `text-madera-foreground` en su `className`. */
  function superficiesDeMadera() {
    const halladas: { ruta: string; clases: string; subarbol: string }[] = [];
    for (const ruta of archivosDeLaInterfaz()) {
      const fuente = leer(ruta);
      for (const m of fuente.matchAll(CLASES)) {
        const clases = m[1] ?? m[2];
        if (/\bbg-madera\b/.test(clases) && /\btext-madera-foreground\b/.test(clases)) {
          halladas.push({ ruta, clases, subarbol: subarbolJsx(fuente, m.index) });
        }
      }
    }
    return halladas;
  }

  it("el recorrido encuentra las superficies de madera (no pasa en vacío)", () => {
    const rutas = superficiesDeMadera().map((s) => s.ruta);
    expect(rutas).toContain("src/components/ui/tablilla.tsx");
    expect(rutas).toContain("app/page.tsx");
  });

  it("ninguna aplica `text-accent` ni `text-destructive`, ni en sus hijos", () => {
    for (const { ruta, subarbol } of superficiesDeMadera()) {
      expect({ ruta, rojoComoTexto: ROJO_COMO_TEXTO.test(subarbol) }).toEqual({
        ruta,
        rojoComoTexto: false,
      });
    }
  });

  it("todo relleno rojo dentro de la madera lleva `text-accent-foreground`", () => {
    for (const { ruta, subarbol } of superficiesDeMadera()) {
      for (const m of subarbol.matchAll(CLASES)) {
        const clases = m[1] ?? m[2];
        if (/\bbg-accent\b/.test(clases)) {
          expect({ ruta, clases, conTextoClaro: /\btext-accent-foreground\b/.test(clases) }).toEqual({
            ruta,
            clases,
            conTextoClaro: true,
          });
        }
      }
    }
  });

  it("el detector reconoce un rojo como texto (control negativo)", () => {
    expect(ROJO_COMO_TEXTO.test('className="text-accent font-display"')).toBe(true);
    expect(ROJO_COMO_TEXTO.test('className="bg-accent text-accent-foreground"')).toBe(false);
  });
});
