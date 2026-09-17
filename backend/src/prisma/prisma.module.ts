import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global para que cualquier módulo de dominio (`reservas`, `mesas`, `zonas`, `horarios`,
 * `auth`, según config.yaml §7) pueda inyectar `PrismaService` sin reimportar este módulo.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
