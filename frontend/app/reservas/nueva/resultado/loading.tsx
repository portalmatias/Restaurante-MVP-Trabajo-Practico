import { EsqueletoCarga } from "../../../../src/components/reservas/esqueleto-carga";
import { PlanoMesasCargando } from "../../../../src/components/reservas/plano-mesas-cargando";

/**
 * Mientras la página pide el plano (y con él el veredicto, design.md D5), se ve el esqueleto de
 * los pasos y, debajo, el del plano (tarea 5.5 de `plano-mesas`). El del plano va dentro del
 * mismo contenedor, como `seccionPlano` en la página, para que el espacio no cambie al llegar.
 */
export default function Loading() {
  return (
    <EsqueletoCarga>
      <PlanoMesasCargando />
    </EsqueletoCarga>
  );
}
