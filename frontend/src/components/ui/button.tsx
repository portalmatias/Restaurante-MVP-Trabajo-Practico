import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";

export type ButtonSize = "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  // Sin relleno de color: para acciones secundarias de bajo énfasis, como los enlaces de
  // navegación del layout (que antes hand-rolleaban sus propias clases base).
  ghost: "text-foreground hover:bg-muted",
};

// El tamaño va en una tabla (no en las clases base) para que dos utilidades de Tailwind sobre
// la misma propiedad (`text-sm`/`text-lg`, `min-h-11`/`min-h-14`) nunca convivan en el mismo
// elemento: el orden en el atributo `class` no decide cuál gana.
const sizeClasses: Record<ButtonSize, string> = {
  md: "min-h-11 text-sm",
  lg: "min-h-14 text-lg",
};

export type ButtonVariantsOptions = {
  variant?: ButtonVariant;
  /** `md` (default, 44px de alto, 14px de texto) o `lg` (56px, 18px) para acciones principales. */
  size?: ButtonSize;
  className?: string;
  /**
   * `true` (default) da ancho completo en mobile y `sm:w-auto` en pantallas más anchas (D1),
   * pensado para una acción primaria/CTA. `false` deja el ancho intrínseco del contenido, para
   * reusar las mismas clases base en un elemento que no debe ocupar todo el ancho, como un
   * enlace de navegación dentro de una fila.
   */
  fullWidth?: boolean;
};

/**
 * Genera las clases visuales de `Button` sin el elemento `<button>`: permite reusar el mismo
 * lenguaje visual (D2) en un enlace de navegación (`next/link`) sin sumar una dependencia de
 * composición como `asChild`/Radix Slot (D4 descarta shadcn/ui).
 */
export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
  fullWidth = true,
}: ButtonVariantsOptions = {}) {
  return [
    "inline-flex items-center justify-center rounded-md px-4 font-medium",
    "transition-colors duration-200 motion-reduce:transition-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    "disabled:cursor-not-allowed disabled:opacity-50",
    fullWidth ? "w-full sm:w-auto" : undefined,
    sizeClasses[size],
    variantClasses[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Botón sobre los tokens del sistema de diseño (D2), ancho completo en mobile por defecto y
 * `sm:w-auto` para pantallas más anchas (D1), con anillo de foco visible y transición que
 * respeta `prefers-reduced-motion` (D4).
 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonVariants({ variant, size, className })} {...props} />;
}
