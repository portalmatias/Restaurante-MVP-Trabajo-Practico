import type { Metadata } from "next";
import { DashboardAforo } from "../../../src/components/admin/dashboard-aforo";

export const metadata: Metadata = { title: "Aforo" };

/** Dashboard de aforo (spec "Dashboard de aforo"). El guard de sesión lo pone el layout. */
export default function AdminDashboardPage() {
  return <DashboardAforo />;
}
