#!/usr/bin/env node
/**
 * scripts/openapi-check.mjs
 *
 * Chequeo de deriva del contrato OpenAPI — D1/D2 en
 * openspec/changes/fundacion-repo/design.md.
 *
 * `openapi/openapi.yaml`, escrito a mano, es la fuente de verdad del contrato
 * (contract-first). Este script levanta la app de NestJS (sin escuchar en un puerto:
 * nunca se llama `app.listen()`), genera el documento OpenAPI con `@nestjs/swagger`,
 * y lo compara contra el YAML commiteado.
 *
 * Alcance de la comparación: SOLO `paths` y `components.schemas`.
 * `info`, `servers` y `components.securitySchemes` son metadata editorial del YAML a
 * mano (título/descripción en español, URLs de servidor, esquema de bearer JWT) y
 * siempre van a diferir de lo que genera Nest por defecto — compararlas daría falsos
 * rojos permanentes (ver design.md, alcance del diff de D1).
 *
 * Exit code 0 si no hay deriva; distinto de 0 si la hay, o si no se pudo generar el
 * spec (por ejemplo porque el backend todavía no existe o no está compilado).
 */

import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const OPENAPI_PATH = path.join(ROOT, 'openapi', 'openapi.yaml');

// El outDir/rootDir exacto que termine usando el tsconfig de `nest new` decide si el
// build cae en dist/app.module.js o dist/src/app.module.js. Probamos ambos.
const APP_MODULE_CANDIDATES = [
  'backend/dist/app.module.js',
  'backend/dist/src/app.module.js',
];

function fail(message) {
  console.error(`\n✖ openapi:check — ${message}\n`);
  process.exit(1);
}

function findCompiledAppModule() {
  for (const rel of APP_MODULE_CANDIDATES) {
    const abs = path.join(ROOT, rel);
    if (existsSync(abs)) return abs;
  }
  return null;
}

async function loadCommittedSpec() {
  if (!existsSync(OPENAPI_PATH)) {
    fail(`no se encontró ${OPENAPI_PATH}`);
  }

  let yaml;
  try {
    ({ default: yaml } = await import('js-yaml'));
  } catch (err) {
    fail(
      'no se pudo cargar "js-yaml" para parsear openapi/openapi.yaml. Viene como ' +
        'dependencia transitiva de @nestjs/swagger; corré "npm install" desde la raíz. ' +
        `Detalle: ${err.message}`,
    );
  }

  const raw = readFileSync(OPENAPI_PATH, 'utf8');
  try {
    return yaml.load(raw);
  } catch (err) {
    fail(`openapi/openapi.yaml no es YAML válido: ${err.message}`);
  }
  return undefined;
}

