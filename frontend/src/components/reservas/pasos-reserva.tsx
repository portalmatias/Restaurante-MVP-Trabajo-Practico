export type PasosReservaProps = {
  pasoActual: number;
  total: number;
};

/**
 * Indicador de progreso del asistente de reserva (design.md D3): una tablilla chica por paso,
 * colgada de un cordón; la del paso actual es la de tinta llena. El texto "Paso X de Y" es la
 * única indicación accesible; las tablillas son decorativas (`aria-hidden`).
 */
export function PasosReserva({ pasoActual, total }: PasosReservaProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-start gap-1.5 pt-2">
        {Array.from({ length: total }, (_, indice) => (
          <span
            key={indice}
            aria-hidden="true"
            className={`relative block h-7 w-4 rounded-sm border before:absolute before:-top-2 before:left-1/2 before:h-2 before:w-px before:bg-border ${
              indice + 1 === pasoActual ? "border-primary bg-primary" : "border-border bg-card"
            }`}
          />
        ))}
      </div>
      <p className="tabular text-base font-medium text-muted-foreground">{`Paso ${pasoActual} de ${total}`}</p>
    </div>
  );
}
