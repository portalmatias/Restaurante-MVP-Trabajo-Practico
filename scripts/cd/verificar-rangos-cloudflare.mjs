/**
 * Comprobación de los rangos de Cloudflare (D2 de openspec/changes/ip-real-detras-de-cloudflare).
 *
 * La lista de rangos en los que Caddy confía para leer `CF-Connecting-IP` tiene una única
 * fuente versionada: deploy/cloudflare-ips.txt. Este script, sin tocar nada:
 *
 *   1. valida que cada rango del archivo sea un CIDR válido;
 *   2. compara el archivo con las listas que publica Cloudflare
 *      (https://www.cloudflare.com/ips-v4 y /ips-v6) y muestra las ALTAS (rangos nuevos que
 *      faltan en el archivo) y las BAJAS (rangos que Cloudflare ya no publica) por separado.
 *
 * Termina en 0 si el archivo coincide con lo publicado y en 1 si hay diferencias, si algún
 * rango es inválido o si no se pudo obtener la lista publicada (ante la duda, falla: una lista
 * que no se pudo comprobar no cuenta como al día).
 *
 * También exporta las funciones puras que usan las pruebas, incluida la de coherencia entre el
 * archivo y la línea `trusted_proxies static` de deploy/Caddyfile.
 *
 * Uso: node scripts/cd/verificar-rangos-cloudflare.mjs
 * Para actualizar la lista, ver docs/despliegue.md §6.
 */
import { readFileSync, appendFileSync } from 'node:fs';
import { isIPv4, isIPv6 } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ARCHIVO_RANGOS = join(RAIZ, 'deploy', 'cloudflare-ips.txt');
export const URL_IPS_V4 = 'https://www.cloudflare.com/ips-v4';
export const URL_IPS_V6 = 'https://www.cloudflare.com/ips-v6';

/** Un rango CIDR válido: dirección IPv4/IPv6 y prefijo dentro del largo de la dirección. */
export function esCidr(rango) {
  if (typeof rango !== 'string') return false;
  const partes = rango.split('/');
  if (partes.length !== 2) return false;
  const [direccion, prefijo] = partes;
  if (!/^[0-9]{1,3}$/.test(prefijo)) return false;
  const largo = Number(prefijo);
  if (isIPv4(direccion)) return largo <= 32;
  if (isIPv6(direccion)) return largo <= 128;
  return false;
}

/** Normaliza para comparar: sin espacios, en minúscula, sin repetidos y ordenado. */
export function normalizar(rangos) {
  return [...new Set(rangos.map((rango) => rango.trim().toLowerCase()))].sort();
}

