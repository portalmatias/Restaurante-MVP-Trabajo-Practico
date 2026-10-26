import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { AdminShell } from "../../../src/components/admin/admin-shell";
import { adminClient, toAdminApiResult } from "../../../src/lib/api/admin-client";
import { guardarSesion, leerSesion } from "../../../src/lib/auth/session";

const replace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/admin",
}));

// Solo se reemplaza `adminClient.GET`: `toAdminApiResult` (y su manejo del 401) es el real.
jest.mock("../../../src/lib/api/admin-client", () => {
  const real = jest.requireActual("../../../src/lib/api/admin-client");
  return { ...real, adminClient: { GET: jest.fn() } };
});

const GET = adminClient.GET as unknown as jest.Mock;

const TOKEN = `cabecera.${btoa(JSON.stringify({ sub: "1", exp: 4_070_908_800 }))}.firma`;

beforeEach(() => {
  replace.mockReset();
  GET.mockReset();
  sessionStorage.clear();
});

describe("AdminShell", () => {
  it("sin sesión redirige a /admin/login y no renderiza los hijos", () => {
    render(
      <AdminShell>
        <p>Contenido protegido</p>
      </AdminShell>,
    );

    expect(replace).toHaveBeenCalledWith("/admin/login");
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  });

  it("con sesión renderiza los hijos y la navegación", () => {
    guardarSesion(TOKEN);

    render(
      <AdminShell>
        <p>Contenido protegido</p>
      </AdminShell>,
    );

    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Aforo" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Salón" })).toHaveAttribute("href", "/admin/salon");
    expect(replace).not.toHaveBeenCalled();
  });

  it("Cerrar sesión borra la sesión y redirige al login", () => {
    guardarSesion(TOKEN);
    render(
      <AdminShell>
        <p>Contenido protegido</p>
      </AdminShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(leerSesion()).toBeNull();
    expect(replace).toHaveBeenCalledWith("/admin/login");
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  });

  it("un 401 en una llamada de un hijo redirige sin que el hijo lo maneje", async () => {
    guardarSesion(TOKEN);
    GET.mockResolvedValue({
      error: { statusCode: 401, message: "Unauthorized" },
      response: { ok: false, status: 401 },
    });

    function HijoQueLlamaALaApi() {
      useEffect(() => {
        void toAdminApiResult(adminClient.GET("/admin/zonas"));
      }, []);
      return <p>Contenido protegido</p>;
    }

    await act(async () => {
      render(
        <AdminShell>
          <HijoQueLlamaALaApi />
        </AdminShell>,
      );
    });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/login?motivo=sesion-vencida"));
    // El manejador del 401 y el cambio de sesión no navegan dos veces.
    expect(replace).toHaveBeenCalledTimes(1);
    expect(leerSesion()).toBeNull();
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  });

  it("avisa cuando faltan menos de 5 minutos y renovar lleva al login con su motivo", () => {
    jest.useFakeTimers();
    try {
      const ahora = Math.floor(Date.now() / 1000);
      const token = `cabecera.${btoa(JSON.stringify({ sub: "1", exp: ahora + 180 }))}.firma`;
      guardarSesion(token);
      render(
        <AdminShell>
          <p>Contenido protegido</p>
        </AdminShell>,
      );
      act(() => {
        jest.advanceTimersByTime(20_000);
      });

      expect(screen.getByRole("group", { name: "Vencimiento de la sesión" })).toHaveTextContent(/Tu sesión vence en \d minutos?/);
      fireEvent.click(screen.getByRole("button", { name: "Renovar sesión" }));
      expect(replace).toHaveBeenCalledWith("/admin/login?motivo=renovar");
    } finally {
      jest.useRealTimers();
    }
  });

  it("sin aviso mientras queda tiempo de sobra", () => {
    guardarSesion(TOKEN);
    render(
      <AdminShell>
        <p>Contenido protegido</p>
      </AdminShell>,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // Tarea 3.7: lo que faltaba de «Rutas de administración protegidas por sesión» y del aviso.
  function tokenQueVenceEn(segundos: number) {
    const exp = Math.floor(Date.now() / 1000) + segundos;
    return `cabecera.${btoa(JSON.stringify({ sub: "1", exp }))}.firma`;
  }

  it("con un solo minuto restante el aviso va en singular", () => {
    jest.useFakeTimers();
    try {
      guardarSesion(tokenQueVenceEn(50));
      render(
        <AdminShell>
          <p>Contenido protegido</p>
        </AdminShell>,
      );
      act(() => {
        jest.advanceTimersByTime(1);
      });

      expect(screen.getByRole("group", { name: "Vencimiento de la sesión" })).toHaveTextContent("Tu sesión vence en 1 minuto.");
    } finally {
      jest.useRealTimers();
    }
  });

  it("«Renovar sesión» nunca pasa por ?motivo=sesion-vencida", () => {
    jest.useFakeTimers();
    try {
      guardarSesion(tokenQueVenceEn(180));
      render(
        <AdminShell>
          <p>Contenido protegido</p>
        </AdminShell>,
      );
      act(() => {
        jest.advanceTimersByTime(1);
      });
      fireEvent.click(screen.getByRole("button", { name: "Renovar sesión" }));
      act(() => {
        jest.advanceTimersByTime(20_000);
      });

      expect(replace).toHaveBeenCalledWith("/admin/login?motivo=renovar");
      expect(replace).not.toHaveBeenCalledWith("/admin/login?motivo=sesion-vencida");
    } finally {
      jest.useRealTimers();
    }
  });

  it("un 403 en una llamada de un hijo también lleva a ?motivo=sesion-vencida", async () => {
    guardarSesion(TOKEN);
    GET.mockResolvedValue({
      error: { statusCode: 403, message: "Forbidden" },
      response: { ok: false, status: 403 },
    });

    function HijoQueLlamaALaApi() {
      useEffect(() => {
        void toAdminApiResult(adminClient.GET("/admin/zonas"));
      }, []);
      return <p>Contenido protegido</p>;
    }

    await act(async () => {
      render(
        <AdminShell>
          <HijoQueLlamaALaApi />
        </AdminShell>,
      );
    });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/login?motivo=sesion-vencida"));
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("una pestaña quieta cuya sesión vence por tiempo va a ?motivo=sesion-vencida", () => {
    jest.useFakeTimers();
    try {
      guardarSesion(tokenQueVenceEn(10));
      render(
        <AdminShell>
          <p>Contenido protegido</p>
        </AdminShell>,
      );

      act(() => {
        jest.advanceTimersByTime(30_000);
      });

      expect(replace).toHaveBeenCalledWith("/admin/login?motivo=sesion-vencida");
      expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  // Revisión de #78: el aviso era `role="alert"` y su texto cambia cada minuto, así que un lector de
  // pantalla lo repetía en cada cambio. El aviso visible no es una región viva; una región aparte,
  // solo para lectores, anuncia nada más la primera aparición y el último minuto.
  it("el aviso visible no es role=alert: no se vuelve a anunciar cada minuto", () => {
    jest.useFakeTimers();
    try {
      guardarSesion(tokenQueVenceEn(180));
      render(
        <AdminShell>
          <p>Contenido protegido</p>
        </AdminShell>,
      );
      act(() => {
        jest.advanceTimersByTime(1);
      });

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByRole("group", { name: "Vencimiento de la sesión" })).toHaveTextContent(
        /Tu sesión vence en 3 minutos/,
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("la región viva anuncia al aparecer el aviso y al llegar al último minuto, no entre medio", () => {
    jest.useFakeTimers();
    try {
      guardarSesion(tokenQueVenceEn(270));
      render(
        <AdminShell>
          <p>Contenido protegido</p>
        </AdminShell>,
      );
      act(() => {
        jest.advanceTimersByTime(1);
      });
      const anuncio = screen.getByRole("status");
      expect(anuncio).toHaveTextContent("Tu sesión vence en 5 minutos.");

      act(() => {
        jest.advanceTimersByTime(105_000);
      });
      expect(screen.getByRole("group", { name: "Vencimiento de la sesión" })).toHaveTextContent(
        /Tu sesión vence en 3 minutos/,
      );
      expect(screen.getByRole("status")).toHaveTextContent("Tu sesión vence en 5 minutos.");

      act(() => {
        jest.advanceTimersByTime(110_000);
      });
      expect(screen.getByRole("group", { name: "Vencimiento de la sesión" })).toHaveTextContent(
        /Tu sesión vence en 1 minuto/,
      );
      expect(screen.getByRole("status")).toHaveTextContent("Tu sesión vence en 1 minuto.");
    } finally {
      jest.useRealTimers();
    }
  });

  // Revisión de #78, punto 2: la sesión vive en `sessionStorage`, que es propio de cada pestaña, y
  // el panel no escucha el evento `storage`. Cerrar sesión en otra pestaña no toca esta: sigue con
  // la suya hasta que venza, y no hay ningún camino que la mande a `?motivo=sesion-vencida`.
  it("un evento de storage de otra pestaña no cierra ni redirige esta sesión", () => {
    guardarSesion(TOKEN);
    render(
      <AdminShell>
        <p>Contenido protegido</p>
      </AdminShell>,
    );

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: "admin-session", oldValue: "x", newValue: null }),
      );
    });

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
    expect(leerSesion()).not.toBeNull();
  });
});
