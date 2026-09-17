import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ActualizarZonaDto } from './dto/actualizar-zona.dto';

/**
 * Solo lectura y actualización de configuración: `Zona.nombre` es un enum de Prisma con
 * exactamente dos valores (`STANDARD`, `VIP`, definidos en `modelo-dominio`), así que no
 * hay alta ni baja — ver design.md → "Zona: solo lectura y actualización, sin alta ni baja".
 */
@Injectable()
export class ZonasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar() {
    return this.prisma.zona.findMany();
  }

  /**
   * Actualiza los valores de configuración de una Zona existente. Rechaza con
   * `BadRequestException` si, combinando los campos del `dto` con los que ya están
   * persistidos (para los que no vienen en el `dto`), el mínimo de comensales resultante
   * queda por encima del máximo (spec: "Actualización de configuración de Zona").
   */
  async actualizar(id: string, dto: ActualizarZonaDto) {
    const zona = await this.prisma.zona.findUnique({ where: { id } });
    if (!zona) {
      throw new NotFoundException('La zona indicada no existe.');
    }

    const minComensalesEfectivo = dto.minComensales ?? zona.minComensales;
    const maxComensalesEfectivo = dto.maxComensales ?? zona.maxComensales;
    if (minComensalesEfectivo > maxComensalesEfectivo) {
      throw new BadRequestException(
        'El mínimo de comensales no puede ser mayor que el máximo.',
      );
    }

    return this.prisma.zona.update({ where: { id }, data: dto });
  }
}
