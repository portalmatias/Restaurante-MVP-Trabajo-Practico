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

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/login"));
    // El manejador del 401 y el cambio de sesión no navegan dos veces.
    expect(replace).toHaveBeenCalledTimes(1);
    expect(leerSesion()).toBeNull();
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  });
});
