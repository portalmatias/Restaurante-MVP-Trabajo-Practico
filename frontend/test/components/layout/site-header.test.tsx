import { render, screen } from "@testing-library/react";
import { SiteHeader } from "../../../src/components/layout/site-header";

// El encabezado es público: el acceso del personal a `/admin` es por URL directa (design.md D11).
describe("SiteHeader", () => {
  it("enlaza a /reservas", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Reservas" })).toHaveAttribute("href", "/reservas");
  });

  it("no muestra ningún enlace ni mención a la administración", () => {
    const { container } = render(<SiteHeader />);

    expect(container.querySelector('a[href^="/admin"]')).toBeNull();
    expect(container.textContent).not.toMatch(/administra/i);
  });
});
