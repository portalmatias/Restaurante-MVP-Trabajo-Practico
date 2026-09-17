import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { ZonasService } from './zonas.service';

@Module({
  imports: [PrismaModule],
  providers: [ZonasService],
  exports: [ZonasService],
})
export class ZonasModule {}
