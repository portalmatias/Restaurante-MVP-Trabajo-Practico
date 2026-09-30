import { act, fireEvent, render, screen } from "@testing-library/react";
import { BotonCopiarCodigo } from "../../../src/components/reservas/boton-copiar-codigo";

const writeText = jest.fn();

function definirPortapapeles(valor: unknown) {
  Object.defineProperty(navigator, "clipboard", { value: valor, configurable: true });
}

async function copiar() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Copiar código" }));
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  writeText.mockReset().mockResolvedValue(undefined);
  definirPortapapeles({ writeText });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("BotonCopiarCodigo", () => {
  it("ofrece la acción de copiar con un ícono decorativo", () => {
    const { container } = render(<BotonCopiarCodigo codigo="K7PM3QXA" />);

    expect(screen.getByRole("button", { name: "Copiar código" })).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("copia el código al portapapeles", async () => {
    render(<BotonCopiarCodigo codigo="K7PM3QXA" />);

    await copiar();

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("K7PM3QXA");
  });

  it("muestra una confirmación momentánea de que se copió", async () => {
    render(<BotonCopiarCodigo codigo="K7PM3QXA" />);

    await copiar();

    expect(screen.getByRole("status")).toHaveTextContent("¡Copiado!");
    expect(screen.getByRole("button", { name: "¡Copiado!" })).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(screen.queryByText("¡Copiado!")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar código" })).toBeInTheDocument();
  });

  it("si el portapapeles rechaza, no confirma y pide copiar a mano", async () => {
    writeText.mockRejectedValue(new Error("denegado"));
    render(<BotonCopiarCodigo codigo="K7PM3QXA" />);

    await copiar();

    expect(screen.queryByText("¡Copiado!")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "No pudimos copiarlo. Anotá el código o seleccionalo para copiarlo.",
    );
  });

  it("si el navegador no ofrece portapapeles, no confirma y pide copiar a mano", async () => {
    definirPortapapeles(undefined);
    render(<BotonCopiarCodigo codigo="K7PM3QXA" />);

    await copiar();

    expect(screen.queryByText("¡Copiado!")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/No pudimos copiarlo/);
  });

  it("si se desmonta mientras la copia está en curso, no deja un temporizador pendiente", async () => {
    let terminarCopia: () => void = () => undefined;
    writeText.mockReturnValue(new Promise<void>((resolver) => (terminarCopia = resolver)));
    const { unmount } = render(<BotonCopiarCodigo codigo="K7PM3QXA" />);

    const antes = jest.getTimerCount();
    fireEvent.click(screen.getByRole("button", { name: "Copiar código" }));
    unmount();
    terminarCopia();
    // Deja correr las continuaciones pendientes de la copia (microtareas, sin temporizadores).
    for (let i = 0; i < 5; i++) await Promise.resolve();

    expect(jest.getTimerCount()).toBe(antes);
  });
});
