/**
 * Esqueleto de `loading.tsx` de los pasos del asistente (design.md D3): bloques grises con
 * `aria-busy` y un texto solo para lector de pantalla, sin `useState` (lo maneja Next.js).
 */
export function EsqueletoCarga() {
  return (
    <div
      aria-busy="true"
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 motion-safe:animate-pulse"
    >
      <p role="status" className="sr-only">Cargando…</p>
      <div aria-hidden="true" className="h-5 w-28 rounded-md bg-muted" />
      <div aria-hidden="true" className="h-8 w-3/4 rounded-md bg-muted" />
      <div aria-hidden="true" className="h-11 w-full rounded-md bg-muted" />
      <div aria-hidden="true" className="h-11 w-full rounded-md bg-muted" />
      <div aria-hidden="true" className="h-28 w-full rounded-lg bg-muted" />
      <div aria-hidden="true" className="h-14 w-full rounded-md bg-muted" />
    </div>
  );
}
