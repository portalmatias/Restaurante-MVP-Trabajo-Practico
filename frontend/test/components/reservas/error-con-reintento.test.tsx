import { fireEvent, render, screen } from "@testing-library/react";
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
});
