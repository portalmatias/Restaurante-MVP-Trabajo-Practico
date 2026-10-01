import { Card } from "../ui/card";
import { formatearFechaLargaEs, formatearHoraTurno } from "../../lib/fecha-hora";

export type ResumenSeleccionProps = {
  /** Fecha `YYYY-MM-DD`. */
  fecha: string;
  /** Hora del turno tal como la entrega `GET /turnos` (hora local, `1970-01-01THH:mm:00.000Z`). */
  horaInicio: string;
  horaFin: string;
  zona: string;
  comensales: number;
  /** Solo el resultado de disponibilidad lo conoce; los demás pasos no lo muestran. */
  lugaresRestantes?: number;
};

/**
 * Resumen de la selección del asistente (design.md D3 Pantallas 3 a 5): fecha en formato largo,
 * horario del turno en hora local, zona y comensales. Es presentacional: recibe todo resuelto.
 */
export function ResumenSeleccion({
  fecha,
  horaInicio,
  horaFin,
  zona,
  comensales,
  lugaresRestantes,
}: ResumenSeleccionProps) {
  return (
    <Card title="Resumen de tu selección" className="text-base">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="text-muted-foreground">Fecha</dt>
        <dd>{formatearFechaLargaEs(fecha)}</dd>
        <dt className="text-muted-foreground">Turno</dt>
        <dd>{`${formatearHoraTurno(horaInicio)} a ${formatearHoraTurno(horaFin)}`}</dd>
        <dt className="text-muted-foreground">Zona</dt>
        <dd>{zona}</dd>
        <dt className="text-muted-foreground">Comensales</dt>
        <dd>{comensales}</dd>
        {lugaresRestantes !== undefined ? (
          <>
            <dt className="text-muted-foreground">Lugares restantes</dt>
            <dd>{lugaresRestantes}</dd>
          </>
        ) : null}
      </dl>
    </Card>
  );
}
