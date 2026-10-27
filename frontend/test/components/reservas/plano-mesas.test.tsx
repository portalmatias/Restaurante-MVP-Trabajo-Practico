import { render, screen, within } from "@testing-library/react";
import { PlanoMesas } from "../../../src/components/reservas/plano-mesas";
import type { MesaPlano, PlanoMesas as Plano } from "../../../src/lib/plano-mesas";

function mesa(etiqueta: string, cambios: Partial<MesaPlano> = {}): MesaPlano {
  return {
    etiqueta,
    capacidad: 4,
    forma: "CUADRADA",
    posX: 0,
    posY: 0,
    ancho: 1,
    alto: 1,
    estado: "LIBRE",
    ...cambios,
  };
}

const PLANO: Plano = {
  zona: "STANDARD",
  columnas: 12,
  filas: 8,
  disponible: true,
  lugaresRestantes: 20,
  motivos: [],
  mesas: [
    mesa("S1", { capacidad: 2, forma: "REDONDA", estado: "NO_ALCANZA" }),
    mesa("S2", { posX: 2, estado: "OCUPADA" }),
    mesa("S3", { posX: 5, ancho: 2, alto: 2 }),
    mesa("S4", { posX: 8, forma: "RECTANGULAR", ancho: 3 }),
    mesa("S5", { posY: 4, estado: "OCUPADA" }),
    mesa("S6", { posX: null, posY: null }),
  ],
};

const SIN_LUGAR: Plano = {
  ...PLANO,
  disponible: false,
  lugaresRestantes: 0,
  motivos: [
    { codigo: "AFORO_ZONA", mensaje: "La zona STANDARD no tiene más lugar en ese turno." },
  ],
};

function renderizar(plano: Plano = PLANO) {
  return render(<PlanoMesas plano={plano} comensales={4} />);
}

function dibujo(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector<SVGSVGElement>("svg[data-dibujo]");
  if (!svg) throw new Error("No hay dibujo");
  return svg;
}

function mesaDibujada(container: HTMLElement, etiqueta: string): SVGGElement | null {
  return dibujo(container).querySelector(`g[data-mesa="${etiqueta}"]`);
}

describe("PlanoMesas - lista textual", () => {
  it("lista cada mesa con etiqueta, capacidad y estado en palabras, en orden", () => {
    renderizar();

    const lista = screen.getByRole("list", { name: "Mesas de la zona" });
    expect(within(lista).getAllByRole("listitem").map((fila) => fila.textContent)).toEqual([
      "Mesa S1, para 2 comensales: no alcanza",
      "Mesa S2, para 4 comensales: ocupada",
      "Mesa S3, para 4 comensales: libre",
      "Mesa S4, para 4 comensales: libre",
      "Mesa S5, para 4 comensales: ocupada",
      "Mesa S6, para 4 comensales: libre (sin ubicar en el plano)",
    ]);
  });
});

