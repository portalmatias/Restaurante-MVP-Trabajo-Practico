import type { Metadata } from "next";
import { ConsultaReserva } from "../../../src/components/reservas/consulta-reserva";
import { esCodigoReservaValido } from "../../../src/lib/reserva-codigo";

export const metadata: Metadata = { title: "Consultá tu reserva" };

type ConsultarPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Consultar una reserva (design.md D3 Pantallas 6 a 9). Solo lee `?codigo=` para prellenar el
 * formulario; el email nunca se lee de la URL ni se refleja en ella (D1.2).
 */
export default async function ConsultarPage({ searchParams }: ConsultarPageProps) {
  const { codigo } = await searchParams;
  const codigoInicial = typeof codigo === "string" && esCodigoReservaValido(codigo) ? codigo : "";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-10">
      {/* `key`: al navegar de ?codigo=A a ?codigo=B el formulario se reinicia con el código nuevo. */}
      <ConsultaReserva key={codigoInicial} codigoInicial={codigoInicial} />
    </div>
  );
}
