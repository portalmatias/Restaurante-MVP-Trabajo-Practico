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
});

describe("Alert", () => {
  it("la variante error usa el token destructive y expone su texto sin ícono", () => {
    render(<Alert variant="error">Ocurrió un error al procesar la reserva</Alert>);

    const alert = screen.getByRole("alert");

    expect(alert).toHaveTextContent("Ocurrió un error al procesar la reserva");
    expect(alert.className).toMatch(/destructive/);
    expect(alert.querySelector("svg")).toBeNull();
  });
});