describe("PlanoMesas - dibujo", () => {
  it("es transparente para el lector de pantalla", () => {
    const { container } = renderizar();

    expect(dibujo(container)).toHaveAttribute("aria-hidden", "true");
  });

  it("usa la grilla de la zona como viewBox", () => {
    const { container } = renderizar();

    expect(dibujo(container)).toHaveAttribute("viewBox", "0 0 576 384");
  });

  it("dibuja solo las mesas ubicadas", () => {
    const { container } = renderizar();

    const etiquetas = [...dibujo(container).querySelectorAll("g[data-mesa]")].map((g) =>
      g.getAttribute("data-mesa"),
    );
    expect(etiquetas).toEqual(["S1", "S2", "S3", "S4", "S5"]);
    expect(mesaDibujada(container, "S6")).toBeNull();
  });

  it("da a cada estado un patrón de relleno y una marca propios, además del color", () => {
    const { container } = renderizar();

    const libre = mesaDibujada(container, "S3");
    const ocupada = mesaDibujada(container, "S2");
    const noAlcanza = mesaDibujada(container, "S1");
    const patrones = [libre, ocupada, noAlcanza].map((g) =>
      g?.querySelector("[data-forma]")?.getAttribute("fill"),
    );
    const marcas = [libre, ocupada, noAlcanza].map(
      (g) => g?.querySelector("[data-marca]")?.textContent,
    );

    expect(new Set(patrones).size).toBe(3);
    for (const patron of patrones) {
      const id = patron?.match(/^url\(#(.+)\)$/)?.[1];
      expect(id && container.querySelector(`pattern[id="${id}"]`)).toBeTruthy();
    }
    expect(marcas).toEqual(["✓", "×", "–"]);
  });

  it("no escribe el estado en palabras dentro de las mesas", () => {
    const { container } = renderizar();

    expect(within(dibujo(container) as unknown as HTMLElement).queryByText(/libre|ocupada|no alcanza/i)).toBeNull();
  });

  it("imprime la capacidad solo en las mesas de al menos 2 celdas de ancho", () => {
    const { container } = renderizar();

    const textos = (etiqueta: string) =>
      [...(mesaDibujada(container, etiqueta)?.querySelectorAll("text") ?? [])].map(
        (texto) => texto.textContent,
      );
    expect(textos("S3")).toContain("4 pers.");
    expect(textos("S4")).toContain("4 pers.");
    expect(textos("S2")).not.toContain("4 pers.");
    expect(textos("S1").some((texto) => texto?.includes("pers."))).toBe(false);
  });

  it("dibuja la forma de cada mesa", () => {
    const { container } = renderizar();

    expect(mesaDibujada(container, "S1")?.querySelector("[data-forma]")?.tagName).toBe("ellipse");
    expect(mesaDibujada(container, "S4")?.querySelector("[data-forma]")?.tagName).toBe("rect");
  });

  it("no dibuja una mesa que se sale de la grilla y la lista la marca sin ubicar", () => {
    const { container } = renderizar({
      ...PLANO,
      mesas: [mesa("S1"), mesa("S9", { posX: 11, ancho: 2 })],
    });

    expect(mesaDibujada(container, "S9")).toBeNull();
    expect(screen.getByText("Mesa S9, para 4 comensales: libre (sin ubicar en el plano)")).toBeInTheDocument();
  });

  it("oculta el dibujo si ninguna mesa está ubicada y deja la lista", () => {
    const { container } = renderizar({
      ...PLANO,
      mesas: [mesa("S6", { posX: null, posY: null })],
    });

    expect(container.querySelector("svg[data-dibujo]")).toBeNull();
    expect(screen.getByRole("list", { name: "Mesas de la zona" })).toBeInTheDocument();
  });
});

describe("PlanoMesas - leyenda y resumen", () => {
  it("muestra la leyenda con los tres estados en palabras, cada uno con su marca", () => {
    renderizar();

    const leyenda = screen.getByRole("list", { name: "Referencias del plano" });
    expect(within(leyenda).getAllByRole("listitem").map((fila) => fila.textContent)).toEqual([
      "✓ Libre",
      "× Ocupada",
      "– No alcanza",
    ]);
  });

  it("resume las cantidades por estado en un texto con role status", () => {
    renderizar();

    expect(screen.getByRole("status")).toHaveTextContent(
      "En la zona STANDARD hay 3 mesas libres para 4 comensales, 2 ocupadas y 1 que no alcanza.",
    );
  });
});

describe("PlanoMesas - informativo", () => {
  it("aclara que es una foto del momento y que la mesa se asigna al confirmar", () => {
    renderizar();

    expect(screen.getByText(/foto del momento/)).toBeInTheDocument();
    expect(
      screen.getByText(/La mesa se asigna automáticamente al confirmar la reserva/),
    ).toBeInTheDocument();
  });

  it("no tiene ningún control para elegir una mesa", () => {
    renderizar();

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

describe("PlanoMesas - sin lugar", () => {
  it("con lugar no se atenúa ni muestra el aviso", () => {
    renderizar();

    expect(screen.getByRole("region", { name: "Plano de las mesas" })).not.toHaveAttribute(
      "data-atenuado",
    );
    expect(screen.queryByText(/hoy no se puede reservar este turno/)).toBeNull();
  });

  it("sin lugar se atenúa y avisa que hoy no se puede reservar, con los motivos", () => {
    renderizar(SIN_LUGAR);

    expect(screen.getByRole("region", { name: "Plano de las mesas" })).toHaveAttribute(
      "data-atenuado",
      "true",
    );
    expect(
      screen.getByText(
        "El plano muestra el estado de las mesas, pero hoy no se puede reservar este turno por: La zona STANDARD no tiene más lugar en ese turno.",
      ),
    ).toBeInTheDocument();
  });

  it("sin lugar y sin motivos informados, el aviso no queda cortado", () => {
    renderizar({ ...SIN_LUGAR, motivos: [] });

    expect(
      screen.getByText(
        "El plano muestra el estado de las mesas, pero hoy no se puede reservar este turno.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/por:/)).toBeNull();
  });

  it("sin lugar no dice que la mesa se asigna al confirmar", () => {
    renderizar(SIN_LUGAR);

    expect(screen.queryByText(/se asigna automáticamente/)).toBeNull();
  });
});
