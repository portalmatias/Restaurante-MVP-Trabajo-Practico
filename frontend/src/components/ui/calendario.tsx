'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { diaSemanaDeFechaLocal, type DiaSemana } from '../../lib/fecha-hora';

// Cálculo con Date.UTC y getUTC* (config.yaml §7): el resultado no depende del huso del dispositivo.

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

const DIAS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const;

// La semana empieza el lunes. El kanji es solo decoración (`aria-hidden`).
const ENCABEZADOS = [
  { abreviatura: 'lun', nombre: 'lunes', kanji: '月' },
  { abreviatura: 'mar', nombre: 'martes', kanji: '火' },
  { abreviatura: 'mié', nombre: 'miércoles', kanji: '水' },
  { abreviatura: 'jue', nombre: 'jueves', kanji: '木' },
  { abreviatura: 'vie', nombre: 'viernes', kanji: '金' },
  { abreviatura: 'sáb', nombre: 'sábado', kanji: '土' },
  { abreviatura: 'dom', nombre: 'domingo', kanji: '日' },
] as const;

function dosDigitos(numero: number): string {
  return String(numero).padStart(2, '0');
}

function aIso(anio: number, mes0: number, dia: number): string {
  return `${anio}-${dosDigitos(mes0 + 1)}-${dosDigitos(dia)}`;
}

function partes(iso: string): { anio: number; mes0: number; dia: number } {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return { anio, mes0: mes - 1, dia };
}

