import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ErrorConReintento } from "../../../src/components/reservas/error-con-reintento";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => {
  refresh.mockReset();
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

  it("mientras el refresh está en curso deshabilita 'Reintentar' y no repite la solicitud", async () => {
    // Un refresh que no termina: la transición sigue pendiente mientras no se resuelva.
    let terminar: () => void = () => undefined;
    refresh.mockImplementation(() => new Promise<void>((resolver) => (terminar = resolver)));
    render(<ErrorConReintento mensaje="Algo falló." />);
    const boton = screen.getByRole("button", { name: "Reintentar" });

    fireEvent.click(boton);
    await waitFor(() => expect(boton).toBeDisabled());
    fireEvent.click(boton);

    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => terminar());
    await waitFor(() => expect(boton).toBeEnabled());
  });
});
