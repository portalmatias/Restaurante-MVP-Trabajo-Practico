import { render, screen, within } from "@testing-library/react";
import { SiteHeader } from "../../../src/components/layout/site-header";

// El encabezado es público: el acceso del personal a `/admin` es por URL directa (design.md D11).
describe("SiteHeader", () => {
  // Spec frontend-base, «El encabezado lleva el nombre del restaurante»: «Ichigo» como enlace a `/`,
  // con «Reservas» y «Consultar reserva» en la navegación.
  it("el nombre «Ichigo» es un enlace a / y la navegación incluye Reservas y Consultar reserva", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: /^Ichigo/ })).toHaveAttribute("href", "/");
    const navegacion = within(screen.getByRole("navigation"));
    expect(navegacion.getByRole("link", { name: "Reservas" })).toBeInTheDocument();
    expect(navegacion.getByRole("link", { name: "Consultar reserva" })).toBeInTheDocument();
  });

  it("enlaza a /reservas", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Reservas" })).toHaveAttribute("href", "/reservas");
  });

  it("enlaza a /reservas/consultar con el nombre accesible 'Consultar reserva'", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Consultar reserva" })).toHaveAttribute(
      "href",
      "/reservas/consultar",
    );
  });

  it("ningún enlace apunta a /admin", () => {
    render(<SiteHeader />);

    for (const enlace of screen.getAllByRole("link")) {
      expect(enlace.getAttribute("href")).not.toMatch(/^\/admin/);
    }
  });

  it("no muestra ningún enlace ni mención a la administración", () => {
    const { container } = render(<SiteHeader />);

    expect(container.querySelector('a[href^="/admin"]')).toBeNull();
    expect(container.textContent).not.toMatch(/administra/i);
  });
});
