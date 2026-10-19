import { render, screen } from "@testing-library/react";
import { BotonCompacto } from "../../../src/components/admin/boton-compacto";

describe("BotonCompacto", () => {
  it("baja a 36px solo con la variante sin-puntero-grueso, no con pointer-fine", () => {
    render(<BotonCompacto>Editar</BotonCompacto>);

    const boton = screen.getByRole("button", { name: "Editar" });

    // jsdom no evalúa `@media (any-pointer: ...)` (D9 de `button.test.tsx`): se verifica que la
    // excepción de tamaño use la variante que excluye cualquier puntero grueso, no la que mira
    // solo el puntero principal (`pointer-fine`), que un equipo híbrido con mouse y pantalla
    // táctil también cumpliría.
    expect(boton.className).toMatch(/(^| )sin-puntero-grueso:min-h-9( |$)/);
    expect(boton.className).toMatch(/(^| )sin-puntero-grueso:px-3( |$)/);
    expect(boton.className).not.toMatch(/pointer-fine:/);
  });

  it("no tiene ancho completo (fullWidth: false), a diferencia de Button", () => {
    render(<BotonCompacto>Editar</BotonCompacto>);

    expect(screen.getByRole("button", { name: "Editar" }).className).not.toMatch(/w-full/);
  });
});
