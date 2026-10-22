import { readFileSync } from "node:fs";
import { join } from "node:path";

// Tarea 3.10 (calendario-fecha, «El día de hoy lo calcula el servidor»): ni el calendario ni el
// Paso 1 leen el reloj del navegador; «hoy» llega por prop desde el servidor.
const raiz = join(__dirname, "../../..");

describe.each(["src/components/ui/calendario.tsx", "src/components/reservas/formulario-seleccion.tsx"])(
  "%s",
  (archivo) => {
    const fuente = readFileSync(join(raiz, archivo), "utf8");

    it("no llama a new Date() sin argumentos", () => {
      expect(fuente).not.toMatch(/new Date\(\s*\)/);
    });

    it("no llama a Date.now()", () => {
      expect(fuente).not.toMatch(/Date\.now\(/);
    });
  },
);
