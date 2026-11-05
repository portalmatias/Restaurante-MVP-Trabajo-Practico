import {
  MesaEnPlano,
  MesaUbicada,
  problemasDeUbicacion,
  validarLayout,
} from './layout-plano';

/** Mesa ubicada en el plano, con 1 por 1 como tamaño por defecto. */
function mesa(
  etiqueta: string,
  posX: number,
  posY: number,
  ancho = 1,
  alto = 1,
): MesaUbicada {
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

describe('problemasDeUbicacion', () => {
  const grilla = { planoColumnas: 12, planoFilas: 8 };

  /** Layout del seed de STANDARD (spec `gestion-salon`, "Ubicación de Mesa en el plano"). */
  const seed = [
    mesa('S1', 0, 0),
    mesa('S2', 2, 0),
    mesa('S3', 5, 0, 2, 2),
    mesa('S4', 0, 3, 3, 2),
    mesa('S5', 5, 3, 4, 2),
  ];

  /** Las demás mesas del seed, sin la que se está ubicando. */
  function otrasQue(etiqueta: string): MesaEnPlano[] {
    return seed.filter((m) => m.etiqueta !== etiqueta);
  }

  it('no informa problemas al mover S4 a un lugar libre (8,5)', () => {
    expect(
      problemasDeUbicacion(grilla, mesa('S4', 8, 5, 3, 2), otrasQue('S4')),
    ).toEqual({ fueraDeGrilla: false, superpuestaCon: [] });
  });

  it('acepta S1 en (1,0), que toca a S2 por un lado sin superponerse', () => {
    expect(
      problemasDeUbicacion(grilla, mesa('S1', 1, 0), otrasQue('S1')),
    ).toEqual({ fueraDeGrilla: false, superpuestaCon: [] });
  });

  it('informa la superposición de S1 en (5,1) con S3', () => {
    expect(
      problemasDeUbicacion(grilla, mesa('S1', 5, 1), otrasQue('S1')),
    ).toEqual({ fueraDeGrilla: false, superpuestaCon: ['S3'] });
  });

  it('informa la superposición de S4 con ancho 6 con S5', () => {
    expect(
      problemasDeUbicacion(grilla, mesa('S4', 0, 3, 6, 2), otrasQue('S4')),
    ).toEqual({ fueraDeGrilla: false, superpuestaCon: ['S5'] });
  });

  it('informa que S5 en (10,3) queda fuera de la grilla de 12 por 8', () => {
    expect(
      problemasDeUbicacion(grilla, mesa('S5', 10, 3, 4, 2), otrasQue('S5')),
    ).toEqual({ fueraDeGrilla: true, superpuestaCon: [] });
  });

  it('devuelve las dos etiquetas ordenadas cuando se superpone con dos mesas', () => {
    expect(
      problemasDeUbicacion(
        grilla,
        mesa('S1', 0, 0, 6, 1),
        [...otrasQue('S1')].reverse(),
      ),
    ).toEqual({ fueraDeGrilla: false, superpuestaCon: ['S2', 'S3'] });
  });

  it('ignora las mesas sin ubicar', () => {
    expect(
      problemasDeUbicacion(grilla, mesa('S1', 0, 0), [
        { etiqueta: 'S6', posX: null, posY: null, ancho: 12, alto: 8 },
      ]),
    ).toEqual({ fueraDeGrilla: false, superpuestaCon: [] });
  });
});
