/**
 * Aforo del dashboard de admin (design.md D5), calculado en el cliente con la misma regla que
 * el backend usa como tope duro (config.yaml §6): la ocupación es la suma de comensales de las
 * Reservas activas. Las `CANCELADA`/`NO_SHOW` no llegan acá: el caller solo pide las
 * `CONFIRMADA` y `PENDIENTE`.
 */

export type ZonaConAforo = { id: string; aforoMaximo: number };

export type ReservaActiva = { comensales: number; zona: { id: string } };

export type Aforo = {
  porZona: Record<string, { ocupado: number; maximo: number }>;
  /** Sin `maximo`: el aforo global configurado no lo expone ningún endpoint todavía (D5). */
  global: { ocupado: number };
};

export function calcularAforo(zonas: ZonaConAforo[], reservasActivas: ReservaActiva[]): Aforo {
  const porZona: Aforo["porZona"] = {};
  for (const zona of zonas) {
    porZona[zona.id] = { ocupado: 0, maximo: zona.aforoMaximo };
  }

  let ocupadoGlobal = 0;
  for (const reserva of reservasActivas) {
    ocupadoGlobal += reserva.comensales;
    // Una Reserva de una Zona que no vino en el listado igual cuenta para el global: el aforo
    // global no depende de qué Zonas se estén mostrando.
    const zona = porZona[reserva.zona.id];
    if (zona) {
      zona.ocupado += reserva.comensales;
    }
  }

  return { porZona, global: { ocupado: ocupadoGlobal } };
}
