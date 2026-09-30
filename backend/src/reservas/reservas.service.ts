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
import {
  fechaCalendarioDesdeIso,
  finTurnoUtc,
  inicioTurnoUtc,
} from '../common/timezone';
import { PrismaService } from '../prisma/prisma.service';
import { elegirMesaBestFit } from './elegir-mesa-best-fit';
import type { ListarReservasDto } from './dto/listar-reservas.dto';
import type { ListadoReservasRespuesta } from './dto/listado-reservas-respuesta.dto';
import type { ReservaConsultadaRespuesta } from './dto/reserva-consultada-respuesta.dto';
import { aReservaAdminRespuesta } from './reserva-admin.mapper';
import {
  aReservaConsultadaRespuesta,
  type ReservaParaConsulta,
} from './reserva-consultada.mapper';
import { reservaNoEncontrada } from './reserva-no-encontrada';

/** `limit`/`offset` por defecto del listado de admin cuando no llegan en la query (D6). */
const LISTADO_LIMIT_DEFAULT = 20;
const LISTADO_OFFSET_DEFAULT = 0;

const MS_POR_HORA = 60 * 60 * 1000;

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
 * Compara dos emails sin distinguir mayúsculas y minúsculas y como texto literal: ningún
 * carácter funciona como comodín. `toLowerCase()` no depende del idioma del proceso (a
 * diferencia de `toLocaleLowerCase()`).
 */
