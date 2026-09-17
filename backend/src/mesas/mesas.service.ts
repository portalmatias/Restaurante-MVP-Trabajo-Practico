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
    if (!Number.isInteger(dto.capacidad) || dto.capacidad <= 0) {
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

    return this.prisma.mesa.create({ data: dto });
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
   */
  async actualizar(id: string, dto: ActualizarMesaDto) {
    const mesa = await this.prisma.mesa.findUnique({ where: { id } });
    if (!mesa) {
      throw new NotFoundException('La mesa indicada no existe.');
    }

    if (dto.capacidad !== undefined) {
      const reservaQueNoAlcanza = await this.prisma.reserva.count({
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
      const zonaDestino = await this.prisma.zona.findUnique({
        where: { id: dto.zonaId },
      });
      if (!zonaDestino) {
        throw new NotFoundException('La zona indicada no existe.');
      }

      const reservasActivas = await this.prisma.reserva.count({
        where: { mesaId: id, estado: { in: [...ESTADOS_RESERVA_ACTIVA] } },
      });
      if (reservasActivas > 0) {
        throw new ConflictException(
          'La mesa tiene reservas activas; no se puede cambiar de zona.',
        );
      }
    }

    return this.prisma.mesa.update({ where: { id }, data: dto });
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
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new ConflictException(
            'No se puede eliminar una mesa con reservas asociadas.',
          );
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('La mesa indicada no existe.');
        }
      }
      throw error;
    }
  }
}
