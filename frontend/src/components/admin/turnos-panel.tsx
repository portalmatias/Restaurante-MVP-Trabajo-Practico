"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Alert } from "../ui/alert";
import { Button } from "../ui/button";
import { BotonCompacto } from "./boton-compacto";
import { Card } from "../ui/card";
import { Field } from "../ui/field";
import { Select } from "../ui/select";
import { adminClient, toAdminApiResult } from "../../lib/api/admin-client";
import type { components } from "../../lib/api/schema";
import type { DiaSemana } from "../../lib/fecha-hora";
import { repartirErrores, type ReglaCampo } from "./errores-campo";
import { Sello } from "./sello";
import { DIAS_SEMANA, ETIQUETA_DIA, horaTurno, ordenarTurnos, rangoTurno } from "./formato";

type Turno = components["schemas"]["TurnoRespuestaDto"];

type CampoTurno = "diaSemana" | "horaInicio" | "horaFin";

const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const REGLAS: Record<CampoTurno, ReglaCampo> = {
  diaSemana: { coincide: /^diaSemana/, textoPorDefecto: "Elegí un día de la semana." },
  horaInicio: { coincide: /^horaInicio/, textoPorDefecto: "Ingresá una hora con formato HH:mm." },
  horaFin: { coincide: /^horaFin/, textoPorDefecto: "Ingresá una hora con formato HH:mm." },
};

/**
 * Alta, listado, edición y activación de Turnos (spec "Alta, listado, edición y activación de
 * Turnos"). Las horas se muestran en `HH:mm` tal cual la hora local del restaurante, sin
 * conversión de huso horario. Desactivar un Turno no lo quita del listado.
 */
