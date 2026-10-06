/**
 * Decisión de despliegue del job `decidir` de .github/workflows/cd.yml (D4 de
 * openspec/changes/despliegue-continuo-ec2/design.md).
 *
 * Funciones puras: reciben lo que ya se leyó de la API de GitHub y no hacen ninguna llamada.
 * La lectura de la API está en scripts/cd/decidir.mjs. Los tests, en
 * scripts/cd/decidir-despliegue.test.mjs.
 *
 * Resultados posibles:
 * - `desplegar`: el workflow sigue con las imágenes y el despliegue;
 * - `omitir`: el workflow termina en verde sin desplegar (versión superada por otra verde);
 * - `rechazar`: el workflow termina en error sin desplegar.
 */

const FORMATO_SHA = /^[0-9a-f]{40}$/;

/**
 * @typedef {'success' | 'failure' | 'cancelled' | 'en-curso' | string | null | undefined} EstadoCi
 *   Conclusión del CI de push sobre main de un commit; `en-curso` si no terminó y
 *   `null`/`undefined` si no hay ejecución.
 *
 * @typedef {object} Entrada
 * @property {'workflow_run' | 'workflow_dispatch'} evento
 * @property {'despliegue' | 'vuelta-atras'} modo
 * @property {string} sha               commit a desplegar
 * @property {boolean} enMain           si el commit está en la historia de main
 * @property {EstadoCi} ciDelSha        estado del CI de push del commit
 * @property {{ sha: string, ci: EstadoCi }[]} posteriores
 *   commits de main posteriores al SHA, del más viejo al más nuevo, con el estado de su CI
 *
 * @typedef {{ resultado: 'desplegar' | 'omitir' | 'rechazar', motivo: string }} Decision
 */

/**
 * @param {Entrada} entrada
 * @returns {Decision}
 */
export function decidirDespliegue(entrada) {
  const { evento, modo, sha, enMain, ciDelSha, posteriores = [] } = entrada;
  const rechazar = (motivo) => ({ resultado: 'rechazar', motivo });

  if (typeof sha !== 'string' || !FORMATO_SHA.test(sha)) {
    return rechazar(
      'El SHA tiene que ser el SHA completo del commit (40 caracteres hexadecimales en minúscula).',
    );
  }
  if (evento !== 'workflow_run' && evento !== 'workflow_dispatch') {
    return rechazar(`Evento no admitido para desplegar: ${evento}.`);
  }
  if (modo !== 'despliegue' && modo !== 'vuelta-atras') {
    return rechazar(`Modo desconocido: ${modo}.`);
  }
  if (!enMain) {
    return rechazar(`El commit ${sha} no está en la historia de main.`);
  }

  if (modo === 'vuelta-atras') {
    if (evento !== 'workflow_dispatch') {
      return rechazar(
        'Una vuelta atrás solo se pide a mano (workflow_dispatch).',
      );
    }
    // Sin regla de "superada": volver a una versión anterior es el objetivo. La instancia
    // exige además que el SHA figure en su historial (desplegar.sh).
    return {
      resultado: 'desplegar',
      motivo: `Vuelta atrás a ${sha}, que está en main.`,
    };
  }

  if (ciDelSha !== 'success') {
    return rechazar(
      `El CI de push sobre main del commit ${sha} no terminó en verde (estado: ${ciDelSha ?? 'sin ejecución'}).`,
    );
  }

  // El más nuevo de los posteriores con el CI en verde, si hay alguno.
  const verdePosterior = [...posteriores]
    .reverse()
    .find((p) => p.ci === 'success');
  if (verdePosterior) {
    const motivo = `Versión superada por ${verdePosterior.sha}, que también tiene el CI en verde.`;
    // Automático: termina en verde sin desplegar (ese commit dispara su propio despliegue).
    // Manual: se rechaza, para no desplegar a mano una versión más vieja que la vigente.
    return evento === 'workflow_run'
      ? { resultado: 'omitir', motivo }
      : rechazar(
          `${motivo} Para volver a una versión anterior, usá modo=vuelta-atras.`,
        );
  }

  return {
    resultado: 'desplegar',
    motivo: `Se despliega ${sha}: está en main, su CI terminó en verde y no hay un commit posterior verde.`,
  };
}

/**
 * Estado del CI por commit a partir de las ejecuciones del workflow `CI` (evento push, rama
 * main) que devuelve la API, ordenadas de la más nueva a la más vieja. Cuenta la más reciente
 * de cada commit: un re-run en curso pisa a un fallo anterior.
 *
 * @param {{ head_sha: string, status: string, conclusion: string | null }[]} runs
 * @returns {Map<string, EstadoCi>}
 */
export function estadoCiPorSha(runs) {
  const estado = new Map();
  for (const run of runs) {
    if (estado.has(run.head_sha)) continue;
    estado.set(
      run.head_sha,
      run.status === 'completed' ? run.conclusion : 'en-curso',
    );
  }
  return estado;
}

/**
 * Lee la respuesta de `GET /repos/{repo}/compare/{sha}...main`. `ahead` significa que main
 * tiene commits que el SHA no tiene, es decir, que el SHA es ancestro de main; `identical`, que
 * es la punta. `commits` son los posteriores, del más viejo al más nuevo.
 *
 * @param {{ status: string, commits: { sha: string }[] }} compare
 * @returns {{ enMain: boolean, posteriores: string[] }}
 */
export function datosDeCompare(compare) {
  const enMain = compare.status === 'ahead' || compare.status === 'identical';
  return {
    enMain,
    posteriores: enMain ? compare.commits.map((c) => c.sha) : [],
  };
}
