import { agruparPorCampo, sinNombreDeCampo } from "../../src/lib/agrupar-por-campo";

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

  it("con claves que se prefijan entre sí, cada mensaje cae en su campo (no gana la primera clave)", () => {
    const resultado = agruparPorCampo(
      ["emailCliente debe ser un email válido", "email no debe estar vacío"],
      { email: "soloEmail", emailCliente: "email" },
    );

    expect(resultado).toEqual({
      porCampo: {
        email: ["emailCliente debe ser un email válido"],
        soloEmail: ["email no debe estar vacío"],
      },
      generales: [],
    });
  });

  it("un mensaje cuyo primer término solo comparte prefijo con un campo cae en generales", () => {
    const resultado = agruparPorCampo(["emailClienteExtra debe ser texto"], CAMPOS);

    expect(resultado).toEqual({ porCampo: {}, generales: ["emailClienteExtra debe ser texto"] });
  });
});

describe("sinNombreDeCampo", () => {
  it("quita el nombre del campo y deja la primera letra en mayúscula", () => {
    expect(sinNombreDeCampo("emailCliente debe ser un email válido")).toBe("Debe ser un email válido");
  });

  it("devuelve el mensaje sin cambios si no tiene espacios, para no mostrar el nombre del campo en mayúscula", () => {
    expect(sinNombreDeCampo("emailCliente")).toBe("emailCliente");
  });

  it("devuelve el mensaje sin cambios si después del nombre del campo no queda texto", () => {
    expect(sinNombreDeCampo("emailCliente   ")).toBe("emailCliente   ");
  });
});
