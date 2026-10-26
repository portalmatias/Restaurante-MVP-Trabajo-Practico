import { calcularEstadoMesa, EstadoMesaPlano } from './estado-mesa';

describe('calcularEstadoMesa', () => {
  const libres = new Set(['mesa-libre-2', 'mesa-libre-4']);

  it('una mesa libre que alcanza está LIBRE', () => {
    expect(
      calcularEstadoMesa({ id: 'mesa-libre-4', capacidad: 4 }, libres, 3),
    ).toBe(EstadoMesaPlano.LIBRE);
  });

  it('una mesa libre de capacidad exacta está LIBRE', () => {
    expect(
      calcularEstadoMesa({ id: 'mesa-libre-4', capacidad: 4 }, libres, 4),
    ).toBe(EstadoMesaPlano.LIBRE);
  });

  it('una mesa libre que no alcanza está NO_ALCANZA', () => {
    expect(
      calcularEstadoMesa({ id: 'mesa-libre-2', capacidad: 2 }, libres, 3),
    ).toBe(EstadoMesaPlano.NO_ALCANZA);
  });

  it('una mesa que no está entre las libres está OCUPADA', () => {
    expect(
      calcularEstadoMesa({ id: 'mesa-ocupada-6', capacidad: 6 }, libres, 3),
    ).toBe(EstadoMesaPlano.OCUPADA);
  });

  it('una mesa ocupada y chica está OCUPADA, no NO_ALCANZA', () => {
    expect(
      calcularEstadoMesa({ id: 'mesa-ocupada-2', capacidad: 2 }, libres, 4),
    ).toBe(EstadoMesaPlano.OCUPADA);
  });
});
