'use client';

import Link from 'next/link';
import {
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '../ui/alert';
import { Button, buttonVariants } from '../ui/button';
import { Calendario, nombreLargoDeFecha, sumarDias } from '../ui/calendario';
import { Tablilla } from '../ui/tablilla';
import type { components } from '../../lib/api/schema';
import {
  diaSemanaDeFechaLocal,
  formatearHoraTurno,
} from '../../lib/fecha-hora';
import {
  esFechaElegible,
  resolverSeleccionInicial,
  urlConSeleccion,
  type SeleccionCruda,
} from '../../lib/seleccion-reserva';
import { PasosReserva } from './pasos-reserva';

type ZonaPublica = components['schemas']['ZonaPublicaRespuestaDto'];
type TurnoPublico = components['schemas']['TurnoPublicoRespuestaDto'];

export type FormularioSeleccionProps = {
  zonas: ZonaPublica[];
  turnos: TurnoPublico[];
  /** Fecha de hoy (`YYYY-MM-DD`, calendario del restaurante) calculada en el servidor. */
  hoy: string;
  /** Selección previa tal como llega de `searchParams`; lo que no es coherente se ignora. */
  seleccionInicial?: SeleccionCruda;
};

function pluralizar(
  cantidad: number,
  singular: string,
  plural: string,
): string {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`;
}

// "a", "a y b", "a, b y c".
function listar(elementos: string[]): string {
  if (elementos.length <= 1) return elementos.join('');
  return `${elementos.slice(0, -1).join(', ')} y ${elementos[elementos.length - 1]}`;
}

function acotar(valor: number, minimo: number, maximo: number): number {
  return Math.min(Math.max(valor, minimo), maximo);
}

/**
 * Paso 1 del asistente: fecha, turno, zona y comensales (design.md D3 Pantalla 2). Los cuatro
 * datos son obligatorios para continuar; al confirmar arma la URL del resultado con la
 * selección (D1) y navega. Las reglas que aplica acá (turnos del día, rango de comensales, fecha
 * mínima) son ayudas de navegación: la validación real es siempre la del servidor.
 */
export function FormularioSeleccion({
  zonas,
  turnos,
  hoy,
  seleccionInicial = {},
}: FormularioSeleccionProps) {
  const router = useRouter();
  const tituloZonaId = useId();
  const tituloTurnoId = useId();
  const tituloFechaId = useId();
  const opcionesZona = useRef<Array<HTMLButtonElement | null>>([]);
  const [inicial] = useState(() =>
    resolverSeleccionInicial(seleccionInicial, { zonas, turnos, hoy }),
  );
  const [fecha, setFecha] = useState(inicial.fecha ?? '');
  const [turnoId, setTurnoId] = useState(inicial.turnoId ?? '');
  const [zonaId, setZonaId] = useState(inicial.zonaId ?? '');
  const [comensales, setComensales] = useState<number | undefined>(
    inicial.comensales,
  );

  const fechaElegible = esFechaElegible(fecha, hoy);
  const turnosDelDia = fechaElegible
    ? turnos.filter((turno) => turno.diaSemana === diaSemanaDeFechaLocal(fecha))
    : [];
  const turnoElegido = turnosDelDia.find((turno) => turno.id === turnoId);
  // El calendario cierra los días sin turnos y los que quedan más allá de lo que admite cualquier
  // zona. Es una ayuda: la anticipación de cada zona la valida el servidor.
  const diasConTurnos = new Set(turnos.map((turno) => turno.diaSemana));
  const maximoDias = Math.max(
    ...zonas.map((candidata) => candidata.anticipacionMaxDias),
  );
  const ultimaFecha = sumarDias(hoy, maximoDias);
  const zona = zonas.find((candidata) => candidata.id === zonaId);

  const faltantes: string[] = [];
  if (!fechaElegible) faltantes.push('fecha');
  if (!turnoElegido) faltantes.push('turno');
  if (!zona) faltantes.push('zona');
  else if (
    comensales === undefined ||
    comensales < zona.minComensales ||
    comensales > zona.maxComensales
  ) {
    faltantes.push('comensales');
  }

  function cambiarFecha(nuevaFecha: string) {
    setFecha(nuevaFecha);
    // Un turno es de un día de la semana: si la nueva fecha cae en otro, ya no corresponde.
    const turnoActual = turnos.find((turno) => turno.id === turnoId);
    const sigueCorrespondiendo =
      turnoActual !== undefined &&
      esFechaElegible(nuevaFecha, hoy) &&
      turnoActual.diaSemana === diaSemanaDeFechaLocal(nuevaFecha);
    if (!sigueCorrespondiendo) setTurnoId('');
  }

  function elegirZona(nuevaZona: ZonaPublica) {
    setZonaId(nuevaZona.id);
    // Sin cantidad previa parte del mínimo de la zona; con una, se ajusta al rango nuevo.
    setComensales((actual) =>
      actual === undefined
        ? nuevaZona.minComensales
        : acotar(actual, nuevaZona.minComensales, nuevaZona.maxComensales),
    );
  }

  // Grupo de radio: las flechas mueven la selección (con vuelta al extremo) y el foco.
  function moverZona(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const paso =
      evento.key === 'ArrowDown' || evento.key === 'ArrowRight'
        ? 1
        : evento.key === 'ArrowUp' || evento.key === 'ArrowLeft'
          ? -1
          : 0;
    if (paso === 0) return;
    evento.preventDefault();
    const destino = (indice + paso + zonas.length) % zonas.length;
    elegirZona(zonas[destino]);
    opcionesZona.current[destino]?.focus();
  }

  function subirComensales() {
    if (!zona) return;
    setComensales((actual) =>
      actual === undefined
        ? zona.minComensales
        : Math.min(actual + 1, zona.maxComensales),
    );
  }

  function bajarComensales() {
    if (!zona) return;
    setComensales((actual) =>
      actual === undefined ? actual : Math.max(actual - 1, zona.minComensales),
    );
  }

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (
      faltantes.length > 0 ||
      !turnoElegido ||
      !zona ||
      comensales === undefined
    ) {
      return;
    }
    router.push(
      urlConSeleccion('/reservas/nueva/resultado', {
        fecha,
        turnoId: turnoElegido.id,
        zonaId: zona.id,
        comensales,
      }),
    );
  }

  const botonesStepper = buttonVariants({
    variant: 'secondary',
    fullWidth: false,
    className: 'w-11 px-0 text-xl',
  });

  // Sin zonas o sin turnos activos no hay nada que elegir: se explica en vez de mostrar un
  // formulario que no puede completarse.
  if (zonas.length === 0 || turnos.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-3xl font-medium leading-tight sm:text-4xl">
          Todavía no hay lugares para reservar
        </h1>
        <Alert variant="info" className="text-base">
          Por ahora el restaurante no tiene turnos abiertos para reservar. Volvé
          a intentar más tarde.
        </Alert>
        <Link
          href="/reservas"
          className={buttonVariants({ variant: 'secondary', size: 'lg' })}
        >
          Volver
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={alEnviar} noValidate className="flex flex-col gap-6">
      <PasosReserva pasoActual={1} total={3} />
      <h1 className="font-display text-3xl font-medium leading-tight sm:text-4xl">
        ¿Cuándo y para cuántos?
      </h1>

      {/* En pantallas anchas el calendario queda a la izquierda y lo demás a la derecha, para
          que elegir la fecha y ver sus turnos no obligue a bajar. En celular se apilan. */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-12">
        <div
          role="group"
          aria-labelledby={tituloFechaId}
          className="flex flex-col gap-2"
        >
          <span
            id={tituloFechaId}
            className="text-sm font-medium text-foreground"
          >
            Fecha
          </span>
          <Calendario
            value={fecha}
            hoy={hoy}
            hasta={ultimaFecha}
            diasConTurnos={diasConTurnos}
            onChange={cambiarFecha}
          />
          <p aria-live="polite" className="text-base text-muted-foreground">
            {fechaElegible
              ? `Elegiste el ${nombreLargoDeFecha(fecha)}.`
              : 'Elegí un día del calendario.'}
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {fechaElegible && turnosDelDia.length === 0 ? (
            <Alert variant="info" className="text-base">
              No hay turnos disponibles ese día. Elegí otra fecha.
            </Alert>
          ) : (
            <div
              role="group"
              aria-labelledby={tituloTurnoId}
              className="flex flex-col gap-2"
            >
              <span
                id={tituloTurnoId}
                className="text-sm font-medium text-foreground"
              >
                Turno
              </span>
              {!fechaElegible ? (
                <p className="text-base text-muted-foreground">
                  Elegí una fecha para ver los turnos de ese día.
                </p>
              ) : (
                // Cada tablilla lleva su tramo de viga: si los turnos pasan a otra fila, cuelgan igual.
                <div className="flex flex-wrap gap-x-2 gap-y-2">
                  {turnosDelDia.map((turno) => {
                    const horario = `${formatearHoraTurno(turno.horaInicio)} a ${formatearHoraTurno(turno.horaFin)}`;
                    return (
                      <div key={turno.id} className="relative pt-8">
                        <div
                          aria-hidden="true"
                          className="absolute -inset-x-1 top-0 h-2 rounded-sm bg-madera"
                        />
                        <Tablilla
                          titulo={formatearHoraTurno(turno.horaInicio)}
                          japones={
                            parseInt(formatearHoraTurno(turno.horaInicio), 10) <
                            16
                              ? '昼食'
                              : '夕食'
                          }
                          detalle={`a ${formatearHoraTurno(turno.horaFin)}`}
                          estado={
                            turno.id === turnoId
                              ? 'elegida'
                              : turnoId
                                ? 'descartada'
                                : 'libre'
                          }
                          aria-label={horario}
                          onClick={() => setTurnoId(turno.id)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span
              id={tituloZonaId}
              className="text-sm font-medium text-foreground"
            >
              Zona
            </span>
            <div
              role="radiogroup"
              aria-labelledby={tituloZonaId}
              className="flex flex-col gap-3"
            >
              {zonas.map((opcion, indice) => {
                const elegida = opcion.id === zonaId;
                // Roving tabindex: solo la opción elegida (o la primera, si no hay) entra con Tab.
                const enTabulacion = zona ? elegida : indice === 0;
                const borde = elegida
                  ? opcion.requiereConfirmacionAdmin
                    ? 'border-2 border-accent'
                    : 'border-2 border-primary'
                  : 'border border-border';
                return (
                  <button
                    key={opcion.id}
                    ref={(nodo) => {
                      opcionesZona.current[indice] = nodo;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={elegida}
                    tabIndex={enTabulacion ? 0 : -1}
                    onClick={() => elegirZona(opcion)}
                    onKeyDown={(evento) => moverZona(evento, indice)}
                    className={`flex min-h-11 flex-col gap-1 rounded-sm bg-card p-4 text-left text-base text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${borde}`}
                  >
                    <span className="flex items-center justify-between gap-2 font-display text-xl font-medium">
                      {opcion.nombre}
                      {elegida ? (
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-5 w-5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12.5 10 17.5 19 7.5" />
                        </svg>
                      ) : null}
                    </span>
                    <span>{`${opcion.minComensales} a ${opcion.maxComensales} comensales`}</span>
                    <span className="text-muted-foreground">
                      {`Reservá con al menos ${pluralizar(opcion.anticipacionMinHoras, 'hora', 'horas')} de anticipación y hasta ${pluralizar(opcion.anticipacionMaxDias, 'día', 'días')} antes.`}
                    </span>
                    {opcion.requiereConfirmacionAdmin ? (
                      <span className="mt-1 self-start rounded-sm bg-accent px-2 py-1 text-sm font-medium text-accent-foreground">
                        Queda pendiente de confirmación
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            role="group"
            aria-labelledby={`${tituloZonaId}-comensales`}
            className="flex flex-col gap-1.5"
          >
            <span
              id={`${tituloZonaId}-comensales`}
              className="text-sm font-medium text-foreground"
            >
              Comensales
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Menos comensales"
                className={botonesStepper}
                disabled={
                  !zona ||
                  comensales === undefined ||
                  comensales <= zona.minComensales
                }
                onClick={bajarComensales}
              >
                <span aria-hidden="true">−</span>
              </button>
              <output
                aria-label="Cantidad de comensales"
                className="tabular min-w-12 text-center font-display text-3xl font-medium text-foreground"
              >
                {comensales ?? '–'}
              </output>
              <button
                type="button"
                aria-label="Más comensales"
                className={botonesStepper}
                disabled={
                  !zona ||
                  (comensales !== undefined && comensales >= zona.maxComensales)
                }
                onClick={subirComensales}
              >
                <span aria-hidden="true">+</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-border bg-background px-4 py-3 sm:static sm:mx-0 sm:border-t-0 sm:px-0 sm:py-0">
        <Button type="submit" size="lg" disabled={faltantes.length > 0}>
          Ver disponibilidad
        </Button>
        {/* Región siempre montada: así el lector de pantalla anuncia los cambios de la lista. */}
        <p aria-live="polite" className="text-base text-muted-foreground">
          {faltantes.length > 0 ? `Falta elegir: ${listar(faltantes)}` : ''}
        </p>
      </div>
    </form>
  );
}
