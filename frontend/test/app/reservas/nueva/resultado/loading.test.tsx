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
});