export function TurnosPanel() {
  const [turnos, setTurnos] = useState<Turno[]>();
  const [errorListado, setErrorListado] = useState<string>();
  const [editando, setEditando] = useState<Turno | "nuevo">();
  const [cambiandoEstado, setCambiandoEstado] = useState<string>();
  const [errorEstado, setErrorEstado] = useState<{ turnoId: string; mensaje: string }>();

  useEffect(() => {
    let vigente = true;
    void toAdminApiResult(adminClient.GET("/admin/turnos")).then((resultado) => {
      if (!vigente) return;
      if (resultado.error) setErrorListado(resultado.error.tipo === "validacion" ? "No se pudo cargar el listado de turnos." : resultado.error.mensaje);
      else setTurnos(resultado.data);
    });
    return () => {
      vigente = false;
    };
  }, []);

  function reemplazar(turno: Turno) {
    setTurnos((actuales = []) =>
      actuales.some((t) => t.id === turno.id)
        ? actuales.map((t) => (t.id === turno.id ? turno : t))
        : [...actuales, turno],
    );
  }

  async function alternarActivo(turno: Turno) {
    setCambiandoEstado(turno.id);
    setErrorEstado(undefined);
    const resultado = await toAdminApiResult(
      adminClient.PATCH("/admin/turnos/{id}", {
        params: { path: { id: turno.id } },
        body: { activo: !turno.activo },
      }),
    );
    setCambiandoEstado(undefined);
    if (resultado.error) {
      setErrorEstado({ turnoId: turno.id, mensaje: resultado.error.tipo === "validacion" ? "No se pudo cambiar el estado del turno." : resultado.error.mensaje });
      return;
    }
    reemplazar(resultado.data);
  }

  return (
    <Card title="Turnos">
      <div className="flex flex-col gap-4">
        <div>
          {/* Sin listado cargado no se ofrecen altas: el GET inicial pisaría el turno nuevo. */}
          <Button
            variant="secondary"
            disabled={turnos === undefined || editando !== undefined}
            onClick={() => setEditando("nuevo")}
          >
            Agregar turno
          </Button>
        </div>

        {editando ? (
          <FormularioTurno
            key={editando === "nuevo" ? "nuevo" : editando.id}
            turno={editando === "nuevo" ? undefined : editando}
            onCancelar={() => setEditando(undefined)}
            onGuardado={(turno) => {
              reemplazar(turno);
              // Solo se cierra el formulario que originó el guardado: una respuesta atrasada no
              // cierra otro que se haya abierto mientras tanto.
              const origen = editando;
              setEditando((actual) => (actual === origen ? undefined : actual));
            }}
          />
        ) : null}

        {errorListado ? <Alert variant="error">{errorListado}</Alert> : null}
        {turnos === undefined && !errorListado ? (
          <p role="status" className="text-sm text-muted-foreground">Cargando turnos…</p>
        ) : null}
        {turnos && turnos.length === 0 ? <p className="text-sm text-muted-foreground">No hay turnos cargados.</p> : null}
        {turnos && turnos.length > 0 ? (
          <div className="relative overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Día</th>
                  <th scope="col" className="px-3 py-2 font-medium">Horario</th>
                  <th scope="col" className="px-3 py-2 font-medium">Estado</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {ordenarTurnos(turnos).map((turno) => {
                  const descripcion = `${ETIQUETA_DIA[turno.diaSemana]} ${rangoTurno(turno)}`;
                  return (
                    <tr key={turno.id} className="border-t border-border align-top">
                      <th scope="row" className="px-3 py-2 font-medium">{ETIQUETA_DIA[turno.diaSemana]}</th>
                      <td className="tabular px-3 py-2">{rangoTurno(turno)}</td>
                      <td className="px-3 py-2">
                        <Sello tono={turno.activo ? "activo" : "inactivo"}>{turno.activo ? "Activo" : "Inactivo"}</Sello>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <BotonCompacto
                            variant="ghost"
                            aria-label={`Editar turno ${descripcion}`}
                            // Con un formulario abierto no se reemplaza por otro: se perderían
                            // sus cambios sin guardar. Hay que guardar o cancelar primero.
                            disabled={editando !== undefined}
                            onClick={() => setEditando(turno)}
                          >
                            Editar
                          </BotonCompacto>
                          <BotonCompacto
                            variant="secondary"
                            // Un solo cambio de estado a la vez: dos PATCH cruzados
                            // podrían resolverse en otro orden que el de los clics.
                            disabled={cambiandoEstado !== undefined}
                            aria-label={`${turno.activo ? "Desactivar" : "Activar"} turno ${descripcion}`}
                            onClick={() => void alternarActivo(turno)}
                          >
                            {turno.activo ? "Desactivar" : "Activar"}
                          </BotonCompacto>
                        </div>
                        {errorEstado?.turnoId === turno.id ? (
                          <Alert variant="error" className="mt-2">{errorEstado.mensaje}</Alert>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function FormularioTurno({
  turno,
  onCancelar,
  onGuardado,
}: {
  turno?: Turno;
  onCancelar: () => void;
  onGuardado: (turno: Turno) => void;
}) {
  const [diaSemana, setDiaSemana] = useState<DiaSemana>(turno?.diaSemana ?? "LUNES");
  const [horaInicio, setHoraInicio] = useState(turno ? horaTurno(turno.horaInicio) : "");
  const [horaFin, setHoraFin] = useState(turno ? horaTurno(turno.horaFin) : "");
  const [errores, setErrores] = useState<Partial<Record<CampoTurno, string>>>({});
  const [errorGeneral, setErrorGeneral] = useState<string>();
  const [guardando, setGuardando] = useState(false);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;
    const nuevosErrores: Partial<Record<CampoTurno, string>> = {
      horaInicio: FORMATO_HORA.test(horaInicio) ? undefined : REGLAS.horaInicio.textoPorDefecto,
      horaFin: FORMATO_HORA.test(horaFin) ? undefined : REGLAS.horaFin.textoPorDefecto,
    };
    setErrores(nuevosErrores);
    setErrorGeneral(undefined);
    if (Object.values(nuevosErrores).some(Boolean)) return;

    setGuardando(true);
    const resultado = await toAdminApiResult(
      turno
        ? adminClient.PATCH("/admin/turnos/{id}", {
            params: { path: { id: turno.id } },
            body: { diaSemana, horaInicio, horaFin },
          })
        : adminClient.POST("/admin/turnos", { body: { diaSemana, horaInicio, horaFin, activo: true } }),
    );
    setGuardando(false);
    if (resultado.error) {
      if (resultado.error.tipo === "conflicto") {
        // "Ya existe un turno para ese día y esa hora de inicio.": el choque es de los dos
        // campos a la vez (spec "Turno duplicado rechazado").
        setErrores({ diaSemana: resultado.error.mensaje, horaInicio: resultado.error.mensaje });
        return;
      }
      const { porCampo, general } = repartirErrores(resultado.error, REGLAS);
      setErrores(porCampo);
      setErrorGeneral(general);
      return;
    }
    onGuardado(resultado.data);
  }

  const titulo = turno
    ? `Editar turno ${ETIQUETA_DIA[turno.diaSemana]} ${rangoTurno(turno)}`
    : "Nuevo turno";
  return (
    <form onSubmit={guardar} noValidate aria-label={titulo} className="flex flex-col gap-4 border-b border-border pb-4">
      <h3 className="font-display text-base">{titulo}</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        {/* El botón que abrió el formulario queda deshabilitado y suelta el foco: se lleva al
            primer campo para que quien usa teclado no pierda la posición. */}
        <Select
          autoFocus
          label="Día"
          value={diaSemana}
          disabled={guardando}
          error={errores.diaSemana}
          onChange={(e) => setDiaSemana(e.target.value as DiaSemana)}
        >
          {DIAS_SEMANA.map((dia) => (
            <option key={dia} value={dia}>
              {ETIQUETA_DIA[dia]}
            </option>
          ))}
        </Select>
        <Field
          label="Hora de inicio"
          type="time"
          value={horaInicio}
          disabled={guardando}
          error={errores.horaInicio}
          onChange={(e) => setHoraInicio(e.target.value)}
        />
        <Field
          label="Hora de fin"
          type="time"
          value={horaFin}
          disabled={guardando}
          error={errores.horaFin}
          aria-describedby="hora-fin-ayuda"
          onChange={(e) => setHoraFin(e.target.value)}
        />
      </div>
      <p id="hora-fin-ayuda" className="text-sm text-muted-foreground">
        Si la hora de fin es anterior a la de inicio, el turno termina al día siguiente.
      </p>
      {errorGeneral ? <Alert variant="error">{errorGeneral}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={guardando}>
          {guardando ? "Guardando…" : turno ? "Guardar cambios" : "Guardar turno"}
        </Button>
        <Button variant="secondary" disabled={guardando} onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
