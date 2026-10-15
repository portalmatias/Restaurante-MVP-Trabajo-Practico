"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "../ui/alert";
import { Button } from "../ui/button";
import { Field } from "../ui/field";
import { apiClient, toApiResult } from "../../lib/api/client";
import type { ErrorApi } from "../../lib/api/errors";
import { guardarSesion, leerSesion } from "../../lib/auth/session";

// Un 401 no dice si el email existe o si la contraseña es la incorrecta (spec "Login de
// administrador"): el backend tampoco lo distingue. `mapErrorApi` no tiene un tipo propio para
// el 401 (cae en `desconocido` con el mensaje genérico de servicio no disponible, sin el texto
// del backend), así que se decide por el status para mostrar el mensaje de credenciales.
export const MENSAJE_CREDENCIALES_INVALIDAS = "El email o la contraseña no son correctos.";
export const MENSAJE_LIMITE_INTENTOS =
  "Se superó el límite de intentos de inicio de sesión. Esperá un minuto antes de volver a intentar.";

/** Por qué se llegó al login, según el `?motivo=` que arma `AdminShell`. */
const MENSAJES_MOTIVO: Record<string, string> = {
  "sesion-vencida":
    "Tu sesión venció. Por seguridad, la sesión del panel dura 60 minutos y no se renueva sola: ingresá de nuevo para seguir.",
  renovar: "Ingresá de nuevo para renovar tu sesión por otros 60 minutos.",
};

type ErroresCampo = { email?: string; password?: string };

/**
 * Reparte los mensajes de un `400` del `ValidationPipe` (`"email must be an email"`, etc.)
 * entre los campos del formulario. Los mensajes del backend están en inglés: se reemplazan por
 * un texto propio por campo en vez de mostrarlos tal cual.
 */
function erroresDeValidacion(mensajes: string[]): ErroresCampo {
  const errores: ErroresCampo = {};
  for (const mensaje of mensajes) {
    if (mensaje.startsWith("email")) errores.email = "Ingresá un email válido.";
    if (mensaje.startsWith("password")) errores.password = "Ingresá tu contraseña.";
  }
  return errores;
}

function mensajeGeneral(error: ErrorApi): string | undefined {
  if (error.tipo === "validacion") return undefined;
  if (error.tipo === "limite-de-intentos") return MENSAJE_LIMITE_INTENTOS;
  return error.mensaje;
}

/**
 * Formulario de login del administrador (spec "Login de administrador"). Usa el `apiClient`
 * público y no `adminClient`: el login no lleva `Authorization`, y un `401` acá significa
 * credenciales incorrectas, no una sesión vencida que haya que redirigir (design.md D2/D4).
 */
export function LoginForm({ motivo }: { motivo?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroresCampo, setErroresCampo] = useState<ErroresCampo>({});
  const [error, setError] = useState<string>();
  const enCurso = useRef(false);

  // Con una sesión vigente, el formulario no tiene sentido: se va directo al panel.
  useEffect(() => {
    if (leerSesion()) {
      router.replace("/admin");
    }
  }, [router]);

  async function iniciarSesion() {
    if (enCurso.current) {
      return;
    }
    const nuevosErrores: ErroresCampo = {
      email: email.trim() === "" ? "Ingresá tu email." : undefined,
      password: password === "" ? "Ingresá tu contraseña." : undefined,
    };
    setErroresCampo(nuevosErrores);
    setError(undefined);
    if (nuevosErrores.email || nuevosErrores.password) {
      return;
    }

    enCurso.current = true;
    setEnviando(true);
    let status: number | undefined;
    const resultado = await toApiResult(
      apiClient.POST("/auth/login", { body: { email: email.trim(), password } }).then((crudo) => {
        status = crudo.response.status;
        return crudo;
      }),
    );
    enCurso.current = false;
    setEnviando(false);

    if (resultado.error) {
      const { error: errorApi } = resultado;
      if (errorApi.tipo === "validacion") {
        setErroresCampo(erroresDeValidacion(errorApi.mensajes));
      }
      setError(status === 401 ? MENSAJE_CREDENCIALES_INVALIDAS : mensajeGeneral(errorApi));
      // La contraseña no queda en memoria ni en el campo después de un intento fallido.
      setPassword("");
      return;
    }

    if (!guardarSesion(resultado.data.accessToken)) {
      setError("No se pudo iniciar la sesión. Intentá de nuevo.");
      return;
    }
    // La contraseña no queda en memoria del componente una vez iniciada la sesión.
    setPassword("");
    router.replace("/admin");
  }

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    void iniciarSesion();
  }

  return (
    <form onSubmit={alEnviar} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl">Iniciar sesión</h1>
        <p className="text-sm text-muted-foreground">
          Acceso exclusivo para el personal del restaurante.
        </p>
      </div>
      {motivo && MENSAJES_MOTIVO[motivo] ? <Alert>{MENSAJES_MOTIVO[motivo]}</Alert> : null}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        value={email}
        disabled={enviando}
        error={erroresCampo.email}
        onChange={(evento) => setEmail(evento.target.value)}
      />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        disabled={enviando}
        error={erroresCampo.password}
        onChange={(evento) => setPassword(evento.target.value)}
      />
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Button type="submit" disabled={enviando}>
        {enviando ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}

