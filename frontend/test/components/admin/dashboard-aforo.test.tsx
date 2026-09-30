import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DashboardAforo } from "../../../src/components/admin/dashboard-aforo";
import { adminClient } from "../../../src/lib/api/admin-client";

jest.mock("../../../src/lib/api/admin-client", () => {
  const real = jest.requireActual("../../../src/lib/api/admin-client");
  return { ...real, adminClient: { GET: jest.fn() } };
});

const GET = adminClient.GET as unknown as jest.Mock;

const ZONAS = [
  { id: "z-std", nombre: "STANDARD", aforoMaximo: 40 },
  { id: "z-vip", nombre: "VIP", aforoMaximo: 20 },
];

// 2026-10-02 es viernes y 2026-10-03, sábado.
const TURNOS = [
  { id: "t-vie", diaSemana: "VIERNES", horaInicio: "1970-01-01T20:00:00.000Z", horaFin: "1970-01-01T23:30:00.000Z", activo: true },
  { id: "t-sab", diaSemana: "SABADO", horaInicio: "1970-01-01T21:00:00.000Z", horaFin: "1970-01-01T23:59:00.000Z", activo: true },
];

function ok(data: unknown) {
  return Promise.resolve({ data, response: { ok: true, status: 200 } });
}

function listado(items: unknown[]) {
  return { items, total: items.length, limit: 100, offset: 0 };
}

function reserva(zonaId: string, comensales: number) {
  return { comensales, zona: { id: zonaId } };
}

/** Reservas activas por fecha: responde según los filtros de la query, como la API real. */
const RESERVAS: Record<string, { CONFIRMADA: unknown[]; PENDIENTE: unknown[] }> = {
  "2026-10-02": {
    CONFIRMADA: [reserva("z-std", 4), reserva("z-std", 2)],
    PENDIENTE: [reserva("z-vip", 6)],
  },
  "2026-10-03": { CONFIRMADA: [reserva("z-vip", 3)], PENDIENTE: [] },
};

beforeEach(() => {
  GET.mockReset();
  GET.mockImplementation((path: string, opciones?: { params: { query: Record<string, string> } }) => {
    if (path === "/admin/zonas") return ok(ZONAS);
    if (path === "/admin/turnos") return ok(TURNOS);
    const { fecha, estado } = opciones!.params.query;
    return ok(listado(RESERVAS[fecha]?.[estado as "CONFIRMADA" | "PENDIENTE"] ?? []));
  });
});

function llamadasA(path: string) {
  return GET.mock.calls.filter(([p]) => p === path);
}

describe("DashboardAforo", () => {
  it("muestra la ocupación por Zona con su máximo y la global sin máximo", async () => {
    render(<DashboardAforo hoy="2026-10-02" />);

    expect(await screen.findByTestId("aforo-zona-STANDARD")).toHaveTextContent("6 / 40");
    expect(screen.getByTestId("aforo-zona-VIP")).toHaveTextContent("6 / 20");
    expect(screen.getByTestId("aforo-global")).toHaveTextContent(/^12$/);
  });

  it("pide solo Reservas CONFIRMADA y PENDIENTE de la fecha y el turno, nunca sin estado", async () => {
    render(<DashboardAforo hoy="2026-10-02" />);
    await screen.findByTestId("aforo-global");

    const consultas = llamadasA("/admin/reservas").map(([, o]) => o.params.query);
    expect(consultas).toEqual([
      { fecha: "2026-10-02", turnoId: "t-vie", estado: "CONFIRMADA", limit: 100 },
      { fecha: "2026-10-02", turnoId: "t-vie", estado: "PENDIENTE", limit: 100 },
    ]);
  });

  it("cambiar la fecha recalcula y no vuelve a pedir las Zonas", async () => {
    render(<DashboardAforo hoy="2026-10-02" />);
    await screen.findByTestId("aforo-global");

    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-10-03" } });

    await waitFor(() => expect(screen.getByTestId("aforo-global")).toHaveTextContent(/^3$/));
    expect(screen.getByTestId("aforo-zona-VIP")).toHaveTextContent("3 / 20");
    expect(screen.getByTestId("aforo-zona-STANDARD")).toHaveTextContent("0 / 40");
    // El Turno pasa al del sábado, el único de ese día.
    expect(screen.getByLabelText("Turno")).toHaveValue("t-sab");

    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-10-02" } });
    await waitFor(() => expect(screen.getByTestId("aforo-global")).toHaveTextContent(/^12$/));

    expect(llamadasA("/admin/zonas")).toHaveLength(1);
    expect(llamadasA("/admin/reservas")).toHaveLength(6);
  });

  it("sin Reservas activas, todo queda en cero", async () => {
    GET.mockImplementation((path: string) => {
      if (path === "/admin/zonas") return ok(ZONAS);
      if (path === "/admin/turnos") return ok(TURNOS);
      return ok(listado([]));
    });
    render(<DashboardAforo hoy="2026-10-02" />);

    expect(await screen.findByTestId("aforo-global")).toHaveTextContent(/^0$/);
    expect(screen.getByTestId("aforo-zona-STANDARD")).toHaveTextContent("0 / 40");
  });

  it("un día sin turnos lo avisa y no pide Reservas", async () => {
    render(<DashboardAforo hoy="2026-10-05" />);

    expect(await screen.findByText(/No hay turnos configurados para los lunes/)).toBeInTheDocument();
    expect(llamadasA("/admin/reservas")).toHaveLength(0);
  });
});
