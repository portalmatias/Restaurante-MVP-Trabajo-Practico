"use client";

import { useEffect, useId, useSyncExternalStore } from "react";
import { borrarNotaDeReserva, leerNotaDeReserva } from "../../lib/nota-cliente";

export type NotaDeLaReservaProps = {
  /** Código de la reserva recién creada: la nota se guardó con esa clave al crearla. */
  codigoReserva: string;
};

// La nota no cambia mientras se muestra: no hay a qué suscribirse.
function suscribirseSinCambios(): () => void {
  return () => {};
}

// Borrados agendados por código. En desarrollo, React monta, limpia y vuelve a montar el
// componente: el borrado se agenda al limpiar y se cancela si se vuelve a montar enseguida, así
// la nota solo se borra cuando la persona sale de verdad de la confirmación.
const borradosPendientes = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Apartado «Tu nota» de la confirmación (D5 de `reserva-nota-cliente`). La nota no viaja en la
 * URL: el formulario la deja en `sessionStorage` y este componente la lee. En el servidor (y en
 * la hidratación) no hay `sessionStorage`, así que el HTML inicial no la incluye. Sin nota
 * guardada, o sin almacenamiento disponible, no muestra nada.
 *
 * Al salir de la confirmación navegando por la app la borra, porque puede traer datos de salud y
 * no hace falta que quede en el navegador. Recargar la página no pasa por esa limpieza, así que
 * la nota se sigue viendo. Una navegación completa o cerrar la pestaña tampoco pasan: ahí queda
 * hasta que se cierra la pestaña, cuando el navegador vacía `sessionStorage` (D5).
 */
export function NotaDeLaReserva({ codigoReserva }: NotaDeLaReservaProps) {
  const nota = useSyncExternalStore(
    suscribirseSinCambios,
    () => leerNotaDeReserva(codigoReserva),
    () => null,
  );
  const idTitulo = useId();

  useEffect(() => {
    clearTimeout(borradosPendientes.get(codigoReserva));
    borradosPendientes.delete(codigoReserva);
    return () => {
      borradosPendientes.set(
        codigoReserva,
        setTimeout(() => {
          borradosPendientes.delete(codigoReserva);
          borrarNotaDeReserva(codigoReserva);
        }, 0),
      );
    };
  }, [codigoReserva]);

  if (nota === null) return null;

  return (
    <section
      aria-labelledby={idTitulo}
      className="flex flex-col gap-2 rounded-sm border border-border bg-card p-4"
    >
      <h2 id={idTitulo} className="font-display text-xl font-medium">
        Tu nota
      </h2>
      <p className="whitespace-pre-line break-words text-base text-foreground">{nota}</p>
    </section>
  );
}
