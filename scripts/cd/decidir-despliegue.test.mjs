/**
 * Tests de la decisión de despliegue del job `decidir` de .github/workflows/cd.yml
 * (scripts/cd/decidir-despliegue.mjs; D4 y D10 de despliegue-continuo-ec2).
 *
 * Cubren los escenarios del requisito "Despliegue automático solo desde main con CI en verde"
 * que no se pueden provocar a mano en `main` sin romperlo. Corren con `node --test`, sin
 * dependencias, desde `npm run test:scripts` (el script lista los archivos uno por uno: ver la
 * nota de scripts/openapi-diff.test.mjs sobre los globs en Node 20).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  decidirDespliegue,
  estadoCiPorSha,
  datosDeCompare,
} from './decidir-despliegue.mjs';

const SHA = 'a'.repeat(40);
const POSTERIOR_1 = 'b'.repeat(40);
const POSTERIOR_2 = 'c'.repeat(40);

/** Entrada base: CI de push del SHA en verde, en main y sin commits posteriores. */
const base = (cambios = {}) => ({
  evento: 'workflow_run',
  modo: 'despliegue',
  sha: SHA,
  enMain: true,
  ciDelSha: 'success',
  posteriores: [],
  ...cambios,
});

describe('por workflow_run (despliegue automático)', () => {
  test('merge a main con CI en verde y sin posteriores: despliega', () => {
    const r = decidirDespliegue(base());
    assert.equal(r.resultado, 'desplegar');
  });

  test('CI en rojo sobre main: no despliega', () => {
    for (const ci of ['failure', 'cancelled', 'en-curso', null]) {
      const r = decidirDespliegue(base({ ciDelSha: ci }));
      assert.equal(r.resultado, 'rechazar', `con CI ${ci}`);
    }
  });

  test('dos merges seguidos: el primero se omite si el segundo ya está verde', () => {
    const r = decidirDespliegue(
      base({ posteriores: [{ sha: POSTERIOR_1, ci: 'success' }] }),
    );
    assert.equal(r.resultado, 'omitir');
    assert.match(r.motivo, /superada por b{40}/);
  });

  test('CI viejo que termina después de uno nuevo: se omite y avisa el más nuevo verde', () => {
    const r = decidirDespliegue(
      base({
        posteriores: [
          { sha: POSTERIOR_1, ci: 'failure' },
          { sha: POSTERIOR_2, ci: 'success' },
        ],
      }),
    );
    assert.equal(r.resultado, 'omitir');
    assert.match(r.motivo, /superada por c{40}/);
  });

  test('commit posterior con CI en rojo: el verde se despliega', () => {
    const r = decidirDespliegue(
      base({ posteriores: [{ sha: POSTERIOR_1, ci: 'failure' }] }),
    );
    assert.equal(r.resultado, 'desplegar');
  });

  test('commit posterior con el CI todavía corriendo o sin CI: el verde se despliega', () => {
    for (const ci of ['en-curso', null, 'cancelled']) {
      const r = decidirDespliegue(
        base({ posteriores: [{ sha: POSTERIOR_1, ci }] }),
      );
      assert.equal(r.resultado, 'desplegar', `con el posterior en ${ci}`);
    }
  });

  test('un SHA que no está en la historia de main: se rechaza', () => {
    const r = decidirDespliegue(base({ enMain: false }));
    assert.equal(r.resultado, 'rechazar');
  });

  test('workflow_run nunca hace una vuelta atrás', () => {
    const r = decidirDespliegue(base({ modo: 'vuelta-atras' }));
    assert.equal(r.resultado, 'rechazar');
  });
});

describe('por workflow_dispatch con modo=despliegue (despliegue manual)', () => {
  const manual = (cambios = {}) =>
    base({ evento: 'workflow_dispatch', ...cambios });

  test('commit de main, con CI verde y sin posteriores verdes: despliega', () => {
    assert.equal(decidirDespliegue(manual()).resultado, 'desplegar');
    assert.equal(
      decidirDespliegue(
        manual({ posteriores: [{ sha: POSTERIOR_1, ci: 'failure' }] }),
      ).resultado,
      'desplegar',
    );
  });

  test('despliegue manual de un commit fuera de main: se rechaza', () => {
    const r = decidirDespliegue(manual({ enMain: false }));
    assert.equal(r.resultado, 'rechazar');
    assert.match(r.motivo, /main/);
  });

  test('despliegue manual de un commit cuyo CI no terminó en verde: se rechaza', () => {
    for (const ci of ['failure', 'cancelled', 'en-curso', null]) {
      const r = decidirDespliegue(manual({ ciDelSha: ci }));
      assert.equal(r.resultado, 'rechazar', `con CI ${ci}`);
      assert.match(r.motivo, /CI/);
    }
  });

  test('despliegue manual de un commit superado por otro verde: se rechaza (no se omite)', () => {
    const r = decidirDespliegue(
      manual({ posteriores: [{ sha: POSTERIOR_1, ci: 'success' }] }),
    );
    assert.equal(r.resultado, 'rechazar');
    assert.match(r.motivo, /b{40}/);
  });
});

