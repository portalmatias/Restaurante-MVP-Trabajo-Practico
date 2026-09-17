import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReservasService } from './reservas.service';

@Module({
  imports: [PrismaModule],
  providers: [ReservasService],
  exports: [ReservasService],
})
export class ReservasModule {}
