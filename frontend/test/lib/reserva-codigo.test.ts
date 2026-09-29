import { esCodigoReservaValido } from "../../src/lib/reserva-codigo";

describe("esCodigoReservaValido", () => {
  it.each(["K7PM3QXA", "k7pm3qxa", "12345678"])("acepta %p", (codigo) => {
    expect(esCodigoReservaValido(codigo)).toBe(true);
  });

  it.each(["", "K7PM3QX", "K7PM3QXAB", "K7PM-3QX", "K7PM 3QX", "<script>"])(
    "rechaza %p",
    (codigo) => {
      expect(esCodigoReservaValido(codigo)).toBe(false);
    },
  );
});
