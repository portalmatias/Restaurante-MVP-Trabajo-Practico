import { fireEvent, render, screen } from "@testing-library/react";
import { Tablilla } from "../../../src/components/ui/tablilla";

const NOMBRE = "20:00 a 23:30";

function renderizar(estado: "libre" | "elegida" | "descartada" | "completa", onClick = jest.fn()) {
  render(<Tablilla titulo="20:00" detalle="a 23:30" japones="夕食" estado={estado} aria-label={NOMBRE} onClick={onClick} />);
  return { onClick };
}

describe("Tablilla - estados", () => {
  it.each([
    ["libre", "false"],
    ["elegida", "true"],
    ["descartada", "false"],
  ] as const)("%s expone aria-pressed=%s y sigue siendo activable", (estado, pressed) => {
    const { onClick } = renderizar(estado);
    const boton = screen.getByRole("button", { name: NOMBRE });

    expect(boton).toHaveAttribute("aria-pressed", pressed);
    expect(boton).not.toHaveAttribute("aria-disabled");
    expect(boton).toBeEnabled();
    fireEvent.click(boton);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("el japonés es decoración: aria-hidden y lang=ja", () => {
    renderizar("libre");
    const japones = screen.getByText("夕食");

    expect(japones).toHaveAttribute("aria-hidden", "true");
    expect(japones).toHaveAttribute("lang", "ja");
  });
});

describe("Tablilla - estado completa", () => {
  it("usa aria-disabled y no disabled, sin aria-pressed", () => {
    renderizar("completa");
    const boton = screen.getByRole("button");

    expect(boton).toHaveAttribute("aria-disabled", "true");
    expect(boton).not.toHaveAttribute("disabled");
    expect(boton).not.toHaveAttribute("aria-pressed");
  });

  it("su nombre accesible es el aria-label recibido más «, completo»", () => {
    renderizar("completa");

    expect(screen.getByRole("button", { name: "20:00 a 23:30, completo" })).toBeInTheDocument();
  });

  it("sin aria-label, el nombre sale del contenido y dice «Completo»", () => {
    render(<Tablilla titulo="20:00" detalle="a 23:30" estado="completa" />);

    expect(screen.getByRole("button", { name: /Completo/ })).toBeInTheDocument();
  });

  it("sigue en el orden de tabulación y recibe el foco", () => {
    renderizar("completa");
    const boton = screen.getByRole("button");

    // jsdom no mueve el foco con Tab: se comprueba que no está fuera del orden (tabIndex >= 0)
    // y que puede recibirlo, que es lo que `disabled` impediría.
    expect(boton.tabIndex).toBeGreaterThanOrEqual(0);
    boton.focus();
    expect(boton).toHaveFocus();
  });

  it("activarla no llama a onClick", () => {
    const { onClick } = renderizar("completa");

    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Tablilla - foco", () => {
  it.each(["libre", "elegida", "descartada", "completa"] as const)(
    "%s dibuja el anillo con separación del fondo, no pegado a la madera",
    (estado) => {
      renderizar(estado);
      const clases = screen.getByRole("button").className;

      expect(clases).toContain("focus-visible:ring-2");
      expect(clases).toContain("focus-visible:ring-offset-2");
      expect(clases).toContain("focus-visible:ring-offset-background");
    },
  );
});
