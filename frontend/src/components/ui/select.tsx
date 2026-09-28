import { useId, type SelectHTMLAttributes } from "react";
import { mergeDescribedBy } from "./aria";
import { Label } from "./label";

export type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "id" | "aria-invalid"
> & {
  /** Texto visible de la etiqueta, asociado al control mediante `htmlFor`/`id`. */
  label: string;
  /** Mensaje de error, mostrado junto al campo y enlazado con `aria-describedby`. */
  error?: string;
  id?: string;
};

/**
 * Selector accesible con la misma asociación etiqueta/control y el mismo mapeo de error que
 * `Field` (D4, spec "Campos de formulario accesibles"). Un `aria-describedby` que ya traiga el
 * caller se conserva: el id del error se agrega, nunca lo reemplaza. El estado de `error`, no
 * un `aria-invalid` del caller, es quien decide la validez del control.
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
  const { "aria-describedby": callerDescribedBy, ...restSelectProps } = selectProps;
  const describedBy = mergeDescribedBy(callerDescribedBy, error ? errorId : undefined);
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
        className={classes}
        {...restSelectProps}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
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
