"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "../ui/alert";
import { Button } from "../ui/button";
import { BotonCompacto } from "./boton-compacto";
import { Card } from "../ui/card";
import { Field } from "../ui/field";
import { adminClient, toAdminApiResult } from "../../lib/api/admin-client";
import type { components } from "../../lib/api/schema";
import { leerEntero, repartirErrores, type ReglaCampo } from "./errores-campo";

type Zona = components["schemas"]["ZonaRespuestaDto"];

type CampoNumerico =
  | "minComensales"
  | "maxComensales"
  | "anticipacionMinHoras"
  | "anticipacionMaxDias"
  | "ventanaCancelacionHoras"
  | "aforoMaximo";

const CAMPOS: { campo: CampoNumerico; etiqueta: string; minimo: number }[] = [
  { campo: "minComensales", etiqueta: "Mínimo de comensales", minimo: 1 },
  { campo: "maxComensales", etiqueta: "Máximo de comensales", minimo: 1 },
  { campo: "anticipacionMinHoras", etiqueta: "Anticipación mínima (horas)", minimo: 0 },
  { campo: "anticipacionMaxDias", etiqueta: "Anticipación máxima (días)", minimo: 0 },
  { campo: "ventanaCancelacionHoras", etiqueta: "Ventana de cancelación (horas)", minimo: 0 },
  { campo: "aforoMaximo", etiqueta: "Aforo máximo", minimo: 0 },
];

const REGLAS: Record<CampoNumerico | "requiereConfirmacionAdmin", ReglaCampo> = {
  // El 400 de regla de negocio ("El mínimo de comensales no puede ser mayor que el máximo.")
  // va junto al mínimo.
  minComensales: { coincide: /^minComensales|mínimo de comensales/i, textoPorDefecto: "Ingresá un entero mayor o igual a 1." },
  maxComensales: { coincide: /^maxComensales/, textoPorDefecto: "Ingresá un entero mayor o igual a 1." },
  anticipacionMinHoras: { coincide: /^anticipacionMinHoras/, textoPorDefecto: "Ingresá un entero mayor o igual a 0." },
  anticipacionMaxDias: { coincide: /^anticipacionMaxDias/, textoPorDefecto: "Ingresá un entero mayor o igual a 0." },
  ventanaCancelacionHoras: { coincide: /^ventanaCancelacionHoras/, textoPorDefecto: "Ingresá un entero mayor o igual a 0." },
  aforoMaximo: { coincide: /^aforoMaximo/, textoPorDefecto: "Ingresá un entero mayor o igual a 0." },
  requiereConfirmacionAdmin: { coincide: /^requiereConfirmacionAdmin/, textoPorDefecto: "Valor inválido." },
};

function sinoNo(valor: boolean): string {
  return valor ? "Sí" : "No";
}

export type ZonasPanelProps = {
  zonas: Zona[];
  onZonaActualizada: (zona: Zona) => void;
};

/**
 * Listado y edición de Zonas (spec "Listado y edición de Zonas"). No ofrece alta ni baja:
 * `gestion-salon` no las soporta.
 */
