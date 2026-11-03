import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  ARCHIVO_RANGOS,
  compararRangos,
  esCidr,
  leerRangos,
  main,
  normalizar,
  rangosDeCaddyfile,
  rangosInvalidos,
} from './verificar-rangos-cloudflare.mjs';

const RAIZ = join(import.meta.dirname, '..', '..');
const CADDYFILE = join(RAIZ, 'deploy', 'Caddyfile');

describe('esCidr', () => {
  for (const valido of ['173.245.48.0/20', '10.0.0.0/8', '0.0.0.0/0', '2400:cb00::/32', '2c0f:f248::/32', '::/0']) {
    test(`acepta ${valido}`, () => assert.equal(esCidr(valido), true));
  }
  for (const invalido of [
    '',
    '173.245.48.0',
    '173.245.48.0/33',
    '173.245.48.0/',
    '173.245.48/20',
    '999.1.1.1/8',
    '2400:cb00::/129',
    '2400:cb00::/-1',
    'cloudflare.com/20',
    '<html>/20',
    '1.2.3.4/8 5.6.7.8/8',
    undefined,
  ]) {
    test(`rechaza ${JSON.stringify(invalido)}`, () => assert.equal(esCidr(invalido), false));
  }
});

describe('leerRangos', () => {
  test('ignora comentarios, líneas vacías y espacios', () => {
    const texto = '# fuente\n\n  173.245.48.0/20  \n103.21.244.0/22 # comentario\r\n2400:cb00::/32\n';
    assert.deepEqual(leerRangos(texto), ['173.245.48.0/20', '103.21.244.0/22', '2400:cb00::/32']);
  });
});

describe('compararRangos', () => {
  test('sin diferencias aunque cambie el orden, el uso de mayúsculas o haya repetidos', () => {
    const r = compararRangos(['2400:CB00::/32', '1.0.0.0/8', '1.0.0.0/8'], ['1.0.0.0/8', '2400:cb00::/32']);
    assert.deepEqual(r, { altas: [], bajas: [] });
  });

  test('una alta es un rango publicado que falta en el archivo', () => {
    assert.deepEqual(compararRangos(['1.0.0.0/8'], ['1.0.0.0/8', '2.0.0.0/8']), {
      altas: ['2.0.0.0/8'],
      bajas: [],
    });
  });

  test('una baja es un rango del archivo que ya no se publica', () => {
    assert.deepEqual(compararRangos(['1.0.0.0/8', '3.0.0.0/8'], ['1.0.0.0/8']), {
      altas: [],
      bajas: ['3.0.0.0/8'],
    });
  });

  test('altas y bajas se informan por separado', () => {
    assert.deepEqual(compararRangos(['1.0.0.0/8', '3.0.0.0/8'], ['1.0.0.0/8', '2.0.0.0/8']), {
      altas: ['2.0.0.0/8'],
      bajas: ['3.0.0.0/8'],
    });
  });
});

describe('rangosDeCaddyfile', () => {
  test('lee los rangos de la línea trusted_proxies static', () => {
    const texto = '{\n\tservers {\n\t\ttrusted_proxies static 1.0.0.0/8 2400:cb00::/32\n\t\tclient_ip_headers CF-Connecting-IP\n\t}\n}\n';
    assert.deepEqual(rangosDeCaddyfile(texto), ['1.0.0.0/8', '2400:cb00::/32']);
  });

  test('falla si no hay línea trusted_proxies static', () => {
    assert.throws(() => rangosDeCaddyfile('{\n}\n'), /exactamente una línea/);
  });

  test('falla si hay más de una', () => {
    const texto = 'trusted_proxies static 1.0.0.0/8\ntrusted_proxies static 2.0.0.0/8\n';
    assert.throws(() => rangosDeCaddyfile(texto), /exactamente una línea/);
  });
});

describe('archivo real deploy/cloudflare-ips.txt', () => {
  const rangos = leerRangos(readFileSync(ARCHIVO_RANGOS, 'utf8'));

  test('no está vacío ni tiene repetidos', () => {
    assert.ok(rangos.length > 0);
    assert.equal(new Set(normalizar(rangos)).size, rangos.length);
  });

  test('todos son CIDR válidos', () => {
    assert.deepEqual(rangosInvalidos(rangos), []);
  });

  test('no incluye rangos amplios que abrirían la confianza a cualquiera', () => {
    for (const rango of rangos) {
      const [, prefijo] = rango.split('/');
      const minimo = rango.includes(':') ? 29 : 12;
      assert.ok(Number(prefijo) >= minimo, `${rango} es demasiado amplio`);
    }
  });
});

