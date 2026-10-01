import { calcularAforo } from "../../../src/lib/aforo/calcular-aforo";

const ZONAS = [
  { id: "standard", aforoMaximo: 40 },
  { id: "vip", aforoMaximo: 20 },
];

function reserva(zonaId: string, comensales: number) {
  return { comensales, zona: { id: zonaId } };
}

describe("calcularAforo", () => {
  it("suma los comensales de las Reservas activas por Zona, junto a su máximo", () => {
    const aforo = calcularAforo(ZONAS, [
      reserva("standard", 4),
      reserva("standard", 2),
      reserva("vip", 6),
    ]);

    expect(aforo.porZona).toEqual({
      standard: { ocupado: 6, maximo: 40 },
      vip: { ocupado: 6, maximo: 20 },
    });
  });

  it("la ocupación global es la suma de todas las Zonas, sin máximo", () => {
    const aforo = calcularAforo(ZONAS, [reserva("standard", 4), reserva("vip", 3)]);

    expect(aforo.global).toEqual({ ocupado: 7 });
  });

  it("las Reservas CANCELADA/NO_SHOW, excluidas por el caller, no suman", () => {
    // El caller solo pide CONFIRMADA y PENDIENTE (D5): acá llegan solo las activas.
    const activas = [reserva("vip", 2)];

    expect(calcularAforo(ZONAS, activas).porZona.vip.ocupado).toBe(2);
  });

  it("sin Reservas, cada Zona y el global quedan en cero", () => {
    const aforo = calcularAforo(ZONAS, []);

    expect(aforo.porZona.standard).toEqual({ ocupado: 0, maximo: 40 });
    expect(aforo.porZona.vip).toEqual({ ocupado: 0, maximo: 20 });
    expect(aforo.global.ocupado).toBe(0);
  });

  it("una Reserva de una Zona que no vino en el listado cuenta solo para el global", () => {
    const aforo = calcularAforo(ZONAS, [reserva("otra", 5)]);

    expect(aforo.global.ocupado).toBe(5);
    expect(Object.keys(aforo.porZona)).toEqual(["standard", "vip"]);
  });
});
