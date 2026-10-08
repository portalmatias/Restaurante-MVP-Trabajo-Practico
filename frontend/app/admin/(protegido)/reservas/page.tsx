import type { Metadata } from "next";
import { ListadoReservas } from "../../../../src/components/admin/listado-reservas";
import { leerFiltros } from "../../../../src/lib/admin/filtros-reservas";

export const metadata: Metadata = { title: "Reservas" };

type ReservasAdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Listado de Reservas de admin. Los filtros y la página se leen de la query string (tarea
 * 7.1): el listado se puede reconstruir desde la URL. Ningún dato de contacto viaja en la URL.
 */
export default async function ReservasAdminPage({ searchParams }: ReservasAdminPageProps) {
  const filtros = leerFiltros(await searchParams);
  return <ListadoReservas filtros={filtros} />;
}
