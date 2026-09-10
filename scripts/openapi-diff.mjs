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

// Campos cuyas listas de valores primitivos NO tienen orden semantico: ["fecha","zonaId"] y
// ["zonaId","fecha"] declaran exactamente lo mismo, y lo mismo vale para un enum numerico.
//
// La lista es deliberadamente corta. Otros campos que tambien son arrays —`example`,
// `default`, `examples`, `prefixItems`— SI tienen orden significativo: ahi el orden es dato, y
// compararlos sin orden dejaria pasar deriva real del contrato.
export const LISTAS_SIN_ORDEN = new Set(['required', 'enum', 'tags']);

// Lo mismo, para listas de objetos. La spec no le define orden a ninguna de estas:
// `parameters` se identifica por `name` + `in`, `security` y `servers` son conjuntos de
// opciones, y en JSON Schema `allOf`/`anyOf`/`oneOf` son conjunciones y disyunciones.
//
// Cualquier lista de objetos que NO este aca se compara por posicion, porque un `example` con
// objetos adentro es dato: reordenarlo cambia lo que el contrato declara.
export const LISTAS_OBJETOS_SIN_ORDEN = new Set([
  'parameters',
  'security',
  'servers',
  'allOf',
  'anyOf',
  'oneOf',
]);

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

/** Agrupa los elementos por una clave, conservando cuantas veces aparece cada una. */
function agruparPorClave(arr, clave) {
  const m = new Map();
  for (const el of arr) {
    const k = clave(el);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(el);
  }
  return m;
}

function diffArrays(generated, committed, keyPath, out) {
  const campo = nombreDeCampo(keyPath);
  const esPrimitivo = (x) => x === null || ['string', 'number', 'boolean'].includes(typeof x);
  const todosPrimitivos = (a) => a.every(esPrimitivo);

  // 1. Listas de primitivos sin orden (`required`, `enum`, `tags`). Se comparan como
  //    multiconjuntos: cuenta cuantas veces aparece cada valor de cada lado, para que un
  //    duplicado tambien se reporte con detalle en vez de dar un titulo sin cuerpo.
  //    La clave es el JSON canonico y no el valor crudo, asi el numero 1 no se confunde con
  //    el string "1", que en un contrato son cosas distintas.
  if (LISTAS_SIN_ORDEN.has(campo) && todosPrimitivos(generated) && todosPrimitivos(committed)) {
    const g = agruparPorClave(generated, jsonCanonico);
    const c = agruparPorClave(committed, jsonCanonico);
    const lineas = [];
    for (const clave of new Set([...g.keys(), ...c.keys()])) {
      const ng = g.get(clave)?.length ?? 0;
      const nc = c.get(clave)?.length ?? 0;
      if (ng === nc) continue;
      if (nc === 0) lineas.push(`      el backend expone ${clave} y el YAML no lo declara`);
      else if (ng === 0) lineas.push(`      el YAML declara ${clave} y el backend no lo expone`);
      else lineas.push(`      ${clave} aparece ${ng} vez/veces en el backend y ${nc} en el YAML`);
    }
    if (lineas.length) {
      out.push(`  - "${keyPath}" difiere (comparado sin tener en cuenta el orden):`);
      out.push(...lineas);
    }
    return;
  }

  // 2. Listas de objetos sin orden (`parameters`, `security`, ...). Se emparejan por identidad
  //    en vez de por posicion, contando ocurrencias para que un elemento duplicado de un lado
  //    no quede tapado al colapsarse contra el mismo elemento del otro.
  if (LISTAS_OBJETOS_SIN_ORDEN.has(campo)) {
    const g = agruparPorClave(generated, claveDeElemento);
    const c = agruparPorClave(committed, claveDeElemento);
    for (const clave of new Set([...g.keys(), ...c.keys()])) {
      const enG = g.get(clave) ?? [];
      const enC = c.get(clave) ?? [];
      const ruta = `${keyPath}[${clave}]`;
      if (enC.length === 0) {
        out.push(`  - el backend expone "${ruta}" y no está en el YAML`);
      } else if (enG.length === 0) {
        out.push(`  - el YAML declara "${ruta}" y el backend no lo expone`);
      } else {
        if (enG.length !== enC.length) {
          out.push(
            `  - "${ruta}" aparece ${enG.length} vez/veces en el backend y ${enC.length} en el YAML`,
          );
        }
        // Con la misma identidad todavia pueden diferir por dentro (por ejemplo un parametro
        // que cambio de `required`), asi que se comparan los pares que existen de los dos lados.
        for (let i = 0; i < Math.min(enG.length, enC.length); i++) {
          diff(enG[i], enC[i], ruta, out);
        }
      }
    }
    return;
  }

  // 3. Cualquier otra lista (`example`, `default`, `prefixItems`): el orden es dato, asi que
  //    se compara posicion por posicion, tenga objetos adentro o no.
  const largo = Math.max(generated.length, committed.length);
  for (let i = 0; i < largo; i++) {
    const ruta = `${keyPath}[${i}]`;
    if (i >= committed.length) {
      out.push(`  - el backend expone "${ruta}" y no está en el YAML`);
    } else if (i >= generated.length) {
      out.push(`  - el YAML declara "${ruta}" y el backend no lo expone`);
    } else {
      diff(generated[i], committed[i], ruta, out);
    }
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
