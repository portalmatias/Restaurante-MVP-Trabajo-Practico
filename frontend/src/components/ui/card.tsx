import { useId, type HTMLAttributes } from "react";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Título accesible de la tarjeta. Cuando está presente, la tarjeta expone `role="region"`. */
  title?: string;
  /**
   * Nivel del encabezado que renderiza `title` (`<h1>`/`<h2>`/`<h3>`). Por defecto `2`: una
   * tarjeta suele ser una sección dentro de una página que ya tiene su propio `<h1>`. Cuando el
   * título de la tarjeta ES el título principal de la página (por ejemplo, un placeholder sin
   * otro encabezado), pasar `1` para que el documento tenga un `<h1>` (WCAG 1.3.1).
   */
  headingLevel?: 1 | 2 | 3;
};

/**
 * Contenedor presentacional sobre los tokens `card`/`card-foreground`/`border` (D4). Con un
 * título accesible, se expone como una región nombrada (`<section aria-labelledby>`, que el
 * navegador resuelve a `role="region"`); sin título, es un contenedor genérico.
 */
export function Card({ title, headingLevel = 2, children, className, ...props }: CardProps) {
  const titleId = useId();
  const classes = [
    "rounded-sm border border-border bg-card p-4 text-card-foreground",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (title) {
    const Encabezado = `h${headingLevel}` as "h1" | "h2" | "h3";
    return (
      <section aria-labelledby={titleId} className={classes} {...props}>
        <Encabezado id={titleId} className="font-display text-lg font-medium">
          {title}
        </Encabezado>
        <div className="mt-2">{children}</div>
      </section>
    );
  }

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
