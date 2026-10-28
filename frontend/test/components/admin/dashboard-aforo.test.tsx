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

  // Tarea 3.7: medidor accesible y hora de la consulta («Dashboard de aforo»).
  it("cada zona tiene un medidor con su porcentaje y se muestra la hora de los datos", async () => {
    render(<DashboardAforo hoy="2026-10-02" />);
    await screen.findByTestId("aforo-zona-STANDARD");

    const medidores = screen.getAllByRole("meter");
    expect(medidores.length).toBeGreaterThanOrEqual(2);
    const standard = medidores.find((m) => m.getAttribute("aria-valuetext") === "15 % ocupado");
    expect(standard).toBeDefined();
    expect(standard).toHaveAttribute("aria-valuemin", "0");
    expect(standard).toHaveAttribute("aria-valuemax", "100");
    expect(standard).toHaveAttribute("aria-valuenow", "15");
    expect(screen.getAllByText(/^Datos de las \d{2}:\d{2}/).length).toBeGreaterThan(0);
  });

  // Revisión de #78: el título salía de la selección actual y los números, del resultado anterior.
  it("mientras llega la consulta nueva, el título sigue siendo el de los números que se ven", async () => {
    render(<DashboardAforo hoy="2026-10-02" />);
    await screen.findByTestId("aforo-global");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/viernes.*12:00 a 15:00/);

    const base = GET.getMockImplementation()!;
    GET.mockImplementation((path: string, o?: { params: { query: Record<string, string | number> } }) =>
      path === "/admin/reservas" && o?.params.query.fecha === "2026-10-03" ? new Promise(() => {}) : base(path, o),
    );
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-10-03" } });

    await waitFor(() => expect(screen.getByText(/se muestra la consulta anterior/)).toBeInTheDocument());
    const titulo = screen.getByRole("heading", { level: 2 });
    expect(titulo).toHaveTextContent(/viernes/);
    expect(titulo).not.toHaveTextContent(/sábado/);
    expect(screen.getByTestId("aforo-global")).toHaveTextContent(/^12$/);
  });

  it("si la consulta nueva falla, no queda un título nuevo sobre números viejos", async () => {
    render(<DashboardAforo hoy="2026-10-02" />);
    await screen.findByTestId("aforo-global");

    const base = GET.getMockImplementation()!;
    GET.mockImplementation((path: string, o?: { params: { query: Record<string, string | number> } }) =>
      path === "/admin/reservas" && o?.params.query.fecha === "2026-10-03"
        ? Promise.resolve({ error: { statusCode: 500, message: "Falló" }, response: { ok: false, status: 500 } })
        : base(path, o),
    );
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-10-03" } });

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByTestId("aforo-global")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: /sábado/ })).not.toBeInTheDocument();
  });

  // Tarea 4.4: en escala de grises el nivel se distingue por texto, forma y pictograma.
  it("aforo 0: la barra se ve sobre su pista y el sello no lleva el check de «Con lugar»", async () => {
    const base = GET.getMockImplementation()!;
    GET.mockImplementation((path: string, o?: { params: { query: Record<string, string | number> } }) =>
      path === "/admin/zonas" ? ok([...ZONAS, { id: "z-cero", nombre: "TERRAZA", aforoMaximo: 0 }]) : base(path, o),
    );
    RESERVAS["2026-10-02|t-vie"].CONFIRMADA.push(reserva("z-cero", 5));
    render(<DashboardAforo hoy="2026-10-02" />);

    const fila = (await screen.findByTestId("aforo-zona-TERRAZA")).closest("li") as HTMLElement;
    const pista = fila.querySelector("[role=meter]") as HTMLElement;
    const barra = pista.firstElementChild as HTMLElement;
    expect(pista.className).toMatch(/(^|\s)bg-muted(\s|$)/);
    expect(barra.className).not.toMatch(/(^|\s)bg-muted(\s|$)/);
    expect(fila.textContent).toContain("Sin aforo");
    const check = "M3 8.5l3.5 3.5L13 4.5";
    expect(fila.querySelector("h3 + span svg")?.innerHTML ?? "").not.toContain(check);
    const conLugar = screen.getByTestId("aforo-zona-STANDARD").closest("li") as HTMLElement;
    expect(conLugar.querySelector("h3 + span svg")?.innerHTML).toContain(check);
  });

  // Spec «Aforo máximo cero»: no se muestra un porcentaje, y el medidor tampoco lo anuncia.
  it("aforo 0: el medidor no anuncia un porcentaje", async () => {
    const base = GET.getMockImplementation()!;
    GET.mockImplementation((path: string, o?: { params: { query: Record<string, string | number> } }) =>
      path === "/admin/zonas" ? ok([...ZONAS, { id: "z-cero", nombre: "TERRAZA", aforoMaximo: 0 }]) : base(path, o),
    );
    render(<DashboardAforo hoy="2026-10-02" />);

    const fila = (await screen.findByTestId("aforo-zona-TERRAZA")).closest("li") as HTMLElement;
    const medidor = fila.querySelector("[role=meter]") as HTMLElement;
    expect(medidor).toHaveAttribute("aria-valuetext", "Sin aforo");
    expect(medidor.getAttribute("aria-valuetext")).not.toMatch(/%/);
  });

  it("«Completo» y «Sobrecupo» no se distinguen solo por el texto: llevan pictogramas distintos", async () => {
    RESERVAS["2026-10-02|t-vie"] = {
      CONFIRMADA: [reserva("z-std", 40), reserva("z-vip", 25)],
      PENDIENTE: [],
    };
    render(<DashboardAforo hoy="2026-10-02" />);

    const std = (await screen.findByTestId("aforo-zona-STANDARD")).closest("li") as HTMLElement;
    const vip = screen.getByTestId("aforo-zona-VIP").closest("li") as HTMLElement;
    expect(std.textContent).toContain("Completo");
    expect(vip.textContent).toContain("Sobrecupo");
    expect(std.querySelector("h3 + span svg")?.innerHTML).not.toBe(vip.querySelector("h3 + span svg")?.innerHTML);
  });
});