export function sumarDias(iso: string, dias: number): string {
  const { anio, mes0, dia } = partes(iso);
  const fecha = new Date(Date.UTC(anio, mes0, dia + dias));
  return aIso(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
}

/** Suma meses conservando el día, o el último del mes si ese día no existe (31 → 30). */
function sumarMeses(iso: string, meses: number): string {
  const { anio, mes0, dia } = partes(iso);
  const primero = new Date(Date.UTC(anio, mes0 + meses, 1));
  const ultimoDia = new Date(
    Date.UTC(primero.getUTCFullYear(), primero.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return aIso(
    primero.getUTCFullYear(),
    primero.getUTCMonth(),
    Math.min(dia, ultimoDia),
  );
}

/** Posición en la semana con el lunes en 0 y el domingo en 6. */
function indiceSemana(iso: string): number {
  const { anio, mes0, dia } = partes(iso);
  return (new Date(Date.UTC(anio, mes0, dia)).getUTCDay() + 6) % 7;
}

/** «sábado 19 de septiembre de 2026»: el nombre accesible de cada día. */
export function nombreLargoDeFecha(iso: string): string {
  const { anio, mes0, dia } = partes(iso);
  const diaSemana = DIAS[new Date(Date.UTC(anio, mes0, dia)).getUTCDay()];
  return `${diaSemana} ${dia} de ${MESES[mes0]} de ${anio}`;
}

export type CalendarioProps = {
  /** Fecha elegida (`YYYY-MM-DD`) o cadena vacía. */
  value: string;
  /** Fecha de hoy (`YYYY-MM-DD`, calendario del restaurante): lo anterior no se puede elegir. */
  hoy: string;
  /** Último día elegible (`YYYY-MM-DD`). Sin él, el calendario avanza hasta 12 meses. */
  hasta?: string;
  /** Días de la semana con al menos un turno: los demás se muestran cerrados. */
  diasConTurnos: ReadonlySet<DiaSemana>;
  onChange: (fecha: string) => void;
  className?: string;
};

/**
 * Calendario mensual siempre visible para elegir la fecha de la reserva (reemplaza al campo
 * `type="date"`). Es una ayuda de navegación: la validación real de la fecha la hace el servidor.
 *
 * Accesibilidad: cada día es un botón con su nombre completo («sábado 19 de septiembre de 2026»);
 * un solo día entra con Tab (tabulación móvil) y las flechas, Inicio, Fin, RePág y AvPág mueven
 * el foco. Los días no elegibles quedan con `aria-disabled` (siguen siendo enfocables, para no
 * perder el hilo al navegar con el teclado) y se distinguen también por texto («cerrado» o «no
 * disponible»), no solo por color. El kanji de los días de la semana es decoración.
 */
export function Calendario({
  value,
  hoy,
  hasta,
  diasConTurnos,
  onChange,
  className,
}: CalendarioProps) {
  const limite = hasta ?? sumarMeses(hoy, 12);
  const inicial = value !== '' ? value : hoy;
  const [visible, setVisible] = useState(() => {
    const { anio, mes0 } = partes(inicial);
    return { anio, mes0 };
  });
  const [foco, setFoco] = useState(inicial);
  const raiz = useRef<HTMLDivElement>(null);
  const hayQueEnfocar = useRef(false);

  useEffect(() => {
    if (!hayQueEnfocar.current) return;
    hayQueEnfocar.current = false;
    raiz.current
      ?.querySelector<HTMLButtonElement>(`button[data-fecha="${foco}"]`)
      ?.focus();
  }, [foco, visible]);

  const mesDeHoy = partes(hoy);
  const mesDelLimite = partes(limite);
  const esMesDeHoy =
    visible.anio === mesDeHoy.anio && visible.mes0 === mesDeHoy.mes0;
  const esMesDelLimite =
    visible.anio === mesDelLimite.anio && visible.mes0 === mesDelLimite.mes0;

  function estado(iso: string): 'elegible' | 'pasado' | 'cerrado' | 'lejano' {
    if (iso < hoy) return 'pasado';
    if (iso > limite) return 'lejano';
    return diasConTurnos.has(diaSemanaDeFechaLocal(iso))
      ? 'elegible'
      : 'cerrado';
  }

  function irAlMes(anio: number, mes0: number) {
    const primero = new Date(Date.UTC(anio, mes0, 1));
    setVisible({ anio: primero.getUTCFullYear(), mes0: primero.getUTCMonth() });
  }

  function cambiarMes(delta: number) {
    const destino = new Date(Date.UTC(visible.anio, visible.mes0 + delta, 1));
    irAlMes(destino.getUTCFullYear(), destino.getUTCMonth());
    // El día enfocado acompaña al mes: queda en el primer día elegible o en el primero del mes.
    const primero = aIso(destino.getUTCFullYear(), destino.getUTCMonth(), 1);
    setFoco(primero < hoy ? hoy : primero);
  }

  function moverFoco(destino: string) {
    if (destino < hoy || destino > limite) return;
    const { anio, mes0 } = partes(destino);
    irAlMes(anio, mes0);
    setFoco(destino);
    hayQueEnfocar.current = true;
  }

  function alTeclear(evento: KeyboardEvent<HTMLButtonElement>, iso: string) {
    const movimientos: Record<string, string> = {
      ArrowLeft: sumarDias(iso, -1),
      ArrowRight: sumarDias(iso, 1),
      ArrowUp: sumarDias(iso, -7),
      ArrowDown: sumarDias(iso, 7),
      Home: sumarDias(iso, -indiceSemana(iso)),
      End: sumarDias(iso, 6 - indiceSemana(iso)),
      PageUp: sumarMeses(iso, -1),
      PageDown: sumarMeses(iso, 1),
    };
    const destino = movimientos[evento.key];
    if (destino === undefined) return;
    evento.preventDefault();
    moverFoco(destino);
  }

  const primerDia = aIso(visible.anio, visible.mes0, 1);
  const diasDelMes = new Date(
    Date.UTC(visible.anio, visible.mes0 + 1, 0),
  ).getUTCDate();
  const huecos = indiceSemana(primerDia);
  const celdas: Array<string | null> = [
    ...Array.from({ length: huecos }, () => null),
    ...Array.from({ length: diasDelMes }, (_, indice) =>
      aIso(visible.anio, visible.mes0, indice + 1),
    ),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);
  const semanas = Array.from({ length: celdas.length / 7 }, (_, indice) =>
    celdas.slice(indice * 7, indice * 7 + 7),
  );

  // Si el día enfocado no está en el mes que se ve, la tabulación entra por el primero visible.
  const enfocableVisible =
    partes(foco).anio === visible.anio && partes(foco).mes0 === visible.mes0;
  const diaDeEntrada = enfocableVisible
    ? foco
    : primerDia < hoy
      ? hoy
      : primerDia;

  const botonMes =
    'flex h-11 w-11 items-center justify-center rounded-md text-xl text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

  return (
    <div
      ref={raiz}
      className={[
        'w-full max-w-md rounded-sm border border-border bg-card p-3 text-card-foreground',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Viga de madera de la que cuelga el mes. */}
      <div
        aria-hidden="true"
        className="-mx-3 -mt-3 mb-3 h-2 rounded-t-sm bg-madera"
      />

      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Mes anterior"
          className={botonMes}
          disabled={esMesDeHoy}
          onClick={() => cambiarMes(-1)}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <p
          aria-live="polite"
          className="flex items-baseline gap-2 text-center font-display text-xl"
        >
          <span className="inline-block first-letter:uppercase">{`${MESES[visible.mes0]} de ${visible.anio}`}</span>
          <span
            aria-hidden="true"
            lang="ja"
            className="text-base text-muted-foreground"
          >
            {`${visible.mes0 + 1}月`}
          </span>
        </p>
        <button
          type="button"
          aria-label="Mes siguiente"
          className={botonMes}
          disabled={esMesDelLimite}
          onClick={() => cambiarMes(1)}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">{`Días de ${MESES[visible.mes0]} de ${visible.anio}`}</caption>
        <thead>
          <tr>
            {ENCABEZADOS.map((columna) => (
              <th
                key={columna.nombre}
                scope="col"
                className="pb-1 text-center font-normal"
              >
                <span
                  aria-hidden="true"
                  className="block text-xs text-muted-foreground"
                >
                  {columna.abreviatura}
                </span>
                <span
                  aria-hidden="true"
                  lang="ja"
                  className="block font-display text-sm leading-none"
                >
                  {columna.kanji}
                </span>
                <span className="sr-only">{columna.nombre}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semanas.map((semana) => (
            <tr key={semana.find((celda) => celda !== null) ?? 'vacia'}>
              {semana.map((iso, columna) => {
                if (iso === null) return <td key={`hueco-${columna}`} />;
                const situacion = estado(iso);
                const elegido = iso === value;
                const elegible = situacion === 'elegible';
                const esHoy = iso === hoy;
                const aspecto = elegido
                  ? 'bg-madera text-madera-foreground'
                  : elegible
                    ? 'bg-background text-foreground hover:bg-muted'
                    : 'text-muted-foreground opacity-50';
                return (
                  <td key={iso} className="p-0.5 text-center">
                    <button
                      type="button"
                      data-fecha={iso}
                      aria-pressed={elegible ? elegido : undefined}
                      aria-disabled={elegible ? undefined : true}
                      aria-label={`${nombreLargoDeFecha(iso)}${esHoy ? ', hoy' : ''}${
                        situacion === 'cerrado'
                          ? ', cerrado'
                          : situacion === 'elegible'
                            ? ''
                            : ', no disponible'
                      }`}
                      tabIndex={iso === diaDeEntrada ? 0 : -1}
                      onClick={() => {
                        setFoco(iso);
                        if (elegible) onChange(iso);
                      }}
                      onKeyDown={(evento) => alTeclear(evento, iso)}
                      className={[
                        'tabular relative mx-auto flex h-11 w-full min-w-0 max-w-12 items-center justify-center rounded-sm text-base',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                        elegible
                          ? 'border border-border'
                          : 'cursor-not-allowed border border-transparent',
                        situacion === 'cerrado' ? 'line-through' : '',
                        esHoy && !elegido
                          ? 'font-bold underline decoration-accent decoration-2 underline-offset-4'
                          : '',
                        aspecto,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {Number(iso.slice(8))}
                      {elegido ? (
                        <span
                          aria-hidden="true"
                          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent"
                        />
                      ) : null}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-sm text-muted-foreground">
        Los días tachados están cerrados.
      </p>
    </div>
  );
}
