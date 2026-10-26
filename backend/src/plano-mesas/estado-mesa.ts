/**
 * Estado de una mesa en el plano (change `plano-mesas`, design.md D2, paso 5).
 *
 * Se deriva SOLO de `contexto.mesasLibres` (la lista que ya usan la regla
 * `SIN_MESA_DISPONIBLE` y el best fit de la creación), así el plano no tiene una segunda
 * definición de "libre" y no puede contradecir a la reserva real.
 */
export enum EstadoMesaPlano {
  LIBRE = 'LIBRE',
  OCUPADA = 'OCUPADA',
  NO_ALCANZA = 'NO_ALCANZA',
}

/**
 * `OCUPADA` si la mesa no está entre las libres; si está, `LIBRE` cuando su capacidad alcanza
 * y `NO_ALCANZA` cuando no. `OCUPADA` tiene precedencia: una mesa ocupada y chica es
 * "ocupada", el dato más fuerte, que no revela nada extra.
 */
export function calcularEstadoMesa(
  mesa: { id: string; capacidad: number },
  mesasLibresIds: ReadonlySet<string>,
  comensales: number,
): EstadoMesaPlano {
  if (!mesasLibresIds.has(mesa.id)) {
    return EstadoMesaPlano.OCUPADA;
  }
  return mesa.capacidad >= comensales
    ? EstadoMesaPlano.LIBRE
    : EstadoMesaPlano.NO_ALCANZA;
}
