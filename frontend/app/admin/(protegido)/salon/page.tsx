import type { Metadata } from "next";
import { SalonAdmin } from "../../../../src/components/admin/salon-admin";

export const metadata: Metadata = { title: "Salón" };

/** Gestión de Zonas, Mesas y Turnos. El guard de sesión lo pone el layout de `(protegido)`. */
export default function AdminSalonPage() {
  return <SalonAdmin />;
}
