import { leerAforo } from "../../../src/components/admin/nivel-aforo";

describe("leerAforo", () => {
  it.each([
    [6, 40, "holgado", 15, 34],
    [32, 40, "casi-lleno", 80, 8],
    [40, 40, "completo", 100, 0],
    [110, 40, "sobrecupo", 275, 0],
  ])("%i de %i es %s", (ocupado, maximo, nivel, porcentaje, libres) => {
    expect(leerAforo(ocupado, maximo)).toMatchObject({ nivel, porcentaje, libres });
  });

  it("limita el ancho de la barra a 100 y trata un máximo 0 como sin aforo", () => {
    expect(leerAforo(110, 40).ancho).toBe(100);
    expect(leerAforo(0, 0)).toMatchObject({ nivel: "sin-aforo", porcentaje: 0, libres: 0, ancho: 0 });
  });
});
