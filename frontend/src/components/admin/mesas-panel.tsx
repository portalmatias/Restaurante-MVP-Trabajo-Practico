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
import { ConfirmacionEnLinea } from "./confirmacion-en-linea";
import { leerEntero, repartirErrores, type ReglaCampo } from "./errores-campo";

type Zona = components["schemas"]["ZonaRespuestaDto"];
type Mesa = components["schemas"]["MesaRespuestaDto"];

type CampoMesa = "zonaId" | "capacidad" | "etiqueta";

const REGLAS: Record<CampoMesa, ReglaCampo> = {
  // 404 "La zona indicada no existe." (spec "Zona inexistente rechazada") y el 409 de cambiar
  // de Zona una Mesa con Reservas activas.
  zonaId: { coincide: /^zonaId|zona indicada|cambiar de zona/i, textoPorDefecto: "Elegí una zona válida." },
  capacidad: { coincide: /^capacidad|capacidad/i, textoPorDefecto: "Ingresá un entero mayor o igual a 1." },
  // 409 "Ya existe una mesa con esa etiqueta." (spec "Etiqueta duplicada rechazada").
  etiqueta: { coincide: /^etiqueta|etiqueta/i, textoPorDefecto: "Ingresá una etiqueta." },
};

/**
 * Alta, listado, edición y baja de Mesas (specs "Alta, listado y edición de Mesas" y "Baja de
 * Mesa con confirmación"). Tras cada operación se actualiza el listado local con la respuesta,
 * sin volver a pedirlo: las rutas de salón tienen el límite de solicitudes global.
 */
