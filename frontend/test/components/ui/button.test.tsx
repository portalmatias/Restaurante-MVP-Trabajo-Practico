import { render, screen } from "@testing-library/react";
import { Button, buttonVariants } from "../../../src/components/ui/button";

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

  it("usa type=button por defecto, para no enviar un form sin querer", () => {
    render(<Button>Confirmar</Button>);

    expect(screen.getByRole("button", { name: "Confirmar" })).toHaveAttribute("type", "button");
  });

  it("la variante secondary usa el token secondary", () => {
    render(<Button variant="secondary">Cancelar</Button>);

    expect(screen.getByRole("button", { name: "Cancelar" }).className).toMatch(/bg-secondary/);
  });

  it("la variante destructive usa el token destructive", () => {
    render(<Button variant="destructive">Eliminar</Button>);

    expect(screen.getByRole("button", { name: "Eliminar" }).className).toMatch(/bg-destructive/);
  });
});

describe("buttonVariants", () => {
  it("genera las clases de la variante primaria por defecto", () => {
    expect(buttonVariants()).toMatch(/bg-primary/);
  });

  it("agrega el className recibido a las clases generadas", () => {
    expect(buttonVariants({ className: "mt-4" })).toMatch(/mt-4/);
  });
});
