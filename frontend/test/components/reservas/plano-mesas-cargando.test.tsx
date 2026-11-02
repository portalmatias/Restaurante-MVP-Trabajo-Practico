import { render, screen } from "@testing-library/react";
import { PlanoMesasCargando } from "../../../src/components/reservas/plano-mesas-cargando";

// Tarea 5.5 de `plano-mesas` (design.md D7): esqueleto del plano mientras se pide.
describe("PlanoMesasCargando", () => {
  it("avisa que está ocupado con aria-busy", () => {
    const { container } = render(<PlanoMesasCargando />);

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  // Comentario de Facundo en #89: como `EsqueletoCarga`, el texto se anuncia con un rol de estado.
  it("anuncia qué se está cargando con un rol de estado", () => {
    render(<PlanoMesasCargando />);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando el plano de mesas");
  });

  // Comentario de Facundo en #89: el pulso es el mismo de `EsqueletoCarga`, sin CSS propio, y
  // `motion-safe:` lo apaga con `prefers-reduced-motion` (la prueba real es la manual de 6.1).
  it("los bloques del esqueleto son decorativos y pulsan solo sin movimiento reducido", () => {
    const { container } = render(<PlanoMesasCargando />);

    const bloques = container.querySelector('[aria-hidden="true"]');
    expect(bloques?.className).toMatch(/(^|\s)motion-safe:animate-pulse(\s|$)/);
    expect(bloques?.children.length).toBeGreaterThan(0);
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
    expect(lista?.children.length).toBeGreaterThan(0);
    // Como en PlanoMesas: en celular la lista va antes que el dibujo; desde `sm`, después.
    expect(lista?.className).toMatch(/(^|\s)order-1(\s|$)/);
    expect(lista?.className).toContain("sm:order-2");
    expect(dibujo?.className).toMatch(/(^|\s)order-2(\s|$)/);
    expect(dibujo?.className).toContain("sm:order-1");
  });
});
