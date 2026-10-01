import { apiClient } from "../../src/lib/api/client";
import { cargarCatalogo } from "../../src/lib/cargar-catalogo";
import { TURNOS, ZONAS } from "../fixtures/reservas";

// Se mockea solo `apiClient`: `toApiResult` es el real. Sin red.
jest.mock("../../src/lib/api/client", () => ({
  ...jest.requireActual("../../src/lib/api/client"),
  apiClient: { GET: jest.fn() },
}));

const GET = apiClient.GET as unknown as jest.Mock;

type Respuesta = { data?: unknown; error?: unknown; response: { ok: boolean; status: number } };

const ok = (data: unknown): Respuesta => ({ data, response: { ok: true, status: 200 } });
const falla = (status: number): Respuesta => ({ response: { ok: false, status } });

function responder({ zonas = ok(ZONAS), turnos = ok(TURNOS) }: { zonas?: Respuesta; turnos?: Respuesta } = {}) {
  GET.mockImplementation(async (ruta: string) => (ruta === "/zonas" ? zonas : turnos));
}

beforeEach(() => {
  GET.mockReset();
});

describe("cargarCatalogo", () => {
  it("pide zonas y turnos sin caché y devuelve ambos", async () => {
    responder();

    const catalogo = await cargarCatalogo();

    expect(GET).toHaveBeenCalledWith("/zonas", { cache: "no-store" });
    expect(GET).toHaveBeenCalledWith("/turnos", { cache: "no-store" });
    expect(catalogo).toEqual({ zonas: ZONAS, turnos: TURNOS });
  });

  it("si falla una sola de las dos peticiones devuelve ese error", async () => {
    responder({ turnos: falla(500) });

    const catalogo = await cargarCatalogo();

    expect(catalogo.error).toEqual(expect.objectContaining({ tipo: "desconocido" }));
    expect(catalogo.zonas).toBeUndefined();
  });

  it("si fallan las dos devuelve el error de las zonas", async () => {
    // Dos estados que se mapean a tipos distintos, para distinguir de cuál petición es el error.
    responder({ zonas: falla(404), turnos: falla(500) });

    const catalogo = await cargarCatalogo();

    expect(catalogo.error).toEqual(expect.objectContaining({ tipo: "no-encontrado" }));
  });

  it.each([
    ["los turnos", { zonas: falla(500), turnos: falla(429) }],
    ["las zonas", { zonas: falla(429), turnos: falla(500) }],
  ])("un límite de intentos en %s tiene prioridad sobre el otro error", async (_cual, respuestas) => {
    responder(respuestas);

    const catalogo = await cargarCatalogo();

    expect(catalogo.error?.tipo).toBe("limite-de-intentos");
  });
});
