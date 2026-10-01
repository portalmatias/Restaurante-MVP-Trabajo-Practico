import { ErrorConReintento } from "../../../src/components/reservas/error-con-reintento";
import { FormularioSeleccion } from "../../../src/components/reservas/formulario-seleccion";
import { apiClient, toApiResult } from "../../../src/lib/api/client";
import { MENSAJE_SERVICIO_NO_DISPONIBLE } from "../../../src/lib/api/errors";
import { fechaLocalDeHoy } from "../../../src/lib/fecha-hora";

type NuevaReservaPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Un parámetro repetido (`?fecha=a&fecha=b`) llega como lista: se trata como ausente.
function textoDe(valor: string | string[] | undefined): string | undefined {
  return typeof valor === "string" ? valor : undefined;
}

/**
 * Paso 1 del asistente (design.md D3 Pantalla 2): resuelve el catálogo de zonas y turnos
 * directo contra el backend y se lo pasa al formulario. Lee la selección previa de la URL
 * para prellenarlo; el formulario ignora lo que no sea coherente.
 */
export default async function NuevaReservaPage({ searchParams }: NuevaReservaPageProps) {
  const params = await searchParams;
  const [zonas, turnos] = await Promise.all([
    toApiResult(apiClient.GET("/zonas")),
    toApiResult(apiClient.GET("/turnos")),
  ]);

  if (zonas.error || turnos.error) {
    // Nunca se muestra el texto que haya podido mandar el servidor: solo el genérico.
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-10">
        <ErrorConReintento mensaje={MENSAJE_SERVICIO_NO_DISPONIBLE} />
      </div>
    );
  }

  const seleccionInicial = {
    fecha: textoDe(params.fecha),
    turnoId: textoDe(params.turnoId),
    zonaId: textoDe(params.zonaId),
    comensales: textoDe(params.comensales),
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-10">
      {/* `key`: al volver a esta ruta con otra selección en la URL, el formulario se reinicia. */}
      <FormularioSeleccion
        key={JSON.stringify(seleccionInicial)}
        zonas={zonas.data}
        turnos={turnos.data}
        hoy={fechaLocalDeHoy(new Date())}
        seleccionInicial={seleccionInicial}
      />
    </div>
  );
}
