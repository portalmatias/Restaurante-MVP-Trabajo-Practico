import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { Input } from "../../../src/components/ui/input";

describe("Input", () => {
  it("standalone con invalid establece aria-invalid", () => {
    render(<Input aria-label="Email" invalid />);

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("invalid decide aria-invalid aunque el caller pase el suyo propio (consistente con Field/Select)", () => {
    // `InputProps` omite `aria-invalid` (lo calcula el componente), así que un caller TS no
    // puede pasarlo. Se simula un caller sin tipos (JS puro) con un cast, que es el caso real
    // que motiva el fix: `aria-invalid` del caller no debe pisar el que calcula `invalid`.
    const propsDeCallerJs = {
      invalid: true,
      "aria-invalid": "false",
    } as unknown as ComponentProps<typeof Input>;

    render(<Input aria-label="Email" {...propsDeCallerJs} />);

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
