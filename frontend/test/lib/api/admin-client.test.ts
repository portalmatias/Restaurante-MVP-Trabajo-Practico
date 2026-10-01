/**
 * @jest-environment node
 */
// Mismo esquema que client.test.ts: entorno node (hay `fetch`/`Request`/`Response` globales),
// `fetch` mockeado antes del import dinámico y `NEXT_PUBLIC_API_URL` definida. Como en node no
// hay `sessionStorage`, se mockea el módulo de sesión: lo que se prueba acá es qué hace el
// cliente con la sesión, no cómo se guarda (eso lo cubre session.test.ts).
import type * as AdminClientModule from "../../../src/lib/api/admin-client";
import { borrarSesion, leerSesion } from "../../../src/lib/auth/session";

jest.mock("../../../src/lib/auth/session", () => ({
  leerSesion: jest.fn(),
  borrarSesion: jest.fn(),
}));

const leerSesionMock = leerSesion as jest.Mock;
const borrarSesionMock = borrarSesion as jest.Mock;

function respuestaJson(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("adminClient y toAdminApiResult", () => {
  const fetchOriginal = global.fetch;
  const envOriginal = process.env.NEXT_PUBLIC_API_URL;
  let modulo: typeof AdminClientModule;
  let fetchMock: jest.Mock;

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    modulo = await import("../../../src/lib/api/admin-client");
  });

  afterAll(() => {
    if (envOriginal === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = envOriginal;
    }
    global.fetch = fetchOriginal;
  });

  beforeEach(() => {
    fetchMock.mockReset();
    leerSesionMock.mockReset();
    borrarSesionMock.mockReset();
  });

  function ultimoPedido(): Request {
    return fetchMock.mock.calls[0][0] as Request;
  }

  it("con una sesión guardada, la request lleva Authorization: Bearer <token>", async () => {
    leerSesionMock.mockReturnValue({ accessToken: "token-123", exp: 9_999_999_999 });
    fetchMock.mockResolvedValue(respuestaJson(200, []));

    await modulo.toAdminApiResult(modulo.adminClient.GET("/admin/zonas"));

    expect(ultimoPedido().headers.get("Authorization")).toBe("Bearer token-123");
    expect(ultimoPedido().url).toBe("http://localhost:3001/admin/zonas");
  });

  it("sin sesión, la request sale sin Authorization", async () => {
    leerSesionMock.mockReturnValue(null);
    fetchMock.mockResolvedValue(respuestaJson(200, []));

    await modulo.toAdminApiResult(modulo.adminClient.GET("/admin/zonas"));

    expect(ultimoPedido().headers.has("Authorization")).toBe(false);
  });

  it("el apiClient público nunca lleva Authorization, aunque haya sesión", async () => {
    leerSesionMock.mockReturnValue({ accessToken: "token-123", exp: 9_999_999_999 });
    fetchMock.mockResolvedValue(respuestaJson(200, []));
    const { apiClient } = await import("../../../src/lib/api/client");

    await apiClient.GET("/zonas");

    expect(ultimoPedido().headers.has("Authorization")).toBe(false);
  });

  it("un 401 borra la sesión y dispara el manejador de sesión vencida", async () => {
    leerSesionMock.mockReturnValue(null);
    fetchMock.mockResolvedValue(
      respuestaJson(401, { statusCode: 401, message: "Unauthorized" }),
    );
    const manejador = jest.fn();
    const desregistrar = modulo.registrarManejadorSesionVencida(manejador);

    const resultado = await modulo.toAdminApiResult(modulo.adminClient.GET("/admin/zonas"));

    expect(resultado.error).toBeDefined();
    expect(borrarSesionMock).toHaveBeenCalledTimes(1);
    expect(manejador).toHaveBeenCalledTimes(1);
    desregistrar();
  });

  it("un 403 (token sin rol ADMIN) también descarta la sesión", async () => {
    leerSesionMock.mockReturnValue({ accessToken: "token-123", exp: 9_999_999_999 });
    fetchMock.mockResolvedValue(respuestaJson(403, { statusCode: 403, message: "Forbidden" }));
    const manejador = jest.fn();
    const desregistrar = modulo.registrarManejadorSesionVencida(manejador);

    await modulo.toAdminApiResult(modulo.adminClient.GET("/admin/zonas"));

    expect(borrarSesionMock).toHaveBeenCalledTimes(1);
    expect(manejador).toHaveBeenCalledTimes(1);
    desregistrar();
  });

  it("un 401 atrasado de un token anterior no borra la sesión nueva", async () => {
    // El pedido sale con el token viejo; cuando llega el 401, ya hay otra sesión guardada.
    leerSesionMock
      // 1.ª lectura: `onRequest`, al evaluarse `adminClient.GET(...)` (el header que sale).
      .mockReturnValueOnce({ accessToken: "token-viejo", exp: 9_999_999_999 })
      // 2.ª: `toAdminApiResult` guarda con qué token salió el pedido.
      .mockReturnValueOnce({ accessToken: "token-viejo", exp: 9_999_999_999 })
      // Al llegar el 401 ya hay otra sesión guardada.
      .mockReturnValue({ accessToken: "token-nuevo", exp: 9_999_999_999 });
    fetchMock.mockResolvedValue(respuestaJson(401, { statusCode: 401, message: "x" }));
    const manejador = jest.fn();
    const desregistrar = modulo.registrarManejadorSesionVencida(manejador);

    await modulo.toAdminApiResult(modulo.adminClient.GET("/admin/zonas"));

    expect(borrarSesionMock).not.toHaveBeenCalled();
    expect(manejador).not.toHaveBeenCalled();
    desregistrar();
  });

  it("otros errores no tocan la sesión", async () => {
    leerSesionMock.mockReturnValue({ accessToken: "token-123", exp: 9_999_999_999 });
    fetchMock.mockResolvedValue(
      respuestaJson(409, { statusCode: 409, message: "Etiqueta duplicada" }),
    );
    const manejador = jest.fn();
    const desregistrar = modulo.registrarManejadorSesionVencida(manejador);

    const resultado = await modulo.toAdminApiResult(
      modulo.adminClient.POST("/admin/mesas", {
        body: { zonaId: "z", capacidad: 4, etiqueta: "M1" },
      }),
    );

    expect(resultado.error).toEqual({
      tipo: "conflicto",
      mensaje: "Etiqueta duplicada",
      motivos: [],
    });
    expect(borrarSesionMock).not.toHaveBeenCalled();
    expect(manejador).not.toHaveBeenCalled();
    desregistrar();
  });

  it("después de desregistrar, un 401 ya no llama al manejador", async () => {
    leerSesionMock.mockReturnValue(null);
    fetchMock.mockResolvedValue(respuestaJson(401, { statusCode: 401, message: "x" }));
    const manejador = jest.fn();
    modulo.registrarManejadorSesionVencida(manejador)();

    await modulo.toAdminApiResult(modulo.adminClient.GET("/admin/zonas"));

    expect(manejador).not.toHaveBeenCalled();
  });
});
