import type { components } from "./schema";

type MotivoNoDisponible = components["schemas"]["MotivoNoDisponible"];

/**
 * Resultado de un error de la API, ya traducido desde `ErrorRespuesta` (D7 de `design.md`).
 * Se apoya solo en lo que `openapi/openapi.yaml` define hoy en `main`: `ErrorRespuesta`
 * (`statusCode`, `message`, `error`) y `MotivoNoDisponible` de `disponibilidad`.
 */
export type ErrorApi =
  | { tipo: "validacion"; mensajes: string[] }
  | { tipo: "no-encontrado"; mensaje: string }
  | { tipo: "conflicto"; mensaje: string; motivos: MotivoNoDisponible[] }
  | { tipo: "desconocido"; mensaje: string };

/**
 * Resultado tipado de una llamada al cliente HTTP, discriminado por la presencia de `data` o
 * de `error` (D7).
 */
export type ApiResult<T> = { data: T; error?: never } | { data?: never; error: ErrorApi };

/**
 * Códigos válidos de `MotivoNoDisponible["codigo"]`, tomados de `CodigoMotivo` en
 * `schema.d.ts` (generado por `openapi-typescript` desde `openapi/openapi.yaml`, D5).
 * `satisfies` deja el tipo de la constante como el union literal exacto, no `string[]`: hace
 * falta así de preciso para la comprobación de exhaustividad de abajo.
 */
const CODIGOS_MOTIVO_VALIDOS = [
  "TURNO_INACTIVO",
  "TURNO_NO_CORRESPONDE_A_FECHA",
  "ANTICIPACION_MINIMA",
  "ANTICIPACION_MAXIMA",
  "COMENSALES_FUERA_DE_RANGO",
  "AFORO_ZONA",
  "AFORO_GLOBAL",
  "SIN_MESA_DISPONIBLE",
] as const satisfies readonly MotivoNoDisponible["codigo"][];

/**
 * Comprobación de exhaustividad en tiempo de compilación: si el `CodigoMotivo` del contrato
 * agrega un código nuevo sin sumarlo también a `CODIGOS_MOTIVO_VALIDOS`, `CodigosMotivoFaltantes`
 * deja de ser `never` y la asignación de abajo deja de compilar (`tsc --noEmit` falla).
 */
type CodigosMotivoFaltantes = Exclude<
  MotivoNoDisponible["codigo"],
  (typeof CODIGOS_MOTIVO_VALIDOS)[number]
>;
const _codigosMotivoCompletos: [CodigosMotivoFaltantes] extends [never] ? true : never = true;
void _codigosMotivoCompletos;

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

function esCodigoMotivoValido(valor: unknown): valor is MotivoNoDisponible["codigo"] {
  return typeof valor === "string" && (CODIGOS_MOTIVO_VALIDOS as readonly string[]).includes(valor);
}

function mensajeDe(cuerpo: unknown): string {
  if (esRegistro(cuerpo) && typeof cuerpo.message === "string") {
    return cuerpo.message;
  }
  return "Ocurrió un error inesperado.";
}

/**
 * Lee `motivos` del cuerpo con un chequeo en tiempo de ejecución, no con un tipo de un
 * contrato todavía no mergeado (D7: `POST /reservas` de `reservas-crear` va a agregarlo). Un
 * motivo con un `codigo` que no pertenece al enum del contrato se descarta: no es un
 * `MotivoNoDisponible` válido, aunque tenga la forma correcta.
 */
function motivosDe(cuerpo: unknown): MotivoNoDisponible[] {
  if (!esRegistro(cuerpo) || !Array.isArray(cuerpo.motivos)) {
    return [];
  }

  return cuerpo.motivos.filter((motivo): motivo is MotivoNoDisponible => {
    return (
      esRegistro(motivo) && esCodigoMotivoValido(motivo.codigo) && typeof motivo.mensaje === "string"
    );
  });
}

/**
 * Traduce una respuesta de error de la API (`statusCode` + cuerpo de `ErrorRespuesta`) al
 * `ErrorApi` correspondiente (D7). Es una función pura: no hace ninguna llamada de red.
 */
export function mapErrorApi(status: number, body: unknown): ErrorApi {
  if (status === 400) {
    // `message` es una lista cuando rechaza el `ValidationPipe` y un texto único cuando lo
    // rechaza una regla de negocio (por ejemplo en `PATCH /admin/zonas/{id}`).
    const mensajes =
      esRegistro(body) && Array.isArray(body.message)
        ? body.message.filter((mensaje): mensaje is string => typeof mensaje === "string")
        : [mensajeDe(body)];
    return { tipo: "validacion", mensajes };
  }

  if (status === 404) {
    return { tipo: "no-encontrado", mensaje: mensajeDe(body) };
  }

  if (status === 409) {
    return { tipo: "conflicto", mensaje: mensajeDe(body), motivos: motivosDe(body) };
  }

  if (status >= 500) {
    // Nunca se expone el mensaje del servidor: podría filtrar detalle interno (stack, nombre de
    // host, etc.). Cubre también el caso en que el proxy `/api` de Next devuelve una página de
    // error HTML (no un `ErrorRespuesta` JSON) porque no puede comunicarse con el backend.
    return {
      tipo: "desconocido",
      mensaje: "El servicio no está disponible en este momento. Intente de nuevo más tarde.",
    };
  }

  return { tipo: "desconocido", mensaje: mensajeDe(body) };
}
