import { render, screen, within } from "@testing-library/react";
import ExitoPage from "../../../../../app/reservas/nueva/exito/page";
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
const falla = (status: number): Respuesta => ({ response: { ok: false, status } });

function responder({ zonas = ok(ZONAS), turnos = ok(TURNOS) }: { zonas?: Respuesta; turnos?: Respuesta } = {}) {
  GET.mockImplementation(async (ruta: string) => (ruta === "/zonas" ? zonas : turnos));
}

const CONFIRMADA = {
  codigo: "K7PM3QXA",
  estado: "CONFIRMADA",
  fecha: "2026-09-19",
  turnoId: TURNO_CENA_SABADO.id,
  zonaId: ZONA_STANDARD.id,
  comensales: "4",
};

const PENDIENTE = { ...CONFIRMADA, estado: "PENDIENTE", zonaId: ZONA_VIP.id };

async function renderizar(searchParams: Record<string, string | string[] | undefined> = CONFIRMADA) {
  render(await ExitoPage({ searchParams: Promise.resolve(searchParams) }));
}

async function destinoDeRedireccion(searchParams: Record<string, string | string[] | undefined>) {
  const error = await ExitoPage({ searchParams: Promise.resolve(searchParams) }).then(
    () => undefined,
    (causa: Error) => causa,
  );
  expect(error?.message).toMatch(/^REDIRECT:/);
  return (error as Error).message.replace("REDIRECT:", "");
}

beforeEach(() => {
  GET.mockReset();
  responder();
});

describe("/reservas/nueva/exito - sin los parámetros esperados", () => {
  it("sin ningún parámetro redirige al Paso 1", async () => {
    expect(await destinoDeRedireccion({})).toBe("/reservas/nueva");
    expect(GET).not.toHaveBeenCalled();
  });

  it.each(["codigo", "estado", "fecha", "turnoId", "zonaId", "comensales"])(
    "sin %s redirige al Paso 1 sin consultar al backend",
    async (campo) => {
      expect(await destinoDeRedireccion({ ...CONFIRMADA, [campo]: undefined })).toBe("/reservas/nueva");
      expect(GET).not.toHaveBeenCalled();
    },
  );

  it("con un estado que una reserva recién creada no puede tener redirige al Paso 1", async () => {
    expect(await destinoDeRedireccion({ ...CONFIRMADA, estado: "CANCELADA" })).toBe("/reservas/nueva");
  });
});

describe("/reservas/nueva/exito - estado", () => {
  it("CONFIRMADA muestra 'confirmada' y no muestra el aviso de pendiente", async () => {
    await renderizar();

    expect(
      screen.getByRole("heading", { level: 1, name: "¡Listo! Tu reserva está confirmada" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/pendiente de confirmación/)).not.toBeInTheDocument();
  });

  it("PENDIENTE muestra 'pendiente de confirmación' y el aviso", async () => {
    await renderizar(PENDIENTE);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "¡Listo! Tu reserva está pendiente de confirmación",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/todavía tiene que confirmarla/)).toBeInTheDocument();
  });
});

describe("/reservas/nueva/exito - código y resumen", () => {
  it("muestra el código con la clase de color accent y el botón de copiar", async () => {
    await renderizar();

    expect(screen.getByText("Tu código de reserva")).toBeInTheDocument();
    expect(screen.getByText("K7PM3QXA").className).toMatch(/\btext-accent\b/);
    expect(screen.getByRole("button", { name: "Copiar código" })).toBeInTheDocument();
  });

  it("solo el código usa el color accent en el título y el texto", async () => {
    await renderizar();

    expect(screen.getByRole("heading", { level: 1 }).className).not.toMatch(/accent/);
  });

  it("muestra el resumen con fecha larga, horario local, zona y comensales", async () => {
    await renderizar();

    const resumen = screen.getByRole("region", { name: "Resumen de tu selección" });
    expect(within(resumen).getByText("sábado, 19 de septiembre de 2026")).toBeInTheDocument();
    expect(within(resumen).getByText("20:00 a 23:30")).toBeInTheDocument();
    expect(within(resumen).getByText("STANDARD")).toBeInTheDocument();
    expect(within(resumen).getByText("4")).toBeInTheDocument();
    expect(screen.queryByText("Lugares restantes")).not.toBeInTheDocument();
  });

  it("consulta el catálogo sin reutilizar respuestas anteriores", async () => {
    await renderizar();

    expect(GET).toHaveBeenCalledWith("/zonas", { cache: "no-store" });
    expect(GET).toHaveBeenCalledWith("/turnos", { cache: "no-store" });
  });

  it("ofrece 'Volver al inicio' hacia /reservas", async () => {
    await renderizar();

    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/reservas");
  });
});

describe("/reservas/nueva/exito - texto", () => {
  it("indica que el código junto con el email es la única forma de consultar o cancelar", async () => {
    await renderizar();

    expect(
      screen.getByText(
        "Guardá este código: junto con tu email, es la única forma de consultar o cancelar tu reserva.",
      ),
    ).toBeInTheDocument();
  });

  it.each([["CONFIRMADA", CONFIRMADA], ["PENDIENTE", PENDIENTE]])(
    "con la reserva %s nunca promete ni afirma el envío de un email",
    async (_estado, query) => {
      await renderizar(query);

      const texto = document.body.textContent ?? "";
      expect(texto).not.toMatch(/enviamos|enviaremos|enviado|te llegar|recibir[aá]s|correo/i);
    },
  );
});

describe("/reservas/nueva/exito - el catálogo no responde", () => {
  it("con un error de servidor conserva el código y ofrece reintentar el resumen", async () => {
    responder({ zonas: falla(500) });

    await renderizar();

    expect(screen.getByText("K7PM3QXA")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "El servicio no está disponible en este momento. Intentá de nuevo más tarde.",
    );
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Resumen de tu selección" })).not.toBeInTheDocument();
  });

  it("si el turno ya no figura en el catálogo conserva el código y omite el resumen", async () => {
    responder({ turnos: ok([]) });

    await renderizar();

    expect(screen.getByText("K7PM3QXA")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Resumen de tu selección" })).not.toBeInTheDocument();
  });
});
