"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "../ui/alert";
import { buttonVariants } from "../ui/button";
import { BotonCompacto } from "./boton-compacto";
import { Field } from "../ui/field";
import { Select } from "../ui/select";
import { adminClient, toAdminApiResult } from "../../lib/api/admin-client";
import type { components } from "../../lib/api/schema";
import {
  aConsultaApi,
  aQueryString,
  totalPaginas,
  type FiltrosReservas,
} from "../../lib/admin/filtros-reservas";
import { formatearFechaLargaEs } from "../../lib/fecha-hora";
import { ConfirmacionEnLinea } from "./confirmacion-en-linea";
import {
  ESTADOS_RESERVA,
  ETIQUETA_DIA,
  ETIQUETA_ESTADO,
  ordenarTurnos,
  rangoTurno,
  TONO_ESTADO,
  type EstadoReserva,
} from "./formato";
import { Sello } from "./sello";

type Reserva = components["schemas"]["ReservaAdminRespuesta"];
type Listado = components["schemas"]["ListadoReservasRespuesta"];
type Zona = components["schemas"]["ZonaRespuestaDto"];
type Turno = components["schemas"]["TurnoRespuestaDto"];

type Accion = "confirmar" | "rechazar" | "no-show";

const RUTA_ACCION = {
  confirmar: "/admin/reservas/{id}/confirmar",
  rechazar: "/admin/reservas/{id}/rechazar",
  "no-show": "/admin/reservas/{id}/no-show",
} as const;

const ESTADO_TRAS_ACCION: Record<Accion, EstadoReserva> = {
  confirmar: "CONFIRMADA",
  rechazar: "CANCELADA",
  "no-show": "NO_SHOW",
};

const RUTA_LISTADO = "/admin/reservas";

function fechaSinRomper(fecha: string): string {
  try {
    return formatearFechaLargaEs(fecha);
  } catch {
    return fecha;
  }
}

/**
 * Listado de Reservas de admin con filtros y paginación (spec "Listado de Reservas con filtros
 * y paginación"), y las acciones por estado: confirmar/rechazar sobre `PENDIENTE` y marcar
 * `NO_SHOW` sobre `CONFIRMADA`. Los filtros viven en la query string: la página los lee y se
 * los pasa, y cada cambio navega a la URL nueva.
 */
