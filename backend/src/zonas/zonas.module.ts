import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ZonasController } from './zonas.controller';
import { ZonasService } from './zonas.service';

@Module({
  // AuthModule: de acá salen JwtAuthGuard/RolesGuard que protegen ZonasController, y con
  // ellos JwtStrategy (necesita registrarse para que passport resuelva la estrategia
  // 'jwt' en tiempo de ejecución). No se registra este módulo en AppModule todavía — ver
  // el comentario en app.module.ts.
  imports: [PrismaModule, AuthModule],
  controllers: [ZonasController],
  providers: [ZonasService],
  exports: [ZonasService],
})
export class ZonasModule {}