/** Rangos de un archivo de texto: una dirección por línea; `#` abre un comentario. */
export function leerRangos(texto) {
  return texto
    .split(/\r?\n/)
    .map((linea) => linea.replace(/#.*$/, '').trim())
    .filter((linea) => linea !== '');
}

/** Rangos que declara la línea `trusted_proxies static ...` de un Caddyfile. */
export function rangosDeCaddyfile(texto) {
  const lineas = texto
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter((linea) => /^trusted_proxies static\s/.test(linea));
  if (lineas.length !== 1) {
    throw new Error(
      `El Caddyfile debe tener exactamente una línea «trusted_proxies static» (tiene ${lineas.length}).`,
    );
  }
  return lineas[0]
    .replace(/^trusted_proxies static\s+/, '')
    .replace(/#.*$/, '')
    .trim()
    .split(/\s+/)
    .filter((rango) => rango !== '');
}

/** Rangos inválidos de una lista (vacía si todos son CIDR válidos). */
export function rangosInvalidos(rangos) {
  return rangos.filter((rango) => !esCidr(rango));
}

/**
 * Diferencia entre lo que usa el sistema (`propios`) y lo que publica Cloudflare (`publicados`).
 * `altas`: publicados que faltan en la lista propia. `bajas`: propios que ya no se publican.
 */
export function compararRangos(propios, publicados) {
  const mios = new Set(normalizar(propios));
  const suyos = new Set(normalizar(publicados));
  return {
    altas: [...suyos].filter((rango) => !mios.has(rango)).sort(),
    bajas: [...mios].filter((rango) => !suyos.has(rango)).sort(),
  };
}

async function descargar(url, fetchImpl) {
  const respuesta = await fetchImpl(url, { signal: AbortSignal.timeout(15_000) });
  if (!respuesta.ok) {
    throw new Error(`${url} respondió HTTP ${respuesta.status}`);
  }
  return respuesta.text();
}

/** Lista publicada por Cloudflare (v4 y v6). Falla si algo no es un CIDR (por ejemplo, HTML). */
export async function obtenerPublicados(fetchImpl = fetch) {
  const [v4, v6] = await Promise.all([
    descargar(URL_IPS_V4, fetchImpl),
    descargar(URL_IPS_V6, fetchImpl),
  ]);
  const rangos = [...leerRangos(v4), ...leerRangos(v6)];
  const invalidos = rangosInvalidos(rangos);
  if (rangos.length === 0 || invalidos.length > 0) {
    throw new Error(
      `La lista publicada no tiene el formato esperado${invalidos.length ? ` (inválidos: ${invalidos.slice(0, 3).join(', ')})` : ' (vacía)'}.`,
    );
  }
  return rangos;
}

function resumen(env, lineas) {
  if (env.GITHUB_STEP_SUMMARY) {
    appendFileSync(env.GITHUB_STEP_SUMMARY, `${lineas.join('\n')}\n`);
  }
}

/**
 * Entrada del script. Todo lo que toca el disco o la red se recibe, para probarla sin ambas.
 *
 * @param {{ env?: NodeJS.ProcessEnv, archivo?: string, fetchImpl?: typeof fetch,
 *   log?: (linea: string) => void }} opciones
 * @returns {Promise<number>} código de salida
 */
export async function main({
  env = process.env,
  archivo = ARCHIVO_RANGOS,
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  let propios;
  try {
    propios = leerRangos(readFileSync(archivo, 'utf8'));
  } catch (error) {
    log(`::error title=Rangos de Cloudflare::No se pudo leer ${archivo}: ${error.message}`);
    return 1;
  }
  const invalidos = rangosInvalidos(propios);
  if (propios.length === 0 || invalidos.length > 0) {
    const mensaje = propios.length === 0
      ? 'El archivo de rangos está vacío.'
      : `Hay rangos inválidos en el archivo: ${invalidos.join(', ')}.`;
    log(`::error title=Rangos de Cloudflare::${mensaje}`);
    resumen(env, ['### Rangos de Cloudflare: archivo inválido', '', mensaje]);
    return 1;
  }

  let publicados;
  try {
    publicados = await obtenerPublicados(fetchImpl);
  } catch (error) {
    const mensaje = `No se pudo obtener la lista publicada: ${error.message} La lista local no quedó comprobada.`;
    log(`::error title=Rangos de Cloudflare::${mensaje}`);
    resumen(env, ['### Rangos de Cloudflare: no se pudo comprobar', '', mensaje]);
    return 1;
  }

  const { altas, bajas } = compararRangos(propios, publicados);
  if (altas.length === 0 && bajas.length === 0) {
    log(`Los ${normalizar(propios).length} rangos de deploy/cloudflare-ips.txt coinciden con los que publica Cloudflare.`);
    resumen(env, ['### Rangos de Cloudflare: al día', '', `${normalizar(propios).length} rangos, sin diferencias.`]);
    return 0;
  }

  const lineas = ['Los rangos de deploy/cloudflare-ips.txt difieren de los que publica Cloudflare:'];
  if (altas.length) {
    lineas.push(`  ALTAS (faltan en el archivo; ese tráfico se cuenta por el borde y no por el visitante): ${altas.join(' ')}`);
  }
  if (bajas.length) {
    lineas.push(`  BAJAS (Cloudflare ya no las publica; siguen siendo de confianza hasta quitarlas): ${bajas.join(' ')}`);
  }
  lineas.push('Para actualizar: docs/despliegue.md §6 (archivo, línea trusted_proxies del Caddyfile y security group, juntos).');
  for (const linea of lineas) log(linea);
  log('::error title=Rangos de Cloudflare desactualizados::Hay altas o bajas pendientes en deploy/cloudflare-ips.txt.');
  resumen(env, ['### Rangos de Cloudflare: hay diferencias', '', ...lineas.map((l) => `- ${l.trim()}`)]);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
