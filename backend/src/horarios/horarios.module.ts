import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HorariosController } from './horarios.controller';
import { HorariosService } from './horarios.service';

@Module({
  // Ver zonas.module.ts: AuthModule trae los guards y registra JwtStrategy.
  imports: [PrismaModule, AuthModule],
  controllers: [HorariosController],
  providers: [HorariosService],
  exports: [HorariosService],
})
export class HorariosModule {}
