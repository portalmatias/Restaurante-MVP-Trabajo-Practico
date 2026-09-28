#!/usr/bin/env node
/**
 * Chequea que `src/lib/api/schema.d.ts` (commiteado) está al día con `openapi/openapi.yaml`
 * (D5 de openspec/changes/frontend-base/design.md).
 *
 * Reemplaza un one-liner de shell POSIX (`mktemp` + `diff`) que no corre en `cmd` de Windows, y
 * evita `npx openapi-typescript` (que podría resolver una versión distinta de la instalada en
 * `node_modules` si el binario local no estuviera ya cacheado). Usa en cambio la API
 * programática del paquete YA instalado en este repo: `openapiTS` + `astToString`, ver
 * `node_modules/openapi-typescript/dist/index.d.ts`. Es la misma API que usa internamente la
 * CLI del paquete (`node_modules/openapi-typescript/bin/cli.js`, función `generateSchema`), así
 * que el resultado es el mismo que genera `npm run api:types -w frontend`.
 */
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createConfig } from "@redocly/openapi-core";
import openapiTS, { astToString, COMMENT_HEADER } from "openapi-typescript";

const raizFrontend = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rutaContrato = resolve(raizFrontend, "../openapi/openapi.yaml");
const rutaSchemaCommiteado = resolve(raizFrontend, "src/lib/api/schema.d.ts");
const rutaTemporal = join(tmpdir(), `api-types-check-${process.pid}-${Date.now()}.d.ts`);

// CRLF vs LF no debe contar como una diferencia real del contenido generado.
function normalizarSaltosDeLinea(texto) {
  return texto.replace(/\r\n/g, "\n");
}

async function generarSchema() {
  // Misma resolución de config que usa la CLI cuando no hay `redocly.yaml` en el repo (ver
  // `findRedocConfigPath` + `main` en bin/cli.js): sin archivo de config, usa el preset
  // "minimal". Se pasa explícito para no depender del default interno de `openapiTS`, que
  // agrega una regla adicional (`operation-operationId-unique`) que la CLI no aplica por
  // defecto.
  const redocly = await createConfig({}, { extends: ["minimal"] });
  const ast = await openapiTS(pathToFileURL(rutaContrato), { redocly, silent: false });
  return `${COMMENT_HEADER}${astToString(ast)}`;
}

async function main() {
  const generado = await generarSchema();
  writeFileSync(rutaTemporal, generado, "utf8");

  try {
    let commiteado;
    try {
      commiteado = readFileSync(rutaSchemaCommiteado, "utf8");
    } catch {
      console.error(
        `No se encontró ${rutaSchemaCommiteado}. Corré \`npm run api:types -w frontend\` para generarlo.`,
      );
      process.exitCode = 1;
      return;
    }

    if (normalizarSaltosDeLinea(generado) !== normalizarSaltosDeLinea(commiteado)) {
      console.error(
        "src/lib/api/schema.d.ts está desactualizado respecto de openapi/openapi.yaml. " +
          "Corré `npm run api:types -w frontend` y commiteá el resultado.",
      );
      process.exitCode = 1;
      return;
    }

    console.log("src/lib/api/schema.d.ts está al día con openapi/openapi.yaml.");
  } finally {
    rmSync(rutaTemporal, { force: true });
  }
}

main().catch((causa) => {
  console.error("No se pudo generar el chequeo de tipos de la API:", causa);
  process.exitCode = 1;
});
