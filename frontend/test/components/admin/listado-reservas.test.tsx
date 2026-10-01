import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ListadoReservas } from "../../../src/components/admin/listado-reservas";
import type { FiltrosReservas } from "../../../src/lib/admin/filtros-reservas";
import { adminClient } from "../../../src/lib/api/admin-client";

const push = jest.fn();
const replace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

jest.mock("../../../src/lib/api/admin-client", () => {
  const real = jest.requireActual("../../../src/lib/api/admin-client");
  return { ...real, adminClient: { GET: jest.fn(), PATCH: jest.fn() } };
});

const GET = adminClient.GET as unknown as jest.Mock;
const PATCH = adminClient.PATCH as unknown as jest.Mock;

function ok(data: unknown, status = 200) {
  return Promise.resolve({ data, response: { ok: true, status } });
}

function sinCuerpo() {
  return Promise.resolve({ response: { ok: true, status: 204 } });
}

function error(status: number, message: string | string[]) {
  return Promise.resolve({ error: { statusCode: status, message }, response: { ok: false, status } });
}

function reserva(id: string, codigo: string, estado: string) {
  return {
    id,
    codigoReserva: codigo,
    estado,
    fecha: "2026-10-02",
    comensales: 4,
    nombreCliente: "Ana Pérez",
    emailCliente: "ana.perez@example.com",
    telefonoCliente: "+54 9 11 5555-1234",
    turno: { id: "t-1", horaInicio: "20:00", horaFin: "23:30" },
    zona: { id: "z-vip", nombre: "VIP" },
    mesa: { id: "m-1", etiqueta: "V1" },
    createdAt: "2026-09-30T12:00:00.000Z",
  };
}

const PENDIENTE = reserva("r-1", "PEND0001", "PENDIENTE");
const CONFIRMADA = reserva("r-2", "CONF0002", "CONFIRMADA");
const CANCELADA = reserva("r-3", "CANC0003", "CANCELADA");
const NO_SHOW = reserva("r-4", "NOSH0004", "NO_SHOW");

let reservas: unknown[];
let total: number;

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  PATCH.mockReset();
  GET.mockReset();
  reservas = [PENDIENTE, CONFIRMADA, CANCELADA, NO_SHOW];
  total = 4;
  GET.mockImplementation((path: string) => {
    if (path === "/admin/zonas") return ok([{ id: "z-vip", nombre: "VIP" }]);
    if (path === "/admin/turnos") return ok([]);
    return ok({ items: reservas, total, limit: 20, offset: 0 });
  });
});

async function renderizar(filtros: FiltrosReservas = { pagina: 1 }) {
  const resultado = render(<ListadoReservas filtros={filtros} />);
  await waitFor(() => expect(screen.queryByText("Cargando reservas…")).not.toBeInTheDocument());
  return resultado;
}

function fila(codigo: string) {
  return screen.getByRole("rowheader", { name: codigo }).closest("tr") as HTMLElement;
}

function consultasDeReservas() {
  return GET.mock.calls.filter(([p]) => p === "/admin/reservas").map(([, o]) => o.params.query);
}

describe("ListadoReservas - listado, filtros y paginación", () => {
  it("muestra código, estado, fecha, turno, zona, comensales y contacto", async () => {
    await renderizar();

    const primera = within(fila("PEND0001"));
    expect(primera.getByText("Pendiente")).toBeInTheDocument();
    expect(primera.getByText(/2 de octubre de 2026/)).toBeInTheDocument();
    expect(primera.getByText("20:00 a 23:30")).toBeInTheDocument();
    expect(primera.getByText("VIP")).toBeInTheDocument();
    expect(primera.getByText("Ana Pérez")).toBeInTheDocument();
    expect(primera.getByText("ana.perez@example.com")).toBeInTheDocument();
  });

  it("pasa los filtros de la URL a la API", async () => {
    await renderizar({ estado: "PENDIENTE", fecha: "2026-10-02", zonaId: "z-vip", pagina: 1 });

    expect(consultasDeReservas()).toEqual([
      { estado: "PENDIENTE", fecha: "2026-10-02", zonaId: "z-vip", limit: 20, offset: 0 },
    ]);
  });

  it("filtrar por estado navega a la URL con el filtro, desde la página 1", async () => {
    await renderizar({ fecha: "2026-10-02", pagina: 3 });

    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "PENDIENTE" } });

    expect(push).toHaveBeenCalledWith("/admin/reservas?fecha=2026-10-02&estado=PENDIENTE");
  });

  it("cambiar de página conserva los filtros activos", async () => {
    total = 45;
    await renderizar({ estado: "CONFIRMADA", zonaId: "z-vip", pagina: 1 });

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(push).toHaveBeenCalledWith("/admin/reservas?estado=CONFIRMADA&zonaId=z-vip&pagina=2");
  });

  it("la página siguiente pide el offset correcto con los mismos filtros", async () => {
    total = 45;
    await renderizar({ estado: "CONFIRMADA", zonaId: "z-vip", pagina: 2 });

    expect(consultasDeReservas()).toEqual([
      { estado: "CONFIRMADA", zonaId: "z-vip", limit: 20, offset: 20 },
    ]);
  });

  it("sin resultados muestra un estado vacío, no un error", async () => {
    reservas = [];
    total = 0;
    await renderizar({ estado: "NO_SHOW", pagina: 1 });

    expect(screen.getByRole("status")).toHaveTextContent("No hay reservas para esos filtros.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("un 400 por un filtro editado a mano se informa como filtro inválido", async () => {
    GET.mockImplementation((path: string) =>
      path === "/admin/reservas" ? error(400, ["fecha must be a valid ISO 8601 date string"]) : ok([]),
    );
    await renderizar({ fecha: "2026-99-99", pagina: 1 });

    expect(screen.getByRole("alert")).toHaveTextContent("Alguno de los filtros no es válido");
    expect(screen.getByRole("link", { name: "Quitar todos los filtros" })).toHaveAttribute(
      "href",
      "/admin/reservas",
    );
  });
});

