import type { Metadata } from "next";
import { LoginForm } from "../../../src/components/admin/login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión — Administración",
  // Pantalla interna del personal: no se indexa.
  robots: { index: false, follow: false },
};

/**
 * Login del administrador (spec "Login de administrador"). Queda fuera del grupo
 * `(protegido)`: ningún layout con guard de sesión lo envuelve (design.md D4).
 */
export default function AdminLoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10">
      <LoginForm />
    </div>
  );
}
