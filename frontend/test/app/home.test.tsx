import { render, screen } from "@testing-library/react";
import Home from "../../app/page";

// La landing es para el cliente final: el acceso del personal a `/admin` es por URL directa
// y no se muestra en la interfaz pública (design.md D11).
describe("Landing (/)", () => {
  it("enlaza a /reservas", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: "Reservar una mesa" })).toHaveAttribute(
      "href",
      "/reservas",
    );
  });

  it("no muestra ningún enlace ni mención a la administración", () => {
    const { container } = render(<Home />);

    expect(container.querySelector('a[href^="/admin"]')).toBeNull();
    expect(container.textContent).not.toMatch(/administra/i);
  });
});
