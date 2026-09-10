/**
 * scripts/openapi-diff.mjs
 *
 * Comparacion de dos documentos OpenAPI para el chequeo de deriva del contrato (D1/D2 en
 * openspec/changes/fundacion-repo/design.md).
 *
 * Vive separado de `openapi-check.mjs` porque esa parte necesita levantar la app de NestJS,
 * y esto es logica pura: asi se puede testear sin build ni base de datos. Los tests estan en
 * `openapi-diff.test.mjs` y corren con `node --test`.
 *
 * La regla que guia todo el archivo: **una diferencia de orden solo es deriva si el orden es
 * dato**. En OpenAPI casi nunca lo es, y NestJS emite las listas en el orden en que estan
 * declaradas las propiedades del DTO, que casi nunca coincide con el orden en que estan
 * escritas a mano en el YAML.
 */

// Campos cuyas listas de strings NO tienen orden semantico: ["fecha","zonaId"] y
// ["zonaId","fecha"] declaran exactamente lo mismo.
//
// La lista es deliberadamente corta. Otros campos que tambien son arrays de strings
// —`example`, `default`, `examples`— SI tienen orden significativo: ahi el orden es dato, y
// compararlos como conjunto dejaria pasar deriva real del contrato.
export const LISTAS_SIN_ORDEN = new Set(['required', 'enum', 'tags']);

export function nombreDeCampo(keyPath) {
  const ultimo = keyPath.split('.').pop() ?? '';
  return ultimo.replace(/\[.*\]$/, '');
}

/** JSON con las claves ordenadas, para usarlo como identidad estable de un elemento. */
export function jsonCanonico(valor) {
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(',')}]`;
  if (valor && typeof valor === 'object') {
    const pares = Object.keys(valor)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${jsonCanonico(valor[k])}`);
    return `{${pares.join(',')}}`;
  }
  return JSON.stringify(valor) ?? 'null';
}

/**
 * Identidad de un elemento dentro de una lista de objetos de OpenAPI.
 *
 * La spec identifica los `parameters` por `name` + `in` y no define un orden para la lista,
 * asi que emparejarlos por posicion daria el mismo rojo falso que se evita en las listas de
 * strings. Si el elemento no trae con que identificarse, se cae al JSON canonico completo.
 */
export function claveDeElemento(el) {
  if (el && typeof el === 'object' && !Array.isArray(el)) {
    if (typeof el.name === 'string' && typeof el.in === 'string') return `param:${el.in}:${el.name}`;
    if (typeof el.name === 'string') return `name:${el.name}`;
    if (typeof el.url === 'string') return `url:${el.url}`;
  }
  return `json:${jsonCanonico(el)}`;
}

function diffArrays(generated, committed, keyPath, out) {
  const soloStrings = (a) => a.every((x) => typeof x === 'string');

  if (
    LISTAS_SIN_ORDEN.has(nombreDeCampo(keyPath)) &&
    soloStrings(generated) &&
    soloStrings(committed)
  ) {
    // Comparacion por multiconjunto: cuenta cuantas veces aparece cada valor de cada lado,
    // para que un duplicado tambien se reporte con detalle en vez de dar un titulo sin cuerpo.
    const contar = (arr) => arr.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map());
    const g = contar(generated);
    const c = contar(committed);
    const lineas = [];
    for (const valor of new Set([...g.keys(), ...c.keys()])) {
      const ng = g.get(valor) ?? 0;
      const nc = c.get(valor) ?? 0;
      if (ng === nc) continue;
      if (nc === 0) lineas.push(`      el backend expone "${valor}" y el YAML no lo declara`);
      else if (ng === 0) lineas.push(`      el YAML declara "${valor}" y el backend no lo expone`);
      else lineas.push(`      "${valor}" aparece ${ng} vez/veces en el backend y ${nc} en el YAML`);
    }
    if (lineas.length) {
      out.push(`  - "${keyPath}" difiere (comparado sin tener en cuenta el orden):`);
      out.push(...lineas);
    }
    return;
  }

  // Listas de objetos: se emparejan por identidad, no por posicion, y se compara cada par.
  const hayObjetos =
    generated.some((x) => x && typeof x === 'object') ||
    committed.some((x) => x && typeof x === 'object');
  if (hayObjetos) {
    const indexar = (arr) => new Map(arr.map((el) => [claveDeElemento(el), el]));
    const g = indexar(generated);
    const c = indexar(committed);
    for (const clave of new Set([...g.keys(), ...c.keys()])) {
      const enG = g.has(clave);
      const enC = c.has(clave);
      const ruta = `${keyPath}[${clave}]`;
      if (enG && !enC) out.push(`  - el backend expone "${ruta}" y no está en el YAML`);
      else if (!enG && enC) out.push(`  - el YAML declara "${ruta}" y el backend no lo expone`);
      else diff(g.get(clave), c.get(clave), ruta, out);
    }
    return;
  }

  // Cualquier otro array (`example`, `default`, listas de numeros): el orden es dato.
  if (jsonCanonico(generated) !== jsonCanonico(committed)) {
    out.push(`  - "${keyPath}" difiere (el orden de esta lista sí es significativo):`);
    out.push(`      generado por el backend: ${JSON.stringify(generated)}`);
    out.push(`      declarado en el YAML:    ${JSON.stringify(committed)}`);
  }
}

/** Diff recursivo pensado para mensajes de CI legibles, no para uso general. */
export function diff(generated, committed, keyPath, out) {
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

  if (Array.isArray(generated) && Array.isArray(committed)) {
    diffArrays(generated, committed, keyPath, out);
    return;
  }

  if (jsonCanonico(generated) !== jsonCanonico(committed)) {
    out.push(`  - "${keyPath || '(raíz)'}" difiere:`);
    out.push(`      generado por el backend: ${JSON.stringify(generated)}`);
    out.push(`      declarado en el YAML:    ${JSON.stringify(committed)}`);
  }
}

/**
 * Compara los dos documentos y devuelve las lineas de diferencia. Vacio = sin deriva.
 *
 * Alcance: SOLO `paths` y `components.schemas`. `info`, `servers` y `securitySchemes` son
 * metadata editorial del YAML escrito a mano y siempre van a diferir de lo que genera Nest;
 * compararlos daria rojos falsos permanentes (ver el alcance del diff de D1).
 */
export function diffSpecs(generated, committed) {
  const recorte = (doc) => ({
    paths: doc?.paths ?? {},
    schemas: doc?.components?.schemas ?? {},
  });
  const diferencias = [];
  diff(recorte(generated), recorte(committed), '', diferencias);
  return diferencias;
}
