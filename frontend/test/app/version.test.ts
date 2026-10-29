/**
 * @jest-environment node
 */
import * as ruta from "../../app/version/route";

// Spec `despliegue`, requisito «El sitio publicado informa qué versión sirve» (change
// verificacion-version-desplegada, D1): el CD compara este SHA con el que despliega.
const SHA = "0123456789abcdef0123456789abcdef01234567";

describe("GET /version", () => {
  const original = process.env.BUILD_SHA;

  afterEach(() => {
    if (original === undefined) delete process.env.BUILD_SHA;
    else process.env.BUILD_SHA = original;
  });

  it("responde con el SHA de la imagen y no lo cachea", async () => {
    process.env.BUILD_SHA = SHA;

    const respuesta = await ruta.GET();

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("Cache-Control")).toBe("no-store");
    expect(respuesta.headers.get("Content-Type")).toMatch(/^application\/json/);
    expect(await respuesta.json()).toEqual({ sha: SHA });
  });

  it("no devuelve ningún otro dato que el SHA", async () => {
    process.env.BUILD_SHA = SHA;

    const cuerpo = await (await ruta.GET()).json();

    expect(Object.keys(cuerpo)).toEqual(["sha"]);
  });

  it.each([
    ["no existe", undefined],
    ["está vacío", ""],
    ["es corto", "abc123"],
    ["tiene 41 caracteres", `${SHA}0`],
    ["tiene mayúsculas", SHA.toUpperCase()],
    ["tiene otros caracteres", `${SHA.slice(0, 39)}g`],
    ["lleva espacios alrededor", ` ${SHA} `],
    ["es un valor cualquiera", "<script>alert(1)</script>"],
  ])("responde «desconocido» si BUILD_SHA %s, sin repetir el valor", async (_caso, valor) => {
    if (valor === undefined) delete process.env.BUILD_SHA;
    else process.env.BUILD_SHA = valor;

    const respuesta = await ruta.GET();
    const texto = await respuesta.text();

    expect(respuesta.status).toBe(200);
    expect(JSON.parse(texto)).toEqual({ sha: "desconocido" });
    if (valor) expect(texto).not.toContain(valor);
  });

  it("lee la variable en cada pedido y no una sola vez al cargar el módulo", async () => {
    process.env.BUILD_SHA = SHA;
    expect((await (await ruta.GET()).json()).sha).toBe(SHA);

    process.env.BUILD_SHA = "f".repeat(40);
    expect((await (await ruta.GET()).json()).sha).toBe("f".repeat(40));
  });

  it("es dinámica: Next no la prerrenderiza en el build", () => {
    expect(ruta.dynamic).toBe("force-dynamic");
  });

  it("solo define GET (Next responde 405 a los demás métodos)", () => {
    const metodos = ["POST", "PUT", "PATCH", "DELETE"];
    for (const metodo of metodos) {
      expect(Object.keys(ruta)).not.toContain(metodo);
    }
  });
});
