import { ConsultaReserva } from "../../../src/components/reservas/consulta-reserva";
import { esCodigoReservaValido } from "../../../src/lib/reserva-codigo";


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
      <ConsultaReserva codigoInicial={codigoInicial} />
    </div>
  );
}
