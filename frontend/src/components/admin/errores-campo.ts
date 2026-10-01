import type { ErrorApi } from "../../lib/api/errors";

export type ReglaCampo = {
  /** Reconoce los mensajes del backend que corresponden a este campo. */
  coincide: RegExp;
  /**
   * Texto propio para los mensajes del `ValidationPipe`, que llegan en inglés y empiezan con el
   * nombre de la propiedad (`"capacidad must not be less than 1"`). Los mensajes de reglas de
   * negocio ya vienen en español y se muestran tal cual.
   */
  textoPorDefecto: string;
};

export type ErroresFormulario<C extends string> = {
  porCampo: Partial<Record<C, string>>;
  /** Mensajes que no corresponden a ningún campo: van en un aviso general del formulario. */
  general?: string;
};

// `ValidationPipe` de class-validator: `<propiedad> must ...`, `<propiedad> should ...`.
const MENSAJE_DE_VALIDATION_PIPE = /^[a-z][A-Za-z]*\s/;

/**
 * Reparte un `ErrorApi` entre los campos de un formulario (design.md D8): cada mensaje de un
 * `400` va junto al campo que reconoce su regla; `404`/`409` también se ubican en un campo si
 * su mensaje lo nombra (por ejemplo, la etiqueta duplicada de una Mesa). Lo que no se reconoce
 * queda como aviso general.
 */
export function repartirErrores<C extends string>(
  error: ErrorApi,
  reglas: Record<C, ReglaCampo>,
): ErroresFormulario<C> {
  const mensajes = error.tipo === "validacion" ? error.mensajes : [error.mensaje];
  const porCampo: Partial<Record<C, string>> = {};
  const generales: string[] = [];

  for (const mensaje of mensajes) {
    const campo = (Object.keys(reglas) as C[]).find((c) => reglas[c].coincide.test(mensaje));
    if (campo === undefined) {
      generales.push(mensaje);
    } else if (porCampo[campo] === undefined) {
      porCampo[campo] = MENSAJE_DE_VALIDATION_PIPE.test(mensaje)
        ? reglas[campo].textoPorDefecto
        : mensaje;
    }
  }

  const general =
    generales.length === 0
      ? undefined
      : error.tipo === "validacion"
        ? "Revisá los datos ingresados."
        : generales.join(" ");
  return { porCampo, general };
}

/** Entero de un campo numérico, o `undefined` si no es un entero mayor o igual a `minimo`. */
export function leerEntero(valor: string, minimo: number): number | undefined {
  if (!/^\d+$/.test(valor.trim())) return undefined;
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero >= minimo ? numero : undefined;
}
