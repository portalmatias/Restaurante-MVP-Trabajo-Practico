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
      // Las acciones de fila bajan a 36 px solo si no hay ningún puntero grueso disponible
      // (`sin-puntero-grueso`, definida en globals.css): un equipo híbrido con pantalla táctil
      // conserva el objetivo de 44 px aunque su puntero principal sea un mouse.
      className={buttonVariants({
        variant,
        size,
        className: [
          "sin-puntero-grueso:min-h-9 sin-puntero-grueso:px-3",
          className,
        ]
          .filter(Boolean)
          .join(" "),
        fullWidth: false,
      })}
      {...props}
    />
  );
}
