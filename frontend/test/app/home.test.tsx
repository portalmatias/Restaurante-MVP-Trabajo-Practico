import { render, screen, within } from "@testing-library/react";
import Home from "../../app/page";

// La landing es para el cliente final: el acceso del personal a `/admin` es por URL directa
// y no se muestra en la interfaz pública (design.md D11).
describe("Landing (/)", () => {
  it("enlaza a /reservas", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: "Reservar una mesa" })).toHaveAttribute(
      "href",
      "/reservas",
    );
  });

  it("no muestra ningún enlace ni mención a la administración", () => {
    const { container } = render(<Home />);

    expect(container.querySelector('a[href^="/admin"]')).toBeNull();
    expect(container.textContent).not.toMatch(/administra/i);
  });

  // Tarea 2.6 de openspec/changes/archive/2026-10-28-rediseno-frontend-ichigo (spec: "Los pasos de reserva
  // coinciden con el flujo real"): el primer paso omitía la zona, que el Paso 1 de
  // /reservas/nueva también pide.
  it('el primer paso de "Así se reserva" menciona la zona', () => {
    render(<Home />);

    expect(screen.getByText("Elegí fecha, turno, zona y cantidad de comensales.")).toBeInTheDocument();
  });

  // Tarea 2.5 (landing-ichigo): las acciones van en infinitivo por decisión del equipo; los
  // títulos y textos explicativos, en voseo y nunca en tuteo.
  it.each([
    ["Reservar una mesa", "/reservas"],
    ["Ya tengo un código", "/reservas/consultar"],
    ["Elegir fecha y turno", "/reservas/nueva"],
  ])("la acción «%s» queda en infinitivo y lleva a %s", (nombre, destino) => {
    render(<Home />);

    expect(screen.getByRole("link", { name: nombre })).toHaveAttribute("href", destino);
  });

  // Spec landing-ichigo.
  describe("estructura y contenido", () => {
    const antes = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    it("«Orden del documento»: el h1 y «Reservar una mesa» aparecen antes que la primera imagen", () => {
      const { container } = render(<Home />);
      const h1 = screen.getByRole("heading", { level: 1 });
      const reservar = screen.getByRole("link", { name: "Reservar una mesa" });
      const primeraImagen = container.querySelector("img");

      expect(primeraImagen).not.toBeNull();
      expect(antes(h1, primeraImagen!)).toBe(true);
      expect(antes(reservar, primeraImagen!)).toBe(true);
    });

    it("«Propuesta de apertura»: el texto que sigue al h1 es la propuesta", () => {
      render(<Home />);

      expect(screen.getByRole("heading", { level: 1 }).nextElementSibling).toHaveTextContent(
        "Omakase japonés. Cada bocado, una sorpresa.",
      );
    });

    it("«Ningún dato del sistema en la landing»: sin precios, horarios, cupos ni cifras de aforo", () => {
      const { container } = render(<Home />);
      const texto = container.textContent ?? "";

      expect(texto).not.toMatch(/[$€]|\bARS\b|precio|\baforo\b|\bcupos?\b/i);
      expect(texto).not.toMatch(/\b\d{1,2}[:.]\d{2}\b/); // horarios de turno
      expect(texto).not.toMatch(/\d+\s*(%|lugares|comensales|personas|mesas)/i); // cifras de lugares o aforo
    });

    it("«Cierre con la acción repetida»: el último enlace es «Elegir fecha y turno» hacia /reservas/nueva, después de las imágenes", () => {
      const { container } = render(<Home />);
      const enlaces = screen.getAllByRole("link");
      const ultimo = enlaces[enlaces.length - 1];
      const imagenes = container.querySelectorAll("img");

      expect(ultimo).toHaveAccessibleName("Elegir fecha y turno");
      expect(ultimo).toHaveAttribute("href", "/reservas/nueva");
      expect(antes(imagenes[imagenes.length - 1], ultimo)).toBe(true);
    });

    it("«Texto sin imágenes»: sin ninguna imagen, el nombre, la propuesta, las secciones y las acciones siguen", () => {
      const { container } = render(<Home />);
      container.querySelectorAll("img").forEach((imagen) => imagen.remove());

      expect(screen.getByRole("heading", { level: 1, name: "Ichigo" })).toBeVisible();
      expect(screen.getByText("Omakase japonés. Cada bocado, una sorpresa.")).toBeVisible();
      for (const seccion of ["Omakase: confiá en el itamae", "Una sala en silencio", "Así se reserva"]) {
        expect(screen.getByRole("heading", { level: 2, name: seccion })).toBeVisible();
      }
      for (const accion of ["Reservar una mesa", "Ya tengo un código", "Elegir fecha y turno"]) {
        expect(screen.getByRole("link", { name: accion })).toBeVisible();
      }
    });

    it("«Una sola imagen prioritaria» (cliente): solo la fotografía de la apertura carga sin diferirse; las otras cuatro son perezosas", () => {
      const { container } = render(<Home />);
      const imagenes = [...container.querySelectorAll("img")];
      const noPerezosas = imagenes.filter((imagen) => imagen.getAttribute("loading") !== "lazy");

      expect(imagenes).toHaveLength(5);
      expect(noPerezosas).toHaveLength(1);
      expect(decodeURIComponent(noPerezosas[0].getAttribute("src") ?? "")).toContain("nigiri.webp");
    });

    it("«Se usa dentro de una lista» (tablilla-turnos): cada tiempo del omakase es un <li> de una lista ordenada", () => {
      const { container } = render(<Home />);
      const tiempos = container.querySelector("ol.tiempos-landing");

      expect(tiempos).not.toBeNull();
      const items = within(tiempos as HTMLElement).getAllByRole("listitem");
      expect(items).toHaveLength(3);
      for (const [indice, titulo] of ["Primer bocado", "Nigiri", "Cierre dulce"].entries()) {
        expect(items[indice]).toHaveTextContent(titulo);
      }
    });

    it("«Los pasos de reserva coinciden con el flujo real»: los tres pasos describen fecha, turno, zona y comensales; datos sin cuenta; y el código", () => {
      render(<Home />);
      const pasos = within(screen.getByRole("heading", { level: 2, name: "Así se reserva" }).parentElement!).getAllByRole(
        "listitem",
      );

      expect(pasos).toHaveLength(3);
      expect(pasos[0]).toHaveTextContent(/fecha, turno, zona y cantidad de comensales/);
      expect(pasos[1]).toHaveTextContent(/nombre.*email.*teléfono.*No necesitás cuenta/);
      expect(pasos[2]).toHaveTextContent(/código.*consultás o cancelás/);
    });
  });

  it("los textos usan voseo y ninguno usa tuteo", () => {
    const { container } = render(<Home />);
    const texto = container.textContent ?? "";

    for (const voseo of ["Dejás", "Reservá", "confiá", "Avisanos", "Elegís", "Elegí", "Dejá", "Guardá", "necesitás"]) {
      expect(texto).toContain(voseo);
    }
    expect(texto).not.toMatch(
      /\b(tienes|puedes|quieres|necesitas|recibes|eliges|dejas|elige|deja|guarda|confía|avísanos|reserva tu)\b/i,
    );
  });
});
