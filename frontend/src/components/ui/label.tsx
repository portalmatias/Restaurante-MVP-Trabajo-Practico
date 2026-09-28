import type { LabelHTMLAttributes } from "react";

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

/**
 * Etiqueta de texto visible para un control de formulario. Siempre se usa asociada a su
 * control mediante `htmlFor`/`id` (nunca se reemplaza por un `placeholder`).
 */
export function Label({ className, ...props }: LabelProps) {
  const classes = ["text-sm font-medium text-foreground", className]
    .filter(Boolean)
    .join(" ");

  return <label className={classes} {...props} />;
}
