import Link from "next/link";
import { MarcoFoto } from "../src/components/layout/marco-foto";
import { buttonVariants } from "../src/components/ui/button";
import { TablillaPaso } from "../src/components/ui/tablilla";

// Contenido de la landing: Ichigo es un restaurante ficticio y los textos y fotografías son
// ilustrativos (las fotos son sintéticas: ver public/ichigo/PROCEDENCIA.md). Ninguna cifra de
// esta página (cupos, horarios, precios) es un dato del sistema: los turnos, las zonas y la
// disponibilidad reales salen de la API en el flujo de reserva.
//
// Mobile primero: una sola columna hasta `md`, objetivos táctiles de 44px o más y textos que
// no dependen de que la foto cargue. El movimiento (clases `tinta-entrada`, `revelar`,
// `balanceo` y `marco-organico`) está definido en globals.css y se apaga con
// `prefers-reduced-motion`.

const TIEMPOS = [
  { titulo: "Primer bocado", japones: "先付", detalle: "Sakizuke" },
  { titulo: "Nigiri", japones: "握り", detalle: "Pieza a pieza" },
  { titulo: "Cierre dulce", japones: "甘味", detalle: "Kanmi" },
] as const;

const PASOS = [
  "Elegí fecha, turno y cantidad de comensales.",
  "Dejá tu nombre, tu email y tu teléfono. No necesitás cuenta.",
  "Guardá el código que recibís: con él y tu email consultás o cancelás.",
] as const;

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 overflow-x-clip px-4 pb-16 pt-8 sm:gap-28 sm:pb-24 sm:pt-16">
      {/* Apertura: el nombre y la acción primero (en celular, antes que la foto). */}
      <section className="grid gap-8 md:grid-cols-12 md:gap-8">
        <div className="flex flex-col gap-5 md:col-span-7">
          <h1 className="tinta-entrada font-wordmark text-7xl font-normal leading-[0.95] tracking-[0.06em] sm:text-9xl">
            Ichigo
          </h1>
          <p className="max-w-[24ch] font-display text-2xl leading-snug sm:text-3xl">
            Omakase japonés. Cada bocado, una sorpresa.
          </p>
          <p className="max-w-[56ch] text-base text-muted-foreground">
            Dejás la elección en manos del itamae: el pescado del día, el arroz tibio, un bocado
            a la vez y a la medida de la barra. Reservá tu lugar en pocos pasos.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/reservas" className={buttonVariants({ variant: "primary", size: "lg" })}>
              Reservar una mesa
            </Link>
            <Link
              href="/reservas/consultar"
              className={buttonVariants({ variant: "ghost", size: "lg", className: "border border-border" })}
            >
              Ya tengo un código
            </Link>
          </div>
        </div>
        <MarcoFoto
          src="/ichigo/nigiri.webp"
          alt="Una pieza de nigiri de atún graso sobre un plato de cerámica oscura, en una mesa de madera clara"
          width={928}
          height={1152}
          priority
          sizes="(min-width: 768px) 40vw, 100vw"
          className="mx-auto w-full max-w-sm md:col-span-5 md:mt-16 md:max-w-none"
        />
      </section>

      <MarcoFoto
        src="/ichigo/barra.webp"
        alt="La barra de hinoki de Ichigo de noche, con luces cálidas y un plato negro sobre la madera"
        width={1376}
        height={768}
        sizes="(min-width: 1024px) 64rem, 100vw"
        caption="La barra, a la hora del primer turno."
      />

      {/* El omakase: las manos, el texto y tres tablillas que se mecen. */}
      <section aria-labelledby="omakase" className="flex flex-col gap-12">
        <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
          <MarcoFoto
            src="/ichigo/manos.webp"
            alt="Las manos del itamae apoyando una pieza de nigiri sobre un plato oscuro"
            width={1264}
            height={848}
            sizes="(min-width: 768px) 32rem, 100vw"
            className="md:order-2"
          />
          <div className="revelar flex flex-col gap-4 md:order-1">
            <h2 id="omakase" className="font-display text-3xl sm:text-4xl">
              Omakase: confiá en el itamae
            </h2>
            <p className="max-w-[52ch] text-base">
              No hay carta. El menú sigue lo que trae el mercado cada mañana y se sirve a tu ritmo,
              frente a quien lo prepara. Cada pieza llega a la mesa en el momento justo.
            </p>
            <p className="max-w-[52ch] text-base text-muted-foreground">
              Avisanos al reservar si hay alguna restricción alimentaria y la tenemos en cuenta.
            </p>
          </div>
        </div>

        <div className="revelar relative pt-6">
          <div aria-hidden="true" className="absolute left-0 right-0 top-0 h-2 rounded-sm bg-madera" />
          <ol className="flex items-start justify-between gap-2 sm:justify-around sm:gap-4">
            {TIEMPOS.map((tiempo) => (
              <li key={tiempo.titulo}>
                <TablillaPaso titulo={tiempo.titulo} japones={tiempo.japones} detalle={tiempo.detalle} />
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* La sala: una imagen grande, una chica y un texto breve. */}
      <section aria-labelledby="sala" className="grid items-end gap-8 md:grid-cols-12">
        <MarcoFoto
          src="/ichigo/tablillas.webp"
          alt="Tablillas de madera clara colgadas de una viga oscura, sin escritura"
          width={1264}
          height={848}
          sizes="(min-width: 768px) 38rem, 100vw"
          className="md:col-span-7"
        />
        <div className="revelar flex flex-col gap-4 md:col-span-5">
          <MarcoFoto
            src="/ichigo/sake.webp"
            alt="Una botella y una taza de cerámica sobre una bandeja de madera, con una ramita de pasto seco"
            width={1024}
            height={1024}
            sizes="(min-width: 768px) 14rem, 60vw"
            className="w-2/3"
          />
          <h2 id="sala" className="font-display text-3xl sm:text-4xl">
            Una sala en silencio
          </h2>
          <p className="max-w-[44ch] text-base">
            Madera clara, cerámica hecha a mano y luz baja. Elegís entre la sala principal y la
            sala VIP al reservar.
          </p>
        </div>
      </section>

      {/* Cómo reservar: una lista simple. */}
      <section aria-labelledby="como-reservar" className="revelar grid gap-6 md:grid-cols-12">
        <h2 id="como-reservar" className="font-display text-3xl sm:text-4xl md:col-span-5">
          Así se reserva
        </h2>
        <ol className="flex flex-col divide-y divide-border border-y border-border md:col-span-7">
          {PASOS.map((paso, indice) => (
            <li key={paso} className="flex gap-4 py-4">
              <span className="tabular font-display text-2xl text-accent">{indice + 1}</span>
              <span className="text-base">{paso}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Cierre: la madera oscura de la viga, con la acción. */}
      <section className="revelar flex flex-col items-start gap-6 rounded-sm bg-madera px-6 py-12 text-madera-foreground sm:px-12">
        <p className="max-w-[24ch] font-display text-3xl leading-snug sm:text-4xl">
          Hay una tablilla esperando tu turno.
        </p>
        <Link
          href="/reservas/nueva"
          className="inline-flex min-h-14 w-full items-center justify-center rounded-md bg-card px-6 text-lg font-medium tracking-wide text-card-foreground transition-colors duration-200 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-card focus-visible:ring-offset-2 focus-visible:ring-offset-madera sm:w-auto"
        >
          Elegir fecha y turno
        </Link>
      </section>
    </div>
  );
}
