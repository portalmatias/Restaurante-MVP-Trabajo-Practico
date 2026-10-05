"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "../ui/alert";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Dialog } from "../ui/dialog";
import { Field } from "../ui/field";
import { apiClient, toApiResult } from "../../lib/api/client";
import type { ErrorApi } from "../../lib/api/errors";
import type { components } from "../../lib/api/schema";
import { formatearFechaLargaEs } from "../../lib/fecha-hora";
import { esCodigoReservaValido } from "../../lib/reserva-codigo";
import { puedeCancelarSegunVentana } from "../../lib/ventana-cancelacion";

type ReservaConsultada = components["schemas"]["ReservaConsultadaRespuesta"];
type Estado = ReservaConsultada["estado"];

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MENSAJE_NO_ENCONTRADA =
  "No encontramos una reserva con esos datos. Revisá el código y el email.";

const TITULO_POR_ESTADO: Record<Estado, string> = {
  CONFIRMADA: "Tu reserva está confirmada",
  PENDIENTE: "Tu reserva está pendiente de confirmación",
  CANCELADA: "Tu reserva está cancelada",
  NO_SHOW: "Tu reserva figura como no presentada",
};

const ETIQUETA_POR_ESTADO: Record<Estado, string> = {
  CONFIRMADA: "Confirmada",
  PENDIENTE: "Pendiente",
  CANCELADA: "Cancelada",
  NO_SHOW: "No se presentó",
};

// Las utilidades de fecha lanzan ante un valor inválido (falla ruidosa a propósito); en la
// vista, un valor inesperado de una respuesta 200 no debe tirar toda la pantalla: se muestra
// tal cual llegó.
function formatearSinRomper(formatear: (valor: string) => string, valor: string): string {
  try {
    return formatear(valor);
  } catch {
    return valor;
  }
}

const MENSAJE_SIN_VERIFICAR =
  "No pudimos verificar si todavía podés cancelar. Probá de nuevo en unos minutos.";

// "no-verificada": no hay con qué evaluar la ventana (falla de `GET /zonas`, zona ausente u
// hora de inicio inválida). Nunca se ofrece una acción cuya condición no se pudo comprobar.
type VerificacionCancelacion = "pendiente" | "no-verificada" | { puedeCancelar: boolean };

async function resolverVerificacion(
  fecha: string,
  horaInicio: string,
  zonaId: string,
): Promise<VerificacionCancelacion> {
  const resultado = await toApiResult(apiClient.GET("/zonas", { cache: "no-store" }));
  const ventana = resultado.data?.find((zona) => zona.id === zonaId)?.ventanaCancelacionHoras;
  if (ventana === undefined) {
    return "no-verificada";
  }
  try {
    return { puedeCancelar: puedeCancelarSegunVentana(fecha, horaInicio, ventana, new Date()) };
  } catch {
    // La función lanza ante una fecha u hora inválida: equivale a no poder verificar.
    return "no-verificada";
  }
}

/**
 * Resuelve, para el detalle consultado, si se ofrece "Cancelar mi reserva" (design.md D9):
 * pide `GET /zonas`, busca la zona por id y evalúa `puedeCancelarSegunVentana`. Solo pide las
 * zonas si el estado admite cancelar. `reintentar` vuelve a pedir únicamente las zonas;
 * `verificando` solo marca el reintento (la primera carga no muestra nada).
 */
function useVerificacionCancelacion(reserva: ReservaConsultada) {
  const { estado, fecha, turno, zona } = reserva;
  const admiteCancelar = estado === "CONFIRMADA" || estado === "PENDIENTE";
  const [verificacion, setVerificacion] = useState<VerificacionCancelacion>("pendiente");
  const [verificando, setVerificando] = useState(false);
  const enCurso = useRef(false);
  const ultimaSolicitud = useRef(0);

  const verificar = useCallback(() => {
    if (enCurso.current) {
      return;
    }
    const solicitud = ++ultimaSolicitud.current;
    enCurso.current = true;
    // Si la verificación rechazara, `enCurso` quedaría en `true` y "Reintentar" sería un no-op:
    // el rechazo equivale a no poder verificar y deja la misma pantalla para reintentar.
    void resolverVerificacion(fecha, turno.horaInicio, zona.id)
      .catch((): VerificacionCancelacion => "no-verificada")
      .then((resultado) => {
        if (solicitud !== ultimaSolicitud.current) {
          return;
        }
        enCurso.current = false;
        setVerificando(false);
        setVerificacion(resultado);
      });
  }, [fecha, turno.horaInicio, zona.id]);

  useEffect(() => {
    if (admiteCancelar) {
      verificar();
    }
    return () => {
      ultimaSolicitud.current += 1;
      enCurso.current = false;
    };
  }, [admiteCancelar, verificar]);

  return {
    ofrecerCancelar:
      admiteCancelar && typeof verificacion === "object" && verificacion.puedeCancelar,
    noVerificada: admiteCancelar && verificacion === "no-verificada",
    verificando,
    reintentar: () => {
      if (!enCurso.current) {
        setVerificando(true);
        verificar();
      }
    },
  };
}