export function ZonasPanel({ zonas, onZonaActualizada }: ZonasPanelProps) {
  const [editando, setEditando] = useState<Zona>();

  return (
    <Card title="Zonas">
      <div className="relative overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="py-2 pr-3">Zona</th>
              <th scope="col" className="py-2 pr-3">Comensales</th>
              <th scope="col" className="py-2 pr-3">Anticipación</th>
              <th scope="col" className="py-2 pr-3">Cancelación</th>
              <th scope="col" className="py-2 pr-3">Confirmación</th>
              <th scope="col" className="py-2 pr-3">Aforo</th>
              <th scope="col" className="py-2"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {zonas.map((zona) => (
              <tr key={zona.id} className="border-t border-border">
                <th scope="row" className="py-2 pr-3 font-medium">{zona.nombre}</th>
                <td className="py-2 pr-3">{zona.minComensales} a {zona.maxComensales}</td>
                <td className="py-2 pr-3">{zona.anticipacionMinHoras} h a {zona.anticipacionMaxDias} días</td>
                <td className="py-2 pr-3">{zona.ventanaCancelacionHoras} h antes</td>
                <td className="py-2 pr-3">{sinoNo(zona.requiereConfirmacionAdmin)}</td>
                <td className="py-2 pr-3">{zona.aforoMaximo}</td>
                <td className="py-2">
                  <BotonCompacto
                    variant="ghost"
                    aria-label={`Editar zona ${zona.nombre}`}
                    // Con un formulario abierto no se reemplaza por otro: se perderían sus
                    // cambios sin guardar. Hay que guardar o cancelar primero.
                    disabled={editando !== undefined}
                    onClick={() => setEditando(zona)}
                  >
                    Editar
                  </BotonCompacto>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editando ? (
        <FormularioZona
          key={editando.id}
          zona={editando}
          onCancelar={() => setEditando(undefined)}
          onGuardada={(zona) => {
            onZonaActualizada(zona);
            // Solo se cierra el formulario de esa misma Zona: si mientras tanto se abrió el de
            // otra, la respuesta atrasada no lo cierra.
            setEditando((actual) => (actual?.id === zona.id ? undefined : actual));
          }}
        />
      ) : null}
    </Card>
  );
}

function FormularioZona({
  zona,
  onCancelar,
  onGuardada,
}: {
  zona: Zona;
  onCancelar: () => void;
  onGuardada: (zona: Zona) => void;
}) {
  const [valores, setValores] = useState<Record<CampoNumerico, string>>(() => {
    const iniciales = {} as Record<CampoNumerico, string>;
    for (const { campo } of CAMPOS) iniciales[campo] = String(zona[campo]);
    return iniciales;
  });
  const [requiereConfirmacion, setRequiereConfirmacion] = useState(zona.requiereConfirmacionAdmin);
  const [errores, setErrores] = useState<Partial<Record<CampoNumerico, string>>>({});
  const [errorGeneral, setErrorGeneral] = useState<string>();
  const [guardando, setGuardando] = useState(false);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    // Solo viajan los campos que el admin cambió: así una edición no pisa con valores viejos lo
    // que otra persona haya modificado en otro campo mientras tanto.
    const cuerpo: Partial<Record<CampoNumerico, number>> & { requiereConfirmacionAdmin?: boolean } =
      {};
    const nuevosErrores: Partial<Record<CampoNumerico, string>> = {};
    for (const { campo, minimo } of CAMPOS) {
      const numero = leerEntero(valores[campo], minimo);
      if (numero === undefined) nuevosErrores[campo] = REGLAS[campo].textoPorDefecto;
      else if (numero !== zona[campo]) cuerpo[campo] = numero;
    }
    if (requiereConfirmacion !== zona.requiereConfirmacionAdmin) {
      cuerpo.requiereConfirmacionAdmin = requiereConfirmacion;
    }
    setErrores(nuevosErrores);
    setErrorGeneral(undefined);
    if (Object.keys(nuevosErrores).length > 0) return;
    if (Object.keys(cuerpo).length === 0) {
      onCancelar();
      return;
    }

    setGuardando(true);
    const resultado = await toAdminApiResult(
      adminClient.PATCH("/admin/zonas/{id}", {
        params: { path: { id: zona.id } },
        body: cuerpo,
      }),
    );
    setGuardando(false);

    if (resultado.error) {
      const { porCampo, general } = repartirErrores(resultado.error, REGLAS);
      setErrores(porCampo);
      setErrorGeneral(general);
      return;
    }
    onGuardada(resultado.data);
  }

  return (
    <form
      onSubmit={guardar}
      noValidate
      aria-label={`Editar zona ${zona.nombre}`}
      className="mt-4 flex flex-col gap-4 border-t border-border pt-4"
    >
      <h3 className="font-semibold">Editar zona {zona.nombre}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {CAMPOS.map(({ campo, etiqueta, minimo }) => (
          <Field
            key={campo}
            // El botón "Editar" queda deshabilitado y suelta el foco: va al primer campo.
            autoFocus={campo === CAMPOS[0].campo}
            label={etiqueta}
            type="number"
            inputMode="numeric"
            min={minimo}
            step={1}
            value={valores[campo]}
            disabled={guardando}
            error={errores[campo]}
            onChange={(e) => setValores((v) => ({ ...v, [campo]: e.target.value }))}
          />
        ))}
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-5"
          checked={requiereConfirmacion}
          disabled={guardando}
          onChange={(e) => setRequiereConfirmacion(e.target.checked)}
        />
        Las reservas requieren confirmación del administrador
      </label>
      {errorGeneral ? <Alert variant="error">{errorGeneral}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </Button>
        <Button variant="secondary" disabled={guardando} onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
