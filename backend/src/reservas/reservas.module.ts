import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReservasAdminController } from './reservas-admin.controller';
import { ReservasController } from './reservas.controller';
import { ReservasService } from './reservas.service';

@Module({
  // AuthModule: de acá salen JwtAuthGuard/RolesGuard que protegen ReservasAdminController,
  // y con ellos JwtStrategy (necesita registrarse para que passport resuelva la estrategia
  // 'jwt' en tiempo de ejecución) — mismo motivo que zonas.module.ts/mesas.module.ts/
  // horarios.module.ts. Sin este import, los guards de /admin/reservas funcionan igual
  // dentro de AppModule (porque AuthModule ya se instancia ahí para /auth/login), pero
  // dejan de resolverse en cualquier módulo de test que arme ReservasModule aislado (como
  // hace, por ejemplo, reserva-consultar-listado.integration-spec.ts para llamar al
  // service directo). Se hace explícito para no depender de ese efecto de borde.
  imports: [PrismaModule, AuthModule],
  controllers: [ReservasController, ReservasAdminController],
  providers: [ReservasService],
  exports: [ReservasService],
})
export class ReservasModule {}
