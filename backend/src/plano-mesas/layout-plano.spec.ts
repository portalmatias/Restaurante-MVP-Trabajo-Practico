import { MesaEnPlano, validarLayout } from './layout-plano';

/** Mesa ubicada en el plano, con 1 por 1 como tamaño por defecto. */
function mesa(
  etiqueta: string,
  posX: number,
  posY: number,
  ancho = 1,
  alto = 1,
): MesaEnPlano {
  return { etiqueta, posX, posY, ancho, alto };
}

describe('validarLayout', () => {
  const grilla = { planoColumnas: 12, planoFilas: 8 };

  it('acepta el layout inicial de STANDARD (design.md, D1)', () => {
    expect(
      validarLayout(grilla, [
        mesa('S1', 0, 0),
        mesa('S2', 2, 0),
        mesa('S3', 5, 0, 2, 2),
        mesa('S4', 0, 3, 3, 2),
        mesa('S5', 5, 3, 4, 2),
      ]),
    ).toEqual([]);
  });

  it('acepta el layout inicial de VIP (design.md, D1)', () => {
    expect(
      validarLayout({ planoColumnas: 10, planoFilas: 6 }, [
        mesa('V1', 0, 0),
        mesa('V2', 3, 0, 2, 2),
        mesa('V3', 0, 3, 3, 2),
        mesa('V4', 4, 3, 6, 2),
      ]),
    ).toEqual([]);
  });

  it('acepta una mesa que toca exactamente el borde derecho e inferior', () => {
    expect(validarLayout(grilla, [mesa('S1', 10, 6, 2, 2)])).toEqual([]);
  });

  it('detecta una mesa que se pasa del ancho de la grilla', () => {
    expect(validarLayout(grilla, [mesa('S5', 9, 0, 4, 2)])).toEqual([
      'La mesa S5 queda fuera de la grilla de 12 por 8.',
    ]);
  });

  it('detecta una mesa que se pasa del alto de la grilla', () => {
    expect(validarLayout(grilla, [mesa('S4', 0, 7, 3, 2)])).toEqual([
      'La mesa S4 queda fuera de la grilla de 12 por 8.',
    ]);
  });

  it('detecta dos mesas que comparten al menos una celda', () => {
    expect(
      validarLayout(grilla, [mesa('S3', 5, 0, 2, 2), mesa('S2', 6, 1)]),
    ).toEqual(['Las mesas S3 y S2 se superponen.']);
  });

  it('no considera superpuestas a dos mesas que solo se tocan por un lado', () => {
    expect(
      validarLayout(grilla, [mesa('S1', 0, 0, 2, 1), mesa('S2', 2, 0)]),
    ).toEqual([]);
  });

  it('ignora las mesas sin ubicar', () => {
    expect(
      validarLayout(grilla, [
        mesa('S1', 0, 0),
        { etiqueta: 'S6', posX: null, posY: null, ancho: 1, alto: 1 },
      ]),
    ).toEqual([]);
  });

  it('informa todos los problemas, no solo el primero', () => {
    expect(
      validarLayout(grilla, [
        mesa('S1', 11, 0, 2, 1),
        mesa('S2', 0, 0),
        mesa('S3', 0, 0),
      ]),
    ).toEqual([
      'La mesa S1 queda fuera de la grilla de 12 por 8.',
      'Las mesas S2 y S3 se superponen.',
    ]);
  });
});
