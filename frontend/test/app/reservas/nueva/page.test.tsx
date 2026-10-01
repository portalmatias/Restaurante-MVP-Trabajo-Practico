import { render, screen } from "@testing-library/react";
import NuevaReservaPage from "../../../../app/reservas/nueva/page";
import { apiClient } from "../../../../src/lib/api/client";
import { TURNOS, ZONA_VIP, ZONAS } from "../../../fixtures/reservas";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));

// Se mockea solo `apiClient`: `toApiResult` es el real. Sin red.
jest.mock("../../../../src/lib/api/client", () => ({
  ...jest.requireActual("../../../../src/lib/api/client"),
  apiClient: { GET: jest.fn() },
}));

const GET = apiClient.GET as unknown as jest.Mock;

type Respuesta = { data?: unknown; error?: unknown; response: { ok: boolean; status: number } };

function responder({
  zonas = ok(ZONAS),
  turnos = ok(TURNOS),
}: { zonas?: Respuesta; turnos?: Respuesta } = {}) {
  GET.mockImplementation(async (ruta: string) => (ruta === "/zonas" ? zonas : turnos));
}

function ok(data: unknown) {
  return { data, response: { ok: true, status: 200 } };
}

function falla(status: number) {
  return { error: undefined, response: { ok: false, status } };
}

async function renderizar(searchParams: Record<string, string | string[] | undefined> = {}) {
  render(await NuevaReservaPage({ searchParams: Promise.resolve(searchParams) }));
}

beforeEach(() => {
  GET.mockReset();
});

describe("/reservas/nueva", () => {
  it("pide las zonas y los turnos al backend y arma el formulario con ellos", async () => {
    responder();

    await renderizar();

    expect(GET).toHaveBeenCalledWith("/zonas");
    expect(GET).toHaveBeenCalledWith("/turnos");
    expect(screen.getByRole("heading", { level: 1, name: "¿Cuándo y para cuántos?" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /VIP/ })).toBeInTheDocument();
  });

  it("calcula 'hoy' en el servidor con el offset de Argentina, no con el día UTC", async () => {
    responder();
    // 02:00 UTC del 15 sigue siendo el 14 a las 23:00 en Argentina.
    jest.useFakeTimers({ now: new Date("2026-09-15T02:00:00.000Z"), doNotFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", "clearImmediate", "nextTick", "queueMicrotask", "performance"] });
    try {
      await renderizar();
    } finally {
      jest.useRealTimers();
    }

    expect(screen.getByLabelText("Fecha")).toHaveAttribute("min", "2026-09-14");
  });

  it("prellena el formulario con la selección de searchParams", async () => {
    responder();

    await renderizar({ zonaId: ZONA_VIP.id, comensales: "6" });

    expect(screen.getByRole("radio", { name: /VIP/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("status", { name: "Cantidad de comensales" })).toHaveTextContent("6");
  });

  it("ignora un parámetro repetido (lista) en vez de romper", async () => {
    responder();

    await renderizar({ zonaId: [ZONA_VIP.id, ZONA_VIP.id] });

    expect(screen.getByRole("radio", { name: /VIP/ })).toHaveAttribute("aria-checked", "false");
  });

  it.each([
    ["las zonas", { zonas: falla(500) }],
    ["los turnos", { turnos: falla(500) }],
  ])("si fallan %s muestra el mensaje genérico y ofrece reintentar", async (_que, respuestas) => {
    responder(respuestas);

    await renderizar();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "El servicio no está disponible en este momento. Intentá de nuevo más tarde.",
    );
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Fecha")).not.toBeInTheDocument();
  });

  it("no ofrece ningún enlace a la administración", async () => {
    responder();

    await renderizar();

    expect(document.querySelector('a[href^="/admin"]')).toBeNull();
  });
});
