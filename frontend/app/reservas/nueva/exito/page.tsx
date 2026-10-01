import Link from "next/link";
import { redirect } from "next/navigation";
import { BotonCopiarCodigo } from "../../../../src/components/reservas/boton-copiar-codigo";
import { ErrorDeCarga } from "../../../../src/components/reservas/error-de-carga";
import { ResumenSeleccion } from "../../../../src/components/reservas/resumen-seleccion";
import { Alert } from "../../../../src/components/ui/alert";
import { buttonVariants } from "../../../../src/components/ui/button";
import { cargarCatalogo } from "../../../../src/lib/cargar-catalogo";
import { leerConfirmacionDeQuery } from "../../../../src/lib/seleccion-reserva";

type ExitoPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Reserva registrada (design.md D3 Pantalla 5). El código y el estado llegan por la URL; el
 * catálogo solo traduce `turnoId`/`zonaId` para el resumen. Como la reserva ya existe, un
 * catálogo que no responde nunca oculta el código: solo el resumen se reemplaza por el error.
 * No promete ningún email: el MVP no tiene proveedor de email.
 */
export default async function ExitoPage({ searchParams }: ExitoPageProps) {
  const confirmacion = leerConfirmacionDeQuery(await searchParams);
  if (!confirmacion) {
    redirect("/reservas/nueva");
  }

  const catalogo = await cargarCatalogo();

  const zona = catalogo.zonas?.find((candidata) => candidata.id === confirmacion.zonaId);
  const turno = catalogo.turnos?.find((candidato) => candidato.id === confirmacion.turnoId);
  const pendiente = confirmacion.estado === "PENDIENTE";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
        {`¡Listo! Tu reserva está ${pendiente ? "pendiente de confirmación" : "confirmada"}`}
      </h1>
      <div className="flex flex-col items-center gap-2 rounded-lg border border-accent bg-muted p-6">
        <p className="text-sm text-muted-foreground">Tu código de reserva</p>
        <p className="text-3xl font-bold tracking-widest text-accent">{confirmacion.codigo}</p>
        <BotonCopiarCodigo codigo={confirmacion.codigo} />
      </div>
      {pendiente ? (
        <Alert variant="info" className="text-base">
          Esta reserva queda pendiente: el restaurante todavía tiene que confirmarla.
        </Alert>
      ) : null}
      <p className="text-base text-foreground">
        Guardá este código: junto con tu email, es la única forma de consultar o cancelar tu
        reserva.
      </p>
      {catalogo.error ? (
        <ErrorDeCarga error={catalogo.error} />
      ) : zona && turno ? (
        <ResumenSeleccion
          fecha={confirmacion.fecha}
          horaInicio={turno.horaInicio}
          horaFin={turno.horaFin}
          zona={zona.nombre}
          comensales={confirmacion.comensales}
        />
      ) : null}
      <Link href="/reservas" className={buttonVariants({ variant: "secondary" })}>
        Volver al inicio
      </Link>
    </div>
  );
}
