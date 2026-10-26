/**
 * Orden natural por etiqueta (S1, S2, …, S9, S10), no alfabético (design.md D2): la lista del
 * plano no depende del plan de Postgres y una mesa S10 no queda entre S1 y S2. Devuelve una
 * lista nueva; no modifica la que recibe.
 */
export function ordenarMesasPorEtiqueta<T extends { etiqueta: string }>(
  mesas: readonly T[],
): T[] {
  return [...mesas].sort((a, b) =>
    a.etiqueta.localeCompare(b.etiqueta, 'es', { numeric: true }),
  );
}
