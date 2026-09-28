/**
 * @jest-environment node
 */
import { urlBaseApi } from "../../../src/lib/api/url-base";

// Entorno node: sin `window`, simula un Server Component (D6).
describe("urlBaseApi en el servidor", () => {
  const originalUrl = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    // Asignar `undefined` a una variable de entorno guarda el texto "undefined": hay que
    // borrarla cuando no estaba definida (mismo patrón que client.test.ts `afterAll`).
    if (originalUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalUrl;
    }
  });

  it("devuelve el valor de NEXT_PUBLIC_API_URL", () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";

    expect(urlBaseApi()).toBe("http://localhost:3001");
  });
});
