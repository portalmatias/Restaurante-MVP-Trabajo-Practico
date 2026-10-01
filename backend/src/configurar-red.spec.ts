import type { NestExpressApplication } from '@nestjs/platform-express';

import { configurarRed, validarTrustProxy } from './configurar-red';

/**
 * Tarea 2.1 de `exposicion-red-local` (design.md D3): `TRUST_PROXY` se valida elemento por
 * elemento contra una lista de formatos permitidos. Los e2e de `test/exposicion-red.e2e-spec.ts`
 * prueban el efecto real sobre el límite de solicitudes; acá se cubre la validación sola.
 */
describe('configurarRed', () => {
  function appFalsa(): { app: NestExpressApplication; set: jest.Mock } {
    const set = jest.fn();
    return { app: { set } as unknown as NestExpressApplication, set };
  }

  /**
   * Corre `prueba` con `TRUST_PROXY` fijado en `valor` (o sin definir, con `undefined`) y
   * después restaura lo que hubiera: así los casos que leen la variable del entorno no
   * dependen del `TRUST_PROXY` de la terminal o del runner que corre los tests.
   */
  function conTrustProxy(valor: string | undefined, prueba: () => void): void {
    const anterior = process.env.TRUST_PROXY;
    if (valor === undefined) {
      delete process.env.TRUST_PROXY;
    } else {
      process.env.TRUST_PROXY = valor;
    }
    try {
      prueba();
    } finally {
      if (anterior === undefined) {
        delete process.env.TRUST_PROXY;
      } else {
        process.env.TRUST_PROXY = anterior;
      }
    }
  }

  describe('sin TRUST_PROXY', () => {
    it.each([
      ['ausente', undefined],
      ['vacía', ''],
      ['solo espacios', '   '],
    ])('%s en el entorno: no configura `trust proxy`', (_caso, valor) => {
      conTrustProxy(valor, () => {
        const { app, set } = appFalsa();

        configurarRed(app);

        expect(set).not.toHaveBeenCalled();
      });
    });
  });

  describe('listas válidas', () => {
    it.each([
      ['loopback', ['loopback']],
      ['10.0.0.5', ['10.0.0.5']],
      ['loopback, 10.0.0.0/8', ['loopback', '10.0.0.0/8']],
      [
        'linklocal,uniquelocal, 192.168.0.0/16 ,10.0.0.5/32',
        ['linklocal', 'uniquelocal', '192.168.0.0/16', '10.0.0.5/32'],
      ],
    ])('"%s": pasa la lista recortada a `trust proxy`', (valor, esperado) => {
      const { app, set } = appFalsa();

      configurarRed(app, valor);

      expect(set).toHaveBeenCalledTimes(1);
      expect(set).toHaveBeenCalledWith('trust proxy', esperado);
    });
  });

  describe('rechazos', () => {
    it.each([
      // Confiar en todos o en un número de saltos.
      'true',
      '*',
      '1',
      // Subredes IPv4 demasiado amplias.
      '0.0.0.0/0',
      '10.0.0.0/7',
      // Toda notación IPv6 (GHSA-jqcg-44mw-7w3h): algunas coinciden con cualquier IPv4.
      '::/0',
      '::/1',
      '::ffff:10.0.0.0/8',
      '::ffff:10.0.0.0/104',
      '::1',
      // Otras escrituras fuera de los formatos admitidos.
      'LOOPBACK',
      '010.0.0.5',
      '10.0.0.256',
      '10.0.0.0/255.0.0.0',
      '10.0.0.0/08',
      'proxy.local',
      // Listas que esconden un rechazo.
      '10.0.0.5,0.0.0.0/0',
      'loopback, ::/1',
      '10.0.0.5, 1',
      'loopback, ::/0',
      // Un elemento vacío por una coma de más.
      '10.0.0.5,',
    ])('"%s": no arranca y pide declarar los saltos confiables', (valor) => {
      const { app, set } = appFalsa();

      expect(() => configurarRed(app, valor)).toThrow(
        /hay que declarar los saltos confiables de forma explícita/,
      );
      expect(() => configurarRed(app, valor)).toThrow(
        /Formatos admitidos: `loopback`, `linklocal`, `uniquelocal`, una dirección IPv4 .* subred IPv4 con prefijo `\/8` o mayor/,
      );
      expect(set).not.toHaveBeenCalled();
    });

    it('nombra en el error los elementos rechazados, no los válidos', () => {
      expect(() => validarTrustProxy('loopback, ::/1, 10.0.0.5, *')).toThrow(
        /\("::\/1", "\*"\)/,
      );
    });
  });

  it('lee TRUST_PROXY del entorno si no se le pasa un valor', () => {
    conTrustProxy('true', () => {
      const { app } = appFalsa();
      expect(() => configurarRed(app)).toThrow(
        /declarar los saltos confiables/,
      );
    });
  });
});
