import Image from "next/image";

type MarcoFotoProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  priority?: boolean;
  caption?: string;
  className?: string;
};

/**
 * Fotografía sin marco: al entrar en pantalla el recorte se abre (clip-path) y la foto se
 * desliza dentro más despacio que el scroll (parallax). Es CSS puro (`.marco-organico` en
 * `globals.css`): sin JavaScript de cliente, y con `prefers-reduced-motion` queda quieta.
 */
export function MarcoFoto({ src, alt, width, height, sizes, priority, caption, className }: MarcoFotoProps) {
  return (
    <figure className={["marco-organico", className].filter(Boolean).join(" ")}>
      <div className="overflow-hidden rounded-[4px]">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          priority={priority}
          className="deriva h-auto w-full"
        />
      </div>
      {caption ? <figcaption className="pt-2 text-sm text-muted-foreground">{caption}</figcaption> : null}
    </figure>
  );
}
