/**
 * Orden natural por etiqueta (S1, S2, …, S9, S10), no alfabético (design.md D2): la lista del
 * plano no depende del plan de Postgres y una mesa S10 no queda entre S1 y S2. Las etiquetas
 * que el orden natural considera iguales (S1 y S01) se desempatan por su texto exacto, así el
 * orden tampoco depende de cómo llega la lista. Devuelve una lista nueva; no modifica la que
 * recibe.
 */
export function ordenarMesasPorEtiqueta<T extends { etiqueta: string }>(
  mesas: readonly T[],
): T[] {
  return [...mesas].sort(
    (a, b) =>
      a.etiqueta.localeCompare(b.etiqueta, 'es', { numeric: true }) ||
      (a.etiqueta < b.etiqueta ? -1 : a.etiqueta > b.etiqueta ? 1 : 0),
  );
}