describe('coherencia entre deploy/cloudflare-ips.txt y deploy/Caddyfile', () => {
  const archivo = readFileSync(ARCHIVO_RANGOS, 'utf8');
  const caddyfile = readFileSync(CADDYFILE, 'utf8');

  test('la línea trusted_proxies static del Caddyfile tiene los mismos rangos que el archivo', () => {
    assert.deepEqual(normalizar(rangosDeCaddyfile(caddyfile)), normalizar(leerRangos(archivo)));
  });

  test('falla si se agrega un rango en el Caddyfile que no está en el archivo', () => {
    const alterado = caddyfile.replace('trusted_proxies static ', 'trusted_proxies static 203.0.113.0/24 ');
    assert.notDeepEqual(normalizar(rangosDeCaddyfile(alterado)), normalizar(leerRangos(archivo)));
  });

  test('falla si se quita un rango del archivo y el Caddyfile no cambia', () => {
    const [, ...sinElPrimero] = leerRangos(archivo);
    assert.notDeepEqual(normalizar(rangosDeCaddyfile(caddyfile)), normalizar(sinElPrimero));
  });

  test('el Caddyfile lee el origen solo de CF-Connecting-IP y reescribe X-Forwarded-For', () => {
    assert.match(caddyfile, /client_ip_headers CF-Connecting-IP\s*$/m);
    assert.match(caddyfile, /header_up X-Forwarded-For \{client_ip\}/);
    for (const descartado of ['X-Real-IP', 'Forwarded', 'CF-Connecting-IP']) {
      assert.match(caddyfile, new RegExp(`header_up -${descartado}\\s*$`, 'm'));
    }
  });
});

describe('main (comprobación contra la lista publicada)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rangos-cf-'));
  const archivoLocal = join(dir, 'ips.txt');
  const escribir = (rangos) => writeFileSync(archivoLocal, `# fuente\n${rangos.join('\n')}\n`);

  const respuesta = (cuerpo, estado = 200) => ({
    ok: estado >= 200 && estado < 300,
    status: estado,
    text: async () => cuerpo,
  });
  /** fetch falso: v4 y v6 según la URL. */
  const publicar = (v4, v6, estado = 200) => async (url) =>
    url.endsWith('ips-v4') ? respuesta(v4.join('\n'), estado) : respuesta(v6.join('\n'), estado);

  const correr = async (fetchImpl) => {
    const salida = [];
    const codigo = await main({ env: {}, archivo: archivoLocal, fetchImpl, log: (l) => salida.push(l) });
    return { codigo, salida: salida.join('\n') };
  };

  test('termina en 0 cuando el archivo coincide con lo publicado', async () => {
    escribir(['1.0.0.0/8', '2400:cb00::/32']);
    const { codigo } = await correr(publicar(['1.0.0.0/8'], ['2400:cb00::/32']));
    assert.equal(codigo, 0);
  });

  test('termina en 1 y nombra las altas cuando Cloudflare publica un rango nuevo', async () => {
    escribir(['1.0.0.0/8']);
    const { codigo, salida } = await correr(publicar(['1.0.0.0/8', '2.0.0.0/8'], []));
    assert.equal(codigo, 1);
    assert.match(salida, /ALTAS[^\n]*2\.0\.0\.0\/8/);
    assert.doesNotMatch(salida, /BAJAS/);
  });

  test('termina en 1 y nombra las bajas cuando Cloudflare retira un rango', async () => {
    escribir(['1.0.0.0/8', '3.0.0.0/8']);
    const { codigo, salida } = await correr(publicar(['1.0.0.0/8'], []));
    assert.equal(codigo, 1);
    assert.match(salida, /BAJAS[^\n]*3\.0\.0\.0\/8/);
    assert.doesNotMatch(salida, /ALTAS/);
  });

  test('termina en 1 si no se puede obtener la lista publicada (no cuenta como al día)', async () => {
    escribir(['1.0.0.0/8']);
    const { codigo, salida } = await correr(async () => {
      throw new Error('sin red');
    });
    assert.equal(codigo, 1);
    assert.match(salida, /no quedó comprobada/);
  });

  test('termina en 1 si Cloudflare responde un error HTTP', async () => {
    escribir(['1.0.0.0/8']);
    const { codigo } = await correr(publicar(['1.0.0.0/8'], [], 503));
    assert.equal(codigo, 1);
  });

  test('termina en 1 si la respuesta no es una lista de rangos (por ejemplo HTML)', async () => {
    escribir(['1.0.0.0/8']);
    const { codigo, salida } = await correr(publicar(['<html>captcha</html>'], []));
    assert.equal(codigo, 1);
    assert.match(salida, /formato esperado/);
  });

  test('termina en 1 si el archivo local está vacío o tiene un rango inválido', async () => {
    escribir([]);
    assert.equal((await correr(publicar(['1.0.0.0/8'], []))).codigo, 1);
    escribir(['1.0.0.0/99']);
    assert.equal((await correr(publicar(['1.0.0.0/8'], []))).codigo, 1);
  });
});
