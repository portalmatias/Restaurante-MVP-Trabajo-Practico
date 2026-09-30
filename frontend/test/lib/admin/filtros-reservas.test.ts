import {
  aConsultaApi,
  aQueryString,
  leerFiltros,
  totalPaginas,
} from "../../../src/lib/admin/filtros-reservas";

describe("filtros del listado de Reservas", () => {
  it("lee los filtros y la página de la URL", () => {
    expect(
      leerFiltros({ fecha: "2026-10-02", estado: "PENDIENTE", zonaId: "z", pagina: "3", otro: "x" }),
    ).toEqual({ fecha: "2026-10-02", estado: "PENDIENTE", zonaId: "z", pagina: 3 });
  });

  it("una página inválida vuelve a la primera", () => {
    expect(leerFiltros({ pagina: "-1" }).pagina).toBe(1);
    expect(leerFiltros({ pagina: "abc" }).pagina).toBe(1);
    expect(leerFiltros({ pagina: ["2", "3"] }).pagina).toBe(1);
  });

  it("la query string omite los vacíos y la página 1", () => {
    expect(aQueryString({ pagina: 1 })).toBe("");
    expect(aQueryString({ estado: "PENDIENTE", fecha: "2026-10-02", pagina: 2 })).toBe(
      "?fecha=2026-10-02&estado=PENDIENTE&pagina=2",
    );
  });

  it("la consulta a la API traduce la página a limit/offset y conserva los filtros", () => {
    expect(aConsultaApi({ estado: "PENDIENTE", zonaId: "z", pagina: 3 })).toEqual({
      estado: "PENDIENTE",
      zonaId: "z",
      limit: 20,
      offset: 40,
    });
  });

  it("cuenta las páginas, con al menos una", () => {
    expect(totalPaginas(0)).toBe(1);
    expect(totalPaginas(20)).toBe(1);
    expect(totalPaginas(21)).toBe(2);
  });
});
