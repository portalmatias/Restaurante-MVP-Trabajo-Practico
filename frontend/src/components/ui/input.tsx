import type { InputHTMLAttributes } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Marca el control como inválido (borde y `aria-invalid`), sin fijar el mensaje de error. */
  invalid?: boolean;
};

/**
 * Campo de texto sobre los tokens del sistema de diseño (D2): sin colores literales, altura
 * mínima de 44px (objetivo táctil) y anillo de foco visible.
 */
export function Input({ className, invalid = false, ...props }: InputProps) {
  const classes = [
    "min-h-11 w-full rounded-md border bg-background px-3 text-base text-foreground",
    "placeholder:text-muted-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    "disabled:cursor-not-allowed disabled:opacity-50",
    invalid ? "border-destructive" : "border-border",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <input
      className={classes}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}
