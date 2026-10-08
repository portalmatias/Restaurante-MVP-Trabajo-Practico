/**
 * Esqueleto de `loading.tsx` de los pasos del asistente (design.md D3): tablillas y campos en
 * blanco sobre la viga, con `aria-busy` y un texto solo para lector de pantalla, sin `useState`
 * (lo maneja Next.js). El pulso respeta `prefers-reduced-motion`.
 */
export function EsqueletoCarga() {
  return (
    <div
      aria-busy="true"
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 motion-safe:animate-pulse"
    >
      <p role="status" className="sr-only">Cargando…</p>
      <div aria-hidden="true" className="h-5 w-28 rounded-sm bg-muted" />
      <div aria-hidden="true" className="h-9 w-3/4 rounded-sm bg-muted" />
      <div aria-hidden="true" className="h-11 w-full rounded-sm bg-muted" />
      <div aria-hidden="true" className="relative pt-6">
        <div className="absolute left-0 right-0 top-0 h-2 rounded-sm bg-muted" />
        <div className="flex gap-2">
          <div className="h-48 w-24 rounded-sm bg-muted" />
          <div className="h-48 w-24 rounded-sm bg-muted" />
          <div className="h-48 w-24 rounded-sm bg-muted" />
        </div>
      </div>
      <div aria-hidden="true" className="h-14 w-full rounded-sm bg-muted" />
    </div>
  );
}
