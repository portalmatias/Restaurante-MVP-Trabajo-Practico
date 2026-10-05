import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Nombres predefinidos de `proxy-addr` (la librería que usa Express para `trust proxy`) que
 * se admiten en `TRUST_PROXY`: los tres son bloques acotados de loopback o de red local.
 */
const NOMBRES_PERMITIDOS = new Set(['loopback', 'linklocal', 'uniquelocal']);

/**
 * Un octeto IPv4 en notación decimal simple, de 0 a 255 y sin ceros a la izquierda (`010`
 * se descarta: según quién lo interprete puede leerse como octal y apuntar a otra dirección).
 */
const OCTETO = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = `${OCTETO}(?:\\.${OCTETO}){3}`;

/** Una dirección IPv4 simple: `10.0.0.5`. */
const FORMATO_IPV4 = new RegExp(`^${IPV4}$`);

/**
 * Una subred IPv4 con prefijo de `/8` a `/32`: `10.0.0.0/8`. Un prefijo menor (como el
 * `/0` de `0.0.0.0/0`) abarca demasiadas direcciones para considerarlas un salto concreto.
 */
const FORMATO_SUBRED_IPV4 = new RegExp(`^${IPV4}/(?:3[0-2]|[12]\\d|[89])$`);

export const FORMATOS_ADMITIDOS =
  '`loopback`, `linklocal`, `uniquelocal`, una dirección IPv4 (`10.0.0.5`) o una subred IPv4 con prefijo `/8` o mayor (`10.0.0.0/8`)';

function esFormatoPermitido(elemento: string): boolean {
  return (
    NOMBRES_PERMITIDOS.has(elemento) ||
    FORMATO_IPV4.test(elemento) ||
    FORMATO_SUBRED_IPV4.test(elemento)
  );
}

/**
 * Valida el valor de `TRUST_PROXY` (design.md D3 de `exposicion-red-local`) y devuelve la
 * lista de saltos confiables que se le pasa a Express, o `undefined` si no hay que confiar en
 * ninguno (variable ausente o vacía, el default).
 *
 * Se valida **cada elemento** contra una lista de formatos permitidos, no contra una lista de
 * valores prohibidos:
 * - Validar solo el valor completo no alcanza: Express acepta `10.0.0.5,0.0.0.0/0`, y el
 *   catch-all escondido en la lista haría confiable a cualquier salto.
 * - Se rechaza toda notación IPv6: con `proxy-addr` hasta la 2.0.7 (GHSA-jqcg-44mw-7w3h),
 *   escrituras como `::/1` o `::ffff:10.0.0.0/8` se compilan sin error y coinciden con
 *   cualquier IPv4. Una lista de prohibidos no puede enumerar todas las variantes peligrosas.
 * - Se rechazan `true`, `*` y los números de saltos: confiar en todos o en "los N últimos"
 *   permite que un cliente invente su origen con `X-Forwarded-For`.
 *
 * Lanza un `Error` (no una excepción HTTP: corre al arrancar, antes de atender pedidos) para
 * que el backend no arranque con una configuración insegura.
 */
export function validarTrustProxy(
  valor: string | undefined,
): string[] | undefined {
  const recortado = valor?.trim();
  if (!recortado) {
    return undefined;
  }

  const elementos = recortado.split(',').map((elemento) => elemento.trim());
  const rechazados = elementos.filter(
    (elemento) => !esFormatoPermitido(elemento),
  );
  if (rechazados.length > 0) {
    const listado = rechazados.map((elemento) => `"${elemento}"`).join(', ');
    throw new Error(
      `TRUST_PROXY inválido (${listado}): hay que declarar los saltos confiables de forma explícita, uno por uno, nunca "todos" ni un número de saltos. Formatos admitidos: ${FORMATOS_ADMITIDOS}, separados por coma. Dejá TRUST_PROXY vacío para no confiar en ningún proxy.`,
    );
  }

  return elementos;
}

/**
 * Configuración de red del backend, compartida por `main.ts` y los tests e2e para que lo que
 * se prueba sea lo mismo que arranca (design.md D2 de `exposicion-red-local`).
 *
 * Sin `TRUST_PROXY`, no se configura `trust proxy`: Express toma `req.ip` (lo que usa
 * `ThrottlerGuard` para contar los límites) de la conexión e ignora `X-Forwarded-For`. Es lo
 * correcto detrás del proxy `/api` de Next, que reenvía ese encabezado tal cual lo manda el
 * cliente: confiar en él permitiría inventar un origen por pedido y saltear el límite contra
 * la fuerza bruta del login.
 *
 * @param valorTrustProxy por defecto, `process.env.TRUST_PROXY`; los tests lo pasan explícito.
 */
export function configurarRed(
  app: NestExpressApplication,
  valorTrustProxy: string | undefined = process.env.TRUST_PROXY,
): void {
  const saltosConfiables = validarTrustProxy(valorTrustProxy);
  if (saltosConfiables) {
    app.set('trust proxy', saltosConfiables);
  }
}
