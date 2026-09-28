import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ActualizarMesaDto } from './dto/actualizar-mesa.dto';
import { CrearMesaDto } from './dto/crear-mesa.dto';

/** Estados de Reserva que cuentan como "activa" (config.yaml §6, invariante 1). */
const ESTADOS_RESERVA_ACTIVA = ['PENDIENTE', 'CONFIRMADA'] as const;

/** Reintentos ante conflicto de serialización (mismo patrón que `ReservasService`). */
const SERIALIZACION_MAX_INTENTOS = 3;

function esCapacidadInvalida(capacidad: number): boolean {
  return !Number.isInteger(capacidad) || capacidad <= 0;
}

/**
 * CRUD completo de Mesa. Las validaciones que necesitan consultar `Reserva` lo hacen
 * directo contra Prisma, sin depender de un `ReservasService` que todavía no existe
 * (nace en `reservas-crear`) — ver design.md → "Verificación de Reservas: consulta
 * directa a la tabla Reserva, no a un service".
 */
@Injectable()
export class MesasService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(dto: CrearMesaDto) {
    if (esCapacidadInvalida(dto.capacidad)) {
      throw new BadRequestException(
        'La capacidad de la mesa debe ser un entero positivo.',
      );
    }

    const zona = await this.prisma.zona.findUnique({
      where: { id: dto.zonaId },
    });
    if (!zona) {
      throw new NotFoundException('La zona indicada no existe.');
    }

    try {
      return await this.prisma.mesa.create({ data: dto });
    } catch (error) {
      throw this.traducirErrorDePrisma(error, 'crear');
    }
  }

  async listar(zonaId?: string) {
    return this.prisma.mesa.findMany({
      where: zonaId ? { zonaId } : undefined,
    });
  }

  /**
   * Edita etiqueta, capacidad y/o zona. Rechaza con `ConflictException` (`409`) si el
   * cambio dejaría inválida una Reserva activa (`PENDIENTE`/`CONFIRMADA`) existente sobre
   * esta Mesa: capacidad insuficiente (invariante 2) o Mesa fuera de la Zona de la Reserva
   * (invariante 3) — spec: "Edición de Mesa preserva las Reservas activas".
   *
   * Toda la validación y la escritura corren dentro de una única transacción
   * `Serializable`: sin esto, una Reserva podría crearse (por `reservas-crear`, una vez
   * exista) entre el `count` de Reservas activas y el `update` de la Mesa, dejando una
   * Reserva activa con más comensales que la nueva capacidad o en una Zona distinta a la
   * de la Mesa — violando los invariantes 2/3. `ReservasService.crearReserva` ya corre en
   * `Serializable`, así que Postgres detecta el conflicto real entre ambas transacciones
   * (mismo mecanismo que documenta `ZonasService.actualizar`).
   */
  async actualizar(id: string, dto: ActualizarMesaDto) {
    if (dto.capacidad !== undefined && esCapacidadInvalida(dto.capacidad)) {
      throw new BadRequestException(
        'La capacidad de la mesa debe ser un entero positivo.',
      );
    }

    for (let intento = 0; intento < SERIALIZACION_MAX_INTENTOS; intento++) {
      try {
        return await this.ejecutarActualizacion(id, dto);
      } catch (error) {
        const esConflictoDeSerializacion =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';
        if (!esConflictoDeSerializacion) {
          throw this.traducirErrorDePrisma(error, 'actualizar');
        }
        if (intento < SERIALIZACION_MAX_INTENTOS - 1) {
          continue;
        }
        throw new ConflictException(
          'No se pudo actualizar la mesa por una edición concurrente. Volvé a intentarlo.',
        );
      }
    }
    // Inalcanzable en la práctica (el loop siempre retorna o lanza), pero TypeScript
    // exige un camino de retorno explícito al final.
    throw new ConflictException(
      'No se pudo actualizar la mesa tras varios reintentos por edición concurrente.',
    );
  }

  private async ejecutarActualizacion(id: string, dto: ActualizarMesaDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const mesa = await tx.mesa.findUnique({ where: { id } });
        if (!mesa) {
          throw new NotFoundException('La mesa indicada no existe.');
        }

        if (dto.capacidad !== undefined) {
          const reservaQueNoAlcanza = await tx.reserva.count({
            where: {
              mesaId: id,
              estado: { in: [...ESTADOS_RESERVA_ACTIVA] },
              comensales: { gt: dto.capacidad },
            },
          });
          if (reservaQueNoAlcanza > 0) {
            throw new ConflictException(
              'La mesa tiene una reserva activa con más comensales que la nueva capacidad.',
            );
          }
        }

        if (dto.zonaId !== undefined && dto.zonaId !== mesa.zonaId) {
          const zonaDestino = await tx.zona.findUnique({
            where: { id: dto.zonaId },
          });
          if (!zonaDestino) {
            throw new NotFoundException('La zona indicada no existe.');
          }

          const reservasActivas = await tx.reserva.count({
            where: { mesaId: id, estado: { in: [...ESTADOS_RESERVA_ACTIVA] } },
          });
          if (reservasActivas > 0) {
            throw new ConflictException(
              'La mesa tiene reservas activas; no se puede cambiar de zona.',
            );
          }
        }

        return tx.mesa.update({ where: { id }, data: dto });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Elimina físicamente una Mesa solo si no tiene ninguna Reserva asociada, de ningún
   * estado (`PENDIENTE`, `CONFIRMADA`, `CANCELADA` o `NO_SHOW`) — preserva el historial,
   * spec: "Baja de Mesa preserva las Reservas activas e históricas". La consulta previa
   * mejora el mensaje de error; la FK restrictiva de `Reserva.mesaId` es la garantía real
   * contra una Reserva insertada entre la consulta y el DELETE (design.md).
   */
  async eliminar(id: string) {
    const mesa = await this.prisma.mesa.findUnique({ where: { id } });
    if (!mesa) {
      throw new NotFoundException('La mesa indicada no existe.');
    }

    const reservasAsociadas = await this.prisma.reserva.count({
      where: { mesaId: id },
    });
    if (reservasAsociadas > 0) {
      throw new ConflictException(
        'No se puede eliminar una mesa con reservas asociadas.',
      );
    }

    try {
      await this.prisma.mesa.delete({ where: { id } });
    } catch (error) {
      throw this.traducirErrorDePrisma(error, 'eliminar');
    }
  }

  /**
   * Traduce los errores de Prisma que puede dejar escapar cualquier escritura de este
   * service a excepciones HTTP legibles, en vez de un `500` crudo: `P2002` (colisión de
   * `Mesa.etiqueta`, único) a `409`, `P2025` (la fila ya no existe — se borró o dejó de
   * cumplir el `where` concurrentemente) a `404`, `P2003` a `404` si la zona no existe al
   * crear/actualizar, o a `409` si reservas asociadas impiden eliminar la mesa.
   * Cualquier otro error se propaga sin tocar.
   */
  private traducirErrorDePrisma(
    error: unknown,
    operacion: 'crear' | 'actualizar' | 'eliminar',
  ): unknown {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return error;
    }
    if (error.code === 'P2002') {
      return new ConflictException('Ya existe una mesa con esa etiqueta.');
    }
    if (error.code === 'P2025') {
      return new NotFoundException('La mesa indicada no existe.');
    }
    if (error.code === 'P2003') {
      if (operacion !== 'eliminar') {
        return new NotFoundException('La zona indicada no existe.');
      }
      return new ConflictException(
        'No se puede eliminar una mesa con reservas asociadas.',
      );
    }
    return error;
  }
}
