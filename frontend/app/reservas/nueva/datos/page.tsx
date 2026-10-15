import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ErrorDeCarga } from "../../../../src/components/reservas/error-de-carga";
import { FormularioDatosContacto } from "../../../../src/components/reservas/formulario-datos-contacto";
import { PasosReserva } from "../../../../src/components/reservas/pasos-reserva";
import { ResumenSeleccion } from "../../../../src/components/reservas/resumen-seleccion";
import { cargarCatalogo } from "../../../../src/lib/cargar-catalogo";
import { diaSemanaDeFechaLocal } from "../../../../src/lib/fecha-hora";
import { leerSeleccionDeQuery, urlConSeleccion } from "../../../../src/lib/seleccion-reserva";

export const metadata: Metadata = { title: "Tus datos" };

type DatosPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const contenedor = "mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10";

/**
 * Paso 3 del asistente (design.md D3 Pantalla 4): valida la selección de la URL (incluido que el turno sea del día de la fecha), resuelve el
 * catálogo para el resumen y renderiza el formulario que crea la reserva. No consulta la
 * disponibilidad: la decide el servidor al crear.
 */
export default async function DatosPage({ searchParams }: DatosPageProps) {
  const seleccion = leerSeleccionDeQuery(await searchParams);
  if (!seleccion) {
    redirect("/reservas/nueva");
  }

  const catalogo = await cargarCatalogo();
  if (catalogo.error) {
    return (
      <div className={contenedor}>
        <ErrorDeCarga error={catalogo.error} />
      </div>
    );
  }

  const zona = catalogo.zonas.find((candidata) => candidata.id === seleccion.zonaId);
  const turno = catalogo.turnos.find((candidato) => candidato.id === seleccion.turnoId);
  // `leerSeleccionDeQuery` ya garantizó una fecha de calendario: el día de la semana no falla.
  if (!zona || !turno || turno.diaSemana !== diaSemanaDeFechaLocal(seleccion.fecha)) {
    redirect(urlConSeleccion("/reservas/nueva", seleccion));
  }

  return (
    <div className={contenedor}>
      <PasosReserva pasoActual={3} total={3} />
      <h1 className="font-display text-3xl font-medium leading-tight sm:text-4xl">Tus datos</h1>
      <ResumenSeleccion
        fecha={seleccion.fecha}
        horaInicio={turno.horaInicio}
        horaFin={turno.horaFin}
        zona={zona.nombre}
        comensales={seleccion.comensales}
      />
      <FormularioDatosContacto seleccion={seleccion} />
    </div>
  );
}
