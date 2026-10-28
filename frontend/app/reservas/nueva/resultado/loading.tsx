import { EsqueletoCarga } from "../../../../src/components/reservas/esqueleto-carga";
import { PlanoMesasCargando } from "../../../../src/components/reservas/plano-mesas-cargando";

/**
 * Mientras la página pide el plano (y con él el veredicto, design.md D5), se ve el esqueleto de
 * los pasos y, debajo, el del plano (tarea 5.5 de `plano-mesas`).
 */
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col">
      <EsqueletoCarga />
      <div className="mx-auto w-full max-w-2xl px-4 pb-10">
        <PlanoMesasCargando />
      </div>
    </div>
  );
}
