import type { HTMLAttributes } from "react";

export type AlertVariant = "info" | "error";

export type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
};

const alertVariantClasses: Record<AlertVariant, string> = {
  info: "border-border text-foreground",
  error: "border-destructive text-destructive",
};

// info es una novedad no urgente (role="status", live region "polite"); error interrumpe
// (role="alert", live region "assertive"). Ninguna variante depende de un ícono para
// transmitir el estado: el texto alcanza (spec "Iconografía accesible").
const roleByVariant: Record<AlertVariant, "status" | "alert"> = {
  info: "status",
  error: "alert",
};

/**
 * Mensaje de estado sobre los tokens del sistema de diseño (D4). Su color y su texto ya
 * comunican la variante: no necesita un ícono para transmitir el significado.
 */
export function Alert({ variant = "info", role, className, ...props }: AlertProps) {
  const classes = [
    "rounded-sm border bg-background px-4 py-3 text-sm",
    alertVariantClasses[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div role={role ?? roleByVariant[variant]} className={classes} {...props} />;
}
