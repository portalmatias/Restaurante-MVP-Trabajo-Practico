import type { Metadata } from "next";
import { LoginForm } from "../../../src/components/admin/login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  // Pantalla interna del personal: no se indexa.
  robots: { index: false, follow: false },
};

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Login del administrador (spec "Login de administrador"). Queda fuera del grupo
 * `(protegido)`: ningún layout con guard de sesión lo envuelve (design.md D4). El `?motivo=` lo
 * arma `AdminShell` cuando la sesión venció o se va a renovar, y el formulario lo explica.
 */
export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const { motivo } = await searchParams;
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <div className="rounded-sm border border-border bg-card p-6">
        <LoginForm motivo={typeof motivo === "string" ? motivo : undefined} />
      </div>
    </div>
  );
}
