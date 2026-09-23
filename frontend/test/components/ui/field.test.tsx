import { render, screen } from "@testing-library/react";
import { Field } from "../../../src/components/ui/field";

describe("Field", () => {
  it("asocia la etiqueta al control mediante htmlFor/id", () => {
    render(<Field label="Email" />);

    const control = screen.getByRole("textbox", { name: "Email" });

    expect(control).toBeInTheDocument();
  });

  it("enlaza el mensaje de error al control mediante aria-describedby", () => {
    render(<Field label="Email" error="Requerido" />);

    const control = screen.getByRole("textbox", { name: "Email" });
    const errorNode = screen.getByText("Requerido");

    expect(control).toHaveAttribute("aria-describedby", errorNode.id);
  });
});
