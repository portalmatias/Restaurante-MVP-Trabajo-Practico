import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MesasController } from './mesas.controller';
import { MesasService } from './mesas.service';

@Module({
  // Ver zonas.module.ts: AuthModule trae los guards y registra JwtStrategy.
  imports: [PrismaModule, AuthModule],
  controllers: [MesasController],
  providers: [MesasService],
  exports: [MesasService],
})
export class MesasModule {}
