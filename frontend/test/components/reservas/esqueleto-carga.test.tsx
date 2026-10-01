import { render, screen } from "@testing-library/react";
import { EsqueletoCarga } from "../../../src/components/reservas/esqueleto-carga";

describe("EsqueletoCarga", () => {
  it("anuncia la carga a los lectores de pantalla con un rol de estado", () => {
    render(<EsqueletoCarga />);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
  });
});
