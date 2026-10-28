"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "../ui/alert";
import { Button, buttonVariants } from "../ui/button";
import { Field } from "../ui/field";
import { apiClient, toApiResult } from "../../lib/api/client";
import type { ErrorApi } from "../../lib/api/errors";
import { agruparPorCampo, sinNombreDeCampo } from "../../lib/agrupar-por-campo";
import {
  urlConSeleccion,
  urlDeExito,
  type SeleccionReserva,
} from "../../lib/seleccion-reserva";

type Campo = "nombre" | "email" | "telefono";
type Errores = Partial<Record<Campo, string>>;

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Nombre del campo en el DTO de `POST /reservas` -> clave del formulario (design.md D8).
const CAMPOS_DEL_DTO: Record<string, Campo> = {
  nombreCliente: "nombre",
  emailCliente: "email",
  telefonoCliente: "telefono",
};

const MENSAJE_CHOQUE =
  "No pudimos registrar tu reserva porque otra persona reservó al mismo tiempo. Reintentá en unos segundos.";

// Tras un 429 reintentar enseguida agrava el límite: el envío queda en espera este tiempo.
const MS_ESPERA_POR_LIMITE = 30_000;

const MENSAJE_NO_ENCONTRADO = "Esa fecha, turno o zona ya no están disponibles. Empecemos de nuevo.";

function errorDeNombre(nombre: string): string | undefined {
  return nombre.trim() === "" ? "Falta ingresar tu nombre." : undefined;
}

function errorDeEmail(email: string): string | undefined {
  if (email.trim() === "") return "Falta ingresar tu email.";
  if (!FORMATO_EMAIL.test(email.trim())) return "Ingresá un email válido.";
  return undefined;
}

function errorDeTelefono(telefono: string): string | undefined {
  return telefono.trim() === "" ? "Falta ingresar tu teléfono." : undefined;
}

export type FormularioDatosContactoProps = {
  /** Selección de los pasos anteriores, ya validada en su forma por la página (design.md D1). */
  seleccion: SeleccionReserva;
};

/**
 * Paso 3 del asistente: nombre, email y teléfono, y la creación de la reserva (design.md D3
 * Pantalla 4, D1.1). Es el único paso que hace una mutación, por eso llama al `apiClient` desde
 * el navegador. Ante cualquier rechazo sigue montado, así que lo ya escrito no se pierde.
 */