export function ListadoReservas({ filtros }: { filtros: FiltrosReservas }) {
  const router = useRouter();
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  // Última respuesta del listado, con la URL (y el número de recarga) que la originó.
  const [respuesta, setRespuesta] = useState<{ clave: string; listado?: Listado; error?: string }>();
  const [recargas, setRecargas] = useState(0);
  const [enCurso, setEnCurso] = useState<string>();
  const [avisoFila, setAvisoFila] = useState<{ reservaId: string; mensaje: string }>();
  const [errorCatalogo, setErrorCatalogo] = useState<string>();
  const [cargasCatalogo, setCargasCatalogo] = useState(0);
  // Búsqueda dentro de la página cargada: no toca los filtros de la URL ni el pedido a la API.
  const [busqueda, setBusqueda] = useState("");

  // Catálogo para los selectores de filtro: una sola vez (o al reintentar), no en cada cambio
  // de filtro. Si falla, se avisa: unos selectores vacíos no deben pasar por "sin zonas".
  useEffect(() => {
    let vigente = true;
    void Promise.all([
      toAdminApiResult(adminClient.GET("/admin/zonas")),
      toAdminApiResult(adminClient.GET("/admin/turnos")),
    ]).then(([resultadoZonas, resultadoTurnos]) => {
      if (!vigente) return;
      if (resultadoZonas.data) setZonas(resultadoZonas.data);
      if (resultadoTurnos.data) setTurnos(ordenarTurnos(resultadoTurnos.data));
      const fallo = resultadoZonas.error ?? resultadoTurnos.error;
      setErrorCatalogo(
        fallo
          ? `No se pudieron cargar las zonas y los turnos para los filtros. ${
              fallo.tipo === "validacion" ? "" : fallo.mensaje
            }`.trim()
          : undefined,
      );
    });
    return () => {
      vigente = false;
    };
  }, [cargasCatalogo]);

  const { fecha, estado, zonaId, turnoId, pagina } = filtros;
  const clave = `${aQueryString(filtros)}#${recargas}`;
  useEffect(() => {
    let vigente = true;
    const claveConsulta = `${aQueryString({ fecha, estado, zonaId, turnoId, pagina })}#${recargas}`;
    const consulta = aConsultaApi({ fecha, estado, zonaId, turnoId, pagina });
    void toAdminApiResult(
      adminClient.GET("/admin/reservas", { params: { query: consulta } }),
    ).then((resultado) => {
      if (!vigente) return;
      setRespuesta(
        resultado.error
          ? {
              clave: claveConsulta,
              error:
                resultado.error.tipo === "validacion"
                  ? "Alguno de los filtros no es válido. Revisá los filtros o quitalos todos."
                  : resultado.error.mensaje,
            }
          : { clave: claveConsulta, listado: resultado.data },
      );
    });
    return () => {
      vigente = false;
    };
  }, [fecha, estado, zonaId, turnoId, pagina, recargas]);

  const cargando = respuesta?.clave !== clave;
  // Mientras llega la página nueva se sigue mostrando la anterior, marcada `aria-busy`.
  const listado = respuesta?.listado;
  const error = cargando ? undefined : respuesta?.error;

  // Una `pagina` de la URL más allá de la última (editada a mano, o porque el listado se
  // achicó) no es "sin reservas": se lleva a la última página que tiene resultados.
  const ultimaPagina = listado ? totalPaginas(listado.total) : undefined;
  useEffect(() => {
    if (!cargando && ultimaPagina !== undefined && pagina > ultimaPagina) {
      router.replace(`${RUTA_LISTADO}${aQueryString({ ...filtros, pagina: ultimaPagina })}`);
    }
  }, [cargando, ultimaPagina, pagina, filtros, router]);

  function filtrar(cambio: Partial<Omit<FiltrosReservas, "pagina">>) {
    // Un filtro nuevo vuelve a la primera página.
    router.push(`${RUTA_LISTADO}${aQueryString({ ...filtros, ...cambio, pagina: 1 })}`);
  }

  async function ejecutar(reserva: Reserva, accion: Accion) {
    setEnCurso(reserva.id);
    setAvisoFila(undefined);
    const resultado = await toAdminApiResult(
      adminClient.PATCH(RUTA_ACCION[accion], { params: { path: { id: reserva.id } } }),
    );
    setEnCurso(undefined);
    if (resultado.error) {
      setAvisoFila({
        reservaId: reserva.id,
        mensaje:
          resultado.error.tipo === "validacion"
            ? "No se pudo completar la acción."
            : resultado.error.mensaje,
      });
      // Otra persona pudo haber cambiado la Reserva: se trae su estado real.
      if (resultado.error.tipo === "conflicto" || resultado.error.tipo === "no-encontrado") {
        setRecargas((n) => n + 1);
      }
      return;
    }
    setRespuesta(
      (actual) =>
        actual?.listado && {
          ...actual,
          listado: {
            ...actual.listado,
            items: actual.listado.items.map((r) =>
              r.id === reserva.id ? { ...r, estado: ESTADO_TRAS_ACCION[accion] } : r,
            ),
          },
        },
    );
  }

  const paginas = listado ? totalPaginas(listado.total) : 1;
  const termino = busqueda.trim().toLowerCase();
  const visibles = (listado?.items ?? []).filter(
    (r) =>
      termino === "" ||
      [r.codigoReserva, r.nombreCliente, r.emailCliente].some((dato) =>
        dato.toLowerCase().includes(termino),
      ),
  );
  const hayFiltros = Boolean(fecha || estado || zonaId || turnoId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl">Reservas</h1>

      <form
        aria-label="Filtros"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => e.preventDefault()}
      >
        <Field
          label="Buscar en esta página"
          type="search"
          autoComplete="off"
          placeholder="Código, nombre o email"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Field
          label="Fecha"
          type="date"
          value={fecha ?? ""}
          onChange={(e) => filtrar({ fecha: e.target.value || undefined })}
        />
        <Select
          label="Estado"
          value={estado ?? ""}
          onChange={(e) => filtrar({ estado: e.target.value || undefined })}
        >
          <option value="">Todos</option>
          {ESTADOS_RESERVA.map((valor) => (
            <option key={valor} value={valor}>
              {ETIQUETA_ESTADO[valor]}
            </option>
          ))}
        </Select>
        <Select
          label="Zona"
          value={zonaId ?? ""}
          onChange={(e) => filtrar({ zonaId: e.target.value || undefined })}
        >
          <option value="">Todas</option>
          {zonas.map((zona) => (
            <option key={zona.id} value={zona.id}>
              {zona.nombre}
            </option>
          ))}
        </Select>
        <Select
          label="Turno"
          value={turnoId ?? ""}
          onChange={(e) => filtrar({ turnoId: e.target.value || undefined })}
        >
          <option value="">Todos</option>
          {turnos.map((turno) => (
            <option key={turno.id} value={turno.id}>
              {ETIQUETA_DIA[turno.diaSemana]} {rangoTurno(turno)}
            </option>
          ))}
        </Select>
      </form>
      {hayFiltros ? (
        <Link
          href={RUTA_LISTADO}
          className={buttonVariants({ variant: "ghost", fullWidth: false, className: "self-start underline" })}
        >
          Quitar todos los filtros
        </Link>
      ) : null}

      {errorCatalogo ? (
        <Alert variant="error" className="flex flex-wrap items-center justify-between gap-2">
          <span>{errorCatalogo}</span>
          <BotonCompacto variant="secondary" onClick={() => setCargasCatalogo((n) => n + 1)}>
            Reintentar
          </BotonCompacto>
        </Alert>
      ) : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      {cargando && !listado ? (
        <p role="status" className="text-sm text-muted-foreground">Cargando reservas…</p>
      ) : null}
      {listado && listado.items.length === 0 ? (
        <Alert>
          {hayFiltros ? "No hay reservas para esos filtros." : "Todavía no hay reservas."}
        </Alert>
      ) : null}
      {listado && listado.items.length > 0 && visibles.length === 0 ? (
        <Alert>
          Ninguna reserva de esta página coincide con «{busqueda.trim()}». Probá con otro código o
          nombre, o cambiá de página.
        </Alert>
      ) : null}

      {visibles.length > 0 ? (
        <div
          className={`relative overflow-x-auto border border-border bg-card transition-opacity duration-200 motion-reduce:transition-none ${
            cargando ? "opacity-60" : ""
          }`}
          aria-busy={cargando}
        >
          <table className="w-full min-w-[64rem] text-left text-sm">
            <caption className="sr-only">
              Reservas, página {pagina} de {paginas}
            </caption>
            <thead className="bg-muted text-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Código</th>
                <th scope="col" className="px-3 py-2 font-medium">Estado</th>
                <th scope="col" className="px-3 py-2 font-medium">Fecha</th>
                <th scope="col" className="px-3 py-2 font-medium">Turno</th>
                <th scope="col" className="px-3 py-2 font-medium">Zona</th>
                <th scope="col" className="px-3 py-2 font-medium">Mesa</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Comensales</th>
                <th scope="col" className="px-3 py-2 font-medium">Nombre</th>
                <th scope="col" className="px-3 py-2 font-medium">Email</th>
                <th scope="col" className="px-3 py-2 font-medium">Teléfono</th>
                <th scope="col" className="px-3 py-2"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((reserva) => (
                <FilaReserva
                  key={reserva.id}
                  reserva={reserva}
                  ocupada={enCurso === reserva.id}
                  aviso={avisoFila?.reservaId === reserva.id ? avisoFila.mensaje : undefined}
                  onAccion={(accion) => void ejecutar(reserva, accion)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {listado && listado.total > 0 ? (
        <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-2">
          <p className="tabular text-sm text-muted-foreground">
            Página {pagina} de {paginas} · {listado.total} reservas
          </p>
          <div className="flex gap-2">
            <BotonCompacto
              variant="secondary"
              disabled={pagina <= 1 || cargando}
              onClick={() => router.push(`${RUTA_LISTADO}${aQueryString({ ...filtros, pagina: pagina - 1 })}`)}
            >
              Anterior
            </BotonCompacto>
            <BotonCompacto
              variant="secondary"
              disabled={pagina >= paginas || cargando}
              onClick={() => router.push(`${RUTA_LISTADO}${aQueryString({ ...filtros, pagina: pagina + 1 })}`)}
            >
              Siguiente
            </BotonCompacto>
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function FilaReserva({
  reserva,
  ocupada,
  aviso,
  onAccion,
}: {
  reserva: Reserva;
  ocupada: boolean;
  aviso?: string;
  onAccion: (accion: Accion) => void;
}) {
  return (
    <tr className="border-t border-border align-top">
      <th scope="row" className="tabular whitespace-nowrap px-3 py-2 font-bold tracking-wider">
        {reserva.codigoReserva}
      </th>
      <td className="px-3 py-2">
        <Sello tono={TONO_ESTADO[reserva.estado]}>{ETIQUETA_ESTADO[reserva.estado]}</Sello>
      </td>
      <td className="px-3 py-2">{fechaSinRomper(reserva.fecha)}</td>
      {/* La API entrega `HH:mm`, ya en hora local del restaurante. */}
      <td className="tabular whitespace-nowrap px-3 py-2">
        {reserva.turno.horaInicio} a {reserva.turno.horaFin}
      </td>
      <td className="whitespace-nowrap px-3 py-2">{reserva.zona.nombre}</td>
      <td className="whitespace-nowrap px-3 py-2">{reserva.mesa.etiqueta}</td>
      <td className="tabular px-3 py-2 text-right">{reserva.comensales}</td>
      <td className="px-3 py-2">{reserva.nombreCliente}</td>
      <td className="break-all px-3 py-2">{reserva.emailCliente}</td>
      <td className="tabular whitespace-nowrap px-3 py-2">{reserva.telefonoCliente}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {reserva.estado === "PENDIENTE" ? (
            <>
              <BotonCompacto
                disabled={ocupada}
                aria-label={`Confirmar reserva ${reserva.codigoReserva}`}
                onClick={() => onAccion("confirmar")}
              >
                Confirmar
              </BotonCompacto>
              <ConfirmacionEnLinea
                etiqueta="Rechazar"
                pregunta={`¿Confirmás el rechazo de ${reserva.codigoReserva}?`}
                confirmar="Sí, rechazar"
                deshabilitado={ocupada}
                onConfirmar={() => onAccion("rechazar")}
              />
            </>
          ) : null}
          {reserva.estado === "CONFIRMADA" ? (
            <ConfirmacionEnLinea
              etiqueta="Marcar ausente"
              pregunta={`¿Confirmás que ${reserva.codigoReserva} estuvo ausente?`}
              confirmar="Sí, marcar ausente"
              deshabilitado={ocupada}
              onConfirmar={() => onAccion("no-show")}
            />
          ) : null}
        </div>
        {aviso ? (
          <Alert variant="error" className="mt-2">
            {aviso}
          </Alert>
        ) : null}
      </td>
    </tr>
  );
}
