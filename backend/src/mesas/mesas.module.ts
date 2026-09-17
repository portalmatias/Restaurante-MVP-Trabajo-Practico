import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { MesasService } from './mesas.service';

@Module({
  imports: [PrismaModule],
  providers: [MesasService],
  exports: [MesasService],
})
export class MesasModule {}
