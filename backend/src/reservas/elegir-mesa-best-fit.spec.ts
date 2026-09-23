import { elegirMesaBestFit, MesaLibre } from './elegir-mesa-best-fit';

/**
 * Unitarios de `elegirMesaBestFit` (tasks.md 3.3/3.4, design.md D3). Sin base: la función es
 * pura y solo mira la lista de mesas libres que le pasan. Corre con `TZ=UTC` y con
 * `TZ=America/Argentina/Buenos_Aires` (no usa fechas, pero la suite entera del backend se
 * corre en ambos husos para detectar dependencias ocultas de la zona horaria del proceso).
 */
describe('elegirMesaBestFit', () => {
  function mesa(etiqueta: string, capacidad: number): MesaLibre {
    return { id: `id-${etiqueta}`, etiqueta, capacidad };
  }

  it('con mesas de capacidad 2, 2, 4, 6 y 8, elige la de 4 para 3 comensales', () => {
    const mesasLibres = [
      mesa('S1', 2),
      mesa('S2', 2),
      mesa('S3', 4),
      mesa('S4', 6),
      mesa('S5', 8),
    ];

    expect(elegirMesaBestFit(mesasLibres, 3)?.etiqueta).toBe('S3');
  });

  it('elige la mesa de capacidad exacta cuando existe', () => {
    const mesasLibres = [mesa('S1', 4), mesa('S2', 8), mesa('S3', 6)];

    expect(elegirMesaBestFit(mesasLibres, 8)?.etiqueta).toBe('S2');
  });

  it('ante un empate de capacidad, elige la de menor etiqueta (S1 antes que S2)', () => {
    const mesasLibres = [mesa('S2', 4), mesa('S1', 4)];

    expect(elegirMesaBestFit(mesasLibres, 4)?.etiqueta).toBe('S1');
  });

  it('el desempate por etiqueta es lexicográfico, no numérico: S10 antes que S2', () => {
    const mesasLibres = [mesa('S2', 4), mesa('S10', 4)];

    expect(elegirMesaBestFit(mesasLibres, 4)?.etiqueta).toBe('S10');
  });

  it('el orden de la lista de entrada no cambia el resultado', () => {
    const ordenAscendente = [mesa('S1', 2), mesa('S3', 4), mesa('S4', 6)];
    const desordenada = [
      ordenAscendente[2],
      ordenAscendente[0],
      ordenAscendente[1],
    ];

    expect(elegirMesaBestFit(desordenada, 3)).toEqual(
      elegirMesaBestFit(ordenAscendente, 3),
    );
  });

  it('devuelve undefined si ninguna mesa alcanza para la cantidad de comensales', () => {
    const mesasLibres = [mesa('S1', 2), mesa('S2', 4)];

    expect(elegirMesaBestFit(mesasLibres, 6)).toBeUndefined();
  });

  it('devuelve undefined con la lista vacía', () => {
    expect(elegirMesaBestFit([], 2)).toBeUndefined();
  });
});