describe("ListadoReservas - casos borde", () => {
  it("una página más allá de la última lleva a la última con los mismos filtros", async () => {
    reservas = [];
    total = 45;
    await renderizar({ estado: "CONFIRMADA", pagina: 7 });

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/admin/reservas?estado=CONFIRMADA&pagina=3"),
    );
  });

  it("si falla la carga de zonas y turnos lo avisa y permite reintentar", async () => {
    GET.mockImplementation((path: string) => {
      if (path === "/admin/zonas") return error(500, "x");
      if (path === "/admin/turnos") return ok([]);
      return ok({ items: reservas, total, limit: 20, offset: 0 });
    });
    await renderizar();

    expect(await screen.findByText(/No se pudieron cargar las zonas y los turnos/)).toBeInTheDocument();

    GET.mockImplementation((path: string) => {
      if (path === "/admin/zonas") return ok([{ id: "z-vip", nombre: "VIP" }]);
      if (path === "/admin/turnos") return ok([]);
      return ok({ items: reservas, total, limit: 20, offset: 0 });
    });
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() =>
      expect(screen.queryByText(/No se pudieron cargar las zonas/)).not.toBeInTheDocument(),
    );
    expect(within(screen.getByLabelText("Zona")).getByRole("option", { name: "VIP" })).toBeInTheDocument();
  });
});

describe("ListadoReservas - confirmar y rechazar", () => {
  it("solo las pendientes ofrecen confirmar y rechazar", async () => {
    await renderizar();

    expect(within(fila("PEND0001")).getByRole("button", { name: /Confirmar reserva/ })).toBeInTheDocument();
    for (const codigo of ["CONF0002", "CANC0003", "NOSH0004"]) {
      expect(within(fila(codigo)).queryByRole("button", { name: /Confirmar reserva/ })).not.toBeInTheDocument();
      expect(within(fila(codigo)).queryByRole("button", { name: "Rechazar" })).not.toBeInTheDocument();
    }
  });

  it("confirmar actualiza la fila a Confirmada sin recargar el listado", async () => {
    PATCH.mockReturnValue(sinCuerpo());
    await renderizar();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar reserva PEND0001" }));

    await waitFor(() => expect(within(fila("PEND0001")).getByText("Confirmada")).toBeInTheDocument());
    expect(PATCH).toHaveBeenCalledWith("/admin/reservas/{id}/confirmar", { params: { path: { id: "r-1" } } });
    expect(consultasDeReservas()).toHaveLength(1);
  });

  it("rechazar pide confirmación y, al confirmar, la fila pasa a Cancelada", async () => {
    PATCH.mockReturnValue(sinCuerpo());
    await renderizar();

    fireEvent.click(within(fila("PEND0001")).getByRole("button", { name: "Rechazar" }));
    expect(PATCH).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sí, rechazar" }));

    await waitFor(() => expect(within(fila("PEND0001")).getByText("Cancelada")).toBeInTheDocument());
    expect(PATCH).toHaveBeenCalledWith("/admin/reservas/{id}/rechazar", { params: { path: { id: "r-1" } } });
  });

  it("un 409 muestra el conflicto y refresca el estado real", async () => {
    PATCH.mockReturnValue(error(409, "La reserva no está pendiente."));
    await renderizar();
    // La otra persona ya la confirmó: al refrescar, la API la devuelve CONFIRMADA.
    reservas = [{ ...PENDIENTE, estado: "CONFIRMADA" }, CONFIRMADA];
    total = reservas.length;

    fireEvent.click(screen.getByRole("button", { name: "Confirmar reserva PEND0001" }));

    expect(await screen.findByText("La reserva no está pendiente.")).toBeInTheDocument();
    await waitFor(() => expect(within(fila("PEND0001")).getByText("Confirmada")).toBeInTheDocument());
    expect(consultasDeReservas()).toHaveLength(2);
  });
});

describe("ListadoReservas - marcar no show", () => {
  it("solo las confirmadas ofrecen marcar no show", async () => {
    await renderizar();

    expect(within(fila("CONF0002")).getByRole("button", { name: "Marcar no show" })).toBeInTheDocument();
    for (const codigo of ["PEND0001", "CANC0003", "NOSH0004"]) {
      expect(within(fila(codigo)).queryByRole("button", { name: "Marcar no show" })).not.toBeInTheDocument();
    }
  });

  it("confirmar el paso de confirmación marca la fila como No se presentó", async () => {
    PATCH.mockReturnValue(sinCuerpo());
    await renderizar();

    fireEvent.click(within(fila("CONF0002")).getByRole("button", { name: "Marcar no show" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, marcar no show" }));

    await waitFor(() => expect(within(fila("CONF0002")).getByText("No se presentó")).toBeInTheDocument());
    expect(PATCH).toHaveBeenCalledWith("/admin/reservas/{id}/no-show", { params: { path: { id: "r-2" } } });
  });

  it("un 409 porque el turno no terminó muestra el motivo y la fila sigue Confirmada", async () => {
    PATCH.mockReturnValue(error(409, "El turno de la reserva todavía no terminó."));
    await renderizar();

    fireEvent.click(within(fila("CONF0002")).getByRole("button", { name: "Marcar no show" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, marcar no show" }));

    expect(await screen.findByText("El turno de la reserva todavía no terminó.")).toBeInTheDocument();
    await waitFor(() => expect(consultasDeReservas()).toHaveLength(2));
    expect(within(fila("CONF0002")).getByText("Confirmada")).toBeInTheDocument();
  });
});
