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
        {/* El aviso y el resumen del plano. */}
        <div className="plano-mesas-cargando h-5 w-full rounded-sm bg-muted" />
        <div className="plano-mesas-cargando h-5 w-3/4 rounded-sm bg-muted" />
        <div className="flex gap-4">
          <div className="plano-mesas-cargando h-5 w-20 rounded-sm bg-muted" />
          <div className="plano-mesas-cargando h-5 w-20 rounded-sm bg-muted" />
          <div className="plano-mesas-cargando h-5 w-24 rounded-sm bg-muted" />
        </div>
        {/* Mismo orden que PlanoMesas: en celular la lista va primero; desde `sm`, el dibujo. */}
        <div className="flex flex-col gap-4">
          {/* Proporción de la grilla STANDARD (12 × 8 celdas). */}
          <div className="plano-mesas-cargando order-2 aspect-[3/2] w-full rounded-lg border border-border bg-muted sm:order-1" />
          {/* Unas filas de la lista textual, una por mesa. */}
          <div data-esqueleto-lista="" className="order-1 flex flex-col gap-1 sm:order-2">
            {["w-64", "w-56", "w-60", "w-52"].map((ancho) => (
              <div key={ancho} className={`plano-mesas-cargando h-6 max-w-full rounded-sm bg-muted ${ancho}`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
