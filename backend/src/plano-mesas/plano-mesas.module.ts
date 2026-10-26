import { Module } from '@nestjs/common';

import { DisponibilidadModule } from '../disponibilidad/disponibilidad.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlanoMesasService } from './plano-mesas.service';
import { RELOJ, relojDelSistema } from './reloj';

/**
 * Plano de mesas público (change `plano-mesas`). Importa `DisponibilidadModule` porque el plano
 * reutiliza su validador (`cargarContexto`, `evaluarReglas`, `calcularLugaresRestantes` y el DTO
 * de la consulta), y provee el reloj que el service usa para evaluar las reglas.
 */
@Module({
  imports: [PrismaModule, DisponibilidadModule],
  providers: [PlanoMesasService, { provide: RELOJ, useValue: relojDelSistema }],
})
export class PlanoMesasModule {}
