import {
  describirMesa,
  ordenarMesas,
  resumirPlano,
  separarMesas,
  textoEstado,
  type EstadoMesa,
  type MesaPlano,
  type PlanoMesas as Plano,
} from "../../lib/plano-mesas";

export type PlanoMesasProps = {
  plano: Plano;
  /** Comensales de la selección, para el resumen. */
  comensales: number;
};

/** Lado de una celda de la grilla en unidades del `viewBox` (design.md D5). */
const CELDA = 48;
const MARGEN = 4;

const ESTADOS: readonly EstadoMesa[] = ["LIBRE", "OCUPADA", "NO_ALCANZA"];

/** Marca de cada estado, para no depender del color (design.md D5, WCAG 1.4.1). */
const MARCA: Record<EstadoMesa, string> = { LIBRE: "✓", OCUPADA: "×", NO_ALCANZA: "–" };

/** Id del patrón de relleno de cada estado: liso, rayado diagonal y punteado. */
const PATRON: Record<EstadoMesa, string> = {
  LIBRE: "plano-mesas-libre",
  OCUPADA: "plano-mesas-ocupada",
  NO_ALCANZA: "plano-mesas-no-alcanza",
};

/** Patrones compartidos por el dibujo y la leyenda; se definen aunque no haya dibujo. */
function Patrones() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      <defs>
        <pattern id={PATRON.LIBRE} width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" className="fill-card" />
        </pattern>
        <pattern
          id={PATRON.OCUPADA}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="8" height="8" className="fill-muted" />
          <line x1="0" y1="0" x2="0" y2="8" strokeWidth="3" className="stroke-muted-foreground" />
        </pattern>
        <pattern id={PATRON.NO_ALCANZA} width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" className="fill-card" />
          <circle cx="4" cy="4" r="1.5" className="fill-muted-foreground" />
        </pattern>
      </defs>
    </svg>
  );
}

function FormaMesa({ mesa, x, y, ancho, alto }: { mesa: MesaPlano } & Rect) {
  const comun = {
    "data-forma": mesa.forma,
    fill: `url(#${PATRON[mesa.estado]})`,
    strokeWidth: 2,
    className: "stroke-foreground",
  };
  if (mesa.forma === "REDONDA") {
    return <ellipse {...comun} cx={x + ancho / 2} cy={y + alto / 2} rx={ancho / 2} ry={alto / 2} />;
  }
  return <rect {...comun} x={x} y={y} width={ancho} height={alto} rx={mesa.forma === "CUADRADA" ? 2 : 6} />;
}

type Rect = { x: number; y: number; ancho: number; alto: number };

function MesaDibujada({ mesa }: { mesa: MesaPlano }) {
  const rect: Rect = {
    x: (mesa.posX ?? 0) * CELDA + MARGEN,
    y: (mesa.posY ?? 0) * CELDA + MARGEN,
    ancho: mesa.ancho * CELDA - 2 * MARGEN,
    alto: mesa.alto * CELDA - 2 * MARGEN,
  };
  const centroX = rect.x + rect.ancho / 2;
  const centroY = rect.y + rect.alto / 2;
  return (
    <g data-mesa={mesa.etiqueta} data-estado={mesa.estado}>
      <FormaMesa mesa={mesa} {...rect} />
      <text
        x={centroX}
        y={centroY - 4}
        textAnchor="middle"
        fontSize="13"
        fontWeight="600"
        className="fill-foreground"
      >
        {mesa.etiqueta}
      </text>
      {/* La capacidad solo entra en mesas de al menos 2 celdas de ancho (design.md D7). */}
      {mesa.ancho >= 2 ? (
        <text x={centroX} y={centroY + 12} textAnchor="middle" fontSize="11" className="fill-foreground">
          {`${mesa.capacidad} pers.`}
        </text>
      ) : null}
      <text
        data-marca
        x={rect.x + rect.ancho - 4}
        y={rect.y + 14}
        textAnchor="end"
        fontSize="14"
        fontWeight="700"
        className="fill-foreground"
      >
        {MARCA[mesa.estado]}
      </text>
    </g>
  );
}

/**
 * Aviso del plano atenuado (design.md D5). El contrato garantiza motivos cuando no hay lugar,
 * pero si llegaran vacíos el aviso termina en punto en vez de quedar cortado en "por:".
 */
function avisoSinLugar(motivos: Plano["motivos"]): string {
  const aviso = "El plano muestra el estado de las mesas, pero hoy no se puede reservar este turno";
  if (motivos.length === 0) return `${aviso}.`;
  return `${aviso} por: ${motivos.map((motivo) => motivo.mensaje).join(" ")}`;
}

/**
 * Plano informativo de la zona elegida (change `plano-mesas`, design.md D5 y D7): un dibujo
 * decorativo (`aria-hidden`) y una lista textual que es la fuente accesible. No tiene ningún
 * control: la mesa se asigna sola al confirmar la reserva. Cuando el turno no tiene lugar, se
 * atenúa y avisa por qué. El estilo de tablillas de madera llega con el rediseño (tarea 5.3).
 */
export function PlanoMesas({ plano, comensales }: PlanoMesasProps) {
  const mesas = ordenarMesas(plano.mesas);
  const { ubicadas } = separarMesas(mesas, plano);
  const atenuado = !plano.disponible;

  return (
    <section
      aria-labelledby="plano-mesas-titulo"
      data-atenuado={atenuado ? "true" : undefined}
      className="relative flex flex-col gap-4"
    >
      <h2 id="plano-mesas-titulo" className="text-xl font-semibold text-foreground">
        Plano de las mesas
      </h2>
      {atenuado ? (
        <p className="text-base text-foreground">{avisoSinLugar(plano.motivos)}</p>
      ) : (
        <p className="text-base text-muted-foreground">
          El plano es una foto del momento y puede cambiar. La mesa se asigna automáticamente al
          confirmar la reserva.
        </p>
      )}
      <p role="status" className="text-base text-foreground">
        {resumirPlano({ zona: plano.zona, comensales, mesas })}
      </p>
      <Patrones />
      <ul aria-label="Referencias del plano" className="flex flex-wrap gap-4 text-sm text-foreground">
        {ESTADOS.map((estado) => (
          <li key={estado} className="flex items-center gap-2">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20">
              <rect
                x="1"
                y="1"
                width="18"
                height="18"
                fill={`url(#${PATRON[estado]})`}
                strokeWidth="2"
                className="stroke-foreground"
              />
            </svg>
            <span aria-hidden="true" className="font-bold">
              {MARCA[estado]}
            </span>{" "}
            {textoEstado(estado)}
          </li>
        ))}
      </ul>
      <div className={atenuado ? "flex flex-col gap-4 opacity-60" : "flex flex-col gap-4"}>
        {ubicadas.length > 0 ? (
          <div className="overflow-x-auto">
            <svg
              data-dibujo
              aria-hidden="true"
              viewBox={`0 0 ${plano.columnas * CELDA} ${plano.filas * CELDA}`}
              className="h-auto w-full rounded-lg border border-border bg-background"
            >
              {ubicadas.map((mesa) => (
                <MesaDibujada key={mesa.etiqueta} mesa={mesa} />
              ))}
            </svg>
          </div>
        ) : null}
        <ul aria-label="Mesas de la zona" className="flex flex-col gap-1 text-base text-foreground">
          {mesas.map((mesa) => (
            <li key={mesa.etiqueta}>{describirMesa(mesa, plano)}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
