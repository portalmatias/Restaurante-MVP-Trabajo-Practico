import type { ButtonHTMLAttributes, ReactNode } from "react";

export type TablillaEstado = "libre" | "elegida" | "descartada" | "completa";

type ContenidoProps = {
  /** Lo principal, en español y en horizontal (por ejemplo, «Cena, 20:30»). */
  titulo: ReactNode;
  /** Dato secundario, en horizontal al pie (por ejemplo, «6 lugares libres»). */
  detalle?: ReactNode;
  /** El equivalente japonés del título, en vertical al costado. Es decoración. */
  japones?: string;
};

export type TablillaProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "title"> &
  ContenidoProps & {
    /**
     * `libre`: colgada de frente y elegible. `elegida`: sigue de frente, con el sello rojo y el
     * borde marcado. `descartada`: dada vuelta (madera oscura, con su texto atenuado) porque se
     * eligió otra; sigue siendo tocable para cambiar de elección. `completa`: colgada boca abajo
     * y sin acción (el sello lo dice).
     */
    estado?: TablillaEstado;
  };

const cara =
  "absolute inset-0 flex flex-col items-center justify-between rounded-sm border px-2 pb-4 pt-8 [backface-visibility:hidden]";

/**
 * Frente de una tablilla. El español (lo que lee quien reserva) va en horizontal; el equivalente
 * japonés, si lo hay, va en vertical al costado, como en un kakefuda tradicional. El japonés es
 * decoración (`aria-hidden`): el texto accesible es el español, y `lang="ja"` evita que un lector
 * de pantalla lo lea con la voz española si alguna vez deja de estar oculto.
 */
function Frente({ titulo, detalle, japones }: ContenidoProps) {
  return (
    <>
      <span className="flex w-full flex-1 items-start gap-2">
        <span className="mt-1 min-w-0 flex-1 text-balance break-words text-left font-display text-base leading-snug">
          {titulo}
        </span>
        {japones ? (
          <span
            aria-hidden="true"
            lang="ja"
            className="font-display text-xl leading-none tracking-[0.15em] [text-orientation:upright] [writing-mode:vertical-rl]"
          >
            {japones}
          </span>
        ) : null}
      </span>
      {detalle ? (
        <span className="tabular w-full text-left text-xs text-muted-foreground">{detalle}</span>
      ) : null}
    </>
  );
}

/**
 * Kakefuda: la tablilla de madera colgada que es la firma visual de Ichigo (ver
 * `.impeccable/surfaces/app-page-tsx.md`). Es un `<button>` con `aria-pressed`: al elegir una,
 * las demás se dan vuelta y la elegida queda a la vista con su sello. El giro es un giro 3D de 450 ms; con `prefers-reduced-motion` el cambio
 * es instantáneo (regla global de `globals.css`). El sello rojo es decoración (`aria-hidden`):
 * el estado lo dicen `aria-pressed` y `disabled`.
 *
 * Los colores salen de los tokens; el rojo solo se usa como relleno con texto hinoki claro.
 */
export function Tablilla({
  titulo,
  detalle,
  japones,
  estado = "libre",
  className,
  type = "button",
  ...props
}: TablillaProps) {
  const completa = estado === "completa";
  const elegida = estado === "elegida";
  const descartada = estado === "descartada";

  return (
    <button
      type={type}
      aria-pressed={completa ? undefined : elegida}
      disabled={completa || props.disabled}
      className={[
        "group relative mx-auto block h-48 w-[6.75rem] [perspective:900px] sm:h-56 sm:w-36",
        "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {/* Cordón y agujero: la tablilla cuelga de la viga. */}
      <span aria-hidden="true" className="absolute -top-6 left-1/2 h-8 w-px -translate-x-1/2 bg-border" />
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-3 z-10 h-2 w-2 -translate-x-1/2 rounded-full border border-border bg-background"
      />

      <span
        className={[
          "absolute inset-0 block origin-top transition-transform duration-[450ms] ease-[var(--ease-out-expo)] [transform-style:preserve-3d]",
          "group-enabled:group-hover:-translate-y-0.5",
          descartada || completa ? "[transform:rotateY(180deg)]" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Frente: hinoki claro con tinta sumi. */}
        <span
          className={`${cara} bg-card text-card-foreground ${elegida ? "border-2 border-accent" : "border-border"}`}
        >
          <Frente titulo={titulo} detalle={detalle} japones={japones} />
          {elegida ? (
            <span
              aria-hidden="true"
              className="absolute bottom-3 right-2 flex h-8 w-8 items-center justify-center rounded-sm bg-accent font-display text-base text-accent-foreground"
            >
              予
            </span>
          ) : null}
        </span>

        {/* Dorso: madera oscura. Descartada deja ver su texto atenuado; completa lleva el sello 満. */}
        <span
          aria-hidden="true"
          className={`${cara} border-madera bg-madera text-madera-foreground [transform:rotateY(180deg)]`}
        >
          {completa ? (
            <>
              <span className="mt-4 h-0" />
              <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-accent font-display text-lg text-accent-foreground">
                満
              </span>
            </>
          ) : (
            <span className="mt-1 w-full text-balance break-words text-left font-display text-base leading-snug opacity-70">
              {titulo}
            </span>
          )}
        </span>
      </span>

      {completa ? <span className="sr-only">Completo</span> : null}
    </button>
  );
}

export type TablillaPasoProps = ContenidoProps & {
  className?: string;
};

/**
 * Tablilla colgada que solo informa (no es un control): se usa dentro de una lista. Mismo
 * cordón, agujero, madera y texto bilingüe que `Tablilla`, sin giro ni foco.
 */
export function TablillaPaso({ titulo, detalle, japones, className }: TablillaPasoProps) {
  return (
    <div className={["balanceo relative mx-auto h-44 w-[6.75rem] sm:h-52 sm:w-36", className].filter(Boolean).join(" ")}>
      <span aria-hidden="true" className="absolute -top-6 left-1/2 h-8 w-px -translate-x-1/2 bg-border" />
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-3 z-10 h-2 w-2 -translate-x-1/2 rounded-full border border-border bg-background"
      />
      <span className="absolute inset-0 flex flex-col items-center justify-between rounded-sm border border-border bg-card px-2 pb-4 pt-8 text-card-foreground">
        <Frente titulo={titulo} detalle={detalle} japones={japones} />
      </span>
    </div>
  );
}
