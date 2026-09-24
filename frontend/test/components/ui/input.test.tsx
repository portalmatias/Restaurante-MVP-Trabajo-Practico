import { render, screen } from "@testing-library/react";
import { Input } from "../../../src/components/ui/input";

describe("Input", () => {
  it("standalone con invalid establece aria-invalid", () => {
    render(<Input aria-label="Email" invalid />);

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
