import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { HorariosService } from './horarios.service';

@Module({
  imports: [PrismaModule],
  providers: [HorariosService],
  exports: [HorariosService],
})
export class HorariosModule {}
