/**
 * @jest-environment node
 */
// jsdom no expone `fetch`/`Response` globales; este test no necesita DOM, solo mockear fetch.
//
// El import de `client.ts` se hace dinámico (dentro de `beforeAll`) porque el módulo llama a
// `urlBaseApi()` al cargarse (D6): sin `window`, esa función necesita `NEXT_PUBLIC_API_URL` ya
// definida, y un `import` estático se resuelve antes de que el código del test pueda setear la
// variable de entorno.
import type { apiClient as ApiClient, toApiResult as ToApiResult } from "../../../src/lib/api/client";

// Test de integración liviano (D7): mockea `fetch` para devolver un 409 de una ruta de admin
// tal como está hoy el contrato (message string, sin motivos — ver openapi.yaml /admin/mesas)
// y comprueba que toApiResult aplica el mapeo de errors.ts sobre la respuesta cruda de
// openapi-fetch.
describe("toApiResult sobre el cliente HTTP", () => {
  const fetchOriginal = global.fetch;
  const envOriginal = process.env.NEXT_PUBLIC_API_URL;
  let apiClient: typeof ApiClient;
  let toApiResult: typeof ToApiResult;
  let fetchMock: jest.Mock;

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
    // `createClient` captura `globalThis.fetch` como default en el momento de crearse (ver
    // node_modules/openapi-fetch/src/index.js): el mock tiene que existir ANTES del import
    // dinámico de client.ts, no dentro de cada test.
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    ({ apiClient, toApiResult } = await import("../../../src/lib/api/client"));
  });

  afterAll(() => {
    // Asignar `undefined` a una variable de entorno guarda el texto "undefined": se borra.
    if (envOriginal === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = envOriginal;
    }
    global.fetch = fetchOriginal;
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  it("una respuesta 2xx devuelve data y llama a la URL base unida al path", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify("ok"), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const resultado = await toApiResult(apiClient.GET("/"));

    expect(resultado).toEqual({ data: "ok" });
    const pedido = fetchMock.mock.calls[0][0] as Request;
    expect(pedido.url).toBe("http://localhost:3001/");
  });

  it("un error sin cuerpo (404 vacío) no se confunde con un éxito", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, { status: 404, headers: { "Content-Length": "0" } }),
    );

    const resultado = await toApiResult(
      apiClient.DELETE("/admin/mesas/{id}", {
        params: { path: { id: "3fa85f64-5717-4562-b3fc-2c963f66afa6" } },
      }),
    );

    expect(resultado.data).toBeUndefined();
    expect(resultado.error).toEqual({
      tipo: "no-encontrado",
      mensaje: "Ocurrió un error inesperado.",
    });
  });

  it("una falla de red devuelve un error desconocido en vez de lanzar", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const resultado = await toApiResult(apiClient.GET("/"));

    expect(resultado.data).toBeUndefined();
    expect(resultado.error).toEqual({
      tipo: "desconocido",
      mensaje: "No se pudo conectar con el servidor.",
    });
  });

  it("una petición cancelada no se informa como falla de conexión", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted.", "AbortError"));

    const resultado = await toApiResult(apiClient.GET("/"));

    expect(resultado.data).toBeUndefined();
    expect(resultado.error).toEqual({ tipo: "desconocido", mensaje: "La solicitud se canceló." });
  });

  it("un 2xx con cuerpo mal formado no se informa como falla de conexión", async () => {
    fetchMock.mockResolvedValue(
      new Response("{no es json", { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const resultado = await toApiResult(apiClient.GET("/"));

    expect(resultado.data).toBeUndefined();
    expect(resultado.error).toEqual({
      tipo: "desconocido",
      mensaje: "Ocurrió un error inesperado.",
    });
  });

  it("un 409 de /admin/mesas (sin motivos) mapea a tipo conflicto con motivos vacío", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          statusCode: 409,
          error: "Conflict",
          message: "Ya existe una mesa con esa etiqueta.",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );

    const resultado = await toApiResult(
      apiClient.POST("/admin/mesas", {
        body: { zonaId: "3fa85f64-5717-4562-b3fc-2c963f66afa6", capacidad: 4, etiqueta: "M1" },
      }),
    );

    expect(resultado.error).toEqual({
      tipo: "conflicto",
      mensaje: "Ya existe una mesa con esa etiqueta.",
      motivos: [],
    });
    expect(resultado.data).toBeUndefined();
  });
});
