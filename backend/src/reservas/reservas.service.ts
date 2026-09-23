import { randomInt } from 'node:crypto';

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoReserva, Prisma } from '@prisma/client';

import { bloquearTurnoFecha } from '../disponibilidad/contexto/bloquear-turno-fecha';
import { cargarContexto } from '../disponibilidad/contexto/cargar-contexto';
import { evaluarReglas } from '../disponibilidad/reglas/evaluar-reglas';
import {
  CodigoMotivo,
  MotivoNoDisponible,
  SolicitudDisponibilidad,
} from '../disponibilidad/reglas/tipos';
import { PrismaService } from '../prisma/prisma.service';
import { elegirMesaBestFit } from './elegir-mesa-best-fit';

const CODIGO_RESERVA_LONGITUD = 8;
// Sin caracteres ambiguos (0/O, 1/I/L) para que sea legible por teléfono/email.
const CODIGO_RESERVA_ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODIGO_RESERVA_MAX_INTENTOS = 5;

/**
 * Nombre real del índice único parcial `(mesaId, turnoId, fecha)` (invariante 1), tal como lo
 * generó la migración editada a mano de #12
 * (`backend/prisma/migrations/20260914234727_init_modelo_dominio/migration.sql`):
 * `Reserva_mesaId_turnoId_fecha_key`. El design.md de este change (Trampas) anotaba como
 * hipótesis el nombre `reserva_mesa_turno_fecha_activa_key`, que no es el real — se corrige
 * acá con el nombre que efectivamente usa la base (verificado con el test de P2002 de 4.2).
 */
const INDICE_MESA_TURNO_FECHA_ACTIVA = 'Reserva_mesaId_turnoId_fecha_key';

/** Transiciones válidas de `EstadoReserva` (config.yaml §6, invariante 5). */
const TRANSICIONES_VALIDAS: Record<EstadoReserva, EstadoReserva[]> = {
  PENDIENTE: ['CONFIRMADA', 'CANCELADA'],
  CONFIRMADA: ['CANCELADA', 'NO_SHOW'],
  CANCELADA: [],
  NO_SHOW: [],
};

export interface CrearReservaInput {
  turnoId: string;
  /** Zona pedida por el cliente. La mesa la elige el service (best fit, D3): no llega en el input. */
  zonaId: string;
  fecha: Date;
  comensales: number;
  nombreCliente: string;
  emailCliente: string;
  telefonoCliente: string;
}

/** Cuerpo `409` fijo de D8/D9: `motivos` vacío significa choque de concurrencia, no regla. */
function rechazoDeReserva(message: string, motivos: MotivoNoDisponible[]) {
  return new ConflictException({
    statusCode: 409,
    message,
    error: 'Conflict',
    motivos,
  });
}