const MENSAJE_NO_CANCELABLE =
  "No se pudo cancelar la reserva: la ventana para cancelar ya venció o la reserva ya no se puede cancelar.";

const MENSAJE_YA_NO_CANCELABLE = "Esta reserva ya no se puede cancelar.";

function errorDeCodigo(codigo: string): string | undefined {
  if (codigo === "") return "Falta ingresar el código de tu reserva.";
  if (!esCodigoReservaValido(codigo)) return "El código tiene 8 caracteres, entre letras y números.";
  return undefined;
}

function errorDeEmail(email: string): string | undefined {
  if (email.trim() === "") return "Falta ingresar tu email.";
  if (!FORMATO_EMAIL.test(email.trim())) return "Ingresá un email válido.";
  return undefined;
}

// Un 404 no dice cuál dato falló (el servidor tampoco lo dice); un 400 solo puede ser un
// formato que la validación en línea no atrapó. El resto usa el mensaje de `mapErrorApi`.
function mensajeDeError(error: ErrorApi): string {
  if (error.tipo === "no-encontrado") return MENSAJE_NO_ENCONTRADA;
  if (error.tipo === "validacion") return "Revisá el código y el email e intentá de nuevo.";
  return error.mensaje;
}

// Igual que la consulta, nunca se muestra el texto del servidor. Un 409 es la ventana vencida o
// un estado no cancelable; un 404 no dice cuál dato falló. El resto usa el mensaje de `mapErrorApi`.
function mensajeDeErrorAlCancelar(error: ErrorApi): string {
  if (error.tipo === "conflicto") return MENSAJE_NO_CANCELABLE;
  return mensajeDeError(error);
}

export type ConsultaReservaProps = {
  /** Código prellenado desde `?codigo=`. El email nunca viaja en la URL (design.md D1.2). */
  codigoInicial?: string;
};

/**
 * Consulta de una reserva por código y email (design.md D3 Pantallas 6 y 7). Maneja sus
 * sub-vistas ("formulario" y "detalle") como estado propio, sin una ruta por sub-vista, para
 * que el email no quede en la URL ni en el historial (D1.2). El detalle solo muestra lo que la
 * spec permite: nunca nombre, email ni teléfono.
 */
