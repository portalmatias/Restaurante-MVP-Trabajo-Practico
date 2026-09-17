import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HorariosModule } from './horarios/horarios.module';
import { MesasModule } from './mesas/mesas.module';
import { ZonasModule } from './zonas/zonas.module';

@Module({
  imports: [
    // El .env vive en la raiz del monorepo, pero los scripts del backend corren con el
    // working directory en backend/. Se buscan los dos lugares para que funcione tanto
    // `npm run dev` desde la raiz como `npm run start:dev -w backend`.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    // change `gestion-salon`: los tres módulos solo exponen sus services por ahora — los
    // controllers protegidos por guard quedan pendientes hasta que `auth-admin` exista
    // (ver tasks.md, prerrequisito 1.2).
    ZonasModule,
    MesasModule,
    HorariosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
