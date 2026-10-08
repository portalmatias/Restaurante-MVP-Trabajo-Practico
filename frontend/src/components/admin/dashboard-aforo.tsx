"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert } from "../ui/alert";
import { Field } from "../ui/field";
import { Select } from "../ui/select";
import { adminClient, toAdminApiResult } from "../../lib/api/admin-client";
import type { ApiResult } from "../../lib/api/errors";
import type { components } from "../../lib/api/schema";
import { calcularAforo, type Aforo } from "../../lib/aforo/calcular-aforo";
import {
  diaSemanaDeFechaLocal,
  fechaLocalDeHoy,
  formatearFechaLargaEs,
  type DiaSemana,
} from "../../lib/fecha-hora";
import { ETIQUETA_DIA, ordenarTurnos, rangoTurno } from "./formato";
import { ETIQUETA_NIVEL, leerAforo, type NivelAforo } from "./nivel-aforo";
import { Sello } from "./sello";

type Zona = components["schemas"]["ZonaRespuestaDto"];
type Turno = components["schemas"]["TurnoRespuestaDto"];

// Tamaño de página: el máximo que acepta `GET /admin/reservas`. Una sola página no alcanza
// siempre (nada garantiza que la suma de aforos de las Zonas quede por debajo), así que se
// pagina hasta cubrir `total`.
const TAMANIO_PAGINA = 100;

type ReservaAdmin = components["schemas"]["ReservaAdminRespuesta"];
type EstadoActivo = "CONFIRMADA" | "PENDIENTE";

/**
 * Todas las Reservas de un estado activo para una fecha y un Turno, recorriendo las páginas
 * con `offset` hasta juntar `total`. Si una página llega vacía antes de completar el total
 * (las Reservas cambiaron entre páginas), se corta ahí en vez de pedir de más.
 */
async function reservasActivas(
  fecha: string,
  turnoId: string,
  estado: EstadoActivo,
): Promise<ApiResult<ReservaAdmin[]>> {
  const acumuladas: ReservaAdmin[] = [];
  for (;;) {
    const pagina = await toAdminApiResult(
      adminClient.GET("/admin/reservas", {
        params: {
          query: { fecha, turnoId, estado, limit: TAMANIO_PAGINA, offset: acumuladas.length },
        },
      }),
    );
    if (pagina.error) return { error: pagina.error };
    acumuladas.push(...pagina.data.items);
    if (pagina.data.items.length === 0 || acumuladas.length >= pagina.data.total) {
      return { data: acumuladas };
    }
  }
}

function diaSemanaSeguro(fecha: string): DiaSemana | undefined {
  try {
    return diaSemanaDeFechaLocal(fecha);
  } catch {
    return undefined;
  }
}

/**
 * Turnos del día de la semana de `fecha`, los activos primero: un Turno de otro día nunca
 * tiene Reservas en esa fecha, así que no se ofrece.
 */
function turnosDelDia(turnos: Turno[], fecha: string): Turno[] {
  const diaDeLaFecha = diaSemanaSeguro(fecha);
  const delDia = ordenarTurnos(turnos.filter((turno) => turno.diaSemana === diaDeLaFecha));
  return [...delDia.filter((t) => t.activo), ...delDia.filter((t) => !t.activo)];
}

/** `recibidoEn` es la hora en que llegó la consulta: se muestra para que se note si es vieja. */
type ResultadoAforo = { clave: string; aforo?: Aforo; error?: string; recibidoEn?: Date };

