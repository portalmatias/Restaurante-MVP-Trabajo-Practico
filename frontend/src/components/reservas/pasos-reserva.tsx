export type PasosReservaProps = {
  pasoActual: number;
  total: number;
};

/**
 * Indicador de progreso del asistente de reserva (design.md D3). El texto "Paso X de Y" es la
 * única indicación accesible; los puntos son decorativos (`aria-hidden`).
 */
export function PasosReserva({ pasoActual, total }: PasosReservaProps) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-base font-medium text-muted-foreground">{`Paso ${pasoActual} de ${total}`}</p>
      <div className="flex items-center gap-2">
        {Array.from({ length: total }, (_, indice) => (
          <span
            key={indice}
            aria-hidden="true"
            className={`h-2.5 w-2.5 rounded-full ${indice + 1 === pasoActual ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>
    </div>
  );
}
