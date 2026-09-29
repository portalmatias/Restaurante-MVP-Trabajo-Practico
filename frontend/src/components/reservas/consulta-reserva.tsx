"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "../ui/alert";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Field } from "../ui/field";
import { apiClient, toApiResult } from "../../lib/api/client";
import type { ErrorApi } from "../../lib/api/errors";
import type { components } from "../../lib/api/schema";
import { formatearFechaLargaEs } from "../../lib/fecha-hora";
import { esCodigoReservaValido } from "../../lib/reserva-codigo";

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

  async function consultar() {
    const nuevoErrorCodigo = errorDeCodigo(codigo);
    const nuevoErrorEmail = errorDeEmail(email);
    setErrorCodigo(nuevoErrorCodigo);
    setErrorEmail(nuevoErrorEmail);
    if (nuevoErrorCodigo || nuevoErrorEmail) {
      return;
    }

    setErrorApi(undefined);
    setConsultando(true);
    const resultado = await toApiResult(
      apiClient.POST("/reservas/consultar", { body: { codigo, email: email.trim() } }),
    );
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
    return <DetalleReserva reserva={reserva} onConsultarOtra={consultarOtra} />;
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
            <Button variant="secondary" size="lg" onClick={() => void consultar()}>
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

function DetalleReserva({
  reserva,
  onConsultarOtra,
}: {
  reserva: ReservaConsultada;
  onConsultarOtra: () => void;
}) {
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
      <Card title="Resumen de tu reserva" className="text-base">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-muted-foreground">Código</dt>
          <dd className="font-bold tracking-widest text-accent">{reserva.codigoReserva}</dd>
          <dt className="text-muted-foreground">Fecha</dt>
          <dd>{formatearFechaLargaEs(reserva.fecha)}</dd>
          <dt className="text-muted-foreground">Turno</dt>
          {/* La API entrega `HH:mm` ya en hora local del restaurante: se muestra tal cual. */}
          <dd>{`${reserva.turno.horaInicio} a ${reserva.turno.horaFin}`}</dd>
          <dt className="text-muted-foreground">Zona</dt>
          <dd>{reserva.zona.nombre}</dd>
          <dt className="text-muted-foreground">Comensales</dt>
          <dd>{reserva.comensales}</dd>
        </dl>
      </Card>
      <Button variant="ghost" onClick={onConsultarOtra} className="underline sm:self-start">
        Consultar otra reserva
      </Button>
    </div>
  );
}
