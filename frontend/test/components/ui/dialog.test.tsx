import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Dialog } from "../../../src/components/ui/dialog";

// jsdom no implementa la semántica modal de HTMLDialogElement (design.md D5): no vuelve inerte
// el fondo, no atrapa el foco con Tab ni devuelve el foco al cerrarse. Esta suite solo prueba
// lo que jsdom puede probar; el atrapado y la devolución de foco se verifican a mano en un
// navegador real (tasks.md 7.2). Los stubs de showModal/close reflejan el atributo `open`
// para que el rol y el nombre accesible del diálogo se puedan consultar.
const showModal = jest.fn(function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
});
const close = jest.fn(function (this: HTMLDialogElement) {
  this.removeAttribute("open");
});

beforeEach(() => {
  showModal.mockClear();
  close.mockClear();
  HTMLDialogElement.prototype.showModal = showModal;
  HTMLDialogElement.prototype.close = close;
});

function renderDialog(props: Partial<React.ComponentProps<typeof Dialog>> = {}) {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  const resultado = render(
    <Dialog
      open
      titulo="Cancelar reserva"
      textoConfirmar="Sí, cancelar"
      textoCancelar="Volver"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    >
      {props.children ?? <p>Resumen de la reserva</p>}
    </Dialog>,
  );
  return { ...resultado, onConfirm, onCancel };
}

