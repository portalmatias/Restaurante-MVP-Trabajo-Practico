import { agruparPorCampo } from "../../src/lib/agrupar-por-campo";

const CAMPOS = {
  nombreCliente: "nombre",
  emailCliente: "email",
  telefonoCliente: "telefono",
};

describe("agruparPorCampo", () => {
  it("un mensaje que empieza con emailCliente cae en el campo email", () => {
    const resultado = agruparPorCampo(["emailCliente debe ser un email válido"], CAMPOS);

    expect(resultado).toEqual({
      porCampo: { email: ["emailCliente debe ser un email válido"] },
      generales: [],
    });
  });

  it("un mensaje de un campo no declarado (turnoId) cae en generales", () => {
    const resultado = agruparPorCampo(["turnoId debe ser un UUID"], CAMPOS);

    expect(resultado).toEqual({ porCampo: {}, generales: ["turnoId debe ser un UUID"] });
  });

  it("una lista vacía da porCampo vacío y generales vacío", () => {
    expect(agruparPorCampo([], CAMPOS)).toEqual({ porCampo: {}, generales: [] });
  });

  it("agrupa varios mensajes del mismo campo y separa los generales, conservando el orden", () => {
    const resultado = agruparPorCampo(
      [
        "nombreCliente no debe estar vacío",
        "comensales debe ser un número entero",
        "nombreCliente debe ser un texto",
        "telefonoCliente no debe estar vacío",
      ],
      CAMPOS,
    );

    expect(resultado).toEqual({
      porCampo: {
        nombre: ["nombreCliente no debe estar vacío", "nombreCliente debe ser un texto"],
        telefono: ["telefonoCliente no debe estar vacío"],
      },
      generales: ["comensales debe ser un número entero"],
    });
  });
});
