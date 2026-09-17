import { Injectable, NotFoundException } from '@nestjs/common';

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
    return this.prisma.turno.create({
      data: { ...dto, activo: dto.activo ?? true },
    });
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

  /** Edita día de la semana y/o horario de un Turno existente. */
  async actualizar(id: string, dto: ActualizarTurnoDto) {
    await this.obtenerOFallar(id);
    return this.prisma.turno.update({
      where: { id },
      data: {
        diaSemana: dto.diaSemana,
        horaInicio: dto.horaInicio,
        horaFin: dto.horaFin,
      },
    });
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
