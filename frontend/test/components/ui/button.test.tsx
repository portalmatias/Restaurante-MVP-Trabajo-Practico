import { render, screen } from "@testing-library/react";
import { Button, buttonVariants } from "../../../src/components/ui/button";

describe("Button", () => {
  it("renderiza su contenido con rol button", () => {
    render(<Button>Confirmar</Button>);

    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
  });

  it("define las clases de anillo de foco visible (:focus-visible)", () => {
    render(<Button>Confirmar</Button>);

    const button = screen.getByRole("button", { name: "Confirmar" });

    // jsdom no aplica pseudoclases como :focus-visible (D9): se verifica que las clases están
    // presentes en el DOM, no que el foco por teclado dispare el anillo en pantalla.
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

describe("Button size", () => {
  it("por defecto (md) conserva min-h-11 y text-sm", () => {
    render(<Button>Confirmar</Button>);

    const clases = screen.getByRole("button", { name: "Confirmar" }).className;

    expect(clases).toMatch(/(^| )min-h-11( |$)/);
    expect(clases).toMatch(/(^| )text-sm( |$)/);
  });

  it("size=lg da min-h-14 y text-lg, sin las clases de md", () => {
    render(<Button size="lg">Reservá ahora</Button>);

    const clases = screen.getByRole("button", { name: "Reservá ahora" }).className;

    expect(clases).toMatch(/(^| )min-h-14( |$)/);
    expect(clases).toMatch(/(^| )text-lg( |$)/);
    expect(clases).not.toMatch(/(^| )min-h-11( |$)/);
    expect(clases).not.toMatch(/(^| )text-sm( |$)/);
  });

  it("buttonVariants acepta size y no cambia variant, fullWidth ni className", () => {
    const clases = buttonVariants({ variant: "secondary", size: "lg", className: "mt-4" });

    expect(clases).toMatch(/min-h-14/);
    expect(clases).toMatch(/bg-secondary/);
    expect(clases).toMatch(/w-full sm:w-auto/);
    expect(clases).toMatch(/mt-4/);
  });
});

describe("buttonVariants", () => {
  it("genera las clases de la variante primaria por defecto", () => {
    expect(buttonVariants()).toMatch(/bg-primary/);
  });

  it("agrega el className recibido a las clases generadas", () => {
    expect(buttonVariants({ className: "mt-4" })).toMatch(/mt-4/);
  });

  it("la variante ghost no lleva relleno de color y resalta el fondo en hover", () => {
    const clases = buttonVariants({ variant: "ghost" });

    expect(clases).toMatch(/hover:bg-muted/);
    expect(clases).not.toMatch(/bg-primary|bg-secondary|bg-destructive/);
  });

  it("fullWidth=false omite el ancho completo en mobile, para reusarse en enlaces de navegación", () => {
    expect(buttonVariants({ variant: "ghost", fullWidth: false })).not.toMatch(/w-full/);
  });
});