/**
 * Crea reservas sobre el validador compartido de `disponibilidad` (design.md D1 de
 * `reservas-crear`): no reimplementa ninguna regla de negocio, solo orquesta
 * `bloquearTurnoFecha`, `cargarContexto` y `evaluarReglas` dentro de una transacción, y elige
 * la mesa con `elegirMesaBestFit`. También es el único punto que escribe `estado`
 * (`transicionarEstado`, sin cambios de este change).
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

  /** `true` si `error` es un `P2002` cuyo `target` incluye alguno de `campos` (nombre de
   * columna o, si Prisma no lo resolvió, nombre del índice — ver Trampas). */
  private esColisionDeCampo(error: unknown, ...campos: string[]): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return false;
    }
    const target = error.meta?.target as string[] | string | undefined;
    const targets = Array.isArray(target)
      ? target
      : typeof target === 'string'
        ? [target]
        : [];
    return campos.some((campo) => targets.includes(campo));
  }

  /**
   * Crea una Reserva evaluando, dentro de una única transacción de Prisma, las mismas ocho
   * reglas que `GET /disponibilidad` (design.md D1). Flujo, en `READ COMMITTED` —el
   * aislamiento por defecto de Postgres, sin `isolationLevel` (D2)—:
   *
   *   1. `bloquearTurnoFecha` como primera sentencia: toma el lock advisory de
   *      `(turnoId, fecha)` antes de leer nada, para que la lectura de ocupación de abajo ya
   *      vea lo que confirmó quien tenía el lock antes (D2).
   *   2. `cargarContexto`, único acceso a la base para turno/zona/ocupación/mesas libres;
   *      lanza `NotFoundException` si el turno o la zona no existen.
   *   3. `evaluarReglas` con el reloj real tomado DESPUÉS de obtener el lock: si informa
   *      motivos, `409` con todos ellos (D8) y no se persiste nada.
   *   4. `elegirMesaBestFit` sobre `contexto.mesasLibres` (D3).
   *   5. Estado inicial según `contexto.zona.requiereConfirmacionAdmin`, no según el nombre
   *      de la zona (D4).
   *   6. `INSERT` dentro de un `SAVEPOINT`, con el generador y el reintento de código de #12
   *      ante colisión de `codigoReserva` (D5).
   *
   * Los choques de escritura (`P2002` sobre la mesa, códigos agotados) y los `P2028`/`P2024`
   * de la transacción se traducen a `409` en vez de propagarse como `500` (D9).
   */
  async crearReserva(input: CrearReservaInput) {
    return this.prisma
      .$transaction(async (tx) => {
        await bloquearTurnoFecha(tx, input.turnoId, input.fecha);

        const solicitud: SolicitudDisponibilidad = {
          fecha: input.fecha,
          turnoId: input.turnoId,
          zonaId: input.zonaId,
          comensales: input.comensales,
        };
        const contexto = await cargarContexto(tx, solicitud);

        // El reloj se inyecta acá, después del lock: una creación que esperó evalúa la
        // anticipación con la hora real en que decide, no con la hora de entrada (D1).
        const motivos = evaluarReglas(contexto, solicitud, new Date());
        if (motivos.length > 0) {
          throw rechazoDeReserva('No se pudo crear la reserva', motivos);
        }

        const mesa = elegirMesaBestFit(contexto.mesasLibres, input.comensales);
        if (!mesa) {
          // No debería pasar nunca: evaluarReglas ya habría informado SIN_MESA_DISPONIBLE
          // con la misma lista de mesasLibres (design.md D1). Si igual pasa, es un bug
          // interno y no un 409 de negocio.
          throw new Error(
            'elegirMesaBestFit no encontró mesa pese a que evaluarReglas no informó motivos.',
          );
        }

        const estadoInicial: EstadoReserva = contexto.zona
          .requiereConfirmacionAdmin
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
          // seguir usando la MISMA transacción (el lock y el contexto ya evaluado deben
          // quedar atómicos con el `create`), cada intento corre dentro de su propio
          // SAVEPOINT: si falla, se hace ROLLBACK TO SAVEPOINT y la transacción queda
          // utilizable para el siguiente intento.
          await tx.$executeRawUnsafe('SAVEPOINT intento_codigo_reserva');
          try {
            const reserva = await tx.reserva.create({
              data: {
                mesaId: mesa.id,
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
            if (
              this.esColisionDeCampo(
                error,
                'mesaId',
                INDICE_MESA_TURNO_FECHA_ACTIVA,
              )
            ) {
              // Con el lock tomado como primera sentencia esto no debería ocurrir: solo
              // aparece si otra escritura saltea `bloquearTurnoFecha`. Se traduce igual,
              // como defensa — el índice parcial es la garantía de base del invariante 1
              // (D9).
              throw rechazoDeReserva(
                'Ya existe una reserva activa para esa mesa, ese turno y esa fecha.',
                [
                  {
                    codigo: CodigoMotivo.SIN_MESA_DISPONIBLE,
                    mensaje: `No queda una mesa libre en la zona ${contexto.zona.nombre} para ${input.comensales} comensales.`,
                  },
                ],
              );
            }
            throw error;
          }
        }

        // Agotar los intentos es prácticamente imposible (D5): 409 sin motivos, no 500.
        throw rechazoDeReserva(
          'No se pudo generar un código de reserva único luego de varios intentos. Volvé a intentarlo.',
          [],
        );
      })
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2028' || error.code === 'P2024')
        ) {
          // P2028: timeout de la transacción interactiva (incluye la espera por el lock,
          // design.md → Trampas). P2024: sin conexión libre en el pool. Ninguno de los dos
          // es un error del servidor: "había demasiada gente reservando a la vez" (D9).
          throw rechazoDeReserva(
            'Hay muchas reservas en curso para ese turno y esa fecha. Intentá de nuevo en unos segundos.',
            [],
          );
        }
        throw error;
      });
  }

  /**
   * Único método autorizado a escribir el campo `estado` de una Reserva (design.md,
   * invariante 5). Valida la transición contra `TRANSICIONES_VALIDAS` antes de escribir;
   * ningún otro punto del código debe hacer `reserva.update({ data: { estado } })`.
   *
   * Corre en Read Committed (el nivel default): leer el estado, validarlo y recién después
   * escribir por `id` deja una ventana entre la lectura y la escritura. Si dos transiciones
   * concurrentes parten del mismo estado (por ejemplo, cliente cancela y admin confirma una
   * misma reserva PENDIENTE al mismo tiempo), las dos pasan la validación y gana la última
   * escritura, rompiendo el invariante 5. Para evitarlo, el `update` se condiciona con
   * `updateMany({ where: { id, estado: <el que se validó> } })`: si otra transacción ya
   * cambió el estado entremedio, `count` da 0 y se responde 409 en vez de pisar el estado.
   */
  async transicionarEstado(reservaId: string, nuevoEstado: EstadoReserva) {
    return this.prisma.$transaction(async (tx) => {
      const reserva = await tx.reserva.findUnique({ where: { id: reservaId } });
      if (!reserva) {
        throw new NotFoundException('La reserva indicada no existe.');
      }

      const permitidas = TRANSICIONES_VALIDAS[reserva.estado];
      if (!permitidas.includes(nuevoEstado)) {
        throw new ConflictException(
          `No se puede transicionar una reserva de ${reserva.estado} a ${nuevoEstado}.`,
        );
      }

      const resultado = await tx.reserva.updateMany({
        where: { id: reservaId, estado: reserva.estado },
        data: { estado: nuevoEstado },
      });
      if (resultado.count !== 1) {
        throw new ConflictException(
          'La reserva cambió de estado antes de poder confirmar esta transición. Volvé a intentarlo.',
        );
      }

      return tx.reserva.findUniqueOrThrow({ where: { id: reservaId } });
    });
  }
}
