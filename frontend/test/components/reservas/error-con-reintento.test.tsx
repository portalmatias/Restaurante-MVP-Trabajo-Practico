import { useTransition } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ErrorConReintento } from "../../../src/components/reservas/error-con-reintento";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

// `router.refresh()` devuelve void: su carga pendiente solo se observa por `useTransition`, así
// que el test controla ese estado en vez de simular una promesa que Next no devuelve.
jest.mock("react", () => ({ ...jest.requireActual("react"), useTransition: jest.fn() }));
const mockUseTransition = useTransition as jest.Mock;

beforeEach(() => {
  refresh.mockReset();
  mockUseTransition.mockReset();
  mockUseTransition.mockImplementation(jest.requireActual("react").useTransition);
});

describe("ErrorConReintento", () => {
  it("muestra el mensaje recibido como alerta", () => {
    render(<ErrorConReintento mensaje="No se pudo conectar con el servidor." />);

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo conectar con el servidor.");
  });

  it("al tocar 'Reintentar' vuelve a pedir la ruta con router.refresh", () => {
    render(<ErrorConReintento mensaje="Algo falló." />);

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("mientras la recarga está pendiente deshabilita 'Reintentar'", () => {
    mockUseTransition.mockReturnValue([true, jest.fn()]);
    render(<ErrorConReintento mensaje="Algo falló." />);

    expect(screen.getByRole("button", { name: "Reintentar" })).toBeDisabled();
  });

  it("con la recarga libre habilita 'Reintentar' y el clic la inicia dentro de la transición", () => {
    const iniciarRecarga = jest.fn((accion: () => void) => accion());
    mockUseTransition.mockReturnValue([false, iniciarRecarga]);
    render(<ErrorConReintento mensaje="Algo falló." />);
    const boton = screen.getByRole("button", { name: "Reintentar" });

    expect(boton).toBeEnabled();
    fireEvent.click(boton);

    expect(iniciarRecarga).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
