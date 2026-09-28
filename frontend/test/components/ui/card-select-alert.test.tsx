import { render, screen } from "@testing-library/react";
import { Alert } from "../../../src/components/ui/alert";
import { Card } from "../../../src/components/ui/card";
import { Select } from "../../../src/components/ui/select";

describe("Card", () => {
  it("expone su contenido dentro de una región cuando recibe un título accesible", () => {
    render(<Card title="Datos de la reserva">Contenido de la tarjeta</Card>);

    const region = screen.getByRole("region", { name: "Datos de la reserva" });

    expect(region).toHaveTextContent("Contenido de la tarjeta");
  });

  it("sin título renderiza un contenedor simple, sin role=region", () => {
    render(<Card>Contenido sin título</Card>);

    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.getByText("Contenido sin título")).toBeInTheDocument();
  });

  it("por defecto expone el título como encabezado de nivel 2", () => {
    render(<Card title="Reservas">Contenido</Card>);

    expect(screen.getByRole("heading", { level: 2, name: "Reservas" })).toBeInTheDocument();
  });

  it("con headingLevel=1 expone el título como el h1 de la página (WCAG 1.3.1)", () => {
    render(
      <Card title="Reservas" headingLevel={1}>
        Contenido
      </Card>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Reservas" })).toBeInTheDocument();
  });
});

describe("Select", () => {
  it("asocia su etiqueta al control igual que Field", () => {
    render(
      <Select label="Zona">
        <option value="standard">Standard</option>
      </Select>,
    );

    expect(screen.getByRole("combobox", { name: "Zona" })).toBeInTheDocument();
  });

  it("enlaza el mensaje de error al control mediante aria-describedby y aria-invalid", () => {
    render(
      <Select label="Zona" error="Requerido">
        <option value="standard">Standard</option>
      </Select>,
    );

    const control = screen.getByRole("combobox", { name: "Zona" });
    const errorNode = screen.getByText("Requerido");

    expect(control).toHaveAttribute("aria-describedby", errorNode.id);
    expect(control).toHaveAttribute("aria-invalid", "true");
  });

  it("conserva un aria-describedby existente y agrega el id del error, sin reemplazarlo", () => {
    render(
      <Select label="Zona" aria-describedby="ayuda" error="Requerido">
        <option value="standard">Standard</option>
      </Select>,
    );

    const control = screen.getByRole("combobox", { name: "Zona" });
    const errorNode = screen.getByText("Requerido");
    const describedBy = control.getAttribute("aria-describedby")?.split(/\s+/) ?? [];

    expect(describedBy).toContain("ayuda");
    expect(describedBy).toContain(errorNode.id);
  });
});

describe("Alert", () => {
  it("la variante error usa el token destructive y expone su texto sin ícono", () => {
    render(<Alert variant="error">Ocurrió un error al procesar la reserva</Alert>);

    const alert = screen.getByRole("alert");

    expect(alert).toHaveTextContent("Ocurrió un error al procesar la reserva");
    expect(alert.className).toMatch(/destructive/);
    expect(alert.querySelector("svg")).toBeNull();
  });

  it("la variante info usa role=status", () => {
    render(<Alert variant="info">Guardado correctamente</Alert>);

    const alert = screen.getByRole("status");

    expect(alert).toHaveTextContent("Guardado correctamente");
  });
});
