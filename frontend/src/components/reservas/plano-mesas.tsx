import {
  describirMesa,
  ordenarMesas,
  resumirPlano,
  mesasUbicadas,
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

/** Desplazamiento del canto de la tablilla bajo su cara, en unidades del `viewBox`. */
const CANTO = 3;

/**
 * Patrones compartidos por el dibujo y la leyenda; se definen aunque no haya dibujo. Son las
 * tablillas Kakefuda del rediseño: `LIBRE` es hinoki claro liso, `OCUPADA` es la tablilla dada
 * vuelta (madera oscura) con vetas diagonales y `NO_ALCANZA` es hinoki a la sombra punteado.
 * Contrastes con los tokens: vetas `border` sobre `madera` 3,13:1, puntos `muted-foreground`
 * sobre `muted` 5,52:1 (WCAG 1.4.11, mínimo 3:1).
 */
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
          <rect width="8" height="8" className="fill-madera" />
          <line x1="0" y1="0" x2="0" y2="8" strokeWidth="3" className="stroke-border" />
        </pattern>
        <pattern id={PATRON.NO_ALCANZA} width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" className="fill-muted" />
          <circle cx="4" cy="4" r="1.5" className="fill-muted-foreground" />
        </pattern>
      </defs>
    </svg>
  );
}

/** Un estado que el backend agregó y este frontend aún no conoce se dibuja neutro (puntos, "?"). */
function patronDe(estado: EstadoMesa): string {
  return PATRON[estado] ?? PATRON.NO_ALCANZA;
}

function marcaDe(estado: EstadoMesa): string {
  return MARCA[estado] ?? "?";
}

/**
 * Texto sobre la cara de la tablilla: claro sobre la madera oscura (13,14:1), tinta sobre hinoki.
 * El halo (trazo del color base de la tablilla, pintado debajo del relleno) aparta el texto de los
 * puntos y las vetas del patrón. Un estado desconocido usa el patrón neutro, con base `muted`.
 */
function claseTexto(estado: EstadoMesa): string {
  if (estado === "OCUPADA") return "fill-madera-foreground stroke-madera";
  if (estado === "LIBRE") return "fill-foreground stroke-card";
  return "fill-foreground stroke-muted";
}

/** Atributos del halo, comunes a todos los textos de la mesa. */
const HALO = { paintOrder: "stroke", strokeWidth: 3, strokeLinejoin: "round" } as const;

type Rect = { x: number; y: number; ancho: number; alto: number };

/** Silueta de la mesa: la usan la cara y el canto, que es la misma forma corrida hacia abajo. */
type PropsSilueta = { forma: MesaPlano["forma"] } & Rect & {
  className: string;
  fill?: string;
  strokeWidth?: number;
  "data-canto"?: string;
  "data-forma"?: string;
};

function Silueta({ forma, x, y, ancho, alto, ...resto }: PropsSilueta) {
  if (forma === "REDONDA") {
    return <ellipse {...resto} cx={x + ancho / 2} cy={y + alto / 2} rx={ancho / 2} ry={alto / 2} />;
  }
  // Esquinas apenas redondeadas, como los radios del tema (`--radius-sm` a `--radius-lg`).
  return <rect {...resto} x={x} y={y} width={ancho} height={alto} rx={forma === "CUADRADA" ? 2 : 4} />;
}

/**
 * Tablilla de la mesa: el canto (madera vista de costado) asoma debajo de la cara, que lleva el
 * patrón del estado. El borde `border` mide 3,66:1 contra el fondo (WCAG 1.4.11).
 */
function FormaMesa({ mesa, ...rect }: { mesa: MesaPlano } & Rect) {
  return (
    <>
      <Silueta data-canto="" forma={mesa.forma} {...rect} y={rect.y + CANTO} className="fill-border" />
      <Silueta
        data-forma={mesa.forma}
        forma={mesa.forma}
        {...rect}
        fill={`url(#${patronDe(mesa.estado)})`}
        strokeWidth={2}
        className="stroke-border"
      />
    </>
  );
}

/**
 * Dónde va cada texto de la mesa. La marca va centrada arriba de la etiqueta, así no se pisa con
 * etiquetas largas ("S10") y en las redondas queda dentro del círculo (aviso de la revisión de
 * gentle-ai, tarea 5.3). Una mesa de una fila y varias columnas no tiene alto para tres líneas:
 * la marca pasa a la izquierda.
 */
