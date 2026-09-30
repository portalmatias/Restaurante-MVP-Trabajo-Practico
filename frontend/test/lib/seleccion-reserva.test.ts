import {
  leerConfirmacionDeQuery,
  leerSeleccionDeQuery,
  urlConSeleccion,
  urlDeExito,
} from "../../src/lib/seleccion-reserva";

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

describe("urlDeExito", () => {
  it("arma la query con el código, el estado y los cuatro datos de la selección", () => {
    expect(
      urlDeExito({ codigo: "K7PM3QXA", estado: "PENDIENTE", ...VALIDA, comensales: 4 }),
    ).toBe(
      `/reservas/nueva/exito?codigo=K7PM3QXA&estado=PENDIENTE&fecha=2026-09-19&turnoId=${VALIDA.turnoId}&zonaId=${VALIDA.zonaId}&comensales=4`,
    );
  });
});

describe("leerConfirmacionDeQuery", () => {
  const COMPLETA = { codigo: "K7PM3QXA", estado: "CONFIRMADA", ...VALIDA };

  it("lee una confirmación completa y convierte los comensales a número", () => {
    expect(leerConfirmacionDeQuery(COMPLETA)).toEqual({ ...COMPLETA, comensales: 4 });
  });

  it("acepta el estado PENDIENTE", () => {
    expect(leerConfirmacionDeQuery({ ...COMPLETA, estado: "PENDIENTE" })?.estado).toBe("PENDIENTE");
  });

  it.each(["codigo", "estado", "fecha", "turnoId", "zonaId", "comensales"])(
    "sin %s devuelve undefined",
    (campo) => {
      expect(leerConfirmacionDeQuery({ ...COMPLETA, [campo]: undefined })).toBeUndefined();
    },
  );

  it.each(["CANCELADA", "confirmada", ""])("con el estado %j devuelve undefined", (estado) => {
    expect(leerConfirmacionDeQuery({ ...COMPLETA, estado })).toBeUndefined();
  });

  it.each(["ABC", "K7PM3QX!", "K7PM3QXAB"])("con el código %j devuelve undefined", (codigo) => {
    expect(leerConfirmacionDeQuery({ ...COMPLETA, codigo })).toBeUndefined();
  });

  it("con un parámetro repetido devuelve undefined", () => {
    expect(leerConfirmacionDeQuery({ ...COMPLETA, codigo: ["K7PM3QXA", "K7PM3QXB"] })).toBeUndefined();
  });
});
