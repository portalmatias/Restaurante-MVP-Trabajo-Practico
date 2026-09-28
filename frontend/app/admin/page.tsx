import { Card } from "../../src/components/ui/card";

// Placeholder sin lógica de negocio ni auth: el login y el dashboard reales llegan con
// frontend-admin.
export default function AdminPage() {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      {/* headingLevel=1: esta tarjeta es el título principal del placeholder, la página no
          tiene otro h1 (WCAG 1.3.1). */}
      <Card title="Administración" headingLevel={1} className="w-full max-w-2xl">
        <p className="text-sm text-card-foreground">
          Esta pantalla todavía no está implementada. Acá vas a poder iniciar sesión como
          administrador y gestionar zonas, mesas y turnos, cuando se implemente el cambio{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-muted-foreground">
            frontend-admin
          </code>
          .
        </p>
      </Card>
    </div>
  );
}
