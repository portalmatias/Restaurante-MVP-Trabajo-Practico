import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  LoginForm,
  MENSAJE_CREDENCIALES_INVALIDAS,
  MENSAJE_LIMITE_INTENTOS,
} from "../../../src/components/admin/login-form";
import { apiClient } from "../../../src/lib/api/client";
import { leerSesion } from "../../../src/lib/auth/session";

const replace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

// Se mockea solo `apiClient`: `toApiResult` y el mapeo de errores son los reales.
jest.mock("../../../src/lib/api/client", () => ({
  ...jest.requireActual("../../../src/lib/api/client"),
  apiClient: { POST: jest.fn() },
}));

const POST = apiClient.POST as unknown as jest.Mock;

// JWT con `exp` lejano (2099): la sesión guardada queda vigente durante el test.
const TOKEN = `cabecera.${btoa(JSON.stringify({ sub: "1", exp: 4_070_908_800 }))}.firma`;

function respuestaOk(data: unknown) {
  return { data, response: { ok: true, status: 200 } };
}

function respuestaError(status: number, error?: unknown) {
  return { error, response: { ok: false, status } };
}

function completar(email = "admin@restaurante-mvp.local", password = "secreta") {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: password } });
}

function enviar() {
  fireEvent.click(screen.getByRole("button", { name: /Ingresar|Ingresando/ }));
}

beforeEach(() => {
  POST.mockReset();
  replace.mockReset();
  sessionStorage.clear();
});

describe("LoginForm", () => {
  it("muestra email y contraseña con los tipos y autocompletado correctos", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  });

  it("deshabilita el botón mientras la solicitud está en curso", async () => {
    let resolver: (valor: unknown) => void = () => {};
    POST.mockReturnValue(new Promise((r) => (resolver = r)));
    render(<LoginForm />);
    completar();

    enviar();

    expect(screen.getByRole("button", { name: "Ingresando…" })).toBeDisabled();
    // Un segundo envío mientras tanto no dispara otra solicitud.
    fireEvent.submit(screen.getByRole("button", { name: "Ingresando…" }));
    expect(POST).toHaveBeenCalledTimes(1);

    await act(async () => resolver(respuestaError(401, { message: "Credenciales inválidas" })));
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled();
  });

  it("login exitoso guarda la sesión y redirige a /admin", async () => {
    POST.mockResolvedValue(respuestaOk({ accessToken: TOKEN }));
    render(<LoginForm />);
    completar();

    enviar();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
    expect(leerSesion()?.accessToken).toBe(TOKEN);
    expect(POST).toHaveBeenCalledWith("/auth/login", {
      body: { email: "admin@restaurante-mvp.local", password: "secreta" },
    });
  });

  it("un 401 muestra el mensaje genérico y no guarda la sesión", async () => {
    POST.mockResolvedValue(respuestaError(401, { statusCode: 401, message: "Credenciales inválidas" }));
    render(<LoginForm />);
    completar();

    enviar();

    expect(await screen.findByRole("alert")).toHaveTextContent(MENSAJE_CREDENCIALES_INVALIDAS);
    expect(leerSesion()).toBeNull();
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");
    expect(replace).not.toHaveBeenCalled();
  });

  it("un 400 muestra los errores de validación junto a los campos", async () => {
    POST.mockResolvedValue(
      respuestaError(400, { statusCode: 400, message: ["email must be an email"] }),
    );
    render(<LoginForm />);
    completar("no-es-un-email");

    enviar();

    expect(await screen.findByText("Ingresá un email válido.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(leerSesion()).toBeNull();
  });

  it("un 429 muestra el límite de intentos, no el mensaje de credenciales", async () => {
    POST.mockResolvedValue(respuestaError(429));
    render(<LoginForm />);
    completar();

    enviar();

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(MENSAJE_LIMITE_INTENTOS);
    expect(alerta).not.toHaveTextContent(MENSAJE_CREDENCIALES_INVALIDAS);
  });

  it("con campos vacíos no envía nada", () => {
    render(<LoginForm />);

    enviar();

    expect(POST).not.toHaveBeenCalled();
    expect(screen.getByText("Ingresá tu email.")).toBeInTheDocument();
  });

  it("un token sin exp legible no se acepta como sesión", async () => {
    POST.mockResolvedValue(respuestaOk({ accessToken: "token-raro" }));
    render(<LoginForm />);
    completar();

    enviar();

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo iniciar la sesión");
    expect(replace).not.toHaveBeenCalled();
  });

  it("con una sesión vigente redirige directo a /admin", () => {
    sessionStorage.setItem("admin-session", JSON.stringify({ accessToken: TOKEN, exp: 4_070_908_800 }));

    render(<LoginForm />);

    expect(replace).toHaveBeenCalledWith("/admin");
  });
});

describe("LoginForm - motivo de llegada", () => {
  it("explica que la sesión venció", () => {
    render(<LoginForm motivo="sesion-vencida" />);
    expect(screen.getByRole("status")).toHaveTextContent(/Tu sesión venció/);
  });

  it("no muestra ningún aviso sin motivo o con uno desconocido", () => {
    const { rerender } = render(<LoginForm />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    rerender(<LoginForm motivo="otro" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
