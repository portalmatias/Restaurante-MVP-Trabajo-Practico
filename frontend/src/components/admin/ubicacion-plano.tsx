import { Button } from "../ui/button";
import { Select } from "../ui/select";
import { CELDA, rectDeMesa, Silueta } from "../reservas/plano-geometria";
import type { components } from "../../lib/api/schema";
import {
  corregirInicio,
  describirUbicacion,
  entraEnGrilla,
  opcionesInicio,
  superposiciones,
  type Grilla,
} from "../../lib/plano-mesas";

type Mesa = components["schemas"]["MesaRespuestaDto"];
type Forma = components["schemas"]["FormaMesa"];

/**
 * Valores de la sección "Ubicación en el plano" (change `plano-mesas-admin`, design.md D5).
 * Columna y fila se numeran desde 1, como en la pantalla; vacías, la mesa queda sin ubicar.
 */
export type Ubicacion = {
  columna?: number;
  fila?: number;
  ancho: number;
  alto: number;
  forma: Forma;
};

/** Mesas de la zona elegida para la vista previa, sin la que se edita. */
export type OtrasMesas = { estado: "cargando" } | { estado: "error" } | { estado: "ok"; mesas: Mesa[] };

const FORMAS: readonly { valor: Forma; texto: string }[] = [
  { valor: "REDONDA", texto: "Redonda" },
  { valor: "CUADRADA", texto: "Cuadrada" },
  { valor: "RECTANGULAR", texto: "Rectangular" },
];

const TEXTO_SIN_UBICAR = "La mesa no está en el plano.";
const TEXTO_FUERA_DE_GRILLA = "La mesa quedó fuera de la grilla de la zona: elegí una ubicación nueva.";
const TEXTO_SIN_OTRAS =
  "No se pudieron cargar las otras mesas de la zona: no se puede avisar si se superpone.";

/**
 * Una mesa guardada fuera de la grilla de su zona se trata como sin ubicar: columna y fila
 * vacías, y ancho y alto ajustados al máximo de la grilla si la superan (design.md D5).
 */
export function ubicacionInicial(mesa: Mesa, grilla: Grilla): Ubicacion {
  const dentro = entraEnGrilla(mesa, grilla);
  return {
    columna: dentro && mesa.posX !== null ? mesa.posX + 1 : undefined,
    fila: dentro && mesa.posY !== null ? mesa.posY + 1 : undefined,
    ancho: Math.min(mesa.ancho, grilla.columnas),
    alto: Math.min(mesa.alto, grilla.filas),
    forma: mesa.forma,
  };
}

/** La mesa tiene posición guardada pero no entra en la grilla de su zona. */
export function quedoFueraDeGrilla(mesa: Mesa, grilla: Grilla): boolean {
  return mesa.posX !== null && mesa.posY !== null && !entraEnGrilla(mesa, grilla);
}

/** Al pasar a otra zona: columna y fila vacías, y el tamaño ajustado a la grilla nueva. */
export function ubicacionEnOtraZona(actual: Ubicacion, grilla: Grilla): Ubicacion {
  return {
    ...actual,
    columna: undefined,
    fila: undefined,
    ancho: Math.min(actual.ancho, grilla.columnas),
    alto: Math.min(actual.alto, grilla.filas),
  };
}

/** Texto de la columna "Plano" del listado (spec "Ubicación de la Mesa en el plano"). */
export function textoPlano(mesa: Mesa, grilla: Grilla): string {
  if (mesa.posX === null || mesa.posY === null) return "Sin ubicar";
  if (!entraEnGrilla(mesa, grilla)) return "Fuera de la grilla";
  return `Columna ${mesa.posX + 1}, fila ${mesa.posY + 1}`;
}

/** "S5", "S3 y S5" o "S2, S3 y S5". */
function enumerar(etiquetas: string[]): string {
  if (etiquetas.length <= 1) return etiquetas.join("");
  return `${etiquetas.slice(0, -1).join(", ")} y ${etiquetas[etiquetas.length - 1]}`;
}

const numero = (valor: string) => (valor === "" ? undefined : Number(valor));

