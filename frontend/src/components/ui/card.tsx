import { useId, type HTMLAttributes } from "react";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Título accesible de la tarjeta. Cuando está presente, la tarjeta expone `role="region"`. */
  title?: string;
};

/**
 * Contenedor presentacional sobre los tokens `card`/`card-foreground`/`border` (D4). Con un
 * título accesible, se expone como una región nombrada (`<section aria-labelledby>`, que el
 * navegador resuelve a `role="region"`); sin título, es un contenedor genérico.
 */
export function Card({ title, children, className, ...props }: CardProps) {
  const titleId = useId();
  const classes = [
    "rounded-lg border border-border bg-card p-4 text-card-foreground",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (title) {
    return (
      <section aria-labelledby={titleId} className={classes} {...props}>
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
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
