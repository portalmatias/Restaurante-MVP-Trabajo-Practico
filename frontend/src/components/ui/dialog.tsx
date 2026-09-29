"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button, type ButtonVariant } from "./button";

export type DialogProps = {
  open: boolean;
  /** Título visible; también es el nombre accesible del diálogo (`aria-labelledby`). */
  titulo: string;
  /** Contenido entre el título y los botones (resumen, mensajes de error, etc.). */
  children?: ReactNode;
  textoConfirmar: string;
  textoCancelar: string;
  onConfirm: () => void;
  /** Se llama al apretar el botón de cancelar o al pedir cerrarlo (Escape en el navegador). */
  onCancel: () => void;
  /** Deshabilita el botón de confirmar mientras la acción está en curso. */
  confirmando?: boolean;
  variantConfirmar?: ButtonVariant;
};

/**
 * Diálogo modal sobre el elemento nativo `<dialog>` (design.md D5): `showModal()` deja el
 * fondo inerte, atrapa el foco de teclado y lo devuelve al elemento que abrió el diálogo al
 * cerrarse, sin implementar nada de eso a mano. Es controlado: quien lo usa decide `open`.
 *
 * Al pedir cerrar con Escape el navegador dispara `cancel` y luego `close`. Se escucha solo
 * `cancel` (con `preventDefault`, para que el cierre lo decida `open`) y así `onCancel` se
 * llama una única vez.
 */
export function Dialog({
  open,
  titulo,
  children,
  textoConfirmar,
  textoCancelar,
  onConfirm,
  onCancel,
  confirmando = false,
  variantConfirmar = "primary",
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const tituloId = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!open || !dialogo) {
      return;
    }
    dialogo.showModal();
    return () => dialogo.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={tituloId}
      onCancel={(evento) => {
        evento.preventDefault();
        onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border bg-card p-6 text-foreground backdrop:bg-black/50"
    >
      <h2 id={tituloId} className="text-xl font-semibold">
        {titulo}
      </h2>
      <div className="mt-4 flex flex-col gap-4 text-base">{children}</div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          {textoCancelar}
        </Button>
        <Button variant={variantConfirmar} onClick={onConfirm} disabled={confirmando}>
          {textoConfirmar}
        </Button>
      </div>
    </dialog>
  );
}
