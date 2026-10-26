import {
  describirMesa,
  ordenarMesas,
  resumirPlano,
  separarMesas,
  textoEstado,
  type MesaPlano,
} from "../../src/lib/plano-mesas";

function mesa(etiqueta: string, cambios: Partial<MesaPlano> = {}): MesaPlano {
  return {
    etiqueta,
    capacidad: 4,
    forma: "CUADRADA",
    posX: 0,
    posY: 0,
    ancho: 1,
    alto: 1,
    estado: "LIBRE",
    ...cambios,
  };
}

describe("textoEstado", () => {
  it.each([
    ["LIBRE", "Libre"],
    ["OCUPADA", "Ocupada"],
    ["NO_ALCANZA", "No alcanza"],
  ] as const)("dice %s en palabras como %p", (estado, texto) => {
    expect(textoEstado(estado)).toBe(texto);
  });
});

describe("describirMesa", () => {
  it("dice la etiqueta, la capacidad y el estado en minúscula", () => {
    expect(describirMesa(mesa("S3", { estado: "OCUPADA" }))).toBe(
      "Mesa S3, para 4 comensales: ocupada",
    );
  });

  it("usa el singular para una mesa de 1 comensal", () => {
    expect(describirMesa(mesa("B1", { capacidad: 1 }))).toBe("Mesa B1, para 1 comensal: libre");
  });

  it("aclara cuando la mesa no está ubicada en el plano", () => {
    expect(describirMesa(mesa("S6", { posX: null, posY: null, estado: "NO_ALCANZA" }))).toBe(
      "Mesa S6, para 4 comensales: no alcanza (sin ubicar en el plano)",
    );
  });
});

describe("resumirPlano", () => {
  it("cuenta las mesas libres, ocupadas y que no alcanzan", () => {
    const mesas = [
      mesa("S1"),
      mesa("S2"),
      mesa("S3"),
      mesa("S4", { estado: "OCUPADA" }),
      mesa("S5", { estado: "NO_ALCANZA" }),
    ];

    expect(resumirPlano({ zona: "STANDARD", comensales: 4, mesas })).toBe(
      "En la zona STANDARD hay 3 mesas libres para 4 comensales, 1 ocupada y 1 que no alcanza.",
    );
  });

  it("usa el singular y el plural en cada cantidad", () => {
    const mesas = [
      mesa("V1"),
      mesa("V2", { estado: "OCUPADA" }),
      mesa("V3", { estado: "OCUPADA" }),
      mesa("V4", { estado: "NO_ALCANZA" }),
      mesa("V5", { estado: "NO_ALCANZA" }),
    ];

    expect(resumirPlano({ zona: "VIP", comensales: 1, mesas })).toBe(
      "En la zona VIP hay 1 mesa libre para 1 comensal, 2 ocupadas y 2 que no alcanzan.",
    );
  });

  it("cuenta también las mesas sin ubicar", () => {
    const mesas = [mesa("S1"), mesa("S6", { posX: null, posY: null })];

    expect(resumirPlano({ zona: "STANDARD", comensales: 2, mesas })).toBe(
      "En la zona STANDARD hay 2 mesas libres para 2 comensales, 0 ocupadas y 0 que no alcanzan.",
    );
  });
});

describe("ordenarMesas", () => {
  it("ordena por etiqueta con los números en orden natural", () => {
    const orden = ordenarMesas([mesa("S10"), mesa("S2"), mesa("V1"), mesa("S1")]);

    expect(orden.map((m) => m.etiqueta)).toEqual(["S1", "S2", "S10", "V1"]);
  });

  it("da el mismo orden para etiquetas que solo difieren en ceros a la izquierda", () => {
    const a = ordenarMesas([mesa("S01"), mesa("S1"), mesa("S2"), mesa("S001")]);
    const b = ordenarMesas([mesa("S2"), mesa("S1"), mesa("S001"), mesa("S01")]);

    expect(a.map((m) => m.etiqueta)).toEqual(b.map((m) => m.etiqueta));
  });

  it("no modifica la lista recibida", () => {
    const mesas = [mesa("S2"), mesa("S1")];

    ordenarMesas(mesas);

    expect(mesas.map((m) => m.etiqueta)).toEqual(["S2", "S1"]);
  });
});

describe("separarMesas", () => {
  it("separa las mesas ubicadas de las que no tienen posición", () => {
    const s1 = mesa("S1");
    const s6 = mesa("S6", { posX: null, posY: null });
    const s7 = mesa("S7", { posX: 3, posY: null });

    expect(separarMesas([s1, s6, s7])).toEqual({ ubicadas: [s1], sinUbicar: [s6, s7] });
  });

  it("deja la posición 0 como ubicada", () => {
    const esquina = mesa("S1", { posX: 0, posY: 0 });

    expect(separarMesas([esquina]).ubicadas).toEqual([esquina]);
  });
});
