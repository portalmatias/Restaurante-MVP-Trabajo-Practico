'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { SiteHeader } from './site-header';

/** `true` para `/admin` y cualquier ruta debajo (no para `/administrar` ni similares). */
function esRutaDeAdmin(ruta: string | null): boolean {
  return ruta === '/admin' || (ruta?.startsWith('/admin/') ?? false);
}

/**
 * Marco de las páginas públicas: encabezado con la navegación del cliente, contenido y pie. El
 * panel de administración tiene su propio encabezado, así que ahí no se muestran ni el
 * encabezado público ni el pie (no tiene sentido mezclar la navegación del cliente con la del
 * personal). Decide por la ruta en vez de mover las páginas a grupos de rutas, para no cambiar
 * la estructura de `app/`.
 */
export function MarcoPublico({ children }: { children: ReactNode }) {
  const enAdmin = esRutaDeAdmin(usePathname());

  if (enAdmin) {
    return <main className="flex flex-1 flex-col">{children}</main>;
  }

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm text-muted-foreground">
          Ichigo es un restaurante ficticio: proyecto académico de Ingeniería de
          Software II.
        </div>
      </footer>
    </>
  );
}
