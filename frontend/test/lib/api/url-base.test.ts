import { urlBaseApi } from "../../../src/lib/api/url-base";

// Entorno jsdom (default de jest.config.ts): simula el navegador, con `window` presente.
describe("urlBaseApi en el navegador", () => {
  it("devuelve '/api', el proxy de mismo origen de next.config.ts (D6)", () => {
    expect(urlBaseApi()).toBe("/api");
  });
});
