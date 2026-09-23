import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "destructive";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

/**
 * Botón sobre los tokens del sistema de diseño (D2), ancho completo en mobile por defecto y
 * `sm:w-auto` para pantallas más anchas (D1), con anillo de foco visible y transición que
 * respeta `prefers-reduced-motion` (D4).
 */
export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = [
    "inline-flex min-h-11 w-full items-center justify-center rounded-md px-4 text-sm font-medium",
    "transition-colors duration-200 motion-reduce:transition-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "sm:w-auto",
    variantClasses[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <button type={type} className={classes} {...props} />;
}
