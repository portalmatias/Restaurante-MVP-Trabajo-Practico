/**
 * Entrada del job `decidir` de .github/workflows/cd.yml (D4 de despliegue-continuo-ec2): lee
 * de la API de GitHub lo que necesita la decisión, llama a la función pura de
 * decidir-despliegue.mjs y escribe el resultado en las salidas del job.
 *
 * Variables de entorno (las pasa el workflow; los inputs del usuario llegan por acá y nunca se
 * interpolan en el código de un paso):
 *   GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_OUTPUT  las provee Actions
 *   EVENTO   workflow_run | workflow_dispatch
 *   MODO     despliegue | vuelta-atras
 *   SHA      commit a desplegar
 *
 * Termina en 1 si la decisión es `rechazar`; en 0 si es `desplegar` u `omitir`.
 */
import { appendFileSync } from 'node:fs';

import {
  datosDeCompare,
  decidirDespliegue,
  estadoCiPorSha,
} from './decidir-despliegue.mjs';

const API = 'https://api.github.com';
const { GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_OUTPUT, EVENTO, MODO, SHA } =
  process.env;

async function api(ruta, { nullSi404 = false } = {}) {
  const respuesta = await fetch(`${API}${ruta}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (nullSi404 && respuesta.status === 404) return null;
  if (!respuesta.ok) {
    throw new Error(
      `La API de GitHub respondió ${respuesta.status} en ${ruta}`,
    );
  }
  return respuesta.json();
}

function salida(nombre, valor) {
  if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `${nombre}=${valor}\n`);
}

async function main() {
  let decision;
  // El formato se valida antes de armar URLs con el valor.
  if (!/^[0-9a-f]{40}$/.test(SHA ?? '')) {
    decision = decidirDespliegue({ evento: EVENTO, modo: MODO, sha: SHA });
  } else {
    const repo = GITHUB_REPOSITORY;
    // 404: el commit no existe en el repositorio (por ejemplo, solo en un fork).
    const compare = await api(`/repos/${repo}/compare/${SHA}...main`, {
      nullSi404: true,
    });
    const { enMain, posteriores } = datosDeCompare(
      compare ?? { status: 'no-existe', commits: [] },
    );

    const filtro = 'branch=main&event=push';
    const delSha = await api(
      `/repos/${repo}/actions/workflows/ci.yml/runs?${filtro}&head_sha=${SHA}&per_page=20`,
    );
    const recientes = await api(
      `/repos/${repo}/actions/workflows/ci.yml/runs?${filtro}&per_page=100`,
    );
    const estado = estadoCiPorSha([
      ...recientes.workflow_runs,
      ...delSha.workflow_runs,
    ]);

    decision = decidirDespliegue({
      evento: EVENTO,
      modo: MODO,
      sha: SHA,
      enMain,
      ciDelSha: estadoCiPorSha(delSha.workflow_runs).get(SHA) ?? null,
      posteriores: posteriores.map((sha) => ({
        sha,
        ci: estado.get(sha) ?? null,
      })),
    });
  }

  salida('resultado', decision.resultado);
  salida('desplegar', decision.resultado === 'desplegar' ? 'true' : 'false');
  const nivel = decision.resultado === 'rechazar' ? 'error' : 'notice';
  console.log(`::${nivel} title=Decisión de despliegue::${decision.motivo}`);
  if (decision.resultado === 'rechazar') process.exitCode = 1;
}

main().catch((error) => {
  console.log(`::error title=Decisión de despliegue::${error.message}`);
  process.exitCode = 1;
});
