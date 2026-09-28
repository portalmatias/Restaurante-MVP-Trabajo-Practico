import { useId } from "react";
import { mergeDescribedBy } from "./aria";
import { Input, type InputProps } from "./input";
import { Label } from "./label";

export type FieldProps = Omit<InputProps, "id" | "invalid" | "aria-invalid"> & {
  /** Texto visible de la etiqueta, asociado al control mediante `htmlFor`/`id`. */
  label: string;
  /** Mensaje de error, mostrado junto al campo y enlazado con `aria-describedby`. */
  error?: string;
  id?: string;
};

/**
 * Campo de formulario accesible: etiqueta visible asociada al control y, si hay error, el
 * texto queda junto al campo y enlazado mediante `aria-describedby` (D4, spec "Campos de
 * formulario accesibles"). Un `aria-describedby` que ya traiga el caller (por ejemplo, un
 * texto de ayuda) se conserva: el id del error se agrega, nunca lo reemplaza. El estado de
 * `error`, no un `aria-invalid` del caller, es quien decide la validez del control.
 */
export function Field({ label, error, id, className, ...inputProps }: FieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const { "aria-describedby": callerDescribedBy, ...restInputProps } = inputProps;
  const describedBy = mergeDescribedBy(callerDescribedBy, error ? errorId : undefined);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={fieldId}>{label}</Label>
      <Input
        id={fieldId}
        className={className}
        {...restInputProps}
        invalid={Boolean(error)}
        aria-describedby={describedBy}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