describe("Dialog", () => {
  it("abrirlo llama a showModal()", () => {
    renderDialog();

    expect(showModal).toHaveBeenCalledTimes(1);
  });

  it("no llama a showModal() mientras está cerrado", () => {
    renderDialog({ open: false });

    expect(showModal).not.toHaveBeenCalled();
  });

  it("cerrarlo llama a close()", () => {
    const { rerender, onConfirm, onCancel } = renderDialog();

    rerender(
      <Dialog
        open={false}
        titulo="Cancelar reserva"
        textoConfirmar="Sí, cancelar"
        textoCancelar="Volver"
        onConfirm={onConfirm}
        onCancel={onCancel}
      >
        <p>Resumen de la reserva</p>
      </Dialog>,
    );

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("expone el rol dialog con su título como nombre accesible", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Cancelar reserva" })).toBeInTheDocument();
  });

  it("muestra el contenido recibido", () => {
    renderDialog();

    expect(screen.getByText("Resumen de la reserva")).toBeInTheDocument();
  });

  it("el botón de confirmar dispara onConfirm", () => {
    const { onConfirm, onCancel } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Sí, cancelar" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("el botón de cancelar dispara onCancel", () => {
    const { onConfirm, onCancel } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Volver" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("un evento cancel (Escape en el navegador) llama a onCancel exactamente una vez", () => {
    const { onCancel } = renderDialog();
    const dialogo = screen.getByRole("dialog", { name: "Cancelar reserva" });

    // Un `cancel` cancelable con `preventDefault` deja el diálogo abierto: el navegador no
    // dispara `close` después, así que `onCancel` se llama solo desde `cancel`. El cierre
    // nativo sin `preventDefault` (cancel no cancelable) se prueba más abajo.
    const cancelar = new Event("cancel", { cancelable: true });
    dialogo.dispatchEvent(cancelar);

    expect(onCancel).toHaveBeenCalledTimes(1);
    // El cierre lo decide `open`, no el navegador: se evita el cierre nativo.
    expect(cancelar.defaultPrevented).toBe(true);
  });

  it("con confirmando deshabilita el botón de confirmar", () => {
    renderDialog({ confirmando: true, textoConfirmar: "Cancelando…" });

    expect(screen.getByRole("button", { name: "Cancelando…" })).toBeDisabled();
  });

  it("muestra el contenido de error dentro del diálogo", () => {
    renderDialog({ children: <p role="alert">No se pudo cancelar</p> });

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cancelar");
  });

  it("define el anillo de foco visible en sus botones", () => {
    renderDialog();

    expect(screen.getByRole("button", { name: "Volver" }).className).toMatch(
      /focus-visible:ring-2/,
    );
  });

  // Chromium (close watcher) dispara un `cancel` NO cancelable ante Escape repetido sin
  // interacción del usuario: el diálogo nativo se cierra igual, aunque `open` siga en true.
  describe("cierre nativo que el padre no pidió", () => {
    function cerrarNativo(dialogo: HTMLElement) {
      dialogo.removeAttribute("open");
      dialogo.dispatchEvent(new Event("close"));
    }

    function conOpen(open: boolean, onCancel: () => void) {
      return (
        <Dialog
          open={open}
          titulo="Cancelar reserva"
          textoConfirmar="Sí, cancelar"
          textoCancelar="Volver"
          onConfirm={jest.fn()}
          onCancel={onCancel}
        >
          <p>Resumen de la reserva</p>
        </Dialog>
      );
    }

    it("un cancel no cancelable seguido de close llama a onCancel exactamente una vez", () => {
      const { onCancel } = renderDialog();
      const dialogo = screen.getByRole("dialog", { name: "Cancelar reserva" });

      const cancelar = new Event("cancel", { cancelable: false });
      dialogo.dispatchEvent(cancelar);
      cerrarNativo(dialogo);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("un close sin cancel previo, con open todavía en true, llama a onCancel una vez", () => {
      const { onCancel } = renderDialog();

      cerrarNativo(screen.getByRole("dialog", { name: "Cancelar reserva" }));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("después del cierre nativo, el padre puede cerrar y volver a abrir el diálogo", () => {
      const onCancel = jest.fn();
      const { rerender } = render(conOpen(true, onCancel));
      cerrarNativo(screen.getByRole("dialog", { name: "Cancelar reserva", hidden: true }));
      expect(showModal).toHaveBeenCalledTimes(1);

      rerender(conOpen(false, onCancel));
      rerender(conOpen(true, onCancel));

      expect(showModal).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("dialog", { name: "Cancelar reserva" })).toBeInTheDocument();
    });

    it("si el padre ignora onCancel y vuelve a renderizar con open=true, se vuelve a mostrar", () => {
      const onCancel = jest.fn();
      const { rerender } = render(conOpen(true, onCancel));
      cerrarNativo(screen.getByRole("dialog", { name: "Cancelar reserva", hidden: true }));

      rerender(conOpen(true, onCancel));

      expect(showModal).toHaveBeenCalledTimes(2);
    });

    it("el close que provoca el propio cierre por open=false no llama a onCancel", () => {
      const onCancel = jest.fn();
      const { rerender } = render(conOpen(true, onCancel));
      const dialogo = screen.getByRole("dialog", { name: "Cancelar reserva" });

      rerender(conOpen(false, onCancel));
      dialogo.dispatchEvent(new Event("close")); // el navegador lo dispara de forma asíncrona

      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  // Como un navegador: `close()` dispara el evento `close` (acá de forma síncrona).
  describe("cierres que provoca el propio componente", () => {
    beforeEach(() => {
      HTMLDialogElement.prototype.close = jest.fn(function (this: HTMLDialogElement) {
        this.removeAttribute("open");
        this.dispatchEvent(new Event("close"));
      });
    });

    function ui(onCancel: () => void, open = true) {
      return (
        <Dialog
          open={open}
          titulo="Cancelar reserva"
          textoConfirmar="Sí, cancelar"
          textoCancelar="Volver"
          onConfirm={jest.fn()}
          onCancel={onCancel}
        >
          <p>Resumen de la reserva</p>
        </Dialog>
      );
    }

    it("desmontar con open=true no llama a onCancel", () => {
      const onCancel = jest.fn();
      const { unmount } = render(ui(onCancel));

      unmount();

      expect(onCancel).not.toHaveBeenCalled();
    });

    it("cerrar con open=false no llama a onCancel", () => {
      const onCancel = jest.fn();
      const { rerender } = render(ui(onCancel));

      rerender(ui(onCancel, false));

      expect(onCancel).not.toHaveBeenCalled();
    });

    it("en StrictMode (montar, limpiar, montar) queda abierto y no llama a onCancel", () => {
      const onCancel = jest.fn();

      render(<StrictMode>{ui(onCancel)}</StrictMode>);

      expect(onCancel).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog", { name: "Cancelar reserva" })).toBeInTheDocument();
    });

    it("un cierre nativo posterior a un cierre propio sigue llamando a onCancel", () => {
      const onCancel = jest.fn();
      const { rerender } = render(ui(onCancel));
      rerender(ui(onCancel, false));
      rerender(ui(onCancel, true));

      const dialogo = screen.getByRole("dialog", { name: "Cancelar reserva" });
      dialogo.removeAttribute("open");
      dialogo.dispatchEvent(new Event("close"));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });
});