// Diff recursivo simple pensado para mensajes de CI legibles, no para uso general.
function diff(generated, committed, keyPath, out) {
  const genIsObj = generated && typeof generated === 'object' && !Array.isArray(generated);
  const comIsObj = committed && typeof committed === 'object' && !Array.isArray(committed);

  if (genIsObj && comIsObj) {
    const keys = new Set([...Object.keys(generated), ...Object.keys(committed)]);
    for (const key of keys) {
      const childPath = keyPath ? `${keyPath}.${key}` : key;
      const inGen = Object.prototype.hasOwnProperty.call(generated, key);
      const inCom = Object.prototype.hasOwnProperty.call(committed, key);
      if (inGen && !inCom) {
        out.push(`  - el backend expone "${childPath}" y no está en el YAML`);
      } else if (!inGen && inCom) {
        out.push(`  - el YAML declara "${childPath}" y el backend no lo expone`);
      } else {
        diff(generated[key], committed[key], childPath, out);
      }
    }
    return;
  }

  // Las listas de strings de OpenAPI (`required`, `tags`, `enum`, `security`) no tienen
  // orden semantico: ["fecha","zonaId"] y ["zonaId","fecha"] declaran lo mismo. NestJS las
  // emite en el orden en que estan declaradas las propiedades del DTO, que casi nunca va a
  // coincidir con el orden en que estan escritas a mano en el YAML. Compararlas literalmente
  // daria rojos falsos en cuanto aparezca el primer DTO, asi que se comparan como conjuntos.
  if (Array.isArray(generated) && Array.isArray(committed)) {
    const soloStrings = (a) => a.every((x) => typeof x === 'string');
    if (soloStrings(generated) && soloStrings(committed)) {
      const g = [...generated].sort();
      const c = [...committed].sort();
      if (JSON.stringify(g) !== JSON.stringify(c)) {
        out.push(`  - "${keyPath}" difiere (comparado sin tener en cuenta el orden):`);
        const faltan = g.filter((x) => !c.includes(x));
        const sobran = c.filter((x) => !g.includes(x));
        if (faltan.length) out.push(`      el backend expone y el YAML no declara: ${faltan.join(', ')}`);
        if (sobran.length) out.push(`      el YAML declara y el backend no expone: ${sobran.join(', ')}`);
      }
      return;
    }

    // Listas de objetos (por ejemplo `parameters`): aca el indice si importa para poder
    // señalar cual difiere, asi que se recorre posicion por posicion.
    const largo = Math.max(generated.length, committed.length);
    for (let i = 0; i < largo; i++) {
      diff(generated[i], committed[i], `${keyPath}[${i}]`, out);
    }
    return;
  }

  const same = JSON.stringify(generated) === JSON.stringify(committed);
  if (!same) {
    out.push(`  - "${keyPath || '(raíz)'}" difiere:`);
    out.push(`      generado por el backend: ${JSON.stringify(generated)}`);
    out.push(`      declarado en el YAML:    ${JSON.stringify(committed)}`);
  }
}

async function generateSpecFromBackend() {
  const appModulePath = findCompiledAppModule();
  if (!appModulePath) {
    fail(
      'no se encontró la salida compilada del backend (backend/dist/app.module.js). ' +
        'Corré "npm run build -w backend" antes de este chequeo.',
    );
  }

  let NestFactory;
  let SwaggerModule;
  let DocumentBuilder;
  let AppModule;
  try {
    ({ NestFactory } = await import('@nestjs/core'));
    ({ SwaggerModule, DocumentBuilder } = await import('@nestjs/swagger'));
    ({ AppModule } = await import(pathToFileURL(appModulePath).href));
  } catch (err) {
    fail(`no se pudo cargar la app de Nest para generar el spec: ${err.message}`);
  }

  let app;
  try {
    // NestFactory.create ya registra módulos, controllers y DTOs: alcanza para que
    // SwaggerModule pueda generar el documento. Nunca se llama app.listen().
    app = await NestFactory.create(AppModule, { logger: false });
    const config = new DocumentBuilder()
      .setTitle('openapi-check')
      .setDescription('Documento generado solo para comparar contra el contrato commiteado.')
      .setVersion('0.0.0')
      .build();
    return SwaggerModule.createDocument(app, config);
  } catch (err) {
    fail(`no se pudo generar el documento OpenAPI desde el backend: ${err.message}`);
    return undefined;
  } finally {
    if (app) await app.close();
  }
}

async function main() {
  const committed = await loadCommittedSpec();
  const generated = await generateSpecFromBackend();

  const generatedSlice = {
    paths: generated.paths ?? {},
    schemas: generated.components?.schemas ?? {},
  };
  const committedSlice = {
    paths: committed.paths ?? {},
    schemas: committed.components?.schemas ?? {},
  };

  const differences = [];
  diff(generatedSlice, committedSlice, '', differences);

  if (differences.length > 0) {
    console.error(
      '\n✖ openapi:check — el backend se desvió del contrato de openapi/openapi.yaml:\n',
    );
    console.error(differences.join('\n'));
    console.error(
      '\nActualizá openapi/openapi.yaml para reflejar el backend, o corregí el backend ' +
        'para que cumpla el contrato ya publicado (contract-first, D1).\n',
    );
    process.exit(1);
  }

  console.log(
    '✔ openapi:check — el backend no se desvía de openapi/openapi.yaml (paths y components.schemas).',
  );
}

main().catch((err) => {
  fail(err.stack || String(err));
});
