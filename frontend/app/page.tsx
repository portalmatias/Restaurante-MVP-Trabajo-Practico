import Link from "next/link";
import { buttonVariants } from "../src/components/ui/button";
import { Card } from "../src/components/ui/card";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center gap-8 px-4 py-10 sm:py-16">
      <div className="flex max-w-2xl flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Reservá tu mesa en minutos
        </h1>
        <p className="text-base text-muted-foreground">
          Consultá disponibilidad y reservá sin necesidad de crear una cuenta.
        </p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <Link href="/reservas" className={buttonVariants({ variant: "primary" })}>
          Reservar una mesa
        </Link>
      </div>
      <Card title="Cómo funciona" className="w-full max-w-2xl">
        <ol className="flex flex-col gap-2 text-sm text-card-foreground">
          <li>1. Elegí fecha, turno y cantidad de comensales.</li>
          <li>2. Confirmá tus datos de contacto.</li>
          <li>3. Recibí un código para consultar o cancelar tu reserva.</li>
        </ol>
      </Card>
    </div>
  );
}
