/**
 * Tests de la comparacion de contratos OpenAPI (scripts/openapi-diff.mjs).
 *
 * Corren con `node --test`, sin dependencias: node:test viene con Node 20.
 *
 * Ojo: el script `test:scripts` lista los archivos de test uno por uno en vez de usar un glob.
 * `node --test` no soporta patrones glob hasta Node 21 y este proyecto corre sobre Node 20 (§10),
 * asi que un glob funciona en una maquina con Node reciente y falla en CI. Si agregas otro
 * archivo de test, sumalo al script en el package.json de la raiz.
 *
 * La seccion 9 de openspec/config.yaml exige que todo bug corregido sume un test que falle sin
 * el fix. Cada bloque de abajo corresponde a un hallazgo real del review del change
 * `fundacion-repo`, y esta anotado con cual.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { claveDeElemento, diffSpecs, jsonCanonico } from './openapi-diff.mjs';

/** Arma un documento OpenAPI minimo con un solo GET en la ruta dada. */
const doc = (operacion, ruta = '/reservas') => ({ paths: { [ruta]: { get: operacion } } });

test('dos documentos identicos no reportan deriva', () => {
  const d = doc({ operationId: 'x', tags: ['Reservas'], responses: { 200: { description: 'ok' } } });
  assert.deepEqual(diffSpecs(d, d), []);
});

test('detecta un endpoint que el backend expone y el YAML no declara', () => {
  const diferencias = diffSpecs(doc({ operationId: 'x' }), { paths: {} });
  assert.equal(diferencias.length, 1);
  assert.match(diferencias[0], /el backend expone .*\/reservas.* y no está en el YAML/);
});

test('detecta un endpoint que el YAML declara y el backend no expone', () => {
  const diferencias = diffSpecs({ paths: {} }, doc({ operationId: 'x' }));
  assert.equal(diferencias.length, 1);
  assert.match(diferencias[0], /el YAML declara/);
});

// --- Hallazgo: `required` comparado literalmente daba rojos falsos --------------------------
// NestJS emite `required` en el orden de declaracion de las propiedades del DTO; el YAML a
// mano casi nunca coincide. Sin el fix, este test falla.

test('el orden de `required` no cuenta como deriva', () => {
  const generado = { components: { schemas: { Reserva: { required: ['fecha', 'zonaId'] } } } };
  const yaml = { components: { schemas: { Reserva: { required: ['zonaId', 'fecha'] } } } };
  assert.deepEqual(diffSpecs(generado, yaml), []);
});

test('el orden de `tags` y de `enum` tampoco cuenta como deriva', () => {
  const generado = doc({ tags: ['Estado', 'Salud'], responses: { 200: { schema: { enum: ['A', 'B'] } } } });
  const yaml = doc({ tags: ['Salud', 'Estado'], responses: { 200: { schema: { enum: ['B', 'A'] } } } });
  assert.deepEqual(diffSpecs(generado, yaml), []);
});

test('un valor faltante en `required` SI se sigue detectando', () => {
  const generado = { components: { schemas: { R: { required: ['fecha', 'zonaId'] } } } };
  const yaml = { components: { schemas: { R: { required: ['fecha'] } } } };
  const diferencias = diffSpecs(generado, yaml);
  assert.ok(diferencias.some((l) => l.includes('zonaId')));
});

// --- Hallazgo: la comparacion como conjunto era demasiado amplia ----------------------------
// `example` y `default` tambien son arrays de strings, pero ahi el orden es dato. Sin el fix,
// este test falla porque la deriva pasaba desapercibida.

test('el orden de `example` SI cuenta: ahi la lista es dato, no presentacion', () => {
  const generado = { components: { schemas: { R: { example: ['almuerzo', 'cena'] } } } };
  const yaml = { components: { schemas: { R: { example: ['cena', 'almuerzo'] } } } };
  const diferencias = diffSpecs(generado, yaml);
  assert.ok(diferencias.length > 0, 'un cambio de orden en `example` tiene que reportarse');
  assert.ok(diferencias.some((l) => l.includes('example[0]')));
});

test('el orden de `default` tambien cuenta', () => {
  const generado = { components: { schemas: { R: { default: ['a', 'b'] } } } };
  const yaml = { components: { schemas: { R: { default: ['b', 'a'] } } } };
  assert.ok(diffSpecs(generado, yaml).length > 0);
});

// --- Hallazgo: un `enum` numerico caia en la comparacion posicional -------------------------
// La guarda pedia que TODOS los elementos fueran strings, asi que enum: [1,2] no entraba por
// la rama sin orden. Sin el fix, este test falla.

test('el orden de un `enum` numerico tampoco cuenta como deriva', () => {
  const generado = { components: { schemas: { R: { enum: [1, 2, 3] } } } };
  const yaml = { components: { schemas: { R: { enum: [3, 1, 2] } } } };
  assert.deepEqual(diffSpecs(generado, yaml), []);
});

