import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReservasAdminController } from './reservas-admin.controller';
import { ReservasController } from './reservas.controller';
import { ReservasService } from './reservas.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReservasController, ReservasAdminController],
  providers: [ReservasService],
  exports: [ReservasService],
})
export class ReservasModule {}
