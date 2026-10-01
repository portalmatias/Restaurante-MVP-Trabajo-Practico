"use client";

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "../ui/alert";
import { Button, buttonVariants } from "../ui/button";
import { Field } from "../ui/field";
import { Select } from "../ui/select";
import type { components } from "../../lib/api/schema";
import {
  diaSemanaDeFechaLocal,
  formatearHoraTurno,
} from "../../lib/fecha-hora";
import {
  esFechaElegible,
  resolverSeleccionInicial,
  urlConSeleccion,
  type SeleccionCruda,
} from "../../lib/seleccion-reserva";
import { PasosReserva } from "./pasos-reserva";

type ZonaPublica = components["schemas"]["ZonaPublicaRespuestaDto"];
type TurnoPublico = components["schemas"]["TurnoPublicoRespuestaDto"];

export type FormularioSeleccionProps = {
  zonas: ZonaPublica[];
  turnos: TurnoPublico[];
  /** Fecha de hoy (`YYYY-MM-DD`, calendario del restaurante) calculada en el servidor. */
  hoy: string;
  /** Selección previa tal como llega de `searchParams`; lo que no es coherente se ignora. */
  seleccionInicial?: SeleccionCruda;
};

function pluralizar(cantidad: number, singular: string, plural: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`;
}

// "a", "a y b", "a, b y c".
function listar(elementos: string[]): string {
  if (elementos.length <= 1) return elementos.join("");
  return `${elementos.slice(0, -1).join(", ")} y ${elementos[elementos.length - 1]}`;
}

function acotar(valor: number, minimo: number, maximo: number): number {
  return Math.min(Math.max(valor, minimo), maximo);
}

/**
 * Paso 1 del asistente: fecha, turno, zona y comensales (design.md D3 Pantalla 2). Los cuatro
 * datos son obligatorios para continuar; al confirmar arma la URL del resultado con la
 * selección (D1) y navega. Las reglas que aplica acá (turnos del día, rango de comensales, fecha
 * mínima) son ayudas de navegación: la validación real es siempre la del servidor.
 */
export function FormularioSeleccion({
  zonas,
  turnos,
  hoy,
  seleccionInicial = {},
}: FormularioSeleccionProps) {
  const router = useRouter();
  const tituloZonaId = useId();
  const opcionesZona = useRef<Array<HTMLButtonElement | null>>([]);
  const [inicial] = useState(() => resolverSeleccionInicial(seleccionInicial, { zonas, turnos, hoy }));
  const [fecha, setFecha] = useState(inicial.fecha ?? "");
  const [turnoId, setTurnoId] = useState(inicial.turnoId ?? "");
  const [zonaId, setZonaId] = useState(inicial.zonaId ?? "");
  const [comensales, setComensales] = useState<number | undefined>(inicial.comensales);

  const fechaElegible = esFechaElegible(fecha, hoy);
  const turnosDelDia = fechaElegible
    ? turnos.filter((turno) => turno.diaSemana === diaSemanaDeFechaLocal(fecha))
    : [];
  const turnoElegido = turnosDelDia.find((turno) => turno.id === turnoId);
  const zona = zonas.find((candidata) => candidata.id === zonaId);

  const faltantes: string[] = [];
  if (!fechaElegible) faltantes.push("fecha");
  if (!turnoElegido) faltantes.push("turno");
  if (!zona) faltantes.push("zona");
  else if (
    comensales === undefined ||
    comensales < zona.minComensales ||
    comensales > zona.maxComensales
  ) {
    faltantes.push("comensales");
  }

  function cambiarFecha(nuevaFecha: string) {
    setFecha(nuevaFecha);
    // Un turno es de un día de la semana: si la nueva fecha cae en otro, ya no corresponde.
    const turnoActual = turnos.find((turno) => turno.id === turnoId);
    const sigueCorrespondiendo =
      turnoActual !== undefined &&
      esFechaElegible(nuevaFecha, hoy) &&
      turnoActual.diaSemana === diaSemanaDeFechaLocal(nuevaFecha);
    if (!sigueCorrespondiendo) setTurnoId("");
  }

  function elegirZona(nuevaZona: ZonaPublica) {
    setZonaId(nuevaZona.id);
    // Sin cantidad previa parte del mínimo de la zona; con una, se ajusta al rango nuevo.
    setComensales((actual) =>
      actual === undefined
        ? nuevaZona.minComensales
        : acotar(actual, nuevaZona.minComensales, nuevaZona.maxComensales),
    );
  }

  // Grupo de radio: las flechas mueven la selección (con vuelta al extremo) y el foco.
  function moverZona(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const paso =
      evento.key === "ArrowDown" || evento.key === "ArrowRight"
        ? 1
        : evento.key === "ArrowUp" || evento.key === "ArrowLeft"
          ? -1
          : 0;
    if (paso === 0) return;
    evento.preventDefault();
    const destino = (indice + paso + zonas.length) % zonas.length;
    elegirZona(zonas[destino]);
    opcionesZona.current[destino]?.focus();
  }

  function subirComensales() {
    if (!zona) return;
    setComensales((actual) => (actual === undefined ? zona.minComensales : Math.min(actual + 1, zona.maxComensales)));
  }

  function bajarComensales() {
    if (!zona) return;
    setComensales((actual) => (actual === undefined ? actual : Math.max(actual - 1, zona.minComensales)));
  }

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (faltantes.length > 0 || !turnoElegido || !zona || comensales === undefined) {
      return;
    }
    router.push(
      urlConSeleccion("/reservas/nueva/resultado", {
        fecha,
        turnoId: turnoElegido.id,
        zonaId: zona.id,
        comensales,
      }),
    );
  }

  const botonesStepper = buttonVariants({
    variant: "secondary",
    fullWidth: false,
    className: "w-11 px-0 text-xl",
  });

  return (
    <form onSubmit={alEnviar} noValidate className="flex flex-col gap-6">
      <PasosReserva pasoActual={1} total={3} />
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">¿Cuándo y para cuántos?</h1>

      <Field
        label="Fecha"
        name="fecha"
        type="date"
        min={hoy}
        value={fecha}
        error={fecha !== "" && !fechaElegible ? "Elegí una fecha desde hoy." : undefined}
        onChange={(evento) => cambiarFecha(evento.target.value)}
      />

      {fechaElegible && turnosDelDia.length === 0 ? (
        <Alert variant="info" className="text-base">
          No hay turnos disponibles ese día. Elegí otra fecha.
        </Alert>
      ) : (
        <Select
          label="Turno"
          name="turnoId"
          value={turnoId}
          disabled={!fechaElegible}
          onChange={(evento) => setTurnoId(evento.target.value)}
        >
          <option value="">Elegí un turno</option>
          {turnosDelDia.map((turno) => (
            <option key={turno.id} value={turno.id}>
              {`${formatearHoraTurno(turno.horaInicio)} a ${formatearHoraTurno(turno.horaFin)}`}
            </option>
          ))}
        </Select>
      )}

      <div className="flex flex-col gap-1.5">
        <span id={tituloZonaId} className="text-sm font-medium text-foreground">
          Zona
        </span>
        <div role="radiogroup" aria-labelledby={tituloZonaId} className="flex flex-col gap-3">
          {zonas.map((opcion, indice) => {
            const elegida = opcion.id === zonaId;
            // Roving tabindex: solo la opción elegida (o la primera, si no hay) entra con Tab.
            const enTabulacion = zona ? elegida : indice === 0;
            const borde = elegida
              ? opcion.requiereConfirmacionAdmin
                ? "border-2 border-accent"
                : "border-2 border-primary"
              : "border border-border";
            return (
              <button
                key={opcion.id}
                ref={(nodo) => {
                  opcionesZona.current[indice] = nodo;
                }}
                type="button"
                role="radio"
                aria-checked={elegida}
                tabIndex={enTabulacion ? 0 : -1}
                onClick={() => elegirZona(opcion)}
                onKeyDown={(evento) => moverZona(evento, indice)}
                className={`flex min-h-11 flex-col gap-1 rounded-lg bg-card p-4 text-left text-base text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${borde}`}
              >
                <span className="flex items-center justify-between gap-2 text-lg font-semibold">
                  {opcion.nombre}
                  {elegida ? (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12.5 10 17.5 19 7.5" />
                    </svg>
                  ) : null}
                </span>
                <span>{`${opcion.minComensales} a ${opcion.maxComensales} comensales`}</span>
                <span className="text-muted-foreground">
                  {`Se reserva con ${pluralizar(opcion.anticipacionMinHoras, "hora", "horas")} a ${pluralizar(opcion.anticipacionMaxDias, "día", "días")} de anticipación`}
                </span>
                {opcion.requiereConfirmacionAdmin ? (
                  <span className="mt-1 self-start rounded-md bg-accent px-2 py-1 text-sm font-medium text-accent-foreground">
                    Queda pendiente de confirmación
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div role="group" aria-labelledby={`${tituloZonaId}-comensales`} className="flex flex-col gap-1.5">
        <span id={`${tituloZonaId}-comensales`} className="text-sm font-medium text-foreground">
          Comensales
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Menos comensales"
            className={botonesStepper}
            disabled={!zona || comensales === undefined || comensales <= zona.minComensales}
            onClick={bajarComensales}
          >
            <span aria-hidden="true">−</span>
          </button>
          <output
            aria-label="Cantidad de comensales"
            className="min-w-12 text-center text-2xl font-semibold text-foreground"
          >
            {comensales ?? "–"}
          </output>
          <button
            type="button"
            aria-label="Más comensales"
            className={botonesStepper}
            disabled={!zona || (comensales !== undefined && comensales >= zona.maxComensales)}
            onClick={subirComensales}
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" disabled={faltantes.length > 0}>
          Ver disponibilidad
        </Button>
        {/* Región siempre montada: así el lector de pantalla anuncia los cambios de la lista. */}
        <p aria-live="polite" className="text-base text-muted-foreground">
          {faltantes.length > 0 ? `Falta elegir: ${listar(faltantes)}` : ""}
        </p>
      </div>
    </form>
  );
}
