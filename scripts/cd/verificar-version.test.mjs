/**
 * Tests de la comprobación de la versión publicada (scripts/cd/verificar-version.mjs; job
 * `verificar` de .github/workflows/cd.yml; D3 a D6 de verificacion-version-desplegada).
 *
 * Las funciones puras se prueban con datos; el ciclo de consulta, contra un servidor HTTP local
 * con intervalos de milisegundos. Corren con `node --test`, sin dependencias, desde
 * `npm run test:scripts` (el script lista los archivos uno por uno: Node 20 no expande globs).
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import {
  decidirAlAgotar,
  decidirObservacion,
  leerObservacion,
  urlDeVersion,
  verificar,
} from './verificar-version.mjs';

const ESPERADO = 'a'.repeat(40);
const OTRO = 'b'.repeat(40);
const POSTERIOR = 'c'.repeat(40);

const respuesta = (estado, cuerpo) => ({
  estado,
  texto: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
});

describe('urlDeVersion', () => {
  const datos = { runId: '123', intento: '2' };

  test('arma una URL HTTPS con el parámetro que evita cachés', () => {
    const url = urlDeVersion('ichigo.alquilerespunilla.com.ar', datos);
    assert.equal(
      url,
      'https://ichigo.alquilerespunilla.com.ar/version?cb=123-2',
    );
  });

  for (const invalido of [
    undefined,
    '',
    '   ',
    'sitio',
    'http://sitio.example.com',
    'sitio.example.com/',
    'sitio.example.com/version?x=1',
    'user@sitio.example.com',
    'sitio.example.com:8443',
    'sitio example.com',
    'Sitio.Example.com',
    '-sitio.example.com',
    'sitio..example.com',
    '127.0.0.1',
    'sitio.example.com\nOtra: cosa',
  ]) {
    test(`rechaza el nombre ${JSON.stringify(invalido)}`, () => {
      assert.throws(() => urlDeVersion(invalido, datos), /SUBDOMINIO/);
    });
  }

  test('rechaza identificadores de ejecución que no son números', () => {
    assert.throws(
      () => urlDeVersion('sitio.example.com', { runId: '1&x=2', intento: '1' }),
      /ejecución/,
    );
  });
});

describe('leerObservacion', () => {
  test('un 200 con el campo sha de 40 hex es un SHA', () => {
    assert.deepEqual(leerObservacion(respuesta(200, { sha: ESPERADO })), {
      tipo: 'sha',
      sha: ESPERADO,
    });
  });

  test('«desconocido» es su propio tipo', () => {
    assert.equal(
      leerObservacion(respuesta(200, { sha: 'desconocido' })).tipo,
      'desconocido',
    );
  });

  test('un 404 es «no-existe»', () => {
    assert.equal(leerObservacion(respuesta(404, 'x')).tipo, 'no-existe');
  });

  for (const [caso, obs] of [
    ['un 500', respuesta(500, { sha: ESPERADO })],
    ['un 503', respuesta(503, '')],
    ['una redirección 301', respuesta(301, '')],
    ['una redirección 308', respuesta(308, '')],
    ['un cuerpo que no es JSON', respuesta(200, '<html>Cloudflare</html>')],
    ['un JSON vacío', respuesta(200, {})],
    ['un JSON que no es un objeto', respuesta(200, [ESPERADO])],
    ['un sha en mayúscula', respuesta(200, { sha: ESPERADO.toUpperCase() })],
    ['un sha corto', respuesta(200, { sha: 'abc' })],
    ['un sha que no es texto', respuesta(200, { sha: 1234 })],
    ['campos de más', respuesta(200, { sha: ESPERADO, version: '1' })],
    ['un error de red', { error: new Error('ECONNRESET') }],
  ]) {
    test(`${caso} es una observación inválida`, () => {
      assert.equal(leerObservacion(obs).tipo, 'invalida');
    });
  }
});

describe('decidirObservacion', () => {
  const sha = (valor) => ({ tipo: 'sha', sha: valor });

  test('el SHA esperado es éxito, en los dos modos', () => {
    for (const modo of ['despliegue', 'vuelta-atras']) {
      assert.equal(
        decidirObservacion({
          esperado: ESPERADO,
          modo,
          observacion: sha(ESPERADO),
        }).accion,
        'exito',
      );
    }
  });

  test('otro SHA sin relación conocida se reintenta', () => {
    assert.equal(
      decidirObservacion({
        esperado: ESPERADO,
        modo: 'despliegue',
        observacion: sha(OTRO),
      }).accion,
      'reintentar',
    );
  });

  test('otro SHA anterior o divergente se reintenta', () => {
    for (const relacion of ['behind', 'diverged', 'identical', null]) {
      assert.equal(
        decidirObservacion({
          esperado: ESPERADO,
          modo: 'despliegue',
          observacion: sha(OTRO),
          relacion,
        }).accion,
        'reintentar',
        relacion,
      );
    }
  });

  test('un SHA posterior en modo despliegue es éxito con aviso', () => {
    const decision = decidirObservacion({
      esperado: ESPERADO,
      modo: 'despliegue',
      observacion: sha(POSTERIOR),
      relacion: 'ahead',
    });
    assert.equal(decision.accion, 'exito-con-aviso');
    assert.match(decision.motivo, /más nueva/);
  });

  test('un SHA posterior en vuelta atrás NO se acepta', () => {
    assert.equal(
      decidirObservacion({
        esperado: ESPERADO,
        modo: 'vuelta-atras',
        observacion: sha(POSTERIOR),
        relacion: 'ahead',
      }).accion,
      'reintentar',
    );
  });

  test('«desconocido» falla de inmediato, en los dos modos', () => {
    for (const modo of ['despliegue', 'vuelta-atras']) {
      const decision = decidirObservacion({
        esperado: ESPERADO,
        modo,
        observacion: { tipo: 'desconocido' },
      });
      assert.equal(decision.accion, 'fallar-ya');
      assert.match(decision.motivo, /BUILD_SHA/);
    }
  });

  for (const tipo of ['no-existe', 'invalida']) {
    test(`una observación «${tipo}» se reintenta`, () => {
      assert.equal(
        decidirObservacion({
          esperado: ESPERADO,
          modo: 'despliegue',
          observacion: { tipo, detalle: 'x' },
        }).accion,
        'reintentar',
      );
    });
  }
});

describe('decidirAlAgotar', () => {
  test('un 404 al final de una vuelta atrás es «no verificable»', () => {
    const decision = decidirAlAgotar({
      esperado: ESPERADO,
      modo: 'vuelta-atras',
      ultima: { tipo: 'no-existe' },
    });
    assert.equal(decision.resultado, 'no-verificable');
    assert.match(decision.mensaje, /anterior|no tiene/i);
  });

  test('un 404 al final de un despliegue es un fallo', () => {
    assert.equal(
      decidirAlAgotar({
        esperado: ESPERADO,
        modo: 'despliegue',
        ultima: { tipo: 'no-existe' },
      }).resultado,
      'fallo',
    );
  });

  test('otro SHA al final es un fallo que nombra los dos SHA', () => {
    const decision = decidirAlAgotar({
      esperado: ESPERADO,
      modo: 'despliegue',
      ultima: { tipo: 'sha', sha: OTRO },
    });
    assert.equal(decision.resultado, 'fallo');
    assert.ok(decision.mensaje.includes(ESPERADO));
    assert.ok(decision.mensaje.includes(OTRO));
    assert.match(decision.mensaje, /terminó bien|despliegue.*terminó/i);
  });

  test('un error de red al final es un fallo que lo explica', () => {
    const decision = decidirAlAgotar({
      esperado: ESPERADO,
      modo: 'despliegue',
      ultima: { tipo: 'invalida', detalle: 'ECONNRESET' },
    });
    assert.equal(decision.resultado, 'fallo');
    assert.match(decision.mensaje, /ECONNRESET/);
  });
});

describe('verificar contra un servidor HTTP local', () => {
  let servidor;
  let base;
  /** Respuestas a dar, en orden; la última se repite. */
  let guion = [];
  let pedidos = [];

  before(async () => {
    servidor = createServer((req, res) => {
      pedidos.push({ url: req.url, cabeceras: req.headers });
      const paso = guion.length > 1 ? guion.shift() : guion[0];
      res.writeHead(paso.estado, {
        'Content-Type': 'application/json',
        ...(paso.cabeceras ?? {}),
      });
      res.end(paso.cuerpo === undefined ? '' : JSON.stringify(paso.cuerpo));
    });
    await new Promise((listo) => servidor.listen(0, '127.0.0.1', listo));
    base = `http://127.0.0.1:${servidor.address().port}/version?cb=1-1`;
  });

  after(() => new Promise((listo) => servidor.close(listo)));

  const ejecutar = (opciones = {}) => {
    pedidos = [];
    return verificar({
      url: base,
      esperado: ESPERADO,
      modo: 'despliegue',
      intentos: 4,
      intervaloMs: 5,
      timeoutMs: 1000,
      ...opciones,
    });
  };
  const sha = (valor) => ({ estado: 200, cuerpo: { sha: valor } });

  test('éxito al primer intento con el SHA esperado', async () => {
    guion = [sha(ESPERADO)];
    const resultado = await ejecutar();
    assert.equal(resultado.resultado, 'ok');
    assert.equal(resultado.intentos, 1);
    assert.equal(pedidos.length, 1);
  });

  test('el pedido lleva Cache-Control: no-cache y el parámetro de la URL', async () => {
    guion = [sha(ESPERADO)];
    await ejecutar();
    assert.equal(pedidos[0].url, '/version?cb=1-1');
    assert.match(pedidos[0].cabeceras['cache-control'], /no-cache/);
  });

  test('reintenta si primero ve el SHA anterior y luego el esperado', async () => {
    guion = [sha(OTRO), sha(OTRO), sha(ESPERADO)];
    const resultado = await ejecutar();
    assert.equal(resultado.resultado, 'ok');
    assert.equal(resultado.intentos, 3);
  });

  test('absorbe errores del servidor y cuerpos inválidos antes del éxito', async () => {
    guion = [
      { estado: 502, cuerpo: { error: 'bad gateway' } },
      { estado: 200, cuerpo: 'no es un objeto' },
      sha(ESPERADO),
    ];
    const resultado = await ejecutar();
    assert.equal(resultado.resultado, 'ok');
    assert.equal(resultado.intentos, 3);
  });

  test('falla al agotar los intentos con otro SHA y nombra los dos', async () => {
    guion = [sha(OTRO)];
    const resultado = await ejecutar();
    assert.equal(resultado.resultado, 'fallo');
    assert.equal(resultado.intentos, 4);
    assert.ok(resultado.mensaje.includes(ESPERADO));
    assert.ok(resultado.mensaje.includes(OTRO));
  });

  test('«desconocido» falla de inmediato, sin reintentar', async () => {
    guion = [sha('desconocido')];
    const resultado = await ejecutar();
    assert.equal(resultado.resultado, 'fallo');
    assert.equal(resultado.intentos, 1);
    assert.match(resultado.mensaje, /BUILD_SHA/);
  });

  test('un 404 en modo despliegue reintenta y falla', async () => {
    guion = [{ estado: 404 }];
    const resultado = await ejecutar();
    assert.equal(resultado.resultado, 'fallo');
    assert.equal(resultado.intentos, 4);
  });

  test('un 404 en vuelta atrás reintenta y queda «no verificable»', async () => {
    guion = [{ estado: 404 }];
    const resultado = await ejecutar({ modo: 'vuelta-atras' });
    assert.equal(resultado.resultado, 'no-verificable');
    assert.equal(resultado.intentos, 4);
  });

  test('una redirección no se sigue ni cuenta como éxito', async () => {
    // El destino de la redirección responde con el SHA correcto: si se la siguiera, la
    // comprobación daría éxito leyendo otro host.
    let visitas = 0;
    const destino = createServer((_req, res) => {
      visitas++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sha: ESPERADO }));
    });
    await new Promise((listo) => destino.listen(0, '127.0.0.1', listo));
    try {
      guion = [
        {
          estado: 302,
          cabeceras: {
            Location: `http://127.0.0.1:${destino.address().port}/version`,
          },
        },
      ];
      const resultado = await ejecutar();
      assert.equal(resultado.resultado, 'fallo');
      assert.equal(pedidos.length, 4);
      assert.equal(visitas, 0, 'no pidió al destino de la redirección');
    } finally {
      await new Promise((listo) => destino.close(listo));
    }
  });

  test('si no responde dentro del tiempo, reintenta y falla', async () => {
    const colgado = createServer(() => {});
    await new Promise((listo) => colgado.listen(0, '127.0.0.1', listo));
    try {
      const resultado = await verificar({
        url: `http://127.0.0.1:${colgado.address().port}/version`,
        esperado: ESPERADO,
        modo: 'despliegue',
        intentos: 2,
        intervaloMs: 5,
        timeoutMs: 50,
      });
      assert.equal(resultado.resultado, 'fallo');
      assert.equal(resultado.intentos, 2);
    } finally {
      colgado.closeAllConnections();
      await new Promise((listo) => colgado.close(listo));
    }
  });

  test('un SHA posterior en despliegue es éxito con aviso (consulta una sola vez la relación)', async () => {
    guion = [sha(POSTERIOR)];
    const consultas = [];
    const resultado = await ejecutar({
      relacion: async (esperado, observado) => {
        consultas.push([esperado, observado]);
        return 'ahead';
      },
    });
    assert.equal(resultado.resultado, 'ok-superada');
    assert.match(resultado.mensaje, /más nueva/);
    assert.deepEqual(consultas, [[ESPERADO, POSTERIOR]]);
  });

  test('un SHA posterior en vuelta atrás falla pasados los intentos', async () => {
    guion = [sha(POSTERIOR)];
    const resultado = await ejecutar({
      modo: 'vuelta-atras',
      relacion: async () => 'ahead',
    });
    assert.equal(resultado.resultado, 'fallo');
  });

  test('si la consulta de la relación falla, se sigue como si no se supiera', async () => {
    guion = [sha(OTRO)];
    const resultado = await ejecutar({
      relacion: async () => {
        throw new Error('api caída');
      },
    });
    assert.equal(resultado.resultado, 'fallo');
    assert.equal(resultado.intentos, 4);
  });
});
