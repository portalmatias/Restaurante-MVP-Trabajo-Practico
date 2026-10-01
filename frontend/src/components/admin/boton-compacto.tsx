import type { ButtonProps } from "../ui/button";
import { buttonVariants } from "../ui/button";

/**
 * Botón con el mismo lenguaje visual que `Button`, pero con el ancho de su contenido también en
 * mobile. `Button` siempre agrega `w-full sm:w-auto`, y un `className="w-auto"` no lo pisa: en
 * el CSS generado `.w-full` va después de `.w-auto` y gana. Para las acciones de una fila o de
 * una barra (editar, dar de baja, cerrar sesión) se usa este, con `fullWidth: false`.
 */
export function BotonCompacto({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonVariants({ variant, size, className, fullWidth: false })}
      {...props}
    />
  );
}