function horaCorta(fecha: Date): string {
  return fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function fechaLegible(fecha: string): string {
  try {
    return formatearFechaLargaEs(fecha);
  } catch {
    return fecha;
  }
}

// Relleno de la barra por nivel: nogal con lugar, sumi casi lleno, sello cuando no queda nada.
const RELLENO_BARRA: Record<NivelAforo, string> = {
  holgado: "bg-secondary",
  "casi-lleno": "bg-foreground",
  completo: "bg-accent",
  sobrecupo: "bg-accent",
  "sin-aforo": "bg-muted",
};

const TONO_NIVEL: Record<NivelAforo, "holgado" | "casi-lleno" | "completo"> = {
  holgado: "holgado",
  "casi-lleno": "casi-lleno",
  completo: "completo",
  sobrecupo: "completo",
  "sin-aforo": "holgado",
};

function FilaZona({ nombre, ocupado, maximo }: { nombre: string; ocupado: number; maximo: number }) {
  const { nivel, porcentaje, libres, ancho } = leerAforo(ocupado, maximo);
  return (
    <li className="flex flex-col gap-3 rounded-sm border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg">Zona {nombre}</h3>
        <Sello tono={TONO_NIVEL[nivel]}>{ETIQUETA_NIVEL[nivel]}</Sello>
      </div>
      <p className="tabular font-display text-2xl" data-testid={`aforo-zona-${nombre}`}>
        {ocupado} / {maximo}
      </p>
      <div
        role="meter"
        aria-label={`Ocupación de la zona ${nombre}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, porcentaje)}
        aria-valuetext={`${porcentaje} % ocupado`}
        className="h-3 w-full border border-border bg-muted"
      >
        <div className={`h-full ${RELLENO_BARRA[nivel]}`} style={{ width: `${ancho}%` }} />
      </div>
      <p className="tabular text-sm text-muted-foreground">
        {maximo > 0 ? `${porcentaje} % ocupado · ` : null}
        {libres === 1 ? "1 lugar libre" : `${libres} lugares libres`}
        {nivel === "sobrecupo" ? ` · ${ocupado - maximo} por encima del aforo` : null}
      </p>
    </li>
  );
}

/**
 * Dashboard de aforo (spec "Dashboard de aforo", design.md D5). Las Zonas y los Turnos se
 * piden una sola vez al montar; cada cambio de fecha o de Turno pide todas las Reservas
 * `CONFIRMADA` y `PENDIENTE` de esa combinación (paginando) y recalcula en el cliente.
 */
export function DashboardAforo({ hoy }: { hoy?: string }) {
  const [zonas, setZonas] = useState<Zona[]>();
  const [turnos, setTurnos] = useState<Turno[]>();
  const [errorCatalogo, setErrorCatalogo] = useState<string>();
  const [fecha, setFecha] = useState(() => hoy ?? fechaLocalDeHoy(new Date()));
  const [turnoElegido, setTurnoElegido] = useState<string>();
  // Resultado de la última consulta que respondió, con la fecha y el Turno que la originaron:
  // "cargando" se deriva de que no coincidan con los elegidos ahora.
  const [resultado, setResultado] = useState<ResultadoAforo>();

  useEffect(() => {
    let vigente = true;
    void Promise.all([
      toAdminApiResult(adminClient.GET("/admin/zonas")),
      toAdminApiResult(adminClient.GET("/admin/turnos")),
    ]).then(([resultadoZonas, resultadoTurnos]) => {
      if (!vigente) return;
      if (resultadoZonas.error || resultadoTurnos.error) {
        const error = resultadoZonas.error ?? resultadoTurnos.error;
        setErrorCatalogo(
          error?.tipo === "validacion"
            ? "No se pudieron cargar las zonas y los turnos."
            : error?.mensaje,
        );
        return;
      }
      setZonas(resultadoZonas.data);
      setTurnos(resultadoTurnos.data);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const opcionesTurno = useMemo(() => (turnos ? turnosDelDia(turnos, fecha) : []), [turnos, fecha]);
  // Si el Turno elegido no corresponde al día de la fecha nueva, se toma el primero del día.
  const turnoId = opcionesTurno.some((t) => t.id === turnoElegido)
    ? turnoElegido
    : opcionesTurno[0]?.id;
  const clave = `${fecha}|${turnoId}`;

  useEffect(() => {
    if (!zonas || !turnoId) {
      return;
    }
    let vigente = true;
    const claveConsulta = `${fecha}|${turnoId}`;
    void Promise.all([
      reservasActivas(fecha, turnoId, "CONFIRMADA"),
      reservasActivas(fecha, turnoId, "PENDIENTE"),
    ]).then(
      ([confirmadas, pendientes]) => {
        // La respuesta de una fecha o un Turno que ya no están elegidos no se aplica.
        if (!vigente) return;
        if (confirmadas.error || pendientes.error) {
          const error = confirmadas.error ?? pendientes.error;
          setResultado({
            clave: claveConsulta,
            error: error?.tipo === "validacion" ? "La fecha elegida no es válida." : error?.mensaje,
          });
          return;
        }
        setResultado({
          clave: claveConsulta,
          aforo: calcularAforo(zonas, [...confirmadas.data, ...pendientes.data]),
          recibidoEn: new Date(),
        });
      },
    );
    return () => {
      vigente = false;
    };
  }, [zonas, fecha, turnoId]);

  const cargando = Boolean(zonas && turnoId) && resultado?.clave !== clave;
  // Mientras llega la consulta nueva se sigue mostrando la anterior, marcada `aria-busy`.
  const aforo = turnoId ? resultado?.aforo : undefined;
  const errorAforo = resultado?.clave === clave ? resultado.error : undefined;
  const dia = diaSemanaSeguro(fecha);

  const turnoActual = opcionesTurno.find((t) => t.id === turnoId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl">Aforo</h1>
      {errorCatalogo ? <Alert variant="error">{errorCatalogo}</Alert> : null}
      <div className="grid gap-4 sm:max-w-2xl sm:grid-cols-2">
        <Field
          label="Fecha"
          type="date"
          value={fecha}
          onChange={(evento) => {
            // Un campo de fecha vaciado no es una fecha: se conserva la última válida.
            if (evento.target.value) setFecha(evento.target.value);
          }}
        />
        <Select
          label="Turno"
          value={turnoId ?? ""}
          disabled={opcionesTurno.length === 0}
          onChange={(evento) => setTurnoElegido(evento.target.value)}
        >
          {opcionesTurno.length === 0 ? <option value="">Sin turnos para ese día</option> : null}
          {opcionesTurno.map((turno) => (
            <option key={turno.id} value={turno.id}>
              {rangoTurno(turno)}
              {turno.activo ? "" : " (inactivo)"}
            </option>
          ))}
        </Select>
      </div>

      {turnos && opcionesTurno.length === 0 ? (
        <Alert>
          {dia
            ? `No hay turnos configurados para los ${ETIQUETA_DIA[dia].toLowerCase()}. Elegí otra fecha.`
            : "La fecha elegida no es válida. Elegí otra fecha."}
        </Alert>
      ) : null}
      {errorAforo ? <Alert variant="error">{errorAforo}</Alert> : null}

      {zonas && aforo && !errorAforo ? (
        <section
          aria-label="Aforo de la noche"
          aria-busy={cargando}
          className={`flex flex-col gap-4 transition-opacity duration-200 motion-reduce:transition-none ${
            cargando ? "opacity-60" : ""
          }`}
        >
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-border pb-3">
            <div>
              <h2 className="font-display text-xl">
                {fechaLegible(fecha)}
                {turnoActual ? `, ${rangoTurno(turnoActual)}` : null}
              </h2>
              <p className="text-sm text-muted-foreground">
                <span className="tabular font-display text-lg text-foreground" data-testid="aforo-global">
                  {aforo.global.ocupado}
                </span>{" "}
                comensales en todo el salón
              </p>
            </div>
            <p aria-live="polite" className="tabular text-sm text-muted-foreground">
              {cargando
                ? "Actualizando: se muestra la consulta anterior."
                : resultado?.recibidoEn
                  ? `Datos de las ${horaCorta(resultado.recibidoEn)}`
                  : null}
            </p>
          </div>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {zonas.map((zona) => (
              <FilaZona
                key={zona.id}
                nombre={zona.nombre}
                ocupado={aforo.porZona[zona.id].ocupado}
                maximo={aforo.porZona[zona.id].maximo}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {cargando && !aforo ? (
        <p role="status" className="text-sm text-muted-foreground">
          Cargando aforo…
        </p>
      ) : null}
    </div>
  );
}
