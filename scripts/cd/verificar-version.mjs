/**
 * Comprobación de la versión publicada: entrada del job `verificar` de
 * .github/workflows/cd.yml (D3 a D6 de openspec/changes/verificacion-version-desplegada).
 *
 * Después de un despliegue que cambió producción, pide `GET /version` al sitio público, por
 * HTTPS y a través del mismo nombre que usan los usuarios, y comprueba que el SHA sea el
 * desplegado. Las decisiones son funciones puras (con tests en verificar-version.test.mjs); el
 * ciclo de consulta recibe todo lo que toca la red, para probarlo contra un servidor local.
 *
 * Variables de entorno (las pasa el workflow; los valores llegan por acá y nunca se interpolan
 * en el código de un paso):
 *   SUBDOMINIO           nombre del sitio (variable de repositorio), solo el nombre de dominio
 *   SHA                  commit que se acaba de desplegar (40 hex en minúscula)
 *   MODO                 despliegue | vuelta-atras
 *   RUN_ID, RUN_ATTEMPT  de la ejecución: arman el parámetro que evita cachés
 *   GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_STEP_SUMMARY  los provee Actions
 *
 * No usa credenciales de despliegue. El token del workflow (`contents: read`) solo sirve para
 * preguntarle a la API de GitHub si el SHA observado es posterior al esperado (D6).
 *
 * Termina en 0 si la versión coincide, si una versión más nueva ya quedó sirviendo o si no se
 * puede verificar una vuelta atrás a una versión sin `/version`; en 1 si no coincide o si la
 * configuración es inválida.
 */
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const FORMATO_SHA = /^[0-9a-f]{40}$/;
// Nombre de dominio en minúscula, con al menos un punto y sin puerto, ruta, usuario ni IP.
const FORMATO_DOMINIO =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/;
const SOLO_DIGITOS = /^[0-9]{1,20}$/;
const MODOS = ['despliegue', 'vuelta-atras'];

/**
 * @typedef {{ tipo: 'sha', sha: string }
 *   | { tipo: 'desconocido' }
 *   | { tipo: 'no-existe', detalle: string }
 *   | { tipo: 'invalida', detalle: string }} Observacion
 */

/**
 * URL de la comprobación. Siempre HTTPS, y el parámetro cambia en cada ejecución para que
 * ninguna caché intermedia responda con una copia anterior.
 *
 * @param {string | undefined} subdominio
 * @param {{ runId: string, intento: string }} ejecucion
 */
export function urlDeVersion(subdominio, { runId, intento }) {
  if (typeof subdominio !== 'string' || !FORMATO_DOMINIO.test(subdominio)) {
    throw new Error(
      'La variable SUBDOMINIO no está definida o no es un nombre de dominio válido (en minúscula, sin protocolo, puerto ni ruta).',
    );
  }
  if (!SOLO_DIGITOS.test(runId ?? '') || !SOLO_DIGITOS.test(intento ?? '')) {
    throw new Error(
      'Los identificadores de la ejecución (RUN_ID y RUN_ATTEMPT) tienen que ser números.',
    );
  }
  return `https://${subdominio}/version?cb=${runId}-${intento}`;
}

/**
 * Interpreta lo que respondió el sitio. Solo un 200 con un objeto de un único campo `sha` vale.
 *
 * @param {{ estado?: number, texto?: string, error?: unknown }} lectura
 * @returns {Observacion}
 */
export function leerObservacion({ estado, texto, error } = {}) {
  if (error) {
    const causa = error?.cause?.code ?? error?.cause?.message;
    const motivo = error?.message ?? String(error);
    return {
      tipo: 'invalida',
      detalle: `no se pudo consultar (${causa ? `${motivo}: ${causa}` : motivo})`,
    };
  }
  if (estado === 404) return { tipo: 'no-existe', detalle: 'HTTP 404' };
  if (estado >= 300 && estado < 400) {
    return {
      tipo: 'invalida',
      detalle: `respondió una redirección (HTTP ${estado}) y no se sigue`,
    };
  }
  if (estado !== 200) {
    return { tipo: 'invalida', detalle: `respondió HTTP ${estado}` };
  }
  let cuerpo;
  try {
    cuerpo = JSON.parse(texto ?? '');
  } catch {
    return { tipo: 'invalida', detalle: 'el cuerpo no es JSON' };
  }
  if (
    cuerpo === null ||
    typeof cuerpo !== 'object' ||
    Array.isArray(cuerpo) ||
    Object.keys(cuerpo).length !== 1 ||
    typeof cuerpo.sha !== 'string'
  ) {
    return {
      tipo: 'invalida',
      detalle: 'el cuerpo no es un objeto con el único campo «sha»',
    };
  }
  if (cuerpo.sha === 'desconocido') return { tipo: 'desconocido' };
  if (!FORMATO_SHA.test(cuerpo.sha)) {
    return { tipo: 'invalida', detalle: 'el campo «sha» no es un SHA completo' };
  }
  return { tipo: 'sha', sha: cuerpo.sha };
}

