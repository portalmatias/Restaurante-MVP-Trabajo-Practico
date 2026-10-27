import type { ErrorApi } from "../../lib/api/errors";
import { Alert } from "../ui/alert";
import { ErrorConReintento } from "./error-con-reintento";

export const MENSAJE_PLANO_NO_DISPONIBLE =
  "No pudimos cargar el plano. Podés seguir con tu reserva igual.";

export const MENSAJE_PLANO_LIMITE =
  "Estamos recibiendo muchas consultas. Probá de nuevo en un minuto.";

export type PlanoMesasErrorProps = {
  error: ErrorApi;
};

/**
 * Sección del plano cuando no se pudo obtener (design.md D7). El `429` solo se informa:
 * reintentar enseguida agrava el límite del plano, que comparten los visitantes de un mismo
 * origen (`/disponibilidad`, el respaldo de la página, no tiene límite). Cualquier otro error (red, `5xx`, `404` o
 * `400`) degrada la sección con la opción de reintentar. La reserva nunca depende del plano.
 */
export function PlanoMesasError({ error }: PlanoMesasErrorProps) {
  return (
    <section aria-labelledby="plano-mesas-titulo" className="flex flex-col gap-4">
      <h2 id="plano-mesas-titulo" className="text-xl font-semibold text-foreground">
        Plano de las mesas
      </h2>
      {error.tipo === "limite-de-intentos" ? (
        <Alert variant="error" className="text-base">
          {MENSAJE_PLANO_LIMITE}
        </Alert>
      ) : (
        <ErrorConReintento mensaje={MENSAJE_PLANO_NO_DISPONIBLE} />
      )}
    </section>
  );
}
