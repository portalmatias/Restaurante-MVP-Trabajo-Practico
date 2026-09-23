import { useId } from "react";
import { Input, type InputProps } from "./input";
import { Label } from "./label";

export type FieldProps = Omit<InputProps, "id" | "invalid"> & {
  /** Texto visible de la etiqueta, asociado al control mediante `htmlFor`/`id`. */
  label: string;
  /** Mensaje de error, mostrado junto al campo y enlazado con `aria-describedby`. */
  error?: string;
  id?: string;
};

/**
 * Campo de formulario accesible: etiqueta visible asociada al control y, si hay error, el
 * texto queda junto al campo y enlazado mediante `aria-describedby` (D4, spec "Campos de
 * formulario accesibles").
 */
export function Field({ label, error, id, className, ...inputProps }: FieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={fieldId}>{label}</Label>
      <Input
        id={fieldId}
        invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={className}
        {...inputProps}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
