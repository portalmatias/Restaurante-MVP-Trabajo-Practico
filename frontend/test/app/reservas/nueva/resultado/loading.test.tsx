import { render, screen } from "@testing-library/react";
import Loading from "../../../../../app/reservas/nueva/resultado/loading";

// El plano se pide en el Server Component de la página (design.md D5), así que lo que se ve
// mientras llega es este `loading.tsx`: tiene que incluir el esqueleto del plano (tarea 5.5).
describe("Carga del resultado de la reserva", () => {
  it("muestra el esqueleto del plano además del de la página", () => {
    render(<Loading />);

    expect(screen.getByText("Cargando el plano de mesas")).toBeInTheDocument();
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
  });

  // Comentario de Facundo en #89: en la página, el plano es un hijo más del contenedor con
  // `gap-6`; si el esqueleto lo ponía en otro contenedor, el espacio cambiaba al llegar.
  it("pone el esqueleto del plano en el mismo contenedor que el resto, como la página", () => {
    render(<Loading />);

    const plano = screen.getByText("Cargando el plano de mesas").closest("section");
    const contenedor = screen.getByText("Cargando…").parentElement;
    expect(plano?.parentElement).toBe(contenedor);
    expect(contenedor?.className).toMatch(/(^|\s)gap-6(\s|$)/);
  });
});
