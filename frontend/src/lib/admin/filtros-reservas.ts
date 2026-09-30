/**
 * Filtros y paginación del listado de Reservas de admin (tareas 7.1 y 7.2), reconstruibles
 * desde la query string. Son funciones puras: la página las usa para leer la URL, armar la
 * consulta a `GET /admin/reservas` y generar los enlaces de filtro y de página.
 */

export const TAMANIO_PAGINA = 20;

export type FiltrosReservas = {
  fecha?: string;
  estado?: string;
  zonaId?: string;
  turnoId?: string;
  pagina: number;
};

const CLAVES_FILTRO = ["fecha", "estado", "zonaId", "turnoId"] as const;

type ParametrosUrl = Record<string, string | string[] | undefined>;

/**
 * Lee los filtros de la query string. Los valores de filtro pasan tal cual (si alguien edita
 * la URL a mano y queda uno mal formado, el backend responde `400` y la pantalla lo informa,
 * tarea 7.3); solo `pagina` se normaliza, porque la calcula el propio frontend.
 */
export function leerFiltros(parametros: ParametrosUrl): FiltrosReservas {
  const filtros: FiltrosReservas = { pagina: 1 };
  for (const clave of CLAVES_FILTRO) {
    const valor = parametros[clave];
    if (typeof valor === "string" && valor !== "") filtros[clave] = valor;
  }
  const pagina = Number(parametros.pagina);
  if (Number.isSafeInteger(pagina) && pagina >= 1) filtros.pagina = pagina;
  return filtros;
}

/** Query string de un conjunto de filtros, sin los vacíos ni `pagina=1`. */
export function aQueryString(filtros: FiltrosReservas): string {
  const parametros = new URLSearchParams();
  for (const clave of CLAVES_FILTRO) {
    const valor = filtros[clave];
    if (valor) parametros.set(clave, valor);
  }
  if (filtros.pagina > 1) parametros.set("pagina", String(filtros.pagina));
  const texto = parametros.toString();
  return texto ? `?${texto}` : "";
}

/** Query de `GET /admin/reservas` para los filtros y la página actuales. */
export function aConsultaApi(filtros: FiltrosReservas) {
  const { pagina, ...resto } = filtros;
  const consulta: Record<string, string | number> = {
    limit: TAMANIO_PAGINA,
    offset: (pagina - 1) * TAMANIO_PAGINA,
  };
  for (const [clave, valor] of Object.entries(resto)) {
    if (valor) consulta[clave] = valor;
  }
  return consulta as {
    fecha?: string;
    estado?: "PENDIENTE" | "CONFIRMADA" | "CANCELADA" | "NO_SHOW";
    zonaId?: string;
    turnoId?: string;
    limit: number;
    offset: number;
  };
}

export function totalPaginas(total: number): number {
  return Math.max(1, Math.ceil(total / TAMANIO_PAGINA));
}
