/**
 * @jest-environment node
 */
// Cubre las dos ramas de `rewrites()` cuando falta NEXT_PUBLIC_API_URL (design.md D6): en
// `next typegen` (typecheck de CI, sin `.env`) se sigue sin proxy; en cualquier otro comando
// (build, dev, start) se corta con un mensaje claro.
import type { NextConfig } from "next";

type Rewrites = NonNullable<NextConfig["rewrites"]>;

describe("rewrites de next.config.ts", () => {
  const argvOriginal = process.argv;
  const urlOriginal = process.env.NEXT_PUBLIC_API_URL;
  let rewrites: Rewrites;

  beforeAll(async () => {
    // Importarlo carga el `.env` de la raíz si existe; cada test fija la variable a mano.
    const config = (await import("../next.config")).default;
    rewrites = config.rewrites as Rewrites;
  });

  afterEach(() => {
    process.argv = argvOriginal;
    if (urlOriginal === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = urlOriginal;
    }
    jest.restoreAllMocks();
  });

  it("con la URL definida, reenvía /api/* al backend", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";

    await expect(rewrites()).resolves.toEqual([
      { source: "/api/:path*", destination: "http://localhost:3001/:path*" },
    ]);
  });

  it("sin la URL, en next typegen avisa y no arma el proxy", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    process.argv = ["node", "next", "typegen"];
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});

    await expect(rewrites()).resolves.toEqual([]);
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining("NEXT_PUBLIC_API_URL"));
  });

  it("sin la URL, fuera de next typegen falla con un mensaje que la nombra", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    process.argv = ["node", "next", "build"];

    await expect(rewrites()).rejects.toThrow(/Falta NEXT_PUBLIC_API_URL/);
  });
});
