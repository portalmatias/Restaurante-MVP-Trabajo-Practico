"use client";

import { useEffect, useRef, useState } from "react";
import { Button, type ButtonVariant } from "../ui/button";

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
 * envía hasta el segundo clic.
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
  // `Button` no expone `ref`: el foco se mueve buscando el botón dentro de su contenedor.
  const contenedorCancelar = useRef<HTMLSpanElement>(null);
  const contenedorInicial = useRef<HTMLSpanElement>(null);
  const volverAlBotonInicial = useRef(false);

  useEffect(() => {
    if (!abierta) {
      if (volverAlBotonInicial.current) {
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
  }, [abierta]);

  function cancelar() {
    volverAlBotonInicial.current = true;
    setAbierta(false);
  }

  if (!abierta) {
    return (
      <span ref={contenedorInicial} className="contents">
        <Button
          variant={variante}
          className="w-auto"
          disabled={deshabilitado}
          onClick={() => setAbierta(true)}
        >
          {etiqueta}
        </Button>
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
      <Button
        variant={variante}
        className="w-auto"
        disabled={deshabilitado}
        onClick={() => {
          setAbierta(false);
          onConfirmar();
        }}
      >
        {confirmar}
      </Button>
      <span ref={contenedorCancelar} className="contents">
        <Button variant="secondary" className="w-auto" onClick={cancelar}>
          Cancelar
        </Button>
      </span>
    </div>
  );
}
