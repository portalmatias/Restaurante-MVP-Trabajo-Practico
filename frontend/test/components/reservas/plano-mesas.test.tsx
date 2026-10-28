import { readFileSync } from "node:fs";
import { join } from "node:path";
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

/**
 * Textos de una mesa dibujada. Falla si la mesa no está o no tiene textos: así un bucle sobre el
 * resultado no puede pasar sin comprobar nada.
 */
function textosDeMesa(container: HTMLElement, etiqueta: string): SVGTextElement[] {
  const g = mesaDibujada(container, etiqueta);
  expect(g).not.toBeNull();
  const textos = [...(g?.querySelectorAll("text") ?? [])];
  expect(textos.length).toBeGreaterThan(0);
  return textos;
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

describe("PlanoMesas - estado que el frontend no conoce", () => {
  // El backend puede agregar un estado antes de que se despliegue este frontend: la mesa se
  // describe y se dibuja en neutro, sin "undefined" ni un patrón inexistente.
  const DESCONOCIDO = {
    ...PLANO,
    mesas: [mesa("S1", { estado: "BLOQUEADA" as MesaPlano["estado"] })],
  };

  it("la lista dice 'sin información' en vez de undefined", () => {
    renderizar(DESCONOCIDO);

    expect(
      within(screen.getByRole("list", { name: "Mesas de la zona" })).getByRole("listitem"),
    ).toHaveTextContent("Mesa S1, para 4 comensales: sin información");
  });

  it("el dibujo usa un patrón que existe y una marca neutra", () => {
    const { container } = renderizar(DESCONOCIDO);

    const forma = mesaDibujada(container, "S1")?.querySelector("[data-forma]");
    const patron = forma?.getAttribute("fill")?.match(/^url\(#(.+)\)$/)?.[1];
    expect(patron).toBeDefined();
    expect(container.querySelector(`pattern[id="${patron}"]`)).not.toBeNull();
    expect(mesaDibujada(container, "S1")?.querySelector("[data-marca]")).toHaveTextContent("?");
    expect(container.innerHTML).not.toContain("undefined");
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

  it("sin lugar atenúa solo el dibujo: la lista y el resumen conservan su contraste", () => {
    const { container } = renderizar(SIN_LUGAR);

    expect(dibujo(container).closest(".opacity-60")).not.toBeNull();
    expect(screen.getByRole("list", { name: "Mesas de la zona" }).closest(".opacity-60")).toBeNull();
    expect(screen.getByRole("status").closest(".opacity-60")).toBeNull();
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

describe("PlanoMesas - tablillas de madera (tarea 5.3)", () => {
  const numero = (elemento: Element | null | undefined, atributo: string) =>
    Number(elemento?.getAttribute(atributo));

  it("no usa colores propios: el componente solo usa los tokens del tema", () => {
    const fuente = readFileSync(
      join(__dirname, "../../../src/components/reservas/plano-mesas.tsx"),
      "utf8",
    );

    expect(fuente).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/);
  });

  it("cada mesa tiene el canto de la tablilla debajo de su cara", () => {
    const { container } = renderizar();

    for (const etiqueta of ["S1", "S2", "S3", "S4"]) {
      const g = mesaDibujada(container, etiqueta);
      const canto = g?.querySelector("[data-canto]");
      expect(canto).not.toBeNull();
      // El canto va antes que la cara, para quedar detrás.
      expect(g?.firstElementChild).toBe(canto);
      expect(canto?.getAttribute("class")).toContain("fill-border");
    }
  });

  it("la mesa ocupada es la tablilla dada vuelta: madera oscura con texto claro", () => {
    const { container } = renderizar();

    const textos = (etiqueta: string) => textosDeMesa(container, etiqueta);
    for (const texto of textos("S2")) {
      expect(texto.getAttribute("class")).toContain("fill-madera-foreground");
    }
    for (const etiqueta of ["S1", "S3"]) {
      for (const texto of textos(etiqueta)) {
        expect(texto.getAttribute("class")).toContain("fill-foreground");
      }
    }
    const patronOcupada = container.querySelector('pattern[id="plano-mesas-ocupada"] rect');
    expect(patronOcupada?.getAttribute("class")).toContain("fill-madera");
  });

  // Aviso de la revisión de gentle-ai anotado en la tarea 5.3: en las mesas de una celda la marca
  // se pisaba con etiquetas largas ("S10") y en las redondas quedaba fuera del círculo.
  it("en una mesa de una celda la marca va centrada arriba de la etiqueta, sin pisarla", () => {
    const { container } = renderizar({
      ...PLANO,
      mesas: [mesa("S10", { posX: 3, posY: 3 }), mesa("S11", { posX: 5, posY: 3, forma: "REDONDA" })],
    });

    for (const etiqueta of ["S10", "S11"]) {
      const g = mesaDibujada(container, etiqueta);
      const forma = g?.querySelector("[data-forma]");
      const marca = g?.querySelector("[data-marca]");
      const texto = g?.querySelector("[data-etiqueta]");
      const centroX =
        forma?.tagName === "ellipse"
          ? numero(forma, "cx")
          : numero(forma, "x") + numero(forma, "width") / 2;

      expect(numero(marca, "x")).toBe(centroX);
      expect(marca?.getAttribute("text-anchor")).toBe("middle");
      // La línea base de la marca queda por encima del alto de la letra de la etiqueta.
      expect(numero(marca, "y")).toBeLessThanOrEqual(numero(texto, "y") - numero(texto, "font-size"));
    }
  });

  it("en una mesa redonda la marca y la etiqueta quedan dentro del círculo", () => {
    const { container } = renderizar({
      ...PLANO,
      mesas: [mesa("S11", { posX: 5, posY: 3, forma: "REDONDA" })],
    });

    const g = mesaDibujada(container, "S11");
    const forma = g?.querySelector("[data-forma]");
    const cy = numero(forma, "cy");
    const ry = numero(forma, "ry");
    for (const texto of textosDeMesa(container, "S11")) {
      const base = numero(texto, "y");
      const alto = numero(texto, "font-size");
      expect(base).toBeLessThanOrEqual(cy + ry);
      expect(base - alto).toBeGreaterThanOrEqual(cy - ry);
    }
  });
});

describe("PlanoMesas - legibilidad sobre el patrón", () => {
  // Revisión visual (tarea 6.1): los puntos y las vetas del patrón se mezclaban con la marca y la
  // etiqueta. Cada texto lleva un halo del color base de su tablilla, pintado debajo del relleno.
  it("cada texto de la mesa lleva un halo del color base de su tablilla", () => {
    const { container } = renderizar();

    const halos: Record<string, string> = { S1: "stroke-muted", S2: "stroke-madera", S3: "stroke-card" };
    for (const [etiqueta, halo] of Object.entries(halos)) {
      for (const texto of textosDeMesa(container, etiqueta)) {
        expect(texto.getAttribute("class")).toContain(halo);
        expect(texto.getAttribute("paint-order")).toBe("stroke");
        expect(Number(texto.getAttribute("stroke-width"))).toBeGreaterThan(0);
      }
    }
  });
});

describe("PlanoMesas - orden en celular (tarea 5.8)", () => {
  it("en pantallas angostas la lista va antes que el dibujo; desde sm, el dibujo primero", () => {
    const { container } = renderizar();

    const lista = screen.getByRole("list", { name: "Mesas de la zona" });
    const contenedorDibujo = dibujo(container).parentElement;
    expect(lista.className).toMatch(/(^|\s)order-1(\s|$)/);
    expect(lista.className).toMatch(/(^|\s)sm:order-2(\s|$)/);
    expect(contenedorDibujo?.className).toMatch(/(^|\s)order-2(\s|$)/);
    expect(contenedorDibujo?.className).toMatch(/(^|\s)sm:order-1(\s|$)/);
    // Los dos comparten el contenedor flex, si no `order` no tiene efecto.
    expect(lista.parentElement).toBe(contenedorDibujo?.parentElement);
    expect(lista.parentElement?.className).toMatch(/(^|\s)flex(\s|$)/);
  });

  it("el dibujo escala al ancho disponible y solo desborda dentro de su caja", () => {
    const { container } = renderizar();

    expect(dibujo(container).getAttribute("class")).toMatch(/(^|\s)w-full(\s|$)/);
    expect(dibujo(container).parentElement?.className).toContain("overflow-x-auto");
  });
});
