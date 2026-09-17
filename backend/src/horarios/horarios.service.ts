import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ActualizarTurnoDto } from './dto/actualizar-turno.dto';
import { CrearTurnoDto } from './dto/crear-turno.dto';

/**
 * Alta, listado, edición y activación/desactivación de Turno. La "baja" es un toggle de
 * `activo`, nunca un delete físico, porque las Reservas existentes referencian el Turno
 * por FK — ver design.md → "Baja de Mesa es DELETE físico; baja de Turno es un toggle de
 * `activo`".
 */
@Injectable()
export class HorariosService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(dto: CrearTurnoDto) {
    try {
      return await this.prisma.turno.create({
        data: { ...dto, activo: dto.activo ?? true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Colisión contra @@unique([diaSemana, horaInicio]) — ya existe un turno que
        // arranca a esa hora, ese día.
        throw new ConflictException(
          'Ya existe un turno para ese día y esa hora de inicio.',
        );
      }
      throw error;
    }
  }

  async listar() {
    return this.prisma.turno.findMany();
  }

  private async obtenerOFallar(id: string) {
    const turno = await this.prisma.turno.findUnique({ where: { id } });
    if (!turno) {
      throw new NotFoundException('El turno indicado no existe.');
    }
    return turno;
  }

  /**
   * Edita día de la semana, horario y/o `activo` de un Turno existente — `activo` viaja
   * en el mismo `PATCH` de edición (design.md, tasks.md 4.4), no en una ruta aparte.
   */
  async actualizar(id: string, dto: ActualizarTurnoDto) {
    await this.obtenerOFallar(id);
    try {
      return await this.prisma.turno.update({
        where: { id },
        data: {
          diaSemana: dto.diaSemana,
          horaInicio: dto.horaInicio,
          horaFin: dto.horaFin,
          activo: dto.activo,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe un turno para ese día y esa hora de inicio.',
        );
      }
      throw error;
    }
  }

  /**
   * Activa o desactiva un Turno sin eliminarlo — sigue apareciendo en `listar()`
   * (spec: "Activación y desactivación de Turno").
   */
  async cambiarActivo(id: string, activo: boolean) {
    await this.obtenerOFallar(id);
    return this.prisma.turno.update({ where: { id }, data: { activo } });
  }
}
