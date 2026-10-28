/**
 * Esqueleto del plano de mesas mientras se pide (change `plano-mesas`, design.md D7): ocupa el
 * lugar aproximado del título, la leyenda, el dibujo y la lista, para que no haya saltos de
 * layout al llegar. `aria-busy` y un texto solo para lector de pantalla; los bloques son
 * decorativos. El brillo (`.plano-mesas-cargando` en `globals.css`) se apaga con
 * `prefers-reduced-motion`.
 */
export function PlanoMesasCargando() {
  return (
    <section aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Cargando el plano de mesas</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="plano-mesas-cargando h-7 w-48 rounded-sm bg-muted" />
        <div className="plano-mesas-cargando h-5 w-full rounded-sm bg-muted" />
        <div className="flex gap-4">
          <div className="plano-mesas-cargando h-5 w-20 rounded-sm bg-muted" />
          <div className="plano-mesas-cargando h-5 w-20 rounded-sm bg-muted" />
          <div className="plano-mesas-cargando h-5 w-24 rounded-sm bg-muted" />
        </div>
        {/* Proporción de la grilla STANDARD (12 × 8 celdas). */}
        <div className="plano-mesas-cargando aspect-[3/2] w-full rounded-lg border border-border bg-muted" />
      </div>
    </section>
  );
}
