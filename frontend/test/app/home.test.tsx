import { render, screen } from "@testing-library/react";
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

  // Tarea 2.6 de openspec/changes/rediseno-frontend-ichigo (spec: "Los pasos de reserva
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