test('en un `enum` el numero 1 y el string "1" no son lo mismo', () => {
  const generado = { components: { schemas: { R: { enum: [1] } } } };
  const yaml = { components: { schemas: { R: { enum: ['1'] } } } };
  assert.ok(diffSpecs(generado, yaml).length > 0);
});

// --- Hallazgo: `example` con objetos se emparejaba por identidad ----------------------------
// El emparejamiento por identidad aplicaba a cualquier lista con objetos, no solo a las que no
// tienen orden semantico. Sin el fix, este test falla: la deriva pasaba desapercibida.

test('el orden de un `example` con objetos adentro SI cuenta como deriva', () => {
  const generado = { components: { schemas: { R: { example: [{ zona: 'VIP' }, { zona: 'STANDARD' }] } } } };
  const yaml = { components: { schemas: { R: { example: [{ zona: 'STANDARD' }, { zona: 'VIP' }] } } } };
  assert.ok(diffSpecs(generado, yaml).length > 0, 'reordenar un example es deriva');
});

test('el orden de `security` NO cuenta: es un conjunto de opciones', () => {
  const generado = doc({ security: [{ bearerAuth: [] }, { apiKey: [] }] });
  const yaml = doc({ security: [{ apiKey: [] }, { bearerAuth: [] }] });
  assert.deepEqual(diffSpecs(generado, yaml), []);
});

// --- Hallazgo: los duplicados de objetos se colapsaban en un Map ----------------------------
// Indexar por clave descartaba las repeticiones, asi que un parametro duplicado en el backend
// pasaba como "sin deriva". Sin el fix, este test falla.

test('un `parameters` duplicado en el backend se detecta', () => {
  const p = { name: 'fecha', in: 'query', schema: { type: 'string' } };
  const generado = doc({ parameters: [p, p] });
  const yaml = doc({ parameters: [p] });
  const diferencias = diffSpecs(generado, yaml);
  assert.ok(diferencias.length > 0, 'un duplicado no puede pasar como sin deriva');
  assert.ok(diferencias.some((l) => /aparece 2 vez\/veces .* y 1 /.test(l)));
});

// --- Hallazgo: los arrays de objetos se comparaban por posicion -----------------------------
// `parameters` se identifica por `name` + `in` y la spec no le define orden. Sin el fix, este
// test falla reportando los dos parametros como distintos.

test('el orden de `parameters` no cuenta como deriva', () => {
  const p = (name) => ({ name, in: 'query', required: true, schema: { type: 'string' } });
  const generado = doc({ parameters: [p('fecha'), p('zonaId')] });
  const yaml = doc({ parameters: [p('zonaId'), p('fecha')] });
  assert.deepEqual(diffSpecs(generado, yaml), []);
});

test('un `parameters` que falta en el YAML SI se detecta, aunque cambie el orden', () => {
  const p = (name) => ({ name, in: 'query', schema: { type: 'string' } });
  const generado = doc({ parameters: [p('fecha'), p('zonaId')] });
  const yaml = doc({ parameters: [p('fecha')] });
  const diferencias = diffSpecs(generado, yaml);
  assert.ok(diferencias.some((l) => l.includes('zonaId')));
});

test('una diferencia dentro de un parametro emparejado se reporta con su nombre', () => {
  const generado = doc({ parameters: [{ name: 'fecha', in: 'query', required: true }] });
  const yaml = doc({ parameters: [{ name: 'fecha', in: 'query', required: false }] });
  const diferencias = diffSpecs(generado, yaml);
  assert.ok(diferencias.some((l) => l.includes('param:query:fecha')));
});

// --- Hallazgo: duplicados daban un titulo sin detalle ---------------------------------------
// La deteccion usaba multiconjunto y el detalle usaba pertenencia a conjunto, asi que
// ["a","a"] contra ["a"] reportaba "difiere" sin decir que. Sin el fix, este test falla.

test('un valor duplicado se reporta con el detalle de cuantas veces aparece de cada lado', () => {
  const generado = { components: { schemas: { R: { required: ['a', 'a'] } } } };
  const yaml = { components: { schemas: { R: { required: ['a'] } } } };
  const diferencias = diffSpecs(generado, yaml);
  assert.ok(diferencias.length > 1, 'tiene que haber titulo y al menos una linea de detalle');
  assert.ok(diferencias.some((l) => /aparece 2 vez\/veces .* y 1 /.test(l)));
});

// --- Helpers --------------------------------------------------------------------------------

test('jsonCanonico ignora el orden de las claves de un objeto', () => {
  assert.equal(jsonCanonico({ b: 1, a: 2 }), jsonCanonico({ a: 2, b: 1 }));
});

test('claveDeElemento identifica un parametro por name + in', () => {
  assert.equal(claveDeElemento({ name: 'fecha', in: 'query' }), 'param:query:fecha');
  assert.equal(claveDeElemento({ name: 'fecha', in: 'path' }), 'param:path:fecha');
});

test('claveDeElemento cae al JSON canonico cuando no hay con que identificar', () => {
  assert.equal(claveDeElemento({ bearerAuth: [] }), 'json:{"bearerAuth":[]}');
});
