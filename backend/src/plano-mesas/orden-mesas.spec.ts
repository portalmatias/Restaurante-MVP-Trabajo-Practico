import { ordenarMesasPorEtiqueta } from './orden-mesas';

describe('ordenarMesasPorEtiqueta', () => {
  const etiquetas = (mesas: { etiqueta: string }[]) =>
    mesas.map((m) => m.etiqueta);

  it('ordena con los números en orden natural: S2 antes que S10', () => {
    const mesas = ['S10', 'S2', 'S1', 'S5', 'S3'].map((etiqueta) => ({
      etiqueta,
    }));
    expect(etiquetas(ordenarMesasPorEtiqueta(mesas))).toEqual([
      'S1',
      'S2',
      'S3',
      'S5',
      'S10',
    ]);
  });

  it('no modifica la lista que recibe', () => {
    const mesas = [{ etiqueta: 'S2' }, { etiqueta: 'S1' }];
    ordenarMesasPorEtiqueta(mesas);
    expect(etiquetas(mesas)).toEqual(['S2', 'S1']);
  });

  it('conserva el resto de los datos de cada mesa', () => {
    expect(
      ordenarMesasPorEtiqueta([
        { etiqueta: 'V2', capacidad: 4 },
        { etiqueta: 'V1', capacidad: 2 },
      ]),
    ).toEqual([
      { etiqueta: 'V1', capacidad: 2 },
      { etiqueta: 'V2', capacidad: 4 },
    ]);
  });
});