export function UbicacionPlano({
  etiqueta,
  grilla,
  ubicacion,
  otras,
  fueraDeGrilla,
  error,
  deshabilitado,
  onCambiar,
}: {
  etiqueta: string;
  grilla: Grilla;
  ubicacion: Ubicacion;
  otras: OtrasMesas;
  /** La mesa se abrió fuera de la grilla y sigue en su zona original sin ubicación nueva. */
  fueraDeGrilla: boolean;
  error?: string;
  deshabilitado: boolean;
  onCambiar: (ubicacion: Ubicacion) => void;
}) {
  const { columna, fila, ancho, alto, forma } = ubicacion;
  const ubicada = columna !== undefined && fila !== undefined;
  const mesasOtras = otras.estado === "ok" ? otras.mesas.filter((m) => entraEnGrilla(m, grilla)) : [];
  const superpuestas = ubicada
    ? superposiciones({ posX: columna - 1, posY: fila - 1, ancho, alto }, mesasOtras)
    : [];

  let texto: string;
  if (ubicada) {
    texto = describirUbicacion({ etiqueta, columna, fila, ancho, alto });
    if (superpuestas.length > 0) texto += ` Se superpone con ${enumerar(superpuestas)}.`;
  } else {
    texto = fueraDeGrilla ? TEXTO_FUERA_DE_GRILLA : TEXTO_SIN_UBICAR;
  }

  return (
    <fieldset className="flex flex-col gap-4 rounded-sm border border-border p-4">
      <legend className="px-1 font-display text-base">Ubicación en el plano</legend>
      <div className="grid gap-4 sm:grid-cols-4">
        <Select
          label="Columna"
          value={columna ?? ""}
          disabled={deshabilitado}
          onChange={(e) => onCambiar({ ...ubicacion, columna: numero(e.target.value) })}
        >
          <option value="">Sin elegir</option>
          {opcionesInicio(ancho, grilla.columnas).map((valor) => (
            <option key={valor} value={valor}>
              {valor}
            </option>
          ))}
        </Select>
        <Select
          label="Fila"
          value={fila ?? ""}
          disabled={deshabilitado}
          onChange={(e) => onCambiar({ ...ubicacion, fila: numero(e.target.value) })}
        >
          <option value="">Sin elegir</option>
          {opcionesInicio(alto, grilla.filas).map((valor) => (
            <option key={valor} value={valor}>
              {valor}
            </option>
          ))}
        </Select>
        <Select
          label="Ancho"
          value={ancho}
          disabled={deshabilitado}
          onChange={(e) => {
            const nuevo = Number(e.target.value);
            onCambiar({ ...ubicacion, ancho: nuevo, columna: corregirInicio(columna, nuevo, grilla.columnas) });
          }}
        >
          {opcionesInicio(1, grilla.columnas).map((valor) => (
            <option key={valor} value={valor}>
              {valor}
            </option>
          ))}
        </Select>
        <Select
          label="Alto"
          value={alto}
          disabled={deshabilitado}
          onChange={(e) => {
            const nuevo = Number(e.target.value);
            onCambiar({ ...ubicacion, alto: nuevo, fila: corregirInicio(fila, nuevo, grilla.filas) });
          }}
        >
          {opcionesInicio(1, grilla.filas).map((valor) => (
            <option key={valor} value={valor}>
              {valor}
            </option>
          ))}
        </Select>
      </div>

      <fieldset className="flex flex-wrap items-center gap-4">
        <legend className="mb-1.5 text-sm font-medium text-foreground">Forma</legend>
        {FORMAS.map(({ valor, texto: textoForma }) => (
          <label key={valor} className="flex min-h-11 items-center gap-2 text-base text-foreground">
            <input
              type="radio"
              name="forma-mesa"
              value={valor}
              checked={forma === valor}
              disabled={deshabilitado}
              onChange={() => onCambiar({ ...ubicacion, forma: valor })}
              className="h-4 w-4 accent-primary"
            />
            {textoForma}
          </label>
        ))}
      </fieldset>

      {ubicada ? (
        <div>
          <Button
            variant="secondary"
            disabled={deshabilitado}
            onClick={() => onCambiar({ ...ubicacion, columna: undefined, fila: undefined })}
          >
            Quitar del plano
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* El dibujo es decorativo: el texto con `aria-live` es la alternativa accesible. */}
      <div className="overflow-x-auto">
        <svg
          data-testid="vista-previa"
          aria-hidden="true"
          viewBox={`0 0 ${grilla.columnas * CELDA} ${grilla.filas * CELDA}`}
          className="h-auto w-full max-w-2xl rounded-lg border border-border bg-background"
        >
          {Array.from({ length: grilla.columnas - 1 }, (_, i) => (
            <line
              key={`c${i}`}
              x1={(i + 1) * CELDA}
              x2={(i + 1) * CELDA}
              y1={0}
              y2={grilla.filas * CELDA}
              className="stroke-border"
              strokeOpacity={0.5}
            />
          ))}
          {Array.from({ length: grilla.filas - 1 }, (_, i) => (
            <line
              key={`f${i}`}
              x1={0}
              x2={grilla.columnas * CELDA}
              y1={(i + 1) * CELDA}
              y2={(i + 1) * CELDA}
              className="stroke-border"
              strokeOpacity={0.5}
            />
          ))}
          {mesasOtras.map((otra) => {
            const rect = rectDeMesa(otra.posX ?? 0, otra.posY ?? 0, otra.ancho, otra.alto);
            return (
              <g key={otra.id} data-mesa={otra.etiqueta}>
                <Silueta forma={otra.forma} {...rect} strokeWidth={2} className="fill-muted stroke-border" />
                <text
                  x={rect.x + rect.ancho / 2}
                  y={rect.y + rect.alto / 2 + 5}
                  textAnchor="middle"
                  fontSize={13}
                  className="fill-muted-foreground font-display"
                >
                  {otra.etiqueta}
                </text>
              </g>
            );
          })}
          {ubicada
            ? (() => {
                const rect = rectDeMesa(columna - 1, fila - 1, ancho, alto);
                return (
                  <g data-mesa={etiqueta} data-editada="">
                    <Silueta
                      data-forma={forma}
                      forma={forma}
                      {...rect}
                      strokeWidth={2}
                      className="fill-madera stroke-border"
                    />
                    <text
                      x={rect.x + rect.ancho / 2}
                      y={rect.y + rect.alto / 2 + 5}
                      textAnchor="middle"
                      fontSize={13}
                      fontWeight="600"
                      className="fill-madera-foreground font-display"
                    >
                      {etiqueta}
                    </text>
                  </g>
                );
              })()
            : null}
        </svg>
      </div>

      <p data-testid="ubicacion-texto" aria-live="polite" className="text-base text-foreground">
        {texto}
      </p>
      {otras.estado === "cargando" ? (
        <p className="text-sm text-muted-foreground">Cargando las mesas de la zona…</p>
      ) : null}
      {otras.estado === "error" ? <p className="text-sm text-foreground">{TEXTO_SIN_OTRAS}</p> : null}
    </fieldset>
  );
}
