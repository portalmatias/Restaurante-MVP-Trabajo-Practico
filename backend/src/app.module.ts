import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DisponibilidadModule } from './disponibilidad/disponibilidad.module';

@Module({
  imports: [
    // El .env vive en la raiz del monorepo, pero los scripts del backend corren con el
    // working directory en backend/. Se buscan los dos lugares para que funcione tanto
    // `npm run dev` desde la raiz como `npm run start:dev -w backend`.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    // change `gestion-salon`: ZonasModule, MesasModule y HorariosModule (services, sin
    // controller todavía — ver tasks.md, prerrequisito 1.2) NO se registran acá a
    // propósito. Importan PrismaModule (@Global()), y AppModule es lo que arranca
    // `test/app.e2e-spec.ts`, que corre en el job de CI "Tests (backend)" **sin**
    // PostgreSQL disponible (esa base llega con `ci-integracion-db`) — registrarlos acá
    // hace que `PrismaService.onModuleInit` intente `$connect()` y ese smoke test falle en
    // CI. Mismo motivo por el que `ReservasModule` (de `modelo-dominio`, PR #12) tampoco
    // está registrado: los tests que ejercitan estos módulos los instancian directo con
    // `Test.createTestingModule({ imports: [PrismaModule, ZonasModule] })`, como ya hacen
    // `reservas-invariantes.integration-spec.ts` y `mesas.integration-spec.ts`. Se
    // registran en `AppModule` recién cuando tengan un controller real que exponer.
    DisponibilidadModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
