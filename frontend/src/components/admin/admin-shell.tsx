"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { buttonVariants } from "../ui/button";
import { BotonCompacto } from "./boton-compacto";
import { registrarManejadorSesionVencida } from "../../lib/api/admin-client";
import { borrarSesion, haySesionVigente, suscribirseASesion } from "../../lib/auth/session";

const RUTA_LOGIN = "/admin/login";

const ENLACES = [
  { href: "/admin", etiqueta: "Aforo" },
  { href: "/admin/salon", etiqueta: "Salón" },
  { href: "/admin/reservas", etiqueta: "Reservas" },
] as const;

// Suscripción vacía: solo sirve para distinguir el render del servidor del primero del cliente.
function suscribirseSinCambios(): () => void {
  return () => {};
}

const claseEnlace = buttonVariants({
  variant: "ghost",
  fullWidth: false,
  className: "min-w-11 underline-offset-4 hover:underline",
});

/**
 * Guard de sesión y navegación de las pantallas protegidas de `/admin/...` (design.md D4).
 * Sin una sesión vigente redirige al login sin renderizar nunca a sus hijos. Mientras está
 * montado, registra la redirección que dispara `toAdminApiResult` ante un `401`/`403`, así
 * ninguna pantalla hija tiene que manejar la sesión vencida por su cuenta.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // En el servidor (y en la hidratación) no hay `sessionStorage`: el snapshot es `false`, así
  // que el HTML inicial nunca incluye contenido protegido.
  const autenticado = useSyncExternalStore(suscribirseASesion, haySesionVigente, () => false);
  const hidratado = useSyncExternalStore(suscribirseSinCambios, () => true, () => false);

  // Un 401/403 dispara dos avisos a la vez (el manejador de `toAdminApiResult` y el cambio de
  // sesión): se navega al login una sola vez.
  const yendoAlLogin = useRef(false);

  // Mientras está montado, un 401/403 de cualquier llamada de admin vuelve al login (D4).
  useEffect(
    () =>
      registrarManejadorSesionVencida(() => {
        if (yendoAlLogin.current) return;
        yendoAlLogin.current = true;
        router.replace(RUTA_LOGIN);
      }),
    [router],
  );

  // Sin sesión (nunca la hubo, venció, se cerró o la borró un 401) se va al login.
  useEffect(() => {
    if (autenticado) {
      yendoAlLogin.current = false;
    } else if (hidratado && !yendoAlLogin.current) {
      yendoAlLogin.current = true;
      router.replace(RUTA_LOGIN);
    }
  }, [hidratado, autenticado, router]);

  function cerrarSesion() {
    // Borrar la sesión dispara la redirección del efecto de arriba.
    borrarSesion();
  }

  if (!autenticado) {
    return (
      <p role="status" className="px-4 py-10 text-center text-sm text-muted-foreground">
        Verificando la sesión…
      </p>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border bg-muted/40">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <nav aria-label="Navegación de administración" className="-ml-3 flex flex-wrap gap-1">
            {ENLACES.map(({ href, etiqueta }) => (
              <Link
                key={href}
                href={href}
                className={claseEnlace}
                aria-current={pathname === href ? "page" : undefined}
              >
                {etiqueta}
              </Link>
            ))}
          </nav>
          <BotonCompacto variant="secondary" onClick={cerrarSesion}>
            Cerrar sesión
          </BotonCompacto>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">{children}</div>
    </div>
  );
}
