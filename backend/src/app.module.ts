import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // El .env vive en la raiz del monorepo, pero los scripts del backend corren con el
    // working directory en backend/. Se buscan los dos lugares para que funcione tanto
    // `npm run dev` desde la raiz como `npm run start:dev -w backend`.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    // THROTTLE_TTL/THROTTLE_LIMIT (config.yaml §10) son el default global; `/auth/login`
    // lo sobreescribe con un límite más estricto vía @Throttle() (design.md de auth-admin).
    // No necesita PrismaService, así que no le aplica la nota de abajo.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: Number(config.get<string>('THROTTLE_TTL', '60')) * 1000,
          limit: Number(config.get<string>('THROTTLE_LIMIT', '10')),
        },
      ],
    }),
    // change `gestion-salon`: ZonasModule, MesasModule y HorariosModule (services, sin
    // controller todavía — ver tasks.md, prerrequisito 1.2) NO se registran acá a
    // propósito. Importan PrismaModule (@Global()), y AppModule es lo que arranca
    // `test/app.e2e-spec.ts`, que corre en el job de CI "Tests (backend)" **sin**
    // PostgreSQL disponible (esa base llega con `ci-integracion-db`) — registrarlos acá
    // hace que `PrismaService.onModuleInit` intente `$connect()` y ese smoke test falle en
    // CI. Mismo motivo por el que `ReservasModule` (de `modelo-dominio`, PR #12) y
    // `AuthModule` (de `auth-admin`, este change) tampoco están registrados: los tests que
    // ejercitan estos módulos los instancian directo con
    // `Test.createTestingModule({ imports: [PrismaModule, AuthModule] })`, como ya hacen
    // `reservas-invariantes.integration-spec.ts` y `mesas.integration-spec.ts`. Se
    // registran en `AppModule` recién cuando `ci-integracion-db` le dé al job `test` una
    // base de Postgres disponible.
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
