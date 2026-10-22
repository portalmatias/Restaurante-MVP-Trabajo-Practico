import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { estadoDeTablilla, Tablilla, TablillaPaso } from "../../../src/components/ui/tablilla";

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

// Tarea 3.1 (tablilla-turnos): lo que faltaba de «Tablilla como control de selección de turno»,
// «Texto japonés solo decorativo» y «TablillaPaso informativa».
describe("Tablilla - control de selección", () => {
  it("el nombre accesible es el aria-label en español, sin el japonés", () => {
    renderizar("libre");

    expect(screen.getByRole("button")).toHaveAccessibleName(NOMBRE);
  });

  it("la elegida lleva el sello decorativo con aria-hidden", () => {
    renderizar("elegida");

    expect(screen.getByText("予")).toHaveAttribute("aria-hidden", "true");
  });

  it("sin japonés no muestra texto vertical", () => {
    const { container } = render(<Tablilla titulo="20:00" detalle="a 23:30" aria-label={NOMBRE} />);

    expect(container.querySelector('[lang="ja"]')).toBeNull();
    expect(container.innerHTML).not.toContain("writing-mode:vertical-rl");
  });

  // jsdom no calcula el layout: se comprueban las clases de tamaño base (las de 390px, sin el
  // prefijo `sm:`). h-48 = 192px y w-[6.75rem] = 108px, ambos por encima de 44px.
  it("su objetivo táctil base supera 44×44px", () => {
    renderizar("libre");
    const clases = screen.getByRole("button").className.split(" ");

    expect(clases).toContain("h-48");
    expect(clases).toContain("w-[6.75rem]");
  });
});

describe("TablillaPaso", () => {
  it("no es un control ni entra en el orden de tabulación", () => {
    const { container } = render(
      <ol>
        <li>
          <TablillaPaso titulo="Nigiri" japones="握り" detalle="Pieza a pieza" />
        </li>
      </ol>,
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector("[tabindex], a, button, input")).toBeNull();
    expect(screen.getByText("握り")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("握り")).toHaveAttribute("lang", "ja");
  });
});

// Tarea 3.13 y escenarios de grupo de «Estados descartada y completa»: el estado sale de
// `estadoDeTablilla`, la misma función que usa el Paso 1.
function GrupoDeTablillas({ completas = [] }: { completas?: string[] }) {
  const [elegida, setElegida] = useState<string>();
  return (
    <>
      {["12:00", "20:00", "22:00"].map((hora) => (
        <Tablilla
          key={hora}
          titulo={hora}
          aria-label={hora}
          estado={estadoDeTablilla(hora, elegida, completas.includes(hora))}
          onClick={() => setElegida(hora)}
        />
      ))}
    </>
  );
}

const pulsadas = () => screen.getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") === "true");

describe("Tablilla - en grupo", () => {
  it("al tocar la segunda, las otras dos se dan vuelta pero siguen tocables", () => {
    render(<GrupoDeTablillas />);
    expect(screen.getByRole("button", { name: "12:00" }).querySelector(".origin-top")?.className).not.toContain(
      "rotateY(180deg)",
    );

    fireEvent.click(screen.getByRole("button", { name: "20:00" }));

    expect(screen.getByRole("button", { name: "20:00" })).toHaveAttribute("aria-pressed", "true");
    for (const hora of ["12:00", "22:00"]) {
      const boton = screen.getByRole("button", { name: hora });
      expect(boton).toHaveAttribute("aria-pressed", "false");
      // El que gira es el contenedor de las dos caras (`origin-top`), no el dorso.
      expect(boton.querySelector(".origin-top")?.className).toContain("rotateY(180deg)");
      expect(boton).toBeEnabled();
    }
    fireEvent.click(screen.getByRole("button", { name: "12:00" }));
    expect(screen.getByRole("button", { name: "12:00" })).toHaveAttribute("aria-pressed", "true");
  });

  it("elegir sucesivamente deja como máximo una elegida", () => {
    render(<GrupoDeTablillas />);

    for (const hora of ["12:00", "22:00", "20:00", "20:00"]) {
      fireEvent.click(screen.getByRole("button", { name: hora }));
      expect(pulsadas()).toHaveLength(1);
    }
  });

  it("una completa sigue completa, se alcanza y no cambia la elección cuando se elige otra", () => {
    render(<GrupoDeTablillas completas={["22:00"]} />);
    const completa = () => screen.getByRole("button", { name: "22:00, completo" });

    fireEvent.click(screen.getByRole("button", { name: "12:00" }));

    expect(completa()).toHaveAttribute("aria-disabled", "true");
    expect(completa()).not.toHaveAttribute("aria-pressed");
    expect(completa().tabIndex).toBeGreaterThanOrEqual(0);
    fireEvent.click(completa());
    fireEvent.keyDown(completa(), { key: "Enter" });
    expect(screen.getByRole("button", { name: "12:00" })).toHaveAttribute("aria-pressed", "true");
    expect(pulsadas()).toHaveLength(1);
  });
});

describe("estadoDeTablilla", () => {
  it.each([
    ["a", undefined, false, "libre"],
    ["a", "a", false, "elegida"],
    ["a", "b", false, "descartada"],
    ["a", undefined, true, "completa"],
    ["a", "a", true, "completa"],
    ["a", "b", true, "completa"],
  ] as const)("%s con elegida=%s y completa=%s es %s", (id, elegida, completa, esperado) => {
    expect(estadoDeTablilla(id, elegida, completa)).toBe(esperado);
  });
});
