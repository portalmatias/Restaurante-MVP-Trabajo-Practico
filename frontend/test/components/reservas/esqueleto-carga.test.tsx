import { render, screen } from "@testing-library/react";
import { EsqueletoCarga } from "../../../src/components/reservas/esqueleto-carga";

describe("EsqueletoCarga", () => {
  it("anuncia la carga a los lectores de pantalla con un rol de estado", () => {
    render(<EsqueletoCarga />);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
  });

  it("agrega su contenido al final del mismo contenedor, sin sumarle el pulso propio", () => {
    render(
      <EsqueletoCarga>
        <p>Extra</p>
      </EsqueletoCarga>,
    );

    const extra = screen.getByText("Extra");
    const contenedor = screen.getByRole("status").parentElement;
    expect(extra.parentElement).toBe(contenedor);
    expect(contenedor?.lastElementChild).toBe(extra);
    expect(extra.closest(".motion-safe\\:animate-pulse")).toBeNull();
  });
});
