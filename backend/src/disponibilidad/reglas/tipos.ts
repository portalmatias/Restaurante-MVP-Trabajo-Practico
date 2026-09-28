import { Mesa, Turno, Zona } from '@prisma/client';

/**
 * Códigos de las ocho reglas de disponibilidad. El orden de declaración ES el orden fijo en
 * que `evaluarReglas` las evalúa y las informa (spec.md → "Evaluación de todas las reglas en
 * orden fijo"). Los valores son strings iguales al nombre para que el enum se pueda publicar
 * en OpenAPI con `enumName: 'CodigoMotivo'`.
 */
export enum CodigoMotivo {
  TURNO_INACTIVO = 'TURNO_INACTIVO',
  TURNO_NO_CORRESPONDE_A_FECHA = 'TURNO_NO_CORRESPONDE_A_FECHA',
  ANTICIPACION_MINIMA = 'ANTICIPACION_MINIMA',
  ANTICIPACION_MAXIMA = 'ANTICIPACION_MAXIMA',
  COMENSALES_FUERA_DE_RANGO = 'COMENSALES_FUERA_DE_RANGO',
  AFORO_ZONA = 'AFORO_ZONA',
  AFORO_GLOBAL = 'AFORO_GLOBAL',
  SIN_MESA_DISPONIBLE = 'SIN_MESA_DISPONIBLE',
}

/** Una regla que impide la reserva pedida. `mensaje` es para personas, no para lógica. */
export interface MotivoNoDisponible {
  codigo: CodigoMotivo;
  mensaje: string;
}

/**
 * Lo que se pide evaluar: una única combinación de fecha, turno, zona y comensales.
 */
export interface SolicitudDisponibilidad {
  /** Fecha de calendario local, construida con `Date.UTC(y, m - 1, d)` como `@db.Date` (D4). */
  fecha: Date;
  turnoId: string;
  zonaId: string;
  comensales: number;
}

/**
 * Datos planos que `cargarContexto` lee de la base para una solicitud (design.md D1). Las
 * reglas trabajan solo sobre esto: no consultan la base ni leen el reloj.
 */
export interface ContextoReserva {
  turno: Pick<Turno, 'activo' | 'diaSemana' | 'horaInicio'>;
  /**
   * `nombre` se usa solo para armar los mensajes ("En la zona VIP...").
   * `requiereConfirmacionAdmin` no lo usa ninguna regla: está para que `reservas-crear` decida
   * el estado inicial con el mismo contexto.
   */
  zona: Pick<
    Zona,
    | 'nombre'
    | 'minComensales'
    | 'maxComensales'
    | 'anticipacionMinHoras'
    | 'anticipacionMaxDias'
    | 'aforoMaximo'
    | 'requiereConfirmacionAdmin'
  >;
  /** `ConfiguracionNegocio.aforoGlobal`. */
  aforoGlobal: number;
  /** Comensales de reservas PENDIENTE o CONFIRMADA de la zona para ese turno y esa fecha. */
  ocupadosZona: number;
  /** Comensales de reservas PENDIENTE o CONFIRMADA de todas las zonas para ese turno y esa fecha. */
  ocupadosGlobal: number;
  /**
   * Mesas de la zona sin reserva PENDIENTE o CONFIRMADA en ese turno y esa fecha. Las reglas
   * solo miran `capacidad`; `id` y `etiqueta` son para que `reservas-crear` asigne la mesa.
   */
  mesasLibres: Pick<Mesa, 'id' | 'etiqueta' | 'capacidad'>[];
}

/**
 * Valores del enum `DiaSemana` de Prisma indexados como `getUTCDay()`: empieza en `DOMINGO`
 * para que `DIAS[diaSemanaDeFecha(fecha)]` dé el día del turno (design.md → Trampas de fechas).
 */
export const DIAS = [
  'DOMINGO',
  'LUNES',
  'MARTES',
  'MIERCOLES',
  'JUEVES',
  'VIERNES',
  'SABADO',
] as const;