describe('por workflow_dispatch con modo=vuelta-atras', () => {
  const vueltaAtras = (cambios = {}) =>
    base({ evento: 'workflow_dispatch', modo: 'vuelta-atras', ...cambios });

  test('vuelta atrás a un SHA de main: se acepta aunque esté superado', () => {
    const r = decidirDespliegue(
      vueltaAtras({ posteriores: [{ sha: POSTERIOR_1, ci: 'success' }] }),
    );
    assert.equal(r.resultado, 'desplegar');
  });

  test('vuelta atrás a un SHA de main con el CI de hoy no disponible: se acepta', () => {
    // La instancia exige además que el SHA figure en su historial (D7).
    const r = decidirDespliegue(vueltaAtras({ ciDelSha: null }));
    assert.equal(r.resultado, 'desplegar');
  });

  test('vuelta atrás a un SHA fuera de main: se rechaza', () => {
    const r = decidirDespliegue(vueltaAtras({ enMain: false }));
    assert.equal(r.resultado, 'rechazar');
  });
});

describe('entradas inválidas', () => {
  test('SHA que no es completo o tiene mayúsculas: se rechaza', () => {
    for (const sha of ['abc', 'a'.repeat(39), 'A'.repeat(40), `${SHA}\n`]) {
      assert.equal(decidirDespliegue(base({ sha })).resultado, 'rechazar');
    }
  });

  test('modo o evento desconocido: se rechaza', () => {
    assert.equal(
      decidirDespliegue(base({ modo: 'borrar' })).resultado,
      'rechazar',
    );
    assert.equal(
      decidirDespliegue(base({ evento: 'push' })).resultado,
      'rechazar',
    );
  });
});

describe('adaptadores de la API de GitHub', () => {
  test('estadoCiPorSha toma la ejecución más reciente de cada commit', () => {
    const runs = [
      // La API devuelve de la más nueva a la más vieja.
      {
        head_sha: SHA,
        status: 'completed',
        conclusion: 'success',
        run_number: 12,
      },
      {
        head_sha: SHA,
        status: 'completed',
        conclusion: 'failure',
        run_number: 11,
      },
      {
        head_sha: POSTERIOR_1,
        status: 'in_progress',
        conclusion: null,
        run_number: 13,
      },
      {
        head_sha: POSTERIOR_2,
        status: 'completed',
        conclusion: 'cancelled',
        run_number: 14,
      },
    ];
    const estado = estadoCiPorSha(runs);
    assert.equal(estado.get(SHA), 'success');
    assert.equal(estado.get(POSTERIOR_1), 'en-curso');
    assert.equal(estado.get(POSTERIOR_2), 'cancelled');
    assert.equal(estado.get('d'.repeat(40)), undefined);
  });

  test('un re-run en curso de un commit cuenta como en curso, aunque antes haya fallado', () => {
    const runs = [
      { head_sha: SHA, status: 'queued', conclusion: null, run_number: 20 },
      {
        head_sha: SHA,
        status: 'completed',
        conclusion: 'failure',
        run_number: 19,
      },
    ];
    assert.equal(estadoCiPorSha(runs).get(SHA), 'en-curso');
  });

  test('datosDeCompare: main delante del SHA (o igual) lo contiene; si no, no', () => {
    assert.deepEqual(
      datosDeCompare({
        status: 'ahead',
        commits: [{ sha: POSTERIOR_1 }, { sha: POSTERIOR_2 }],
      }),
      { enMain: true, posteriores: [POSTERIOR_1, POSTERIOR_2] },
    );
    assert.deepEqual(datosDeCompare({ status: 'identical', commits: [] }), {
      enMain: true,
      posteriores: [],
    });
    for (const status of ['behind', 'diverged']) {
      assert.equal(
        datosDeCompare({ status, commits: [{ sha: POSTERIOR_1 }] }).enMain,
        false,
      );
    }
  });
});
