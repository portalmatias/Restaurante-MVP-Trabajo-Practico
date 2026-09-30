import {
  borrarSesion,
  decodificarExp,
  guardarSesion,
  leerSesion,
} from "../../../src/lib/auth/session";

// Payload `{"sub":"admin-0","rol":"ADMIN","exp":1790000000,"x":"??>>~~"}` en base64url: trae
// `-` y `_`, que `atob()` rechaza o decodifica mal si no se normalizan antes (tarea 2.1).
const PAYLOAD_CON_GUIONES =
  "eyJzdWIiOiJhZG1pbi0wIiwicm9sIjoiQURNSU4iLCJleHAiOjE3OTAwMDAwMDAsIngiOiI_Pz4-fn4ifQ";
const EXP = 1_790_000_000;
const TOKEN = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${PAYLOAD_CON_GUIONES}.firma`;

const ANTES_DEL_VENCIMIENTO = new Date((EXP - 60) * 1000);
const DESPUES_DEL_VENCIMIENTO = new Date((EXP + 1) * 1000);

function tokenConPayload(payload: unknown): string {
  const base64url = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `cabecera.${base64url}.firma`;
}

beforeEach(() => {
  sessionStorage.clear();
});

describe("decodificarExp", () => {
  it("decodifica el exp de un payload base64url con - y _", () => {
    expect(PAYLOAD_CON_GUIONES).toMatch(/[-_]/);
    expect(decodificarExp(TOKEN)).toBe(EXP);
  });

  it("devuelve undefined si el token no tiene tres partes", () => {
    expect(decodificarExp("no-es-un-jwt")).toBeUndefined();
  });

  it("devuelve undefined si el payload no es JSON", () => {
    expect(decodificarExp("a.bm8tZXMtanNvbg.c")).toBeUndefined();
  });

  it("devuelve undefined si exp no es numérico", () => {
    expect(decodificarExp(tokenConPayload({ exp: "mañana" }))).toBeUndefined();
    expect(decodificarExp(tokenConPayload({ sub: "x" }))).toBeUndefined();
  });
});

describe("guardarSesion / leerSesion / borrarSesion", () => {
  it("guardar y leer devuelve el mismo token", () => {
    expect(guardarSesion(TOKEN)).toBe(true);

    expect(leerSesion(ANTES_DEL_VENCIMIENTO)).toEqual({ accessToken: TOKEN, exp: EXP });
  });

  it("la sesión vive en sessionStorage, no en localStorage", () => {
    guardarSesion(TOKEN);

    expect(sessionStorage.length).toBe(1);
    expect(localStorage.length).toBe(0);
  });

  it("no guarda un token sin exp legible", () => {
    expect(guardarSesion("token-invalido")).toBe(false);

    expect(sessionStorage.length).toBe(0);
  });

  it("una sesión vencida no se devuelve y se borra", () => {
    guardarSesion(TOKEN);

    expect(leerSesion(DESPUES_DEL_VENCIMIENTO)).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it("leer sin sesión guardada devuelve null", () => {
    expect(leerSesion()).toBeNull();
  });

  it("una sesión guardada con forma inválida se descarta", () => {
    sessionStorage.setItem("admin-session", "{no es json");
    expect(leerSesion()).toBeNull();

    sessionStorage.setItem("admin-session", JSON.stringify({ accessToken: 1, exp: EXP }));
    expect(leerSesion(ANTES_DEL_VENCIMIENTO)).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it("borrarSesion deja sin sesión", () => {
    guardarSesion(TOKEN);

    borrarSesion();

    expect(leerSesion(ANTES_DEL_VENCIMIENTO)).toBeNull();
  });
});
