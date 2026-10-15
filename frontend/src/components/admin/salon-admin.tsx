"use client";

import { useEffect, useState } from "react";
import { Alert } from "../ui/alert";
import { adminClient, toAdminApiResult } from "../../lib/api/admin-client";
import type { components } from "../../lib/api/schema";
import { MesasPanel } from "./mesas-panel";
import { TurnosPanel } from "./turnos-panel";
import { ZonasPanel } from "./zonas-panel";

type Zona = components["schemas"]["ZonaRespuestaDto"];

/**
 * Gestión del salón: Zonas, Mesas y Turnos. Las Zonas se piden una sola vez acá porque las
 * usan dos paneles (su propia edición y el selector de Zona de las Mesas).
 */
export function SalonAdmin() {
  const [zonas, setZonas] = useState<Zona[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let vigente = true;
    void toAdminApiResult(adminClient.GET("/admin/zonas")).then((resultado) => {
      if (!vigente) return;
      if (resultado.error) setError(resultado.error.tipo === "validacion" ? "No se pudieron cargar las zonas." : resultado.error.mensaje);
      else setZonas(resultado.data);
    });
    return () => {
      vigente = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl">Salón</h1>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {zonas === undefined && !error ? (
        <p role="status" className="text-sm text-muted-foreground">Cargando zonas…</p>
      ) : null}
      {zonas ? (
        <>
          <ZonasPanel
            zonas={zonas}
            onZonaActualizada={(zona) =>
              setZonas((actuales = []) => actuales.map((z) => (z.id === zona.id ? zona : z)))
            }
          />
        </>
      ) : null}
      {/* Mesas y turnos lado a lado en escritorio: son dos listas cortas e independientes. */}
      <div className="grid items-start gap-6 xl:grid-cols-2">
        {zonas ? <MesasPanel zonas={zonas} /> : null}
        <TurnosPanel />
      </div>
    </div>
  );
}
