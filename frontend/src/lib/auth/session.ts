/**
 * Sesión del administrador en `sessionStorage` (design.md D1): dura lo que dura la pestaña,
 * sobrevive a una recarga y se descarta al cerrarla. No hay "recordarme".
 *
 * `exp` se lee del payload del JWT sin verificar la firma: la verificación real la hace el
 * backend en cada request. Acá solo sirve para no mostrar como activa una sesión ya vencida.
 */

const CLAVE_SESION = "admin-session";
// Evento propio para avisar, dentro de la misma pestaña, que la sesión cambió: el evento
// `storage` del navegador solo llega a las otras pestañas.
const EVENTO_CAMBIO = "admin-session-cambio";

function avisarCambio(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENTO_CAMBIO));
  }
}

/**
 * Suscribe `alCambiar` a los cambios de la sesión (guardar o borrar en esta pestaña). Pensado
 * para `useSyncExternalStore`. Devuelve la función que cancela la suscripción.
 */
export function suscribirseASesion(alCambiar: () => void): () => void {
  window.addEventListener(EVENTO_CAMBIO, alCambiar);
  return () => window.removeEventListener(EVENTO_CAMBIO, alCambiar);
}

export type Sesion = {
  accessToken: string;
  /** Vencimiento del token, en segundos desde epoch (claim `exp` del JWT). */
  exp: number;
};

/**
 * Decodifica el claim `exp` de un JWT. El payload viene en base64**url** (`-`/`_`, sin `=`):
 * `atob()` solo acepta base64 estándar, así que primero se normaliza. Devuelve `undefined` si
 * el token no tiene la forma esperada o no trae un `exp` numérico.
 */
export function decodificarExp(token: string): number | undefined {
  const partes = token.split(".");
  if (partes.length !== 3 || partes[1] === "") {
    return undefined;
  }
  const base64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
  const conRelleno = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  try {
    const payload: unknown = JSON.parse(atob(conRelleno));
    if (typeof payload === "object" && payload !== null && "exp" in payload) {
      const { exp } = payload;
      return typeof exp === "number" && Number.isFinite(exp) ? exp : undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function almacenamiento(): Storage | undefined {
  // En el servidor no hay `sessionStorage`; en algunos navegadores el acceso puede lanzar
  // (almacenamiento bloqueado). En los dos casos se comporta como "sin sesión".
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

/**
 * Guarda la sesión a partir del token que devolvió `POST /auth/login`. Devuelve `false` (sin
 * guardar nada) si el token no trae un `exp` legible: una sesión sin vencimiento conocido no
 * se acepta.
 */
export function guardarSesion(accessToken: string): boolean {
  const exp = decodificarExp(accessToken);
  const storage = almacenamiento();
  if (exp === undefined || !storage) {
    return false;
  }
  const sesion: Sesion = { accessToken, exp };
  try {
    storage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    avisarCambio();
    return true;
  } catch {
    return false;
  }
}

type Lectura = { sesion: Sesion | null; hayQueBorrar: boolean };

function leerAlmacenada(ahora: Date): Lectura {
  const storage = almacenamiento();
  let crudo: string | null = null;
  try {
    crudo = storage?.getItem(CLAVE_SESION) ?? null;
  } catch {
    return { sesion: null, hayQueBorrar: false };
  }
  if (crudo === null) {
    return { sesion: null, hayQueBorrar: false };
  }

  let sesion: unknown;
  try {
    sesion = JSON.parse(crudo);
  } catch {
    sesion = undefined;
  }
  if (
    typeof sesion !== "object" ||
    sesion === null ||
    !("accessToken" in sesion) ||
    !("exp" in sesion) ||
    typeof sesion.accessToken !== "string" ||
    typeof sesion.exp !== "number" ||
    // `JSON.parse` convierte `1e309` en `Infinity`: una sesión sin vencimiento finito no vale.
    !Number.isFinite(sesion.exp) ||
    sesion.exp * 1000 <= ahora.getTime()
  ) {
    return { sesion: null, hayQueBorrar: true };
  }
  return { sesion: { accessToken: sesion.accessToken, exp: sesion.exp }, hayQueBorrar: false };
}

/**
 * Devuelve la sesión guardada si sigue vigente. Si venció o está mal formada, la borra y
 * devuelve `null`.
 */
export function leerSesion(ahora: Date = new Date()): Sesion | null {
  const { sesion, hayQueBorrar } = leerAlmacenada(ahora);
  if (hayQueBorrar) {
    borrarSesion();
  }
  return sesion;
}

/**
 * Si hay una sesión vigente, sin efectos secundarios (no borra una vencida ni avisa a nadie):
 * apta para llamarse durante el render, por ejemplo como snapshot de `useSyncExternalStore`.
 */
export function haySesionVigente(ahora: Date = new Date()): boolean {
  return leerAlmacenada(ahora).sesion !== null;
}

export function borrarSesion(): void {
  const storage = almacenamiento();
  try {
    if (storage?.getItem(CLAVE_SESION) === null) return;
    storage?.removeItem(CLAVE_SESION);
  } catch {
    // Sin almacenamiento accesible no hay sesión que borrar.
    return;
  }
  avisarCambio();
}
