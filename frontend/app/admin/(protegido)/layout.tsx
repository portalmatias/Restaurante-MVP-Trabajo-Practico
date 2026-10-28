import type { Metadata } from "next";
import { AdminShell } from "../../../src/components/admin/admin-shell";

export const metadata: Metadata = {
  // Pantallas internas del personal: no se indexan.
  robots: { index: false, follow: false },
};

/**
 * Layout de todas las pantallas protegidas de `/admin/...` (design.md D4). El segmento
 * `(protegido)` no aparece en la URL; `/admin/login` es hermano de este grupo y no pasa por
 * este guard. El chequeo de sesión corre en el cliente (`AdminShell`), porque la sesión vive en
 * `sessionStorage` (D1).
 */
export default function AdminProtegidoLayout({ children }: LayoutProps<"/admin">) {
  return <AdminShell>{children}</AdminShell>;
}
