import { render, screen } from "@testing-library/react";
import { PasosReserva } from "../../../src/components/reservas/pasos-reserva";

describe("PasosReserva", () => {
  it("muestra el texto 'Paso 2 de 3', la única indicación accesible", () => {
    render(<PasosReserva pasoActual={2} total={3} />);

    expect(screen.getByText("Paso 2 de 3")).toBeInTheDocument();
  });

  it("renderiza un punto decorativo con aria-hidden por paso", () => {
    const { container } = render(<PasosReserva pasoActual={2} total={3} />);

    const puntos = container.querySelectorAll('[aria-hidden="true"]');

    expect(puntos).toHaveLength(3);
  });

  it("solo el punto del paso actual lleva el estilo de actual", () => {
    const { container } = render(<PasosReserva pasoActual={2} total={3} />);

    const puntos = Array.from(container.querySelectorAll('[aria-hidden="true"]'));

    expect(puntos.map((punto) => punto.className.includes("bg-primary"))).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("acompaña el paso 1 de 3", () => {
    render(<PasosReserva pasoActual={1} total={3} />);

    expect(screen.getByText("Paso 1 de 3")).toBeInTheDocument();
  });
});
