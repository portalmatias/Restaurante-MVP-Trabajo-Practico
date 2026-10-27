/** @jest-environment node */
import { renderToString } from "react-dom/server";
import Home from "../../app/page";

// Spec landing-ichigo, «Una sola imagen prioritaria»: en el HTML servido de `/` solo la fotografía de
// la apertura se precarga. Se renderiza en el entorno `node` (como el servidor) porque jsdom no
// recibe las pistas de precarga que React emite en el HTML de servidor.
// Límite: este renderizado emite el `<link rel="preload" as="image">` pero no un atributo
// `fetchpriority`, así que «alta prioridad» no se puede afirmar aquí; solo que es la única precargada.
describe("Landing (/): precarga de imágenes en el HTML del servidor", () => {
  it("hay una sola precarga de imagen y es la fotografía de la apertura", () => {
    const html = renderToString(<Home />);
    const precargas = html.match(/<link[^>]*\srel="preload"[^>]*\sas="image"[^>]*>/g) ?? [];

    expect(precargas).toHaveLength(1);
    expect(decodeURIComponent(precargas[0] ?? "")).toContain("nigiri.webp");
  });
});
