#!/usr/bin/env node
/**
 * Chequea que `src/lib/api/schema.d.ts` (commiteado) está al día con `openapi/openapi.yaml`
 * (D5 de openspec/changes/frontend-base/design.md).
 *
 * Genera a un archivo temporal con el MISMO binario local de `openapi-typescript` que usa
 * `npm run api:types` (resuelto desde `node_modules`, sin `npx`, que podría descargar otra
 * versión) y lo compara con el commiteado. Es un script de Node y no un one-liner de shell para
 * que corra igual en Linux, macOS y Windows.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raizFrontend = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rutaContrato = resolve(raizFrontend, "../openapi/openapi.yaml");
const rutaSchemaCommiteado = resolve(raizFrontend, "src/lib/api/schema.d.ts");
const rutaTemporal = join(tmpdir(), `api-types-check-${process.pid}-${Date.now()}.d.ts`);

const require = createRequire(import.meta.url);
const cliOpenapiTypescript = join(
  dirname(require.resolve("openapi-typescript/package.json")),
  "bin/cli.js",
);

// CRLF vs LF no debe contar como una diferencia real del contenido generado.
function lineas(texto) {
  return texto.replace(/\r\n/g, "\n").split("\n");
}

function primeraDiferencia(esperado, actual) {
  const largo = Math.max(esperado.length, actual.length);
  for (let i = 0; i < largo; i++) {
    if (esperado[i] !== actual[i]) {
      return { linea: i + 1, generado: esperado[i] ?? "(fin del archivo)", commiteado: actual[i] ?? "(fin del archivo)" };
    }
  }
  return null;
}

function main() {
  const generacion = spawnSync(
    process.execPath,
    [cliOpenapiTypescript, rutaContrato, "-o", rutaTemporal],
    { encoding: "utf8" },
  );
  if (generacion.status !== 0) {
    console.error("No se pudieron generar los tipos de la API:", generacion.stderr || generacion.error);
    return 1;
  }

  let commiteado;
  try {
    commiteado = readFileSync(rutaSchemaCommiteado, "utf8");
  } catch {
    console.error(
      `No se encontró ${rutaSchemaCommiteado}. Ejecute \`npm run api:types -w frontend\` para generarlo.`,
    );
    return 1;
  }

  const diferencia = primeraDiferencia(lineas(readFileSync(rutaTemporal, "utf8")), lineas(commiteado));
  if (diferencia) {
    console.error(
      "src/lib/api/schema.d.ts está desactualizado respecto de openapi/openapi.yaml. " +
        "Ejecute `npm run api:types -w frontend` y commitee el resultado.\n" +
        `Primera diferencia en la línea ${diferencia.linea}:\n` +
        `  generado:   ${diferencia.generado}\n` +
        `  commiteado: ${diferencia.commiteado}`,
    );
    return 1;
  }

  console.log("src/lib/api/schema.d.ts está al día con openapi/openapi.yaml.");
  return 0;
}

try {
  process.exitCode = main();
} finally {
  rmSync(rutaTemporal, { force: true });
}
