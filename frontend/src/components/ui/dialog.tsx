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
 * Escape dispara `cancel`. Si es cancelable se evita el cierre nativo (`preventDefault`) y
 * `onCancel` se llama una vez, para que el cierre lo decida `open`. Chromium, ante Escape
 * repetido sin interacción del usuario, dispara un `cancel` NO cancelable y cierra el diálogo
 * igual: ese caso se resincroniza con el evento `close` (si el diálogo nativo ya no está
 * abierto pero `open` sigue en true, se llama a `onCancel`, una vez, para que el padre lo
 * cierre). Con eso cada Escape llama a `onCancel` exactamente una vez, y un `open=true` posterior
 * vuelve a mostrar el diálogo porque el efecto revisa el estado nativo en cada render.
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

  // Sin lista de dependencias a propósito: compara `open` con el estado nativo en cada render,
  // así un diálogo que el navegador cerró por su cuenta se vuelve a mostrar si `open` sigue en
  // true. `showModal()` lanza si ya está abierto, de ahí la guarda.
  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) {
      return;
    }
    if (open && !dialogo.open) {
      dialogo.showModal();
    } else if (!open && dialogo.open) {
      dialogo.close();
    }
  });

  // Al desmontar se cierra el diálogo nativo si quedó abierto.
  useEffect(() => {
    const dialogo = ref.current;
    return () => {
      if (dialogo?.open) {
        dialogo.close();
      }
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={tituloId}
      onCancel={(evento) => {
        // Un `cancel` no cancelable ya no se puede evitar: el diálogo se cierra y `onClose`
        // resincroniza (ver arriba), así `onCancel` no se llama dos veces.
        if (evento.cancelable) {
          evento.preventDefault();
          onCancel();
        }
      }}
      onClose={(evento) => {
        // Cerrado por el navegador mientras `open` sigue en true. El `close` provocado por
        // `open=false` o el de un diálogo ya reabierto no llegan acá con `open` y cerrado.
        if (open && !evento.currentTarget.open) {
          onCancel();
        }
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
