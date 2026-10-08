import type { ReactNode } from "react";
import { TablillaPaso } from "../ui/tablilla";

export type PantallaDeEstadoProps = {
  /** Texto vertical de la tablilla colgada (por ejemplo, «No encontrada»). */
  tablilla: string;
  /** Dato al pie de la tablilla (por ejemplo, «404»). */
  detalle?: string;
  /** Título de la pantalla (el `<h1>`). */
  titulo: string;
  /** Explicación y acciones. */
  children: ReactNode;
};

/**
 * Pantalla de estado de página completa (ruta inexistente, error inesperado): una tablilla
 * colgada de la viga y el mensaje al lado. Sin estado ni hooks: sirve en Server y Client
 * Components.
 */
export function PantallaDeEstado({ tablilla, detalle, titulo, children }: PantallaDeEstadoProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-10 sm:flex-row sm:items-start sm:gap-14 sm:py-16">
      <div aria-hidden="true" className="relative w-full pt-6 sm:w-40 sm:shrink-0">
        <div className="absolute left-0 right-0 top-0 h-2 rounded-sm bg-madera" />
        <TablillaPaso titulo={tablilla} detalle={detalle} />
      </div>
      <div className="flex flex-col gap-5">
        <h1 className="font-display text-3xl font-medium leading-tight sm:text-4xl">{titulo}</h1>
        {children}
      </div>
    </div>
  );
}
