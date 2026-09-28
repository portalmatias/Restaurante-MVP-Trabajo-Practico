/**
 * Junta ids de `aria-describedby`: los que ya traiga el caller (por ejemplo, el id de un texto
 * de ayuda) y otros ids adicionales (por ejemplo, el de un mensaje de error), sin duplicados ni
 * espacios vacíos. Compartido entre `Field` y `Select` (mismo comportamiento; antes estaba
 * duplicado en los dos archivos).
 */
export function mergeDescribedBy(...values: Array<string | undefined>): string | undefined {
  const ids = values
    .flatMap((value) => (value ? value.split(/\s+/) : []))
    .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);
  return ids.length > 0 ? ids.join(" ") : undefined;
}
