import { Mesa } from '@prisma/client';

/** Vista mínima de una mesa libre que necesita el best fit (design.md D3). */
export type MesaLibre = Pick<Mesa, 'id' | 'etiqueta' | 'capacidad'>;

/**
 * Elige, entre las mesas libres de una zona, la de menor capacidad que alcance para
 * `comensales` (best fit — config.yaml §6, "Mesas y asignación"). Ante un empate de
 * capacidad, desempata por `etiqueta` en orden lexicográfico ascendente (design.md D3): no es
 * un orden numérico, así que `S10` queda antes que `S2`.
 *
 * Función pura: no lee la base ni el reloj. `reservas-crear` la llama con
 * `ContextoReserva.mesasLibres`, la misma lista que ya evaluó `SIN_MESA_DISPONIBLE`, así que
 * en el flujo normal nunca debería devolver `undefined` cuando hay motivos vacíos (design.md
 * D1 — si igual pasa, es un bug del caller, no un caso de negocio).
 */
export function elegirMesaBestFit(
  mesasLibres: MesaLibre[],
  comensales: number,
): MesaLibre | undefined {
  const candidatas = mesasLibres
    .filter((mesa) => mesa.capacidad >= comensales)
    .sort((a, b) => {
      if (a.capacidad !== b.capacidad) {
        return a.capacidad - b.capacidad;
      }
      // Desempate lexicográfico, no numérico: 'S10' < 'S2' (design.md D3).
      return a.etiqueta < b.etiqueta ? -1 : a.etiqueta > b.etiqueta ? 1 : 0;
    });

  return candidatas[0];
}