/**
 * Qué hacer con una observación (D5).
 *
 * @param {{
 *   esperado: string,
 *   modo: 'despliegue' | 'vuelta-atras',
 *   observacion: Observacion,
 *   relacion?: 'ahead' | 'behind' | 'identical' | 'diverged' | null,
 * }} entrada `relacion` es la del SHA observado respecto del esperado (D6), si se la consultó
 * @returns {{ accion: 'exito' | 'exito-con-aviso' | 'reintentar' | 'fallar-ya', motivo: string }}
 */
export function decidirObservacion({ esperado, modo, observacion, relacion }) {
  if (observacion.tipo === 'sha' && observacion.sha === esperado) {
    return { accion: 'exito', motivo: `el sitio sirve ${esperado}` };
  }
  if (observacion.tipo === 'desconocido') {
    return {
      accion: 'fallar-ya',
      motivo:
        'el sitio respondió «desconocido»: la imagen del frontend se construyó sin BUILD_SHA. Reintentar no lo arregla.',
    };
  }
  if (
    observacion.tipo === 'sha' &&
    modo === 'despliegue' &&
    relacion === 'ahead'
  ) {
    return {
      accion: 'exito-con-aviso',
      motivo: `el sitio sirve ${observacion.sha}, un commit posterior: una versión más nueva ya quedó desplegada.`,
    };
  }
  const visto =
    observacion.tipo === 'sha'
      ? `sirve ${observacion.sha}`
      : observacion.detalle;
  return { accion: 'reintentar', motivo: visto };
}

/**
 * Qué concluir cuando se agotaron los intentos sin una respuesta definitiva.
 *
 * @param {{ esperado: string, modo: string, ultima: Observacion }} entrada
 * @returns {{ resultado: 'fallo' | 'no-verificable', mensaje: string }}
 */
export function decidirAlAgotar({ esperado, modo, ultima }) {
  if (modo === 'vuelta-atras' && ultima.tipo === 'no-existe') {
    return {
      resultado: 'no-verificable',
      mensaje: `No se pudo verificar: el sitio no tiene la ruta /version. La vuelta atrás a ${esperado} es a una versión anterior a la comprobación y no la incluye.`,
    };
  }
  const terminacion =
    ' El despliegue en el servidor terminó bien: lo que no se pudo confirmar es lo que ve el público. Ver «Cómo comprobar que un cambio del frontend llegó» en docs/despliegue.md.';
  if (ultima.tipo === 'sha') {
    return {
      resultado: 'fallo',
      mensaje: `El sitio publicado sigue sirviendo ${ultima.sha} y no ${esperado}, el commit desplegado.${terminacion}`,
    };
  }
  return {
    resultado: 'fallo',
    mensaje: `No se pudo comprobar que el sitio publicado sirva ${esperado}: ${ultima.detalle}.${terminacion}`,
  };
}

const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));