export function ConsultaReserva({ codigoInicial = "" }: ConsultaReservaProps) {
  const [codigo, setCodigo] = useState(codigoInicial.toUpperCase());
  const [email, setEmail] = useState("");
  const [errorCodigo, setErrorCodigo] = useState<string>();
  const [errorEmail, setErrorEmail] = useState<string>();
  const [errorApi, setErrorApi] = useState<ErrorApi>();
  const [consultando, setConsultando] = useState(false);
  const [reserva, setReserva] = useState<ReservaConsultada>();
  // `enCurso` evita reentradas (el estado tarda un render en reflejarse); `ultimaSolicitud`
  // identifica la consulta vigente: la respuesta de una consulta abandonada (por ejemplo, tras
  // desmontar el componente) nunca se aplica.
  const enCurso = useRef(false);
  const ultimaSolicitud = useRef(0);

  useEffect(() => {
    return () => {
      ultimaSolicitud.current += 1;
    };
  }, []);

  async function consultar() {
    if (enCurso.current) {
      return;
    }
    const nuevoErrorCodigo = errorDeCodigo(codigo);
    const nuevoErrorEmail = errorDeEmail(email);
    setErrorCodigo(nuevoErrorCodigo);
    setErrorEmail(nuevoErrorEmail);
    if (nuevoErrorCodigo || nuevoErrorEmail) {
      return;
    }

    const solicitud = ++ultimaSolicitud.current;
    enCurso.current = true;
    setErrorApi(undefined);
    setConsultando(true);
    const resultado = await toApiResult(
      apiClient.POST("/reservas/consultar", { body: { codigo, email: email.trim() } }),
    );
    if (solicitud !== ultimaSolicitud.current) {
      return;
    }
    enCurso.current = false;
    setConsultando(false);

    if (resultado.error) {
      setErrorApi(resultado.error);
      return;
    }
    setReserva(resultado.data);
  }

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    void consultar();
  }

  function consultarOtra() {
    setReserva(undefined);
    setEmail("");
    setErrorApi(undefined);
    setErrorEmail(undefined);
  }

  if (reserva) {
    return (
      <DetalleReserva
        reserva={reserva}
        email={email.trim()}
        onCancelada={() => setReserva({ ...reserva, estado: "CANCELADA" })}
        onConsultarOtra={consultarOtra}
      />
    );
  }

  return (
    <form onSubmit={alEnviar} noValidate className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Consultá tu reserva</h1>
      <p className="text-base text-muted-foreground">
        Ingresá el código de tu reserva y el email con el que reservaste.
      </p>
      <Field
        label="Código de reserva"
        name="codigo"
        value={codigo}
        maxLength={8}
        disabled={consultando}
        autoComplete="off"
        autoCapitalize="characters"
        error={errorCodigo}
        onChange={(evento) => setCodigo(evento.target.value.toUpperCase())}
        onBlur={() => setErrorCodigo(errorDeCodigo(codigo))}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        value={email}
        disabled={consultando}
        autoComplete="email"
        error={errorEmail}
        onChange={(evento) => setEmail(evento.target.value)}
        onBlur={() => setErrorEmail(errorDeEmail(email))}
      />
      {errorApi ? (
        <div className="flex flex-col gap-3">
          <Alert variant="error" className="text-base">
            {mensajeDeError(errorApi)}
          </Alert>
          {errorApi.tipo === "desconocido" ? (
            <Button
              variant="secondary"
              size="lg"
              disabled={consultando}
              onClick={() => void consultar()}
            >
              Reintentar
            </Button>
          ) : null}
        </div>
      ) : null}
      <Button type="submit" size="lg" disabled={consultando}>
        {consultando ? "Buscando…" : "Buscar mi reserva"}
      </Button>
    </form>
  );
}

function ResumenReserva({ reserva }: { reserva: ReservaConsultada }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
      <dt className="text-muted-foreground">Código</dt>
      <dd className="font-bold tracking-widest text-accent">{reserva.codigoReserva}</dd>
      <dt className="text-muted-foreground">Fecha</dt>
      <dd>{formatearSinRomper(formatearFechaLargaEs, reserva.fecha)}</dd>
      <dt className="text-muted-foreground">Turno</dt>
      {/* La API entrega `HH:mm` ya en hora local del restaurante: se muestra tal cual. */}
      <dd>{`${reserva.turno.horaInicio} a ${reserva.turno.horaFin}`}</dd>
      <dt className="text-muted-foreground">Zona</dt>
      <dd>{reserva.zona.nombre}</dd>
      <dt className="text-muted-foreground">Comensales</dt>
      <dd>{reserva.comensales}</dd>
    </dl>
  );
}

