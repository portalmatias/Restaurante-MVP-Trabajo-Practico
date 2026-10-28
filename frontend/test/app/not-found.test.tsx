import { render, screen, within } from "@testing-library/react";
import NotFound, { metadata } from "../../app/not-found";
import { PantallaDeEstado } from "../../src/components/reservas/pantalla-de-estado";

// Tarea 3.5 (experiencia-reserva-cliente, «Pantallas de estado para ruta inexistente y error
// inesperado»).
describe("Pantalla de ruta inexistente", () => {
  it("tiene un único h1 «No encontramos esa página» y el título de pestaña propio", () => {
    render(<NotFound />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("No encontramos esa página");
    expect(metadata.title).toBe("Página no encontrada");
  });

  it("ofrece «Volver al inicio» hacia / y «Reservar una mesa»", () => {
    render(<NotFound />);

    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Reservar una mesa" })).toHaveAttribute("href", "/reservas/nueva");
  });
});

describe("PantallaDeEstado", () => {
  it("la tablilla es decorativa y el mensaje es el h1", () => {
    const { container } = render(
      <PantallaDeEstado tablilla="Algo falló" detalle="500" titulo="Ichigo no está disponible por ahora">
        <button type="button">Reintentar</button>
      </PantallaDeEstado>,
    );

    const decorativo = container.querySelector('[aria-hidden="true"]');
    expect(decorativo).not.toBeNull();
    expect(within(decorativo as HTMLElement).getByText("Algo falló")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ichigo no está disponible por ahora");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    // Lo decorativo queda fuera del árbol accesible: la tablilla no se anuncia.
    expect(screen.queryByText("Algo falló", { ignore: '[aria-hidden="true"] *' })).toBeNull();
  });
});
