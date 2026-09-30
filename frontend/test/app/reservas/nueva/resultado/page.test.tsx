import { render, screen, within } from "@testing-library/react";
import ResultadoPage from "../../../../../app/reservas/nueva/resultado/page";
import { apiClient } from "../../../../../src/lib/api/client";
import {
  TURNO_CENA_SABADO,
  TURNOS,
  ZONA_STANDARD,
  ZONA_VIP,
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
const falla = (status: number, error?: unknown): Respuesta => ({
  error,
  response: { ok: false, status },
});

const CON_LUGAR = ok({ disponible: true, lugaresRestantes: 20, motivos: [] });

function responder(
  disponibilidad: Respuesta,
  { zonas = ok(ZONAS), turnos = ok(TURNOS) }: { zonas?: Respuesta; turnos?: Respuesta } = {},
) {
  GET.mockImplementation(async (ruta: string) => {
    if (ruta === "/disponibilidad") return disponibilidad;
    return ruta === "/zonas" ? zonas : turnos;
  });
}

const SELECCION = {
  fecha: "2026-09-19",
  turnoId: TURNO_CENA_SABADO.id,
  zonaId: ZONA_STANDARD.id,
  comensales: "4",
};

async function renderizar(searchParams: Record<string, string | string[] | undefined> = SELECCION) {
  render(await ResultadoPage({ searchParams: Promise.resolve(searchParams) }));
}

async function destinoDeRedireccion(searchParams: Record<string, string | string[] | undefined>) {
  const error = await ResultadoPage({ searchParams: Promise.resolve(searchParams) }).then(
    () => undefined,
    (causa: Error) => causa,
  );
  expect(error?.message).toMatch(/^REDIRECT:/);
  return (error as Error).message.replace("REDIRECT:", "");
}

function valorDe(etiqueta: string): string | null {
  return screen.getByText(etiqueta).nextElementSibling?.textContent ?? null;
}

beforeEach(() => {
  GET.mockReset();
});

describe("/reservas/nueva/resultado - sin selección", () => {
  it("sin ningún parámetro redirige al Paso 1", async () => {
    expect(await destinoDeRedireccion({})).toBe("/reservas/nueva");
    expect(GET).not.toHaveBeenCalled();
  });

  it.each(["fecha", "turnoId", "zonaId", "comensales"])(
    "sin %s redirige al Paso 1 sin consultar al backend",
    async (campo) => {
      expect(await destinoDeRedireccion({ ...SELECCION, [campo]: undefined })).toBe("/reservas/nueva");
      expect(GET).not.toHaveBeenCalled();
    },
  );

  it("con un parámetro mal formado redirige al Paso 1", async () => {
    expect(await destinoDeRedireccion({ ...SELECCION, turnoId: "no-es-uuid" })).toBe(
      "/reservas/nueva",
    );
  });
});

describe("/reservas/nueva/resultado - hay lugar", () => {
  it("consulta la disponibilidad de la selección sin reutilizar respuestas anteriores", async () => {
    responder(CON_LUGAR);

    await renderizar();

    expect(GET).toHaveBeenCalledWith("/disponibilidad", {
      params: {
        query: {
          fecha: "2026-09-19",
          turnoId: TURNO_CENA_SABADO.id,
          zonaId: ZONA_STANDARD.id,
          comensales: 4,
        },
      },
      cache: "no-store",
    });
    expect(GET).toHaveBeenCalledWith("/zonas");
    expect(GET).toHaveBeenCalledWith("/turnos");
  });

  it("muestra el paso 2 de 3, el título y los lugares restantes", async () => {
    responder(CON_LUGAR);

    await renderizar();

    expect(screen.getByText("Paso 2 de 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "¡Hay lugar!" })).toBeInTheDocument();
    expect(valorDe("Lugares restantes")).toBe("20");
  });

  it("muestra el resumen con fecha larga, horario local, zona y comensales", async () => {
    responder(CON_LUGAR);

    await renderizar();

    const resumen = screen.getByRole("region", { name: "Resumen de tu selección" });
    expect(within(resumen).getByText("sábado, 19 de septiembre de 2026")).toBeInTheDocument();
    expect(within(resumen).getByText("20:00 a 23:30")).toBeInTheDocument();
    expect(within(resumen).getByText("STANDARD")).toBeInTheDocument();
    expect(valorDe("Comensales")).toBe("4");
  });

  it("en una zona sin confirmación no muestra el aviso de pendiente", async () => {
    responder(CON_LUGAR);

    await renderizar();

    expect(screen.queryByText(/pendiente de confirmación/)).not.toBeInTheDocument();
  });

  it("en una zona que requiere confirmación muestra el aviso de pendiente", async () => {
    responder(CON_LUGAR);

    await renderizar({ ...SELECCION, zonaId: ZONA_VIP.id });

    expect(screen.getByRole("status")).toHaveTextContent(/pendiente de confirmación/);
  });

  it("ofrece 'Continuar' hacia los datos de contacto con la misma selección", async () => {
    responder(CON_LUGAR);

    await renderizar();

    const esperada = new URLSearchParams(SELECCION).toString();
    expect(screen.getByRole("link", { name: "Continuar" })).toHaveAttribute(
      "href",
      `/reservas/nueva/datos?${esperada}`,
    );
  });
});

describe("/reservas/nueva/resultado - no hay lugar", () => {
  const SIN_LUGAR = ok({
    disponible: false,
    lugaresRestantes: 0,
    motivos: [
      { codigo: "AFORO_ZONA", mensaje: "La zona STANDARD está completa para ese turno y esa fecha." },
      { codigo: "COMENSALES_FUERA_DE_RANGO", mensaje: "La zona STANDARD admite de 1 a 8 comensales." },
    ],
  });

  it("muestra un Alert de error por cada motivo informado, sin omitir ninguno", async () => {
    responder(SIN_LUGAR);

    await renderizar();

    const alertas = screen.getAllByRole("alert");
    expect(alertas.map((alerta) => alerta.textContent)).toEqual([
      "La zona STANDARD está completa para ese turno y esa fecha.",
      "La zona STANDARD admite de 1 a 8 comensales.",
    ]);
  });

  it("muestra el título de rechazo, sin indicador de paso ni 'Continuar'", async () => {
    responder(SIN_LUGAR);

    await renderizar();

    expect(
      screen.getByRole("heading", { level: 1, name: "No hay lugar para esa combinación" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Paso \d de \d/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Continuar" })).not.toBeInTheDocument();
  });

  it("ofrece 'Cambiar fecha, turno o zona' hacia el Paso 1 con la selección prellenada", async () => {
    responder(SIN_LUGAR);

    await renderizar();

    const esperada = new URLSearchParams(SELECCION).toString();
    expect(screen.getByRole("link", { name: "Cambiar fecha, turno o zona" })).toHaveAttribute(
      "href",
      `/reservas/nueva?${esperada}`,
    );
  });
});

describe("/reservas/nueva/resultado - errores", () => {
  it("ante un 404 de la disponibilidad redirige al Paso 1 conservando la selección", async () => {
    responder(falla(404, { statusCode: 404, message: "Turno no encontrado", error: "Not Found" }));

    const destino = await destinoDeRedireccion(SELECCION);

    expect(destino).toBe(`/reservas/nueva?${new URLSearchParams(SELECCION).toString()}`);
  });

  it("ante un 400 de la disponibilidad no redirige: muestra el error y el enlace para cambiar la selección", async () => {
    const seleccion = { ...SELECCION, comensales: "9999" };
    responder(
      falla(400, {
        statusCode: 400,
        message: ["comensales must not be greater than 100"],
        error: "Bad Request",
      }),
    );

    await renderizar(seleccion);

    // Texto propio del cliente: nunca el del servidor (config.yaml §6).
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Alguno de los datos de la selección no es válido. Cambiá la fecha, el turno, la zona o los comensales e intentá de nuevo.",
    );
    expect(screen.queryByText(/must not be greater/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cambiar fecha, turno o zona" })).toHaveAttribute(
      "href",
      `/reservas/nueva?${new URLSearchParams(seleccion).toString()}`,
    );
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });

  it("ante un 429 de la disponibilidad no redirige: muestra el mensaje genérico con reintentar", async () => {
    responder(falla(429));

    await renderizar();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "El servicio no está disponible en este momento. Intentá de nuevo más tarde.",
    );
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("si el turno ya no figura en el catálogo redirige al Paso 1", async () => {
    responder(CON_LUGAR, { turnos: ok([]) });

    const destino = await destinoDeRedireccion(SELECCION);

    expect(destino).toBe(`/reservas/nueva?${new URLSearchParams(SELECCION).toString()}`);
  });

  it("si la zona ya no figura en el catálogo redirige al Paso 1", async () => {
    responder(CON_LUGAR, { zonas: ok([ZONA_VIP]) });

    const destino = await destinoDeRedireccion(SELECCION);

    expect(destino).toBe(`/reservas/nueva?${new URLSearchParams(SELECCION).toString()}`);
  });

  it.each([
    ["la disponibilidad", () => responder(falla(500, { message: "detalle interno" }))],
    ["las zonas", () => responder(CON_LUGAR, { zonas: falla(503) })],
    ["los turnos", () => responder(CON_LUGAR, { turnos: falla(502) })],
  ])(
    "si falla %s muestra el mensaje genérico, sin detalle del servidor, y el botón de reintentar",
    async (_que, preparar) => {
      preparar();

      await renderizar();

      expect(screen.getByRole("alert")).toHaveTextContent(
        "El servicio no está disponible en este momento. Intentá de nuevo más tarde.",
      );
      expect(screen.queryByText(/detalle interno/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    },
  );

  it("ante un error de red muestra el mensaje del resultado y el botón de reintentar", async () => {
    GET.mockRejectedValue(new TypeError("fetch failed"));

    await renderizar();

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo conectar con el servidor.");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("no ofrece ningún enlace a la administración", async () => {
    responder(CON_LUGAR);

    await renderizar();

    expect(document.querySelector('a[href^="/admin"]')).toBeNull();
  });
});
