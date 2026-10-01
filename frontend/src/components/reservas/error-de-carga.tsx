import { MENSAJE_SERVICIO_NO_DISPONIBLE, type ErrorApi } from "../../lib/api/errors";
import { Alert } from "../ui/alert";
import { ErrorConReintento } from "./error-con-reintento";

export type ErrorDeCargaProps = {
  error: ErrorApi | undefined;
};

/**
 * Error al cargar datos de una pantalla servida. El límite de solicitudes solo se informa:
 * reintentar enseguida lo agrava (como en ConsultaReserva). Cualquier otro error muestra solo el
 * mensaje propio del cliente (red o servicio), nunca el texto de un 4xx del servidor, y ofrece
 * reintentar.
 */
export function ErrorDeCarga({ error }: ErrorDeCargaProps) {
  if (error?.tipo === "limite-de-intentos") {
    return (
      <Alert variant="error" className="text-base">
        {error.mensaje}
      </Alert>
    );
  }
  return (
    <ErrorConReintento
      mensaje={error?.tipo === "desconocido" ? error.mensaje : MENSAJE_SERVICIO_NO_DISPONIBLE}
    />
  );
}
