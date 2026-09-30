import Link from "next/link";
import { redirect } from "next/navigation";
import { ErrorConReintento } from "../../../../src/components/reservas/error-con-reintento";
import { PasosReserva } from "../../../../src/components/reservas/pasos-reserva";
import { ResumenSeleccion } from "../../../../src/components/reservas/resumen-seleccion";
import { Alert } from "../../../../src/components/ui/alert";
import { buttonVariants } from "../../../../src/components/ui/button";
import { apiClient, toApiResult } from "../../../../src/lib/api/client";
import { MENSAJE_SERVICIO_NO_DISPONIBLE } from "../../../../src/lib/api/errors";
import { leerSeleccionDeQuery, urlConSeleccion } from "../../../../src/lib/seleccion-reserva";

type ResultadoPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const MENSAJE_SELECCION_INVALIDA =
  "Alguno de los datos de la selección no es válido. Cambiá la fecha, el turno, la zona o los comensales e intentá de nuevo.";

const contenedor = "mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10";

/**
 * Resultado de disponibilidad (design.md D3 Pantalla 3). Consulta el servidor en cada visita
 * (sin caché: es "una foto del momento", config.yaml §6) y resuelve en paralelo el catálogo
 * para traducir `turnoId`/`zonaId` a horario y nombre, y para saber si la zona queda pendiente.
 */
export default async function ResultadoPage({ searchParams }: ResultadoPageProps) {
  const seleccion = leerSeleccionDeQuery(await searchParams);
  if (!seleccion) {
    redirect("/reservas/nueva");
  }

  const [disponibilidad, zonas, turnos] = await Promise.all([
    toApiResult(
      apiClient.GET("/disponibilidad", { params: { query: seleccion }, cache: "no-store" }),
    ),
    toApiResult(apiClient.GET("/zonas", { cache: "no-store" })),
    toApiResult(apiClient.GET("/turnos", { cache: "no-store" })),
  ]);

  const paso1ConSeleccion = urlConSeleccion("/reservas/nueva", seleccion);

  // Turno o zona que ya no existen (por ejemplo, un enlace viejo): reintentar no lo arregla y el
  // Paso 1 ignora lo inválido.
  if (disponibilidad.error?.tipo === "no-encontrado") {
    redirect(paso1ConSeleccion);
  }

  // Selección que el servidor rechaza aunque el Paso 1 la dé por válida: no se redirige (el
  // usuario volvería sin explicación, en bucle). Se explica con texto propio y se ofrece cambiarla.
  if (disponibilidad.error?.tipo === "validacion") {
    return (
      <div className={contenedor}>
        <Alert variant="error" className="text-base">
          {MENSAJE_SELECCION_INVALIDA}
        </Alert>
        <Link
          href={paso1ConSeleccion}
          className={buttonVariants({ variant: "secondary", size: "lg" })}
        >
          Cambiar fecha, turno o zona
        </Link>
      </div>
    );
  }

  if (disponibilidad.error || zonas.error || turnos.error) {
    const error = disponibilidad.error ?? zonas.error ?? turnos.error;
    // Límite de solicitudes: reintentar enseguida lo agrava, así que solo se informa (como en
    // ConsultaReserva).
    if (error?.tipo === "limite-de-intentos") {
      return (
        <div className={contenedor}>
          <Alert variant="error" className="text-base">
            {error.mensaje}
          </Alert>
        </div>
      );
    }
    // Solo el mensaje propio del cliente (red o servicio): nunca el texto de un 4xx del servidor.
    const mensaje = error?.tipo === "desconocido" ? error.mensaje : MENSAJE_SERVICIO_NO_DISPONIBLE;
    return (
      <div className={contenedor}>
        <ErrorConReintento mensaje={mensaje} />
      </div>
    );
  }

  const zona = zonas.data.find((candidata) => candidata.id === seleccion.zonaId);
  const turno = turnos.data.find((candidato) => candidato.id === seleccion.turnoId);
  if (!zona || !turno) {
    redirect(paso1ConSeleccion);
  }

  if (!disponibilidad.data.disponible) {
    return (
      <div className={contenedor}>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
          No hay lugar para esa combinación
        </h1>
        <ul className="flex flex-col gap-3">
          {disponibilidad.data.motivos.map((motivo, indice) => (
            // El índice desambigua dos motivos con el mismo código; la lista no se reordena.
            <li key={`${motivo.codigo}-${indice}`}>
              {/* El backend ya manda el texto en español para personas. */}
              <Alert variant="error" className="text-base">
                {motivo.mensaje}
              </Alert>
            </li>
          ))}
        </ul>
        <Link
          href={paso1ConSeleccion}
          className={buttonVariants({ variant: "secondary", size: "lg" })}
        >
          Cambiar fecha, turno o zona
        </Link>
      </div>
    );
  }

  return (
    <div className={contenedor}>
      <PasosReserva pasoActual={2} total={3} />
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">¡Hay lugar!</h1>
      <ResumenSeleccion
        fecha={seleccion.fecha}
        horaInicio={turno.horaInicio}
        horaFin={turno.horaFin}
        zona={zona.nombre}
        comensales={seleccion.comensales}
        lugaresRestantes={disponibilidad.data.lugaresRestantes}
      />
      {zona.requiereConfirmacionAdmin ? (
        <Alert variant="info" className="text-base">
          Esta zona queda pendiente de confirmación: el restaurante tiene que confirmar tu reserva.
        </Alert>
      ) : null}
      <Link
        href={urlConSeleccion("/reservas/nueva/datos", seleccion)}
        className={buttonVariants({ variant: "primary", size: "lg" })}
      >
        Continuar
      </Link>
    </div>
  );
}
