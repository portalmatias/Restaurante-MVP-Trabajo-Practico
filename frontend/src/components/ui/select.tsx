import { useId, type SelectHTMLAttributes } from "react";
import { Label } from "./label";

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  /** Texto visible de la etiqueta, asociado al control mediante `htmlFor`/`id`. */
  label: string;
  /** Mensaje de error, mostrado junto al campo y enlazado con `aria-describedby`. */
  error?: string;
  id?: string;
};

/**
 * Selector accesible con la misma asociación etiqueta/control y el mismo mapeo de error que
 * `Field` (D4, spec "Campos de formulario accesibles").
 */
export function Select({
  label,
  error,
  id,
  className,
  children,
  ...selectProps
}: SelectProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const classes = [
    "min-h-11 w-full rounded-md border bg-background px-3 text-base text-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    "disabled:cursor-not-allowed disabled:opacity-50",
    error ? "border-destructive" : "border-border",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={fieldId}>{label}</Label>
      <select
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={classes}
        {...selectProps}
      >
        {children}
      </select>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
