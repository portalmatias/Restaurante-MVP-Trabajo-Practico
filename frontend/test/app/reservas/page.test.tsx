import { render, screen } from "@testing-library/react";
import ReservasPage from "../../../app/reservas/page";

// design.md D3 Pantalla 1: una acción principal, una secundaria y nada de administración.
describe("/reservas (Inicio)", () => {
  it("muestra el título de la pantalla como h1", () => {
    render(<ReservasPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Reservá tu mesa" })).toBeInTheDocument();
  });

  it("ofrece la acción principal 'Reservá ahora' hacia /reservas/nueva", () => {
    render(<ReservasPage />);

    expect(screen.getByRole("link", { name: "Reservá ahora" })).toHaveAttribute(
      "href",
      "/reservas/nueva",
    );
  });

  it("ofrece la acción secundaria hacia /reservas/consultar", () => {
    render(<ReservasPage />);

    expect(
      screen.getByRole("link", { name: "¿Ya reservaste? Consultá o cancelá tu reserva" }),
    ).toHaveAttribute("href", "/reservas/consultar");
  });

  it("no tiene más enlaces que las dos acciones del cliente", () => {
    render(<ReservasPage />);

    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("no muestra ningún enlace ni mención a la administración", () => {
    const { container } = render(<ReservasPage />);

    expect(container.querySelector('a[href^="/admin"]')).toBeNull();
    expect(container.textContent).not.toMatch(/administra/i);
  });

  it("ya no es el placeholder de frontend-base", () => {
    const { container } = render(<ReservasPage />);

    expect(container.textContent).not.toMatch(/todavía no está implementada/i);
  });
});
