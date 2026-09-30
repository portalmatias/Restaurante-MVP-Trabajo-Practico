import { redirect } from "next/navigation";
import { ErrorDeCarga } from "../../../../src/components/reservas/error-de-carga";
import { FormularioDatosContacto } from "../../../../src/components/reservas/formulario-datos-contacto";
import { PasosReserva } from "../../../../src/components/reservas/pasos-reserva";
import { ResumenSeleccion } from "../../../../src/components/reservas/resumen-seleccion";
import { apiClient, toApiResult } from "../../../../src/lib/api/client";
import { leerSeleccionDeQuery, urlConSeleccion } from "../../../../src/lib/seleccion-reserva";

type DatosPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const contenedor = "mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10";

/**
 * Paso 3 del asistente (design.md D3 Pantalla 4): valida la selección de la URL, resuelve el
 * catálogo para el resumen y renderiza el formulario que crea la reserva. No consulta la
 * disponibilidad: la decide el servidor al crear.
 */
export default async function DatosPage({ searchParams }: DatosPageProps) {
  const seleccion = leerSeleccionDeQuery(await searchParams);
  if (!seleccion) {
    redirect("/reservas/nueva");
  }

  // Sin caché: `router.refresh()` de "Reintentar" tiene que volver a llegar al backend.
  const [zonas, turnos] = await Promise.all([
    toApiResult(apiClient.GET("/zonas", { cache: "no-store" })),
    toApiResult(apiClient.GET("/turnos", { cache: "no-store" })),
  ]);

  if (zonas.error || turnos.error) {
    const error = zonas.error ?? turnos.error;
    return (
      <div className={contenedor}>
        <ErrorDeCarga error={error} />
      </div>
    );
  }

  const zona = zonas.data.find((candidata) => candidata.id === seleccion.zonaId);
  const turno = turnos.data.find((candidato) => candidato.id === seleccion.turnoId);
  if (!zona || !turno) {
    redirect(urlConSeleccion("/reservas/nueva", seleccion));
  }

  return (
    <div className={contenedor}>
      <PasosReserva pasoActual={3} total={3} />
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Tus datos</h1>
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
