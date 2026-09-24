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

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

function mensajeDe(cuerpo: unknown): string {
  if (esRegistro(cuerpo) && typeof cuerpo.message === "string") {
    return cuerpo.message;
  }
  return "Ocurrió un error inesperado.";
}

/**
 * Lee `motivos` del cuerpo con un chequeo en tiempo de ejecución, no con un tipo de un
 * contrato todavía no mergeado (D7: `POST /reservas` de `reservas-crear` va a agregarlo).
 */
function motivosDe(cuerpo: unknown): MotivoNoDisponible[] {
  if (!esRegistro(cuerpo) || !Array.isArray(cuerpo.motivos)) {
    return [];
  }

  return cuerpo.motivos.filter((motivo): motivo is MotivoNoDisponible => {
    return (
      esRegistro(motivo) && typeof motivo.codigo === "string" && typeof motivo.mensaje === "string"
    );
  });
}

/**
 * Traduce una respuesta de error de la API (`statusCode` + cuerpo de `ErrorRespuesta`) al
 * `ErrorApi` correspondiente (D7). Es una función pura: no hace ninguna llamada de red.
 */
export function mapErrorApi(status: number, body: unknown): ErrorApi {
  if (status === 400 && esRegistro(body) && Array.isArray(body.message)) {
    return {
      tipo: "validacion",
      mensajes: body.message.filter((mensaje): mensaje is string => typeof mensaje === "string"),
    };
  }

  if (status === 404) {
    return { tipo: "no-encontrado", mensaje: mensajeDe(body) };
  }

  if (status === 409) {
    return { tipo: "conflicto", mensaje: mensajeDe(body), motivos: motivosDe(body) };
  }

  return { tipo: "desconocido", mensaje: mensajeDe(body) };
}
