"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";

const MS_CONFIRMACION = 2500;

export type BotonCopiarCodigoProps = {
  codigo: string;
};

type Resultado = "copiado" | "fallo";

/**
 * Copia el código de reserva al portapapeles (design.md D3 Pantalla 5). Confirma un momento con
 * el texto del botón y con una región `status` para lectores de pantalla; si el navegador no
 * puede copiar, lo dice en vez de confirmar en falso.
 */
export function BotonCopiarCodigo({ codigo }: BotonCopiarCodigoProps) {
  const [resultado, setResultado] = useState<Resultado>();
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);

  const montado = useRef(false);
  // Número del último intento: con dos clics seguidos solo cuenta el resultado del más reciente.
  const ultimoIntento = useRef(0);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      clearTimeout(temporizador.current);
    };
  }, []);

  async function copiar() {
    const intento = ++ultimoIntento.current;
    let siguiente: Resultado = "copiado";
    try {
      await navigator.clipboard.writeText(codigo);
    } catch {
      // Sin `navigator.clipboard` (contexto no seguro) o con el permiso denegado.
      siguiente = "fallo";
    }
    // La copia es asíncrona: si el botón se desmontó mientras tanto, no hay nada que mostrar.
    // Un intento anterior que termina tarde no pisa el resultado del más reciente.
    if (!montado.current || intento !== ultimoIntento.current) return;
    setResultado(siguiente);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setResultado(undefined), MS_CONFIRMACION);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button variant="ghost" onClick={() => void copiar()} className="gap-2 underline">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V6a2 2 0 0 1 2-2h9" />
        </svg>
        {resultado === "copiado" ? "¡Copiado!" : "Copiar código"}
      </Button>
      {/* Región siempre montada: así el lector de pantalla anuncia el cambio. */}
      <p role="status" className={resultado === "fallo" ? "text-base text-muted-foreground" : "sr-only"}>
        {resultado === "copiado"
          ? "¡Copiado!"
          : resultado === "fallo"
            ? "No pudimos copiarlo. Anotá el código o seleccionalo para copiarlo."
            : ""}
      </p>
    </div>
  );
}
