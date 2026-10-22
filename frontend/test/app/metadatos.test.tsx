import type { Metadata } from "next";
import { renderToStaticMarkup } from "react-dom/server";
import RootLayout, { metadata as metadataRaiz } from "../../app/layout";
import { metadata as consultar } from "../../app/reservas/consultar/page";
import { metadata as datos } from "../../app/reservas/nueva/datos/page";
import { metadata as exito } from "../../app/reservas/nueva/exito/page";
import { metadata as nueva } from "../../app/reservas/nueva/page";
import { metadata as resultado } from "../../app/reservas/nueva/resultado/page";
import { metadata as reservas } from "../../app/reservas/page";
import * as landing from "../../app/page";

jest.mock("next/navigation", () => ({ usePathname: () => "/" }));

// Tarea 3.6 (identidad-visual-ichigo, «Metadatos del documento»).
describe("Metadatos del documento", () => {
  const titulosDeReservas: [string, Metadata][] = [
    ["/reservas", reservas],
    ["/reservas/nueva", nueva],
    ["/reservas/nueva/resultado", resultado],
    ["/reservas/nueva/datos", datos],
    ["/reservas/nueva/exito", exito],
    ["/reservas/consultar", consultar],
  ];

  it("las seis pantallas de reservas tienen un título propio y distinto", () => {
    const titulos = titulosDeReservas.map(([, m]) => m.title);

    for (const titulo of titulos) {
      expect(typeof titulo).toBe("string");
      expect((titulo as string).trim()).not.toBe("");
    }
    expect(new Set(titulos).size).toBe(6);
    expect(consultar.title).toBe("Consultá tu reserva");
  });

  it("el layout declara «Ichigo» con la plantilla «%s | Ichigo»", () => {
    expect(metadataRaiz.title).toEqual({ default: "Ichigo", template: "%s | Ichigo" });
  });

  it("la landing no declara título propio: su pestaña resuelve a «Ichigo» exacto", () => {
    const propio = (landing as { metadata?: Metadata }).metadata?.title;

    expect(propio).toBeUndefined();
    expect((metadataRaiz.title as { default: string }).default).toBe("Ichigo");
  });

  it("el documento declara lang=\"es-AR\"", () => {
    const html = renderToStaticMarkup(<RootLayout params={Promise.resolve({})}>contenido</RootLayout>);

    expect(html).toMatch(/^<html[^>]* lang="es-AR"/);
  });
});
