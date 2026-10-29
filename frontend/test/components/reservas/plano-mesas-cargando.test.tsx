import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { PlanoMesasCargando } from "../../../src/components/reservas/plano-mesas-cargando";

// Tarea 5.5 de `plano-mesas` (design.md D7): esqueleto del plano mientras se pide.
describe("PlanoMesasCargando", () => {
  it("avisa que está ocupado con aria-busy", () => {
    const { container } = render(<PlanoMesasCargando />);

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("tiene un texto accesible que dice qué se está cargando", () => {
    render(<PlanoMesasCargando />);

    expect(screen.getByText("Cargando el plano de mesas")).toBeInTheDocument();
  });

  it("los bloques del esqueleto son decorativos y usan la clase animada", () => {
    const { container } = render(<PlanoMesasCargando />);

    const bloques = container.querySelectorAll(".plano-mesas-cargando");
    expect(bloques.length).toBeGreaterThan(0);
    for (const bloque of bloques) {
      expect(bloque.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it("reserva el lugar del dibujo con la proporción de la grilla, sin saltos de layout", () => {
    const { container } = render(<PlanoMesasCargando />);

    expect(container.querySelector(".aspect-\\[3\\/2\\]")).not.toBeNull();
  });

  // Comentario de cubic en #89: sin la lista, el plano real agregaba altura al llegar.
  it("reserva también el lugar de la lista, en el mismo orden que el plano real", () => {
    const { container } = render(<PlanoMesasCargando />);

    const lista = container.querySelector("[data-esqueleto-lista]");
    const dibujo = container.querySelector(".aspect-\\[3\\/2\\]");
    expect(lista?.querySelectorAll(".plano-mesas-cargando").length).toBeGreaterThan(0);
    // Como en PlanoMesas: en celular la lista va antes que el dibujo; desde `sm`, después.
    expect(lista?.className).toMatch(/(^|\s)order-1(\s|$)/);
    expect(lista?.className).toContain("sm:order-2");
    expect(dibujo?.className).toMatch(/(^|\s)order-2(\s|$)/);
    expect(dibujo?.className).toContain("sm:order-1");
  });
});

describe("PlanoMesasCargando - movimiento reducido", () => {
  // `jsdom` no evalúa media queries: se comprueba que la regla existe en la hoja de estilos y la
  // prueba real es la manual de la tarea 6.1.
  const css = readFileSync(join(__dirname, "../../../app/globals.css"), "utf8");

  it("la clase del esqueleto tiene una animación declarada", () => {
    expect(css).toMatch(/\.plano-mesas-cargando\s*\{[^}]*animation:[^;]*\bbrillo-plano\b/);
  });

  it("prefers-reduced-motion apaga la animación del esqueleto", () => {
    const bloques = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\r?\n\}/g)].map(
      (m) => m[1],
    );

    expect(
      bloques.some(
        (bloque) => /\.plano-mesas-cargando(?![\w-])[^{]*\{[^}]*animation:\s*none/.test(bloque),
      ),
    ).toBe(true);
  });
});