function emailsIguales(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Crea reservas sobre el validador compartido de `disponibilidad` (design.md D1 de
 * `reservas-crear`): no reimplementa ninguna regla de negocio, solo orquesta
 * `bloquearTurnoFecha`, `cargarContexto` y `evaluarReglas` dentro de una transacción, y elige
 * la mesa con `elegirMesaBestFit`. También es el único punto que escribe `estado`
 * (`transicionarEstado`). Además concentra la búsqueda por código + email y la consulta
 * pública mínima (capability `reserva-consultar`, D2 y D3 de su design.md).
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
   *
   * `desdeEstadoEsperado` restringe además el estado de ORIGEN, más allá de lo que ya permite
   * `TRANSICIONES_VALIDAS`. Hace falta porque la tabla es genérica por destino, no por quién
   * llama: `CONFIRMADA → CANCELADA` es una transición válida tanto para `cancelar` (cliente)
   * como, en teoría, para `rechazar` (admin), pero `rechazar` solo debe aceptar Reservas
   * `PENDIENTE` (spec de `reserva-vip`: "Rechazo bloqueado si la Reserva no está pendiente").
   * Sin este chequeo, una Reserva que pasó de `PENDIENTE` a `CONFIRMADA` justo antes de que
   * `rechazar` leyera su estado (dentro de esta misma transacción, así que no hay ventana
   * adicional) terminaría cancelándose igual, con el mismo motivo/código de error genérico. Se
   * valida siempre contra el estado leído dentro de la transacción, nunca contra uno leído
   * antes de entrar acá, para no reabrir la ventana que ya cierra la lectura+escritura atómica.
   */
  async transicionarEstado(
    reservaId: string,
    nuevoEstado: EstadoReserva,
    desdeEstadoEsperado?: EstadoReserva,
  ) {
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
      // Chequeo aparte del de arriba: acá la transición SÍ es válida en general (por eso no
      // pasó por el `if` anterior), pero el llamador pidió un origen más específico que el
      // que tiene la reserva — no es lo mismo "transición inválida" que "válida pero no
      // desde este estado", y el mensaje se lo dice a quien lo lea (cubic, PR #56).
      if (
        desdeEstadoEsperado !== undefined &&
        reserva.estado !== desdeEstadoEsperado
      ) {
        throw new ConflictException(
          `La reserva está en estado ${reserva.estado}, no ${desdeEstadoEsperado}: no se puede aplicar esta operación.`,
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

  /**
   * Búsqueda por código + email, **el único punto** donde el sistema compara esas dos
   * credenciales (design.md D2 y D3): la usan la consulta pública y, cuando exista, la
   * cancelación por código y email de `cancelacion-turnos`. Devuelve la Reserva con su turno
   * y la zona de su mesa, o `null` si no hay una que coincida con las dos cosas.
   *
   * El código se normaliza a mayúsculas (se genera siempre en mayúsculas, así que la
   * búsqueda usa el índice único) y el email se compara **en la aplicación**, sin distinguir
   * mayúsculas. No se compara en la consulta con `mode: 'insensitive'` porque Prisma lo
   * traduce a `ILIKE` sin escapar: un `%` o un `_` en el email funcionaría como comodín y
   * `%@dominio.com` encontraría la Reserva sin conocer el email real (comprobado en
   * `test/reserva-consultar.integration-spec.ts`).
   *
   * "Código inexistente" y "email incorrecto" siguen el mismo camino: una sola lectura por el
   * índice único que trae solo `id` y `emailCliente`, y `null` si no hay fila o el email no
   * coincide. Las relaciones (turno, mesa y zona) se leen recién cuando ya coincidieron los
   * dos datos, así que las dos fallas cuestan lo mismo y no hay diferencia de tiempo
   * atribuible a la aplicación.
   *
   * `db` permite llamarla dentro de una transacción ajena (`tx`) sin abrir otra.
   */
  async buscarPorCodigoYEmail(
    codigo: string,
    email: string,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<ReservaParaConsulta | null> {
    const candidata = await db.reserva.findUnique({
      where: { codigoReserva: codigo.toUpperCase() },
      select: { id: true, emailCliente: true },
    });
    if (!candidata || !emailsIguales(candidata.emailCliente, email)) {
      return null;
    }
    return db.reserva.findUnique({
      where: { id: candidata.id },
      include: { turno: true, mesa: { include: { zona: true } } },
    });
  }

  /**
   * Consulta pública de una Reserva por código + email (capability `reserva-consultar`).
   * Devuelve la vista mínima de la Reserva en cualquier estado, o el `404` genérico si el
   * código no existe o el email no coincide, sin distinguir cuál falló. Es de solo lectura.
   */
  async consultar(
    codigo: string,
    email: string,
  ): Promise<ReservaConsultadaRespuesta> {
    const reserva = await this.buscarPorCodigoYEmail(codigo, email);
    if (!reserva) {
      throw reservaNoEncontrada();
    }
    return aReservaConsultadaRespuesta(reserva);
  }

  /**
   * Listado de Reservas para el admin (capability `reserva-consultar`, design.md D6). Arma
   * el `where` solo con los filtros presentes (AND entre todos), pagina con `limit`/`offset`
   * y devuelve el `total` sin paginar en la misma consulta transaccional.
   *
   * **Orden total** (D6): `fecha`, `turno.horaInicio`, `createdAt`, `id`, todos ascendentes.
   * El `id` desempata para que dos páginas consecutivas nunca repitan ni omitan una Reserva
   * bajo escrituras concurrentes (a diferencia de un orden que empatara sin desempate final).
   *
   * Un `zonaId`/`turnoId` con formato válido pero inexistente no es un `404`: es un filtro
   * que ninguna Reserva cumple, así que da lista vacía con `total: 0` (a diferencia de
   * `disponibilidad`/`reservas-crear`, donde el turno o la zona son el objeto de la
   * operación, no un filtro).
   */
  async listar(filtros: ListarReservasDto): Promise<ListadoReservasRespuesta> {
    const limit = filtros.limit ?? LISTADO_LIMIT_DEFAULT;
    const offset = filtros.offset ?? LISTADO_OFFSET_DEFAULT;

    const where: Prisma.ReservaWhereInput = {
      ...(filtros.fecha && { fecha: fechaCalendarioDesdeIso(filtros.fecha) }),
      ...(filtros.estado && { estado: filtros.estado }),
      ...(filtros.zonaId && { mesa: { zonaId: filtros.zonaId } }),
      ...(filtros.turnoId && { turnoId: filtros.turnoId }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.reserva.findMany({
        where,
        include: { turno: true, mesa: { include: { zona: true } } },
        orderBy: [
          { fecha: 'asc' },
          { turno: { horaInicio: 'asc' } },
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
        take: limit,
        skip: offset,
      }),
      this.prisma.reserva.count({ where }),
    ]);

    return {
      items: items.map(aReservaAdminRespuesta),
      total,
      limit,
      offset,
    };
  }

  /**
   * Cancelación pública por código + email (capability `cancelacion-turnos`). Reusa
   * `buscarPorCodigoYEmail` (design.md D2 de `reserva-consultar`): el mismo `404` genérico
   * que la consulta, sin distinguir código inexistente de email incorrecto. Rechaza con
   * `409` si al inicio del Turno le quedan menos horas que `Zona.ventanaCancelacionHoras`
   * (límite inclusive: exactamente esa cantidad de horas ya alcanza, design.md → Decisions).
   * La transición en sí (incluido el rechazo si la Reserva ya está en un estado terminal, o
   * el `404` si desapareció entre la lectura y la escritura) la resuelve
   * `transicionarEstado`, el único punto de escritura de `estado` (invariante 5).
   *
   * `ahora` se inyecta (default `new Date()`) para poder probar el borde exacto de la
   * ventana sin mocks de reloj — mismo patrón que `evaluarReglas` en `disponibilidad`.
   */
  async cancelar(
    codigo: string,
    email: string,
    ahora: Date = new Date(),
  ): Promise<void> {
    const reserva = await this.buscarPorCodigoYEmail(codigo, email);
    if (!reserva) {
      throw reservaNoEncontrada();
    }

    const inicio = inicioTurnoUtc(reserva.fecha, reserva.turno.horaInicio);
    const ventanaMs = reserva.mesa.zona.ventanaCancelacionHoras * MS_POR_HORA;
    if (inicio.getTime() - ahora.getTime() < ventanaMs) {
      throw new ConflictException(
        'La reserva ya no se puede cancelar: está fuera de la ventana mínima de cancelación de su zona.',
      );
    }

    await this.transicionarEstado(reserva.id, 'CANCELADA');
  }

  /**
   * Marcado de `NO_SHOW` por el admin (capability `cancelacion-turnos`). Rechaza con `404`
   * si la Reserva no existe, y con `409` si el Turno todavía no terminó — el instante exacto
   * de fin se rechaza (`ahora` debe ser estrictamente posterior, design.md → Decisions), con
   * `finTurnoUtc` resolviendo el cruce de medianoche. Si la Reserva no está `CONFIRMADA`, el
   * `409` lo da igual `transicionarEstado` (`NO_SHOW` no es una transición válida desde
   * ningún otro estado, ver `TRANSICIONES_VALIDAS`), sin necesidad de un chequeo aparte acá.
   *
   * `ahora` se inyecta por el mismo motivo que en `cancelar`.
   */
  async marcarNoShow(id: string, ahora: Date = new Date()): Promise<void> {
    const reserva = await this.prisma.reserva.findUnique({
      where: { id },
      include: { turno: true },
    });
    if (!reserva) {
      throw new NotFoundException('La reserva indicada no existe.');
    }

    const fin = finTurnoUtc(
      reserva.fecha,
      reserva.turno.horaInicio,
      reserva.turno.horaFin,
    );
    if (ahora.getTime() <= fin.getTime()) {
      throw new ConflictException(
        'No se puede marcar NO_SHOW antes de que termine el turno.',
      );
    }

    await this.transicionarEstado(id, 'NO_SHOW');
  }

  /**
   * Confirmación de una Reserva `PENDIENTE` por el admin (capability `reserva-vip`). Solo
   * cambia `estado`: no revalida aforo ni disponibilidad de Mesa (design.md — "Confirmar no
   * revalida..."). `PENDIENTE` es el único origen que `TRANSICIONES_VALIDAS` permite hacia
   * `CONFIRMADA`, así que el `409` de "no está PENDIENTE" ya lo da `transicionarEstado` sin
   * un chequeo aparte.
   */
  async confirmar(id: string): Promise<void> {
    await this.transicionarEstado(id, 'CONFIRMADA');
  }

  /**
   * Rechazo de una Reserva `PENDIENTE` por el admin (capability `reserva-vip`). A diferencia
   * de `confirmar`, `TRANSICIONES_VALIDAS` por sí solo no alcanza acá: `CONFIRMADA →
   * CANCELADA` también es una transición válida (la usa `cancelar`, del cliente), así que sin
   * `desdeEstadoEsperado: 'PENDIENTE'` este método rechazaría también una Reserva ya
   * `CONFIRMADA` en vez de responder `409` (spec: "Rechazo bloqueado si la Reserva no está
   * pendiente").
   */
  async rechazar(id: string): Promise<void> {
    await this.transicionarEstado(id, 'CANCELADA', 'PENDIENTE');
  }
}
