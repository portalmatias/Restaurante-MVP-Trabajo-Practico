import { leerSeleccionDeQuery, urlConSeleccion } from "../../src/lib/seleccion-reserva";

const VALIDA = {
  fecha: "2026-09-19",
  turnoId: "9a2b6c1d-7e34-4f58-b0a9-1c5d8e3f7a64",
  zonaId: "0c7d9e41-52b8-4f36-a1d0-93e6b7c8f245",
  comensales: "4",
};

describe("urlConSeleccion", () => {
  it("arma la query con los cuatro parámetros", () => {
    expect(urlConSeleccion("/reservas/nueva/datos", { ...VALIDA, comensales: 4 })).toBe(
      `/reservas/nueva/datos?fecha=2026-09-19&turnoId=${VALIDA.turnoId}&zonaId=${VALIDA.zonaId}&comensales=4`,
    );
  });

  it("sin selección devuelve la ruta sola", () => {
    expect(urlConSeleccion("/reservas/nueva", {})).toBe("/reservas/nueva");
  });

  it("omite los valores ausentes", () => {
    expect(urlConSeleccion("/reservas/nueva", { fecha: "2026-09-19" })).toBe(
      "/reservas/nueva?fecha=2026-09-19",
    );
  });
});

describe("leerSeleccionDeQuery", () => {
  it("lee una selección completa y convierte los comensales a número", () => {
    expect(leerSeleccionDeQuery(VALIDA)).toEqual({ ...VALIDA, comensales: 4 });
  });

  it.each(["fecha", "turnoId", "zonaId", "comensales"] as const)(
    "devuelve undefined si falta %s",
    (campo) => {
      expect(leerSeleccionDeQuery({ ...VALIDA, [campo]: undefined })).toBeUndefined();
    },
  );

  it.each([
    ["una fecha mal formada", { fecha: "19/09/2026" }],
    ["una fecha que no existe", { fecha: "2026-02-30" }],
    ["un turnoId que no es UUID", { turnoId: "no-es-uuid" }],
    ["una zonaId que no es UUID", { zonaId: "123" }],
    ["comensales cero", { comensales: "0" }],
    ["comensales no entero", { comensales: "2.5" }],
    ["comensales no numérico", { comensales: "muchos" }],
    ["comensales que no son un entero seguro", { comensales: "9007199254740993" }],
    ["comensales que desbordan a Infinity", { comensales: "9".repeat(400) }],
    ["un parámetro repetido", { fecha: ["2026-09-19", "2026-09-20"] }],
  ])("devuelve undefined con %s", (_motivo, cambio) => {
    expect(leerSeleccionDeQuery({ ...VALIDA, ...cambio })).toBeUndefined();
  });

  it("acepta una fecha anterior a hoy: el servidor informa el motivo", () => {
    expect(leerSeleccionDeQuery({ ...VALIDA, fecha: "2020-01-01" })).toEqual(
      expect.objectContaining({ fecha: "2020-01-01" }),
    );
  });
});
