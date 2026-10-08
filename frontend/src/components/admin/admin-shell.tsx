"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Alert } from "../ui/alert";
import { BotonCompacto } from "./boton-compacto";
import { registrarManejadorSesionVencida } from "../../lib/api/admin-client";
import {
  borrarSesion,
  haySesionVigente,
  leerSesion,
  suscribirseASesion,
} from "../../lib/auth/session";

const RUTA_LOGIN = "/admin/login";
/** Motivos que el login explica (ver `LoginForm`). */
export const RUTA_LOGIN_SESION_VENCIDA = `${RUTA_LOGIN}?motivo=sesion-vencida`;
export const RUTA_LOGIN_RENOVAR = `${RUTA_LOGIN}?motivo=renovar`;

/** Minutos que faltan para el vencimiento a partir de los cuales se avisa. */
export const MINUTOS_AVISO_VENCIMIENTO = 5;
const INTERVALO_CONTROL_MS = 15_000;

const ENLACES = [
  { href: "/admin", etiqueta: "Aforo" },
  { href: "/admin/salon", etiqueta: "Salón" },
  { href: "/admin/reservas", etiqueta: "Reservas" },
] as const;

// Suscripción vacía: solo sirve para distinguir el render del servidor del primero del cliente.
function suscribirseSinCambios(): () => void {
  return () => {};
}

// Enlace de pestaña: la página actual se ve por el trazo grueso de abajo y el peso del texto,
// no solo por `aria-current`.
const claseEnlace =
  "inline-flex min-h-11 items-center border-b-2 px-3 text-sm tracking-wide transition-colors duration-200 motion-reduce:transition-none hover:bg-muted";
const claseEnlaceActivo = "border-foreground font-bold text-foreground";
const claseEnlaceInactivo = "border-transparent font-medium text-muted-foreground hover:text-foreground";

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
  // Para decidir el mensaje del login: una sesión que estuvo y desapareció sin que la persona
  // pulsara «Cerrar sesión» venció (o la rechazó el backend).
  const tuvoSesion = useRef(false);
  const cerroAMano = useRef(false);
  const [minutosRestantes, setMinutosRestantes] = useState<number>();

  function rutaDeSalida(): string {
    return tuvoSesion.current && !cerroAMano.current ? RUTA_LOGIN_SESION_VENCIDA : RUTA_LOGIN;
  }

  // Mientras está montado, un 401/403 de cualquier llamada de admin vuelve al login (D4).
  useEffect(
    () =>
      registrarManejadorSesionVencida(() => {
        if (yendoAlLogin.current) return;
        yendoAlLogin.current = true;
        router.replace(rutaDeSalida());
      }),
    // `rutaDeSalida` solo lee refs.
    [router],
  );

  // Sin sesión (nunca la hubo, venció, se cerró o la borró un 401) se va al login.
  useEffect(() => {
    if (autenticado) {
      yendoAlLogin.current = false;
      tuvoSesion.current = true;
    } else if (hidratado && !yendoAlLogin.current) {
      yendoAlLogin.current = true;
      router.replace(rutaDeSalida());
    }
  }, [hidratado, autenticado, router]);

  // Aviso previo al vencimiento (la sesión dura 60 minutos y no se renueva sola). Una pestaña
  // quieta no hace pedidos, así que también se controla por tiempo: `leerSesion` borra la sesión
  // vencida y eso dispara la salida al login con su mensaje.
  useEffect(() => {
    if (!autenticado) return;
    function controlar() {
      const sesion = leerSesion();
      if (!sesion) {
        setMinutosRestantes(undefined);
        return;
      }
      const restanteMs = sesion.exp * 1000 - Date.now();
      setMinutosRestantes(
        restanteMs <= MINUTOS_AVISO_VENCIMIENTO * 60_000 ? Math.max(1, Math.ceil(restanteMs / 60_000)) : undefined,
      );
    }
    const inicial = setTimeout(controlar, 0);
    const intervalo = setInterval(controlar, INTERVALO_CONTROL_MS);
    return () => {
      clearTimeout(inicial);
      clearInterval(intervalo);
    };
  }, [autenticado]);

  function cerrarSesion() {
    // Borrar la sesión dispara la redirección del efecto de arriba.
    cerroAMano.current = true;
    borrarSesion();
  }

  function renovarSesion() {
    // No hay refresh token: renovar es volver a ingresar. Los cambios sin guardar se pierden,
    // por eso el aviso lo dice antes.
    cerroAMano.current = true;
    yendoAlLogin.current = true;
    borrarSesion();
    router.replace(RUTA_LOGIN_RENOVAR);
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
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-6">
            <p className="py-2 font-display text-lg font-medium">
              Ichigo <span className="text-sm text-muted-foreground">panel del salón</span>
            </p>
            <nav aria-label="Navegación de administración" className="flex flex-wrap">
              {ENLACES.map(({ href, etiqueta }) => {
                const activo = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`${claseEnlace} ${activo ? claseEnlaceActivo : claseEnlaceInactivo}`}
                    aria-current={activo ? "page" : undefined}
                  >
                    {etiqueta}
                  </Link>
                );
              })}
            </nav>
          </div>
          <BotonCompacto variant="secondary" onClick={cerrarSesion}>
            Cerrar sesión
          </BotonCompacto>
        </div>
      </div>
      {minutosRestantes !== undefined ? (
        <div className="mx-auto w-full max-w-screen-2xl px-4 pt-4 sm:px-6">
          <Alert
            variant="error"
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <span>
              Tu sesión vence en {minutosRestantes} {minutosRestantes === 1 ? "minuto" : "minutos"}.
              Guardá lo que estés editando: al vencer, los cambios sin guardar se pierden.
            </span>
            <BotonCompacto variant="primary" onClick={renovarSesion}>
              Renovar sesión
            </BotonCompacto>
          </Alert>
        </div>
      ) : null}
      <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </div>
    </div>
  );
}