export function MesasPanel({ zonas }: { zonas: Zona[] }) {
  const [filtroZona, setFiltroZona] = useState("");
  // Último listado que respondió, con el filtro que lo originó: si no coincide con el filtro
  // actual, se está cargando el nuevo.
  const [listado, setListado] = useState<{ filtro: string; mesas?: Mesa[]; error?: string }>();
  const [editando, setEditando] = useState<Mesa | "nueva">();
  const [eliminando, setEliminando] = useState<string>();
  const [errorBaja, setErrorBaja] = useState<{ mesaId: string; mensaje: string }>();

  useEffect(() => {
    let vigente = true;
    void toAdminApiResult(
      adminClient.GET("/admin/mesas", {
        params: { query: filtroZona ? { zonaId: filtroZona } : {} },
      }),
    ).then((resultado) => {
      if (!vigente) return;
      setListado(
        resultado.error
          ? {
              filtro: filtroZona,
              error:
                resultado.error.tipo === "validacion"
                  ? "No se pudo cargar el listado de mesas."
                  : resultado.error.mensaje,
            }
          : { filtro: filtroZona, mesas: resultado.data },
      );
    });
    return () => {
      vigente = false;
    };
  }, [filtroZona]);

  const listadoActual = listado?.filtro === filtroZona ? listado : undefined;
  const mesas = listadoActual?.mesas;
  const errorListado = listadoActual?.error;

  function actualizarMesas(cambiar: (actuales: Mesa[]) => Mesa[]) {
    setListado((actual) => actual?.mesas && { ...actual, mesas: cambiar(actual.mesas) });
  }

  const nombreZona = (id: string) => zonas.find((z) => z.id === id)?.nombre ?? "—";

  function alGuardar(mesa: Mesa) {
    actualizarMesas((actuales) => {
      const sinEsta = actuales.filter((m) => m.id !== mesa.id);
      // Con un filtro activo, una Mesa que pasó a otra Zona deja de corresponder al listado.
      if (filtroZona && mesa.zonaId !== filtroZona) return sinEsta;
      const indice = actuales.findIndex((m) => m.id === mesa.id);
      if (indice === -1) return [...actuales, mesa];
      return actuales.map((m) => (m.id === mesa.id ? mesa : m));
    });
    setEditando(undefined);
  }

  async function eliminar(mesa: Mesa) {
    setEliminando(mesa.id);
    setErrorBaja(undefined);
    const resultado = await toAdminApiResult(
      adminClient.DELETE("/admin/mesas/{id}", { params: { path: { id: mesa.id } } }),
    );
    setEliminando(undefined);
    if (resultado.error) {
      setErrorBaja({ mesaId: mesa.id, mensaje: resultado.error.tipo === "validacion" ? "No se pudo dar de baja la mesa." : resultado.error.mensaje });
      return;
    }
    actualizarMesas((actuales) => actuales.filter((m) => m.id !== mesa.id));
  }

  return (
    <Card title="Mesas">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="sm:w-64">
            {/* Cambiar el filtro con un alta, edición o baja en curso haría que el listado nuevo
                pisara esa operación: el filtro espera a que termine. */}
            <Select
              label="Filtrar por zona"
              value={filtroZona}
              disabled={editando !== undefined || eliminando !== undefined}
              onChange={(e) => setFiltroZona(e.target.value)}
            >
              <option value="">Todas las zonas</option>
              {zonas.map((zona) => (
                <option key={zona.id} value={zona.id}>
                  {zona.nombre}
                </option>
              ))}
            </Select>
          </div>
          {/* Sin listado cargado no se ofrecen altas: su resultado se perdería al llegar el GET. */}
          <Button
            variant="secondary"
            disabled={mesas === undefined || editando !== undefined}
            onClick={() => setEditando("nueva")}
          >
            Agregar mesa
          </Button>
        </div>

        {editando ? (
          <FormularioMesa
            key={editando === "nueva" ? "nueva" : editando.id}
            mesa={editando === "nueva" ? undefined : editando}
            zonas={zonas}
            zonaInicial={filtroZona}
            onCancelar={() => setEditando(undefined)}
            onGuardada={alGuardar}
          />
        ) : null}

        {errorListado ? <Alert variant="error">{errorListado}</Alert> : null}
        {mesas === undefined && !errorListado ? (
          <p role="status" className="text-sm text-muted-foreground">Cargando mesas…</p>
        ) : null}
        {mesas && mesas.length === 0 ? <p className="text-sm text-muted-foreground">No hay mesas para mostrar.</p> : null}
        {mesas && mesas.length > 0 ? (
          <div className="relative overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-3">Etiqueta</th>
                  <th scope="col" className="py-2 pr-3">Zona</th>
                  <th scope="col" className="py-2 pr-3">Capacidad</th>
                  <th scope="col" className="py-2"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {mesas.map((mesa) => (
                  <tr key={mesa.id} className="border-t border-border align-top">
                    <th scope="row" className="py-2 pr-3 font-medium">{mesa.etiqueta}</th>
                    <td className="py-2 pr-3">{nombreZona(mesa.zonaId)}</td>
                    <td className="py-2 pr-3">{mesa.capacidad}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <BotonCompacto
                          variant="ghost"
                          aria-label={`Editar mesa ${mesa.etiqueta}`}
                          // Con un formulario abierto no se reemplaza por otro: se perderían
                          // sus cambios sin guardar. Hay que guardar o cancelar primero.
                          disabled={eliminando !== undefined || editando !== undefined}
                          onClick={() => setEditando(mesa)}
                        >
                          Editar
                        </BotonCompacto>
                        <ConfirmacionEnLinea
                          etiqueta="Dar de baja"
                          pregunta={`¿Confirmás la baja de la mesa ${mesa.etiqueta}?`}
                          confirmar="Sí, dar de baja"
                          deshabilitado={eliminando !== undefined || editando !== undefined}
                          onConfirmar={() => void eliminar(mesa)}
                        />
                      </div>
                      {errorBaja?.mesaId === mesa.id ? (
                        <Alert variant="error" className="mt-2">{errorBaja.mensaje}</Alert>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function FormularioMesa({
  mesa,
  zonas,
  zonaInicial,
  onCancelar,
  onGuardada,
}: {
  mesa?: Mesa;
  zonas: Zona[];
  zonaInicial: string;
  onCancelar: () => void;
  onGuardada: (mesa: Mesa) => void;
}) {
  const [zonaId, setZonaId] = useState(mesa?.zonaId ?? (zonaInicial || zonas[0]?.id || ""));
  const [capacidad, setCapacidad] = useState(mesa ? String(mesa.capacidad) : "");
  const [etiqueta, setEtiqueta] = useState(mesa?.etiqueta ?? "");
  const [errores, setErrores] = useState<Partial<Record<CampoMesa, string>>>({});
  const [errorGeneral, setErrorGeneral] = useState<string>();
  const [guardando, setGuardando] = useState(false);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;
    const capacidadNumero = leerEntero(capacidad, 1);
    const nuevosErrores: Partial<Record<CampoMesa, string>> = {
      zonaId: zonaId ? undefined : REGLAS.zonaId.textoPorDefecto,
      capacidad: capacidadNumero === undefined ? REGLAS.capacidad.textoPorDefecto : undefined,
      etiqueta: etiqueta.trim() ? undefined : REGLAS.etiqueta.textoPorDefecto,
    };
    setErrores(nuevosErrores);
    setErrorGeneral(undefined);
    if (Object.values(nuevosErrores).some(Boolean) || capacidadNumero === undefined) return;

    const cuerpo = { zonaId, capacidad: capacidadNumero, etiqueta: etiqueta.trim() };
    setGuardando(true);
    const resultado = await toAdminApiResult(
      mesa
        ? adminClient.PATCH("/admin/mesas/{id}", { params: { path: { id: mesa.id } }, body: cuerpo })
        : adminClient.POST("/admin/mesas", { body: cuerpo }),
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

  const titulo = mesa ? `Editar mesa ${mesa.etiqueta}` : "Nueva mesa";
  return (
    <form onSubmit={guardar} noValidate aria-label={titulo} className="flex flex-col gap-4 rounded-md border border-border p-4">
      <h3 className="font-semibold">{titulo}</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="Zona" value={zonaId} disabled={guardando} error={errores.zonaId} onChange={(e) => setZonaId(e.target.value)}>
          {zonas.map((zona) => (
            <option key={zona.id} value={zona.id}>
              {zona.nombre}
            </option>
          ))}
        </Select>
        <Field
          label="Capacidad"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={capacidad}
          disabled={guardando}
          error={errores.capacidad}
          onChange={(e) => setCapacidad(e.target.value)}
        />
        <Field
          label="Etiqueta"
          value={etiqueta}
          disabled={guardando}
          error={errores.etiqueta}
          onChange={(e) => setEtiqueta(e.target.value)}
        />
      </div>
      {errorGeneral ? <Alert variant="error">{errorGeneral}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={guardando}>
          {guardando ? "Guardando…" : mesa ? "Guardar cambios" : "Agregar mesa"}
        </Button>
        <Button variant="secondary" disabled={guardando} onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