export function FormularioDatosContacto({ seleccion }: FormularioDatosContactoProps) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  // Errores de la validación en línea y los que el servidor asoció a un campo (`400`, D8).
  const [errores, setErrores] = useState<Errores>({});
  const [erroresDelServidor, setErroresDelServidor] = useState<Errores>({});
  const [generales, setGenerales] = useState<string[]>([]);
  const [errorApi, setErrorApi] = useState<ErrorApi>();
  const [enviando, setEnviando] = useState(false);
  // `true` desde un 429 hasta que pasa la espera: el botón de enviar sigue deshabilitado.
  const [enEspera, setEnEspera] = useState(false);
  // Destino de la pantalla de éxito una vez registrada la reserva: si la navegación no llega a
  // desmontar el formulario, es la salida para que la persona vea su código.
  const [destinoExito, setDestinoExito] = useState<string>();
  const resumenErrores = useRef<HTMLDivElement>(null);
  // `enCurso` evita reentradas (el estado tarda un render en reflejarse); `ultimaSolicitud`
  // descarta la respuesta de un envío abandonado (por ejemplo, tras desmontar el componente).
  const enCurso = useRef(false);
  const ultimaSolicitud = useRef(0);
  const temporizadorEspera = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      ultimaSolicitud.current += 1;
      clearTimeout(temporizadorEspera.current);
    };
  }, []);

  useEffect(() => {
    if (generales.length > 0) resumenErrores.current?.focus();
  }, [generales]);

  function editar(campo: Campo, valor: string, guardar: (valor: string) => void) {
    guardar(valor);
    // Lo que dijo el servidor sobre ese valor deja de aplicar en cuanto se lo edita.
    setErroresDelServidor((actuales) => ({ ...actuales, [campo]: undefined }));
  }

  function validar(campo: Campo, valor: string): string | undefined {
    if (campo === "nombre") return errorDeNombre(valor);
    return campo === "email" ? errorDeEmail(valor) : errorDeTelefono(valor);
  }

  function alSalir(campo: Campo, valor: string) {
    setErrores((actuales) => ({ ...actuales, [campo]: validar(campo, valor) }));
  }

  async function enviar() {
    if (enCurso.current || enEspera) {
      return;
    }
    const nuevosErrores: Errores = {
      nombre: errorDeNombre(nombre),
      email: errorDeEmail(email),
      telefono: errorDeTelefono(telefono),
    };
    setErrores(nuevosErrores);
    if (nuevosErrores.nombre || nuevosErrores.email || nuevosErrores.telefono) {
      return;
    }

    const solicitud = ++ultimaSolicitud.current;
    enCurso.current = true;
    setErrorApi(undefined);
    setErroresDelServidor({});
    setGenerales([]);
    setEnviando(true);
    const resultado = await toApiResult(
      apiClient.POST("/reservas", {
        body: {
          ...seleccion,
          nombreCliente: nombre.trim(),
          emailCliente: email.trim(),
          telefonoCliente: telefono.trim(),
        },
      }),
    );
    if (solicitud !== ultimaSolicitud.current) {
      return;
    }

    if (!resultado.error) {
      // El botón sigue deshabilitado hasta que la navegación desmonte el formulario.
      const { codigoReserva, estado, fecha, turnoId, zonaId, comensales } = resultado.data;
      const destino = urlDeExito({ codigo: codigoReserva, estado, fecha, turnoId, zonaId, comensales });
      setDestinoExito(destino);
      router.push(destino);
      return;
    }

    enCurso.current = false;
    setEnviando(false);
    if (resultado.error.tipo === "validacion") {
      const { porCampo, generales: sinCampo } = agruparPorCampo(
        resultado.error.mensajes,
        CAMPOS_DEL_DTO,
      );
      const enLinea = (campo: Campo) => porCampo[campo]?.map(sinNombreDeCampo).join(" ");
      setErroresDelServidor({
        nombre: enLinea("nombre"),
        email: enLinea("email"),
        telefono: enLinea("telefono"),
      });
      setGenerales(sinCampo);
      return;
    }
    setErrorApi(resultado.error);
    if (resultado.error.tipo === "limite-de-intentos") {
      setEnEspera(true);
      clearTimeout(temporizadorEspera.current);
      temporizadorEspera.current = setTimeout(() => setEnEspera(false), MS_ESPERA_POR_LIMITE);
    }
  }

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    void enviar();
  }

  const conMotivos = errorApi?.tipo === "conflicto" && errorApi.motivos.length > 0;

  return (
    <form onSubmit={alEnviar} noValidate className="flex flex-col gap-5">
      {generales.length > 0 ? (
        <div
          ref={resumenErrores}
          role="alert"
          tabIndex={-1}
          className="rounded-sm border border-destructive bg-background px-4 py-3 text-base text-destructive"
        >
          <ul className="flex flex-col gap-1">
            {generales.map((mensaje, indice) => (
              <li key={`${mensaje}-${indice}`}>{mensaje}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <Field
        label="Nombre"
        name="nombre"
        value={nombre}
        disabled={enviando}
        autoComplete="name"
        error={errores.nombre ?? erroresDelServidor.nombre}
        onChange={(evento) => editar("nombre", evento.target.value, setNombre)}
        onBlur={() => alSalir("nombre", nombre)}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        value={email}
        disabled={enviando}
        autoComplete="email"
        error={errores.email ?? erroresDelServidor.email}
        onChange={(evento) => editar("email", evento.target.value, setEmail)}
        onBlur={() => alSalir("email", email)}
      />
      <Field
        label="Teléfono"
        name="telefono"
        type="tel"
        value={telefono}
        disabled={enviando}
        autoComplete="tel"
        error={errores.telefono ?? erroresDelServidor.telefono}
        onChange={(evento) => editar("telefono", evento.target.value, setTelefono)}
        onBlur={() => alSalir("telefono", telefono)}
      />
      {errorApi ? (
        <div className="flex flex-col gap-3">
          {errorApi.tipo === "conflicto" && conMotivos ? (
            <ul className="flex flex-col gap-3">
              {errorApi.motivos.map((motivo, indice) => (
                <li key={`${motivo.codigo}-${indice}`}>
                  {/* El backend ya manda el texto en español para personas. */}
                  <Alert variant="error" className="text-base">
                    {motivo.mensaje}
                  </Alert>
                </li>
              ))}
            </ul>
          ) : (
            <Alert variant="error" className="text-base">
              {mensajeDeError(errorApi)}
            </Alert>
          )}
          {conMotivos ? (
            <Link
              href={urlConSeleccion("/reservas/nueva", seleccion)}
              className={buttonVariants({ variant: "secondary", size: "lg" })}
            >
              Volver a elegir
            </Link>
          ) : null}
          {errorApi.tipo === "no-encontrado" ? (
            <Link
              href="/reservas/nueva"
              className={buttonVariants({ variant: "secondary", size: "lg" })}
            >
              Volver a empezar
            </Link>
          ) : null}
          {errorApi.tipo === "desconocido" ? (
            <Button
              variant="secondary"
              size="lg"
              disabled={enviando}
              onClick={() => void enviar()}
            >
              Reintentar
            </Button>
          ) : null}
        </div>
      ) : null}
      {destinoExito ? (
        <div className="flex flex-col gap-3">
          <Alert variant="info" className="text-base">
            Tu reserva quedó registrada. Si no avanzás solo a la pantalla con tu código, tocá el
            enlace.
          </Alert>
          <Link href={destinoExito} className={buttonVariants({ variant: "primary", size: "lg" })}>
            Ver mi reserva
          </Link>
        </div>
      ) : null}
      <Button type="submit" size="lg" disabled={enviando || enEspera}>
        {enviando ? "Confirmando…" : enEspera ? "Esperá un momento para reintentar" : "Confirmar reserva"}
      </Button>
    </form>
  );
}

// Nunca se muestra el texto del servidor: el `409` sin motivos y el `404` tienen texto propio.
function mensajeDeError(error: ErrorApi): string {
  if (error.tipo === "conflicto") return MENSAJE_CHOQUE;
  if (error.tipo === "no-encontrado") return MENSAJE_NO_ENCONTRADO;
  if (error.tipo === "validacion") return "Revisá los datos e intentá de nuevo.";
  return error.mensaje;
}