function DetalleReserva({
  reserva,
  email,
  onCancelada,
  onConsultarOtra,
}: {
  reserva: ReservaConsultada;
  /** Email ya usado para consultar: viaja en el body de la cancelación, nunca se muestra. */
  email: string;
  onCancelada: () => void;
  onConsultarOtra: () => void;
}) {
  const { ofrecerCancelar, noVerificada, verificando, reintentar } =
    useVerificacionCancelacion(reserva);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [errorAlCancelar, setErrorAlCancelar] = useState<ErrorApi>();
  const [recienCancelada, setRecienCancelada] = useState(false);
  // Un 409 es definitivo para esta reserva (ventana vencida o estado no cancelable): el detalle
  // deja de ofrecer la acción. Los demás errores pueden ser pasajeros y permiten reintentar.
  const [rechazadaPorConflicto, setRechazadaPorConflicto] = useState(false);
  // Mismo patrón que la consulta: `enCurso` evita reentradas y `ultimaSolicitud` descarta la
  // respuesta de una cancelación abandonada (por ejemplo, tras desmontar).
  const cancelacionEnCurso = useRef(false);
  const ultimaCancelacion = useRef(0);

  useEffect(() => {
    return () => {
      ultimaCancelacion.current += 1;
    };
  }, []);

  function abrirDialogo() {
    setErrorAlCancelar(undefined);
    setDialogoAbierto(true);
  }

  // Mientras la cancelación está pendiente el diálogo no se cierra (el `Dialog` ya lo impide);
  // la guarda evita que un cierre tardío abandone una solicitud en curso.
  function cerrarDialogo() {
    if (!cancelacionEnCurso.current) {
      setDialogoAbierto(false);
    }
  }

  async function cancelar() {
    if (cancelacionEnCurso.current) {
      return;
    }
    const solicitud = ++ultimaCancelacion.current;
    cancelacionEnCurso.current = true;
    setErrorAlCancelar(undefined);
    setCancelando(true);
    const resultado = await toApiResult(
      apiClient.POST("/reservas/{codigo}/cancelar", {
        params: { path: { codigo: reserva.codigoReserva } },
        body: { email },
      }),
    );
    if (solicitud !== ultimaCancelacion.current) {
      return;
    }
    cancelacionEnCurso.current = false;
    setCancelando(false);

    if (resultado.error) {
      setErrorAlCancelar(resultado.error);
      setRechazadaPorConflicto(resultado.error.tipo === "conflicto");
      return;
    }
    // El 204 ya confirma el cambio: no se vuelve a consultar al servidor (design.md D3).
    setRechazadaPorConflicto(false);
    setDialogoAbierto(false);
    setRecienCancelada(true);
    onCancelada();
  }

  const esPendiente = reserva.estado === "PENDIENTE";
  const claseEtiqueta = esPendiente
    ? "bg-accent text-accent-foreground"
    : "bg-muted text-muted-foreground";

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
        {TITULO_POR_ESTADO[reserva.estado]}
      </h1>
      <p>
        <span className={`inline-block rounded-md px-3 py-1 text-base font-medium ${claseEtiqueta}`}>
          {ETIQUETA_POR_ESTADO[reserva.estado]}
        </span>
      </p>
      {recienCancelada ? (
        <Alert variant="info" className="text-base">
          Tu reserva fue cancelada.
        </Alert>
      ) : null}
      <Card title="Resumen de tu reserva" className="text-base">
        <ResumenReserva reserva={reserva} />
      </Card>
      {ofrecerCancelar && !rechazadaPorConflicto ? (
        <Button variant="destructive" size="lg" onClick={abrirDialogo}>
          Cancelar mi reserva
        </Button>
      ) : null}
      {/* Con el diálogo abierto el rechazo ya se lee ahí: el aviso aparece al cerrarlo. */}
      {rechazadaPorConflicto && !dialogoAbierto ? (
        <Alert variant="info" className="text-base">
          {MENSAJE_YA_NO_CANCELABLE}
        </Alert>
      ) : null}
      {noVerificada ? (
        <div className="flex flex-col gap-3">
          <Alert variant="info" className="text-base">
            {MENSAJE_SIN_VERIFICAR}
          </Alert>
          <Button variant="secondary" size="lg" disabled={verificando} onClick={reintentar}>
            Reintentar
          </Button>
        </div>
      ) : null}
      <Button variant="ghost" onClick={onConsultarOtra} className="underline sm:self-start">
        Consultar otra reserva
      </Button>
      <Dialog
        open={dialogoAbierto}
        titulo="¿Cancelar tu reserva?"
        textoConfirmar={cancelando ? "Cancelando…" : "Sí, cancelar"}
        textoCancelar="Volver"
        variantConfirmar="destructive"
        confirmando={cancelando}
        onConfirm={() => void cancelar()}
        onCancel={cerrarDialogo}
      >
        {/* Cerrado, el diálogo no lleva contenido: no duplica el resumen del detalle. */}
        {dialogoAbierto ? <ResumenReserva reserva={reserva} /> : null}
        {dialogoAbierto && errorAlCancelar ? (
          <Alert variant="error">{mensajeDeErrorAlCancelar(errorAlCancelar)}</Alert>
        ) : null}
      </Dialog>
    </div>
  );
}