async function consultar(url, fetchImpl, timeoutMs) {
  try {
    const respuesta = await fetchImpl(url, {
      // Sin seguir redirecciones: terminaría leyendo otro host (D4).
      redirect: 'manual',
      headers: { 'Cache-Control': 'no-cache', Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return leerObservacion({
      estado: respuesta.status,
      texto: await respuesta.text(),
    });
  } catch (error) {
    return leerObservacion({ error });
  }
}

/**
 * Ciclo de consulta: pide la versión hasta que coincida, se agoten los intentos o la respuesta
 * sea definitiva.
 *
 * @param {{
 *   url: string,
 *   esperado: string,
 *   modo: 'despliegue' | 'vuelta-atras',
 *   intentos?: number,
 *   intervaloMs?: number,
 *   timeoutMs?: number,
 *   fetchImpl?: typeof fetch,
 *   relacion?: (esperado: string, observado: string) => Promise<string | null>,
 *   log?: (linea: string) => void,
 * }} opciones
 * @returns {Promise<{
 *   resultado: 'ok' | 'ok-superada' | 'no-verificable' | 'fallo',
 *   mensaje: string,
 *   intentos: number,
 * }>}
 */
export async function verificar({
  url,
  esperado,
  modo,
  intentos = 30,
  intervaloMs = 10_000,
  timeoutMs = 10_000,
  fetchImpl = fetch,
  relacion,
  log = () => {},
}) {
  const relaciones = new Map();
  let ultima = { tipo: 'invalida', detalle: 'no se hizo ningún intento' };

  for (let intento = 1; intento <= intentos; intento++) {
    ultima = await consultar(url, fetchImpl, timeoutMs);

    // Solo en `despliegue` y solo para un SHA distinto del esperado (D6). Un resultado se
    // conserva; un error de la consulta no: se vuelve a intentar en la vuelta siguiente.
    let rel = null;
    if (
      ultima.tipo === 'sha' &&
      ultima.sha !== esperado &&
      modo === 'despliegue' &&
      relacion
    ) {
      if (!relaciones.has(ultima.sha)) {
        try {
          const dato = await relacion(esperado, ultima.sha);
          if (dato) relaciones.set(ultima.sha, dato);
        } catch {
          // Sin la relación se sigue como si no se supiera: se reintenta.
        }
      }
      rel = relaciones.get(ultima.sha) ?? null;
    }

    const decision = decidirObservacion({
      esperado,
      modo,
      observacion: ultima,
      relacion: rel,
    });
    log(`Intento ${intento}/${intentos}: ${decision.motivo}`);

    if (decision.accion === 'exito') {
      return {
        resultado: 'ok',
        mensaje: `El sitio publicado sirve el commit desplegado (${esperado}).`,
        intentos: intento,
      };
    }
    if (decision.accion === 'exito-con-aviso') {
      return { resultado: 'ok-superada', mensaje: decision.motivo, intentos: intento };
    }
    if (decision.accion === 'fallar-ya') {
      return {
        resultado: 'fallo',
        mensaje: `${decision.motivo} Esperado: ${esperado}.`,
        intentos: intento,
      };
    }
    if (intento < intentos) await esperar(intervaloMs);
  }

  return {
    ...decidirAlAgotar({ esperado, modo, ultima }),
    intentos,
  };
}

/**
 * Relación del SHA observado respecto del esperado, según la API de GitHub: `ahead` si el
 * observado es posterior. `null` si GitHub no conoce alguno de los dos commits.
 */
export function relacionConGitHub({ token, repositorio, fetchImpl = fetch }) {
  return async (esperado, observado) => {
    const respuesta = await fetchImpl(
      `https://api.github.com/repos/${repositorio}/compare/${esperado}...${observado}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (respuesta.status === 404) return null;
    if (!respuesta.ok) {
      throw new Error(`La API de GitHub respondió ${respuesta.status}`);
    }
    return (await respuesta.json()).status ?? null;
  };
}

function resumen(env, lineas) {
  if (env.GITHUB_STEP_SUMMARY) {
    appendFileSync(env.GITHUB_STEP_SUMMARY, `${lineas.join('\n')}\n`);
  }
}

/** Entrada del job: valida el entorno, verifica y deja el resultado en el resumen. */
export async function main(env = process.env) {
  const { SHA: esperado, MODO: modo, SUBDOMINIO: subdominio } = env;

  let url;
  try {
    if (!FORMATO_SHA.test(esperado ?? '')) {
      throw new Error('SHA tiene que ser el SHA completo del commit desplegado.');
    }
    if (!MODOS.includes(modo)) {
      throw new Error('MODO tiene que ser despliegue o vuelta-atras.');
    }
    url = urlDeVersion(subdominio, {
      runId: env.RUN_ID,
      intento: env.RUN_ATTEMPT,
    });
  } catch (error) {
    const mensaje = `${error.message} El despliegue terminó, pero no se pudo comprobar la versión publicada.`;
    console.log(`::error title=No se pudo comprobar la versión publicada::${mensaje}`);
    resumen(env, ['### No se pudo comprobar la versión publicada', '', mensaje]);
    return 1;
  }

  console.log(`Comprobando ${url.replace(/\?.*$/, '')} (esperado ${esperado}, modo ${modo}).`);
  const resultado = await verificar({
    url,
    esperado,
    modo,
    relacion:
      env.GITHUB_TOKEN && env.GITHUB_REPOSITORY
        ? relacionConGitHub({
            token: env.GITHUB_TOKEN,
            repositorio: env.GITHUB_REPOSITORY,
          })
        : undefined,
    log: (linea) => console.log(linea),
  });

  const sitio = url.replace(/\?.*$/, '');
  if (resultado.resultado === 'ok') {
    resumen(env, [
      '### Versión publicada verificada',
      '',
      `- Sitio: \`${sitio}\``,
      `- Commit desplegado y servido: \`${esperado}\``,
      `- Intentos: ${resultado.intentos}`,
    ]);
    return 0;
  }
  if (resultado.resultado === 'ok-superada') {
    console.log(`::notice title=Versión más nueva ya desplegada::${resultado.mensaje}`);
    resumen(env, [
      '### Versión publicada: otra más nueva ya está sirviendo',
      '',
      `- Sitio: \`${sitio}\``,
      `- Commit de esta ejecución: \`${esperado}\``,
      `- ${resultado.mensaje}`,
    ]);
    return 0;
  }
  if (resultado.resultado === 'no-verificable') {
    console.log(`::warning title=Versión no verificable::${resultado.mensaje}`);
    resumen(env, ['### Versión publicada: no verificable', '', resultado.mensaje]);
    return 0;
  }
  console.log(`::error title=El sitio no sirve la versión desplegada::${resultado.mensaje}`);
  resumen(env, [
    '### El sitio no sirve la versión desplegada',
    '',
    `- Sitio: \`${sitio}\``,
    `- Esperado: \`${esperado}\``,
    `- ${resultado.mensaje}`,
  ]);
  return 1;
}

// Se ejecuta solo como programa, no al importarlo desde los tests.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await main();
}
