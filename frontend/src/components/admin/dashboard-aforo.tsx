"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert } from "../ui/alert";
import { Card } from "../ui/card";
import { Field } from "../ui/field";
import { Select } from "../ui/select";
import { adminClient, toAdminApiResult } from "../../lib/api/admin-client";
import type { components } from "../../lib/api/schema";
import { calcularAforo, type Aforo } from "../../lib/aforo/calcular-aforo";
import { diaSemanaDeFechaLocal, fechaLocalDeHoy, type DiaSemana } from "../../lib/fecha-hora";
import { ETIQUETA_DIA, ordenarTurnos, rangoTurno } from "./formato";

type Zona = components["schemas"]["ZonaRespuestaDto"];
type Turno = components["schemas"]["TurnoRespuestaDto"];

// Cota real de filas por estado activo (D5): cada Reserva activa suma al menos 1 comensal, así
// que no puede haber más filas que la suma de aforos de las Zonas.
const LIMITE_POR_ESTADO = 100;

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

type ResultadoAforo = { clave: string; aforo?: Aforo; error?: string };

/**
 * Dashboard de aforo (spec "Dashboard de aforo", design.md D5). Las Zonas y los Turnos se
 * piden una sola vez al montar; cada cambio de fecha o de Turno pide solo las Reservas
 * `CONFIRMADA` y `PENDIENTE` de esa combinación y recalcula en el cliente.
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
    const pedir = (estado: "CONFIRMADA" | "PENDIENTE") =>
      toAdminApiResult(
        adminClient.GET("/admin/reservas", {
          params: { query: { fecha, turnoId, estado, limit: LIMITE_POR_ESTADO } },
        }),
      );
    void Promise.all([pedir("CONFIRMADA"), pedir("PENDIENTE")]).then(
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
          aforo: calcularAforo(zonas, [...confirmadas.data.items, ...pendientes.data.items]),
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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Aforo</h1>
      {errorCatalogo ? <Alert variant="error">{errorCatalogo}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
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
            : "La fecha elegida no es válida."}
        </Alert>
      ) : null}
      {errorAforo ? <Alert variant="error">{errorAforo}</Alert> : null}

      {zonas && aforo && !errorAforo ? (
        <div aria-busy={cargando} className="grid gap-4 sm:grid-cols-3">
          <Card title="Ocupación total">
            <p className="text-3xl font-semibold" data-testid="aforo-global">
              {aforo.global.ocupado}
            </p>
            <p className="text-sm text-muted-foreground">comensales en todo el salón</p>
          </Card>
          {zonas.map((zona) => {
            const { ocupado, maximo } = aforo.porZona[zona.id];
            return (
              <Card key={zona.id} title={`Zona ${zona.nombre}`}>
                <p className="text-3xl font-semibold" data-testid={`aforo-zona-${zona.nombre}`}>
                  {ocupado} <span className="text-lg text-muted-foreground">/ {maximo}</span>
                </p>
                <p className="text-sm text-muted-foreground">comensales</p>
              </Card>
            );
          })}
        </div>
      ) : null}
      {cargando && !aforo ? (
        <p role="status" className="text-sm text-muted-foreground">
          Calculando el aforo…
        </p>
      ) : null}
    </div>
  );
}