function posicionesTexto(mesa: MesaPlano, rect: Rect) {
  const centroX = rect.x + rect.ancho / 2;
  const centroY = rect.y + rect.alto / 2;
  const conCapacidad = mesa.ancho >= 2;
  if (mesa.alto >= 2) {
    return {
      marca: { x: centroX, y: centroY - 10, fontSize: 14, textAnchor: "middle" as const },
      etiqueta: { x: centroX, y: centroY + 8, fontSize: 13 },
      capacidad: conCapacidad ? { x: centroX, y: centroY + 24, fontSize: 11 } : null,
    };
  }
  if (conCapacidad) {
    return {
      marca: { x: rect.x + 12, y: centroY + 5, fontSize: 14, textAnchor: "middle" as const },
      etiqueta: { x: centroX, y: centroY - 1, fontSize: 13 },
      capacidad: { x: centroX, y: centroY + 13, fontSize: 11 },
    };
  }
  return {
    marca: { x: centroX, y: centroY - 3, fontSize: 12, textAnchor: "middle" as const },
    etiqueta: { x: centroX, y: centroY + 13, fontSize: 12 },
    capacidad: null,
  };
}

function MesaDibujada({ mesa }: { mesa: MesaPlano }) {
  const rect: Rect = {
    x: (mesa.posX ?? 0) * CELDA + MARGEN,
    y: (mesa.posY ?? 0) * CELDA + MARGEN,
    ancho: mesa.ancho * CELDA - 2 * MARGEN,
    alto: mesa.alto * CELDA - 2 * MARGEN,
  };
  const texto = claseTexto(mesa.estado);
  const { marca, etiqueta, capacidad } = posicionesTexto(mesa, rect);
  return (
    <g data-mesa={mesa.etiqueta} data-estado={mesa.estado}>
      <FormaMesa mesa={mesa} {...rect} />
      <text data-marca {...marca} {...HALO} fontWeight="700" className={texto}>
        {marcaDe(mesa.estado)}
      </text>
      <text
        data-etiqueta
        {...etiqueta}
        {...HALO}
        textAnchor="middle"
        fontWeight="600"
        className={`font-display ${texto}`}
      >
        {mesa.etiqueta}
      </text>
      {/* La capacidad solo entra en mesas de al menos 2 celdas de ancho (design.md D7). */}
      {capacidad ? (
        <text {...capacidad} {...HALO} textAnchor="middle" className={`tabular ${texto}`}>
          {`${mesa.capacidad} pers.`}
        </text>
      ) : null}
    </g>
  );
}

/**
 * Aviso del plano atenuado (design.md D5). El contrato garantiza motivos cuando no hay lugar,
 * pero si llegaran vacíos el aviso termina en punto en vez de quedar cortado en "por:". Si el
 * último motivo no trae su punto final, se le agrega.
 */
function avisoSinLugar(motivos: Plano["motivos"]): string {
  const aviso = "El plano muestra el estado de las mesas, pero hoy no se puede reservar este turno";
  if (motivos.length === 0) return `${aviso}.`;
  const texto = `${aviso} por: ${motivos.map((motivo) => motivo.mensaje.trim()).join(" ")}`;
  return /[.!?]$/.test(texto) ? texto : `${texto}.`;
}

/**
 * Plano informativo de la zona elegida (change `plano-mesas`, design.md D5 y D7): un dibujo
 * decorativo (`aria-hidden`) y una lista textual que es la fuente accesible. No tiene ningún
 * control: la mesa se asigna sola al confirmar la reserva. Cuando el turno no tiene lugar, se
 * atenúa y avisa por qué. Cada mesa es una tablilla de madera del rediseño Kakefuda.
 */
export function PlanoMesas({ plano, comensales }: PlanoMesasProps) {
  const mesas = ordenarMesas(plano.mesas);
  const ubicadas = mesasUbicadas(mesas, plano);
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
                rx="2"
                fill={`url(#${PATRON[estado]})`}
                strokeWidth="2"
                className="stroke-border"
              />
            </svg>
            <span aria-hidden="true" className="font-bold">
              {MARCA[estado]}
            </span>{" "}
            {textoEstado(estado)}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-4">
        {ubicadas.length > 0 ? (
          // Solo se atenúa el dibujo: la lista es la fuente accesible y tiene que conservar el
          // contraste del texto (WCAG 1.4.3).
          // En celular la lista va primero (es la vía más rápida); desde `sm`, el dibujo (D7).
          <div className={`order-2 overflow-x-auto sm:order-1${atenuado ? " opacity-60" : ""}`}>
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
        <ul aria-label="Mesas de la zona" className="order-1 flex flex-col gap-1 text-base text-foreground sm:order-2">
          {mesas.map((mesa) => (
            <li key={mesa.etiqueta}>{describirMesa(mesa, plano)}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
