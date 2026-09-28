import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { DisponibilidadController } from './disponibilidad.controller';
import { DisponibilidadService } from './disponibilidad.service';

/**
 * Módulo del validador compartido de disponibilidad (design.md D1).
 *
 * Registra el controller de `GET /disponibilidad` y exporta `DisponibilidadService` para
 * que `reservas-crear` reuse el mismo validador en vez de reimplementar las reglas.
 * `cargarContexto`, `bloquearTurnoFecha`, `evaluarReglas` y `calcularLugaresRestantes` son
 * funciones sueltas, no providers: se importan por ruta desde `contexto/` y `reglas/` (D1).
 */
@Module({
  imports: [PrismaModule],
  controllers: [DisponibilidadController],
  providers: [DisponibilidadService],
  exports: [DisponibilidadService],
})
export class DisponibilidadModule {}
