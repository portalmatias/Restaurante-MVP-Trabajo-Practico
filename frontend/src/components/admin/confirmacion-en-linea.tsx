"use client";

import { useEffect, useRef, useState } from "react";
import type { ButtonVariant } from "../ui/button";
import { BotonCompacto } from "./boton-compacto";

export type ConfirmacionEnLineaProps = {
  /** Texto del botón inicial (por ejemplo, "Dar de baja"). */
  etiqueta: string;
  /** Pregunta del paso de confirmación (por ejemplo, "¿Confirmás la baja de M1?"). */
  pregunta: string;
  /** Texto del botón que ejecuta la acción. */
  confirmar: string;
  onConfirmar: () => void;
  deshabilitado?: boolean;
  variante?: ButtonVariant;
};

/**
 * Confirmación de una acción irreversible en dos pasos, en el mismo lugar del control
 * (design.md D6), sin ventana modal: el botón se reemplaza por la pregunta con "confirmar" y
 * "cancelar". Vuelve al estado inicial al cancelar, con Escape o con un clic afuera. Nada se
 * envía hasta el segundo clic. Con un clic afuera el foco queda donde se hizo clic: no se lo
 * mueve de vuelta al botón.
 */
export function ConfirmacionEnLinea({
  etiqueta,
  pregunta,
  confirmar,
  onConfirmar,
  deshabilitado = false,
  variante = "destructive",
}: ConfirmacionEnLineaProps) {
  const [abierta, setAbierta] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  // El botón no expone `ref`: el foco se mueve buscando el botón dentro de su contenedor.
  const contenedorCancelar = useRef<HTMLSpanElement>(null);
  const contenedorInicial = useRef<HTMLSpanElement>(null);
  const volverAlBotonInicial = useRef(false);

  useEffect(() => {
    if (!abierta) {
      // Tras cancelar o confirmar, el foco vuelve al botón inicial para no perderse. Si la
      // acción confirmada sigue en curso, el botón está deshabilitado y no puede recibir el
      // foco: se espera a que `deshabilitado` vuelva a `false` (por ejemplo, tras un error, para
      // poder reintentar con el teclado). Si la acción cambia la fila, el componente se desmonta.
      if (volverAlBotonInicial.current && !deshabilitado) {
        volverAlBotonInicial.current = false;
        contenedorInicial.current?.querySelector("button")?.focus();
      }
      return;
    }
    // El foco va a "cancelar", la opción no destructiva: un Enter apurado no confirma.
    contenedorCancelar.current?.querySelector("button")?.focus();
    function alPresionarFuera(evento: MouseEvent) {
      if (contenedor.current && !contenedor.current.contains(evento.target as Node)) {
        setAbierta(false);
      }
    }
    document.addEventListener("mousedown", alPresionarFuera);
    return () => document.removeEventListener("mousedown", alPresionarFuera);
  }, [abierta, deshabilitado]);

  function cancelar() {
    volverAlBotonInicial.current = true;
    setAbierta(false);
  }

  if (!abierta) {
    return (
      <span ref={contenedorInicial} className="contents">
        <BotonCompacto
          variant={variante}
          disabled={deshabilitado}
          onClick={() => setAbierta(true)}
        >
          {etiqueta}
        </BotonCompacto>
      </span>
    );
  }

  return (
    <div
      ref={contenedor}
      role="group"
      aria-label={pregunta}
      className="flex flex-wrap items-center gap-2"
      onKeyDown={(evento) => {
        if (evento.key === "Escape") cancelar();
      }}
    >
      <span className="text-sm font-medium">{pregunta}</span>
      <BotonCompacto
        variant={variante}
        disabled={deshabilitado}
        onClick={() => {
          volverAlBotonInicial.current = true;
          setAbierta(false);
          onConfirmar();
        }}
      >
        {confirmar}
      </BotonCompacto>
      <span ref={contenedorCancelar} className="contents">
        <BotonCompacto variant="secondary" onClick={cancelar}>
          Cancelar
        </BotonCompacto>
      </span>
    </div>
  );
}
