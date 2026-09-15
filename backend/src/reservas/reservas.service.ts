import { randomInt } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { DiaSemana, EstadoReserva, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { diaSemanaDeFecha } from '../common/timezone';

const CODIGO_RESERVA_LONGITUD = 8;
// Sin caracteres ambiguos (0/O, 1/I/L) para que sea legible por teléfono/email.
const CODIGO_RESERVA_ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODIGO_RESERVA_MAX_INTENTOS = 5;
const SERIALIZACION_MAX_INTENTOS = 3;

/** Transiciones válidas de `EstadoReserva` (config.yaml §6, invariante 5). */
const TRANSICIONES_VALIDAS: Record<EstadoReserva, EstadoReserva[]> = {
  PENDIENTE: ['CONFIRMADA', 'CANCELADA'],
  CONFIRMADA: ['CANCELADA', 'NO_SHOW'],
  CANCELADA: [],
  NO_SHOW: [],
};

export interface CrearReservaInput {
  /** Mesa ya elegida. La asignación automática (best fit) es de la capability `reservas-crear`. */
  mesaId: string;
  turnoId: string;
  /** Zona que el cliente solicitó — debe coincidir con la zona real de `mesaId` (invariante 3). */
  zonaSolicitadaId: string;
  fecha: Date;
  comensales: number;
  nombreCliente: string;
  emailCliente: string;
  telefonoCliente: string;
}

/**
 * Contiene la lógica de negocio de Reserva que este change (`modelo-dominio`) necesita para
 * poder probar los cinco invariantes de config.yaml §6 contra datos reales. No define DTOs,
 * controllers ni el algoritmo de asignación automática de mesa — eso es alcance de las
 * capabilities `reservas-crear` / `cancelacion-turnos` / `reserva-vip` (ver design.md →
 * Non-Goals).
 */
@Injectable()
export class ReservasService {
  constructor(private readonly prisma: PrismaService) {}

  private generarCodigoReserva(): string {
    let codigo = '';
    for (let i = 0; i < CODIGO_RESERVA_LONGITUD; i++) {
      codigo +=
        CODIGO_RESERVA_ALFABETO[randomInt(CODIGO_RESERVA_ALFABETO.length)];
    }
    return codigo;
  }

  private esColisionDeCampo(error: unknown, campo: string): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return false;
    }
    const target = error.meta?.target as string[] | string | undefined;
    if (Array.isArray(target)) return target.includes(campo);
    return typeof target === 'string' && target.includes(campo);
  }

  /**
   * Crea una Reserva validando, dentro de una única transacción Prisma, los invariantes 2
   * (capacidad de mesa), 3 (turno activo y mesa de la zona solicitada) y 4 (aforo de zona y
   * aforo global) — ver design.md → "Invariantes 2, 3 y 4 → validación de servicio". El
   * invariante 1 (exclusividad mesa+turno+fecha) lo hace cumplir el índice único parcial de
   * la base; acá se traduce el `P2002` de Prisma a un `409 Conflict` legible en vez de
   * propagarlo crudo.
   *
   * Corre con aislamiento `Serializable`: bajo el default de Postgres (Read Committed), dos
   * transacciones concurrentes que reservan mesas distintas de la misma zona pueden leer el
   * mismo agregado de aforo, pasar ambas la validación, e insertar ambas — violando el
   * invariante de aforo bajo concurrencia real. `Serializable` hace que Postgres aborte una
   * de las dos con un error de serialización (P2034); ante eso, se reintenta la transacción
   * completa desde cero (no solo el insert) hasta `SERIALIZACION_MAX_INTENTOS` veces.
   */
  async crearReserva(input: CrearReservaInput) {
    if (input.comensales <= 0) {
      throw new BadRequestException(
        'La cantidad de comensales debe ser mayor a cero.',
      );
    }

    for (
      let intentoSerializacion = 0;
      intentoSerializacion < SERIALIZACION_MAX_INTENTOS;
      intentoSerializacion++
    ) {
      try {
        return await this.ejecutarCreacionReserva(input);
      } catch (error) {
        const esConflictoDeSerializacion =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';
        const quedanIntentos =
          intentoSerializacion < SERIALIZACION_MAX_INTENTOS - 1;
        if (esConflictoDeSerializacion && quedanIntentos) {
          continue;
        }
        throw error;
      }
    }
    // Inalcanzable en la práctica (el loop siempre retorna o lanza), pero TypeScript
    // exige que la función tenga un camino de retorno explícito al final.
    throw new ConflictException(
      'No se pudo completar la reserva tras varios reintentos por conflictos de concurrencia.',
    );
  }

  private async ejecutarCreacionReserva(input: CrearReservaInput) {
    return this.prisma.$transaction(
      async (tx) => {
        const mesa = await tx.mesa.findUnique({ where: { id: input.mesaId } });
        if (!mesa) {
          throw new BadRequestException('La mesa indicada no existe.');
        }

        const turno = await tx.turno.findUnique({
          where: { id: input.turnoId },
        });
        if (!turno) {
          throw new BadRequestException('El turno indicado no existe.');
        }

        // Invariante 3 (parte 1): el turno debe estar activo.
        if (!turno.activo) {
          throw new ConflictException('El turno solicitado no está activo.');
        }

        // Invariante 3 (parte 2): la mesa debe pertenecer a la zona solicitada.
        if (mesa.zonaId !== input.zonaSolicitadaId) {
          throw new ConflictException(
            'La mesa elegida no pertenece a la zona solicitada.',
          );
        }

        // Invariante 3 (parte 3): el día de la semana de la fecha debe coincidir con el
        // diaSemana del turno. Usamos getUTCDay() (via diaSemanaDeFecha) porque
        // Reserva.fecha es @db.Date (fecha calendario pura sin zona horaria).
        const diaSemanaFecha = diaSemanaDeFecha(input.fecha);
        const diaSemanaTurnoNumero: Record<DiaSemana, number> = {
          DOMINGO: 0,
          LUNES: 1,
          MARTES: 2,
          MIERCOLES: 3,
          JUEVES: 4,
          VIERNES: 5,
          SABADO: 6,
        };
        if (diaSemanaFecha !== diaSemanaTurnoNumero[turno.diaSemana]) {
          throw new ConflictException(
            'La fecha de la reserva no coincide con el día de la semana del turno seleccionado.',
          );
        }

        // Invariante 2: los comensales no pueden superar la capacidad de la mesa.
        if (input.comensales > mesa.capacidad) {
          throw new ConflictException(
            'La cantidad de comensales supera la capacidad de la mesa asignada.',
          );
        }

        const zona = await tx.zona.findUnique({
          where: { id: input.zonaSolicitadaId },
        });
        if (!zona) {
          throw new BadRequestException('La zona indicada no existe.');
        }

        // Invariante 4: la suma de comensales activos del turno/fecha en la zona no puede
        // superar el aforo configurado, aunque la mesa esté físicamente libre.
        const agregado = await tx.reserva.aggregate({
          where: {
            turnoId: input.turnoId,
            fecha: input.fecha,
            estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
            mesa: { zonaId: input.zonaSolicitadaId },
          },
          _sum: { comensales: true },
        });
        const comensalesActivos = agregado._sum.comensales ?? 0;
        if (comensalesActivos + input.comensales > zona.aforoMaximo) {
          throw new ConflictException(
            'La reserva excede el aforo restante de la zona para ese turno y esa fecha.',
          );
        }

        // Invariante adicional: la suma de comensales activos de TODAS las zonas para ese
        // turno/fecha no puede superar el aforo global — independiente de que el aforo de la
        // zona solicitada, mirado en aislamiento, todavía alcance.
        const configuracion = await tx.configuracionNegocio.findUnique({
          where: { id: 1 },
        });
        if (!configuracion) {
          throw new ConflictException(
            'No hay configuración de negocio cargada para validar el aforo global.',
          );
        }
        const agregadoGlobal = await tx.reserva.aggregate({
          where: {
            turnoId: input.turnoId,
            fecha: input.fecha,
            estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
          },
          _sum: { comensales: true },
        });
        const comensalesActivosGlobal = agregadoGlobal._sum.comensales ?? 0;
        if (
          comensalesActivosGlobal + input.comensales >
          configuracion.aforoGlobal
        ) {
          throw new ConflictException(
            'La reserva excede el aforo global restante para ese turno y esa fecha.',
          );
        }

        const estadoInicial: EstadoReserva = zona.requiereConfirmacionAdmin
          ? 'PENDIENTE'
          : 'CONFIRMADA';

        for (
          let intento = 0;
          intento < CODIGO_RESERVA_MAX_INTENTOS;
          intento++
        ) {
          const codigoReserva = this.generarCodigoReserva();
          // Postgres aborta el resto de la transacción en curso apenas una sentencia falla
          // por violar un constraint. Como el reintento por colisión de código necesita
          // seguir usando la MISMA transacción (las validaciones de arriba deben quedar
          // atómicas con el `create`, invariante 4 incluido), cada intento corre dentro de
          // su propio SAVEPOINT: si falla, se hace ROLLBACK TO SAVEPOINT y la transacción
          // queda utilizable para el siguiente intento.
          await tx.$executeRawUnsafe('SAVEPOINT intento_codigo_reserva');
          try {
            const reserva = await tx.reserva.create({
              data: {
                mesaId: input.mesaId,
                turnoId: input.turnoId,
                fecha: input.fecha,
                comensales: input.comensales,
                estado: estadoInicial,
                nombreCliente: input.nombreCliente,
                emailCliente: input.emailCliente,
                telefonoCliente: input.telefonoCliente,
                codigoReserva,
              },
            });
            await tx.$executeRawUnsafe(
              'RELEASE SAVEPOINT intento_codigo_reserva',
            );
            return reserva;
          } catch (error) {
            await tx.$executeRawUnsafe(
              'ROLLBACK TO SAVEPOINT intento_codigo_reserva',
            );
            if (this.esColisionDeCampo(error, 'codigoReserva')) {
              // Colisión de código de reserva (invariante de unicidad, no de negocio):
              // reintentar con un código nuevo en vez de romper la creación.
              continue;
            }
            if (this.esColisionDeCampo(error, 'mesaId')) {
              // Índice único parcial de (mesaId, turnoId, fecha) — invariante 1.
              throw new ConflictException(
                'Ya existe una reserva activa para esa mesa, ese turno y esa fecha.',
              );
            }
            throw error;
          }
        }

        throw new ConflictException(
          'No se pudo generar un código de reserva único luego de varios intentos.',
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Único método autorizado a escribir el campo `estado` de una Reserva (design.md,
   * invariante 5). Valida la transición contra `TRANSICIONES_VALIDAS` antes de escribir;
   * ningún otro punto del código debe hacer `reserva.update({ data: { estado } })`.
   */
  async transicionarEstado(reservaId: string, nuevoEstado: EstadoReserva) {
    return this.prisma.$transaction(async (tx) => {
      const reserva = await tx.reserva.findUnique({ where: { id: reservaId } });
      if (!reserva) {
        throw new BadRequestException('La reserva indicada no existe.');
      }

      const permitidas = TRANSICIONES_VALIDAS[reserva.estado];
      if (!permitidas.includes(nuevoEstado)) {
        throw new ConflictException(
          `No se puede transicionar una reserva de ${reserva.estado} a ${nuevoEstado}.`,
        );
      }

      return tx.reserva.update({
        where: { id: reservaId },
        data: { estado: nuevoEstado },
      });
    });
  }
}
