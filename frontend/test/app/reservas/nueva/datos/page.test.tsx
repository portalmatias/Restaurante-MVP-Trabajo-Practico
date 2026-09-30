import { render, screen, within } from "@testing-library/react";
import DatosPage from "../../../../../app/reservas/nueva/datos/page";
import { apiClient } from "../../../../../src/lib/api/client";
import {
  TURNO_CENA_SABADO,
  TURNOS,
  ZONA_STANDARD,
  ZONAS,
} from "../../../../fixtures/reservas";

// `redirect` de Next corta el render lanzando una excepción: se replica para poder afirmar el
// destino sin ejecutar nada más de la página.
jest.mock("next/navigation", () => ({
  redirect: jest.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

// Se mockea solo `apiClient`: `toApiResult` es el real. Sin red (design.md D10).
jest.mock("../../../../../src/lib/api/client", () => ({
  ...jest.requireActual("../../../../../src/lib/api/client"),
  apiClient: { GET: jest.fn() },
}));

const GET = apiClient.GET as unknown as jest.Mock;

type Respuesta = { data?: unknown; error?: unknown; response: { ok: boolean; status: number } };

const ok = (data: unknown): Respuesta => ({ data, response: { ok: true, status: 200 } });
const falla = (status: number): Respuesta => ({ response: { ok: false, status } });

function responder({ zonas = ok(ZONAS), turnos = ok(TURNOS) }: { zonas?: Respuesta; turnos?: Respuesta } = {}) {
  GET.mockImplementation(async (ruta: string) => (ruta === "/zonas" ? zonas : turnos));
}

const SELECCION = {
  fecha: "2026-09-19",
  turnoId: TURNO_CENA_SABADO.id,
  zonaId: ZONA_STANDARD.id,
  comensales: "4",
};

async function renderizar(searchParams: Record<string, string | string[] | undefined> = SELECCION) {
  render(await DatosPage({ searchParams: Promise.resolve(searchParams) }));
}

async function destinoDeRedireccion(searchParams: Record<string, string | string[] | undefined>) {
  const error = await DatosPage({ searchParams: Promise.resolve(searchParams) }).then(
    () => undefined,
    (causa: Error) => causa,
  );
  expect(error?.message).toMatch(/^REDIRECT:/);
  return (error as Error).message.replace("REDIRECT:", "");
}

beforeEach(() => {
  GET.mockReset();
});

describe("/reservas/nueva/datos", () => {
  it.each(["fecha", "turnoId", "zonaId", "comensales"])(
    "sin %s redirige al Paso 1 sin consultar al backend",
    async (campo) => {
      expect(await destinoDeRedireccion({ ...SELECCION, [campo]: undefined })).toBe("/reservas/nueva");
      expect(GET).not.toHaveBeenCalled();
    },
  );

  it("consulta el catálogo sin reutilizar respuestas anteriores", async () => {
    responder();

    await renderizar();

    expect(GET).toHaveBeenCalledWith("/zonas", { cache: "no-store" });
    expect(GET).toHaveBeenCalledWith("/turnos", { cache: "no-store" });
  });

  it("muestra el paso 3 de 3, el resumen de la selección y el formulario", async () => {
    responder();

    await renderizar();

    expect(screen.getByText("Paso 3 de 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Tus datos" })).toBeInTheDocument();
    const resumen = screen.getByRole("region", { name: "Resumen de tu selección" });
    expect(within(resumen).getByText("sábado, 19 de septiembre de 2026")).toBeInTheDocument();
    expect(within(resumen).getByText("20:00 a 23:30")).toBeInTheDocument();
    expect(within(resumen).getByText("STANDARD")).toBeInTheDocument();
    expect(within(resumen).getByText("4")).toBeInTheDocument();
    expect(screen.queryByText("Lugares restantes")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar reserva" })).toBeInTheDocument();
  });

  it("si el turno o la zona ya no figuran en el catálogo redirige al Paso 1", async () => {
    responder({ turnos: ok([]) });

    expect(await destinoDeRedireccion(SELECCION)).toBe(
      `/reservas/nueva?${new URLSearchParams(SELECCION).toString()}`,
    );
  });

  it("si falla el catálogo muestra el mensaje genérico y el botón de reintentar", async () => {
    responder({ zonas: falla(500) });

    await renderizar();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "El servicio no está disponible en este momento. Intentá de nuevo más tarde.",
    );
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
