import { render, screen } from "@testing-library/react";
import { Button } from "../../../src/components/ui/button";

describe("Button", () => {
  it("renderiza su contenido con rol button", () => {
    render(<Button>Confirmar</Button>);

    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
  });

  it("expone un anillo de foco visible al recibir foco por teclado", () => {
    render(<Button>Confirmar</Button>);

    const button = screen.getByRole("button", { name: "Confirmar" });

    expect(button.className).toMatch(/focus-visible:ring-2/);
    expect(button.className).toMatch(/focus-visible:ring-ring/);
  });

  it("la variante primaria mide al menos 44px de alto", () => {
    render(<Button variant="primary">Confirmar</Button>);

    const button = screen.getByRole("button", { name: "Confirmar" });

    // jsdom no calcula layout real (D9): se verifica la clase de altura mínima aplicada.
    expect(button.className).toMatch(/min-h-11/);
  });
});
