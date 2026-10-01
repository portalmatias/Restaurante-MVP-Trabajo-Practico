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

// 2026-10-02 es viernes y 2026-10-03, sábado. El viernes tiene dos Turnos: el mock responde
// según `turnoId`, así que mezclar las Reservas de uno y otro se nota en los números.
const TURNOS = [
  // El primero del día (y por lo tanto el elegido por defecto) es el del mediodía.
  { id: "t-vie", diaSemana: "VIERNES", horaInicio: "1970-01-01T12:00:00.000Z", horaFin: "1970-01-01T15:00:00.000Z", activo: true },
  { id: "t-vie-noche", diaSemana: "VIERNES", horaInicio: "1970-01-01T20:00:00.000Z", horaFin: "1970-01-01T23:30:00.000Z", activo: true },
  { id: "t-sab", diaSemana: "SABADO", horaInicio: "1970-01-01T21:00:00.000Z", horaFin: "1970-01-01T23:59:00.000Z", activo: true },
];

function ok(data: unknown) {
  return Promise.resolve({ data, response: { ok: true, status: 200 } });
}

function reserva(zonaId: string, comensales: number) {
  return { comensales, zona: { id: zonaId } };
}

/** Reservas activas por `fecha|turnoId` y estado, como las filtra la API real. */
let RESERVAS: Record<string, { CONFIRMADA: unknown[]; PENDIENTE: unknown[] }>;

beforeEach(() => {
  RESERVAS = {
    "2026-10-02|t-vie": {
      CONFIRMADA: [reserva("z-std", 4), reserva("z-std", 2)],
      PENDIENTE: [reserva("z-vip", 6)],
    },
    "2026-10-02|t-vie-noche": { CONFIRMADA: [reserva("z-std", 8)], PENDIENTE: [] },
    "2026-10-03|t-sab": { CONFIRMADA: [reserva("z-vip", 3)], PENDIENTE: [] },
  };
  GET.mockReset();
  GET.mockImplementation((path: string, opciones?: { params: { query: Record<string, string | number> } }) => {
    if (path === "/admin/zonas") return ok(ZONAS);
    if (path === "/admin/turnos") return ok(TURNOS);
    const { fecha, turnoId, estado, limit, offset } = opciones!.params.query;
    const todas =
      RESERVAS[`${fecha}|${turnoId}`]?.[estado as "CONFIRMADA" | "PENDIENTE"] ?? [];
    const desde = Number(offset ?? 0);
    const items = todas.slice(desde, desde + Number(limit));
    return ok({ items, total: todas.length, limit, offset: desde });
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
      { fecha: "2026-10-02", turnoId: "t-vie", estado: "CONFIRMADA", limit: 100, offset: 0 },
      { fecha: "2026-10-02", turnoId: "t-vie", estado: "PENDIENTE", limit: 100, offset: 0 },
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

  it("cambiar de Turno en el mismo día no mezcla sus Reservas", async () => {
    render(<DashboardAforo hoy="2026-10-02" />);
    await screen.findByTestId("aforo-global");

    fireEvent.change(screen.getByLabelText("Turno"), { target: { value: "t-vie-noche" } });

    await waitFor(() => expect(screen.getByTestId("aforo-global")).toHaveTextContent(/^8$/));
    expect(screen.getByTestId("aforo-zona-VIP")).toHaveTextContent("0 / 20");
  });

  it("con más Reservas que una página, las suma todas paginando con offset", async () => {
    RESERVAS["2026-10-02|t-vie"] = {
      CONFIRMADA: Array.from({ length: 110 }, () => reserva("z-std", 1)),
      PENDIENTE: [],
    };
    render(<DashboardAforo hoy="2026-10-02" />);

    expect(await screen.findByTestId("aforo-zona-STANDARD")).toHaveTextContent("110 / 40");
    const offsets = llamadasA("/admin/reservas")
      .map(([, o]) => o.params.query)
      .filter((q) => q.estado === "CONFIRMADA")
      .map((q) => q.offset);
    expect(offsets).toEqual([0, 100]);
  });

  it("sin Reservas activas, todo queda en cero", async () => {
    RESERVAS = {};
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
