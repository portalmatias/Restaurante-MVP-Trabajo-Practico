import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ZonasModule } from './zonas/zonas.module';
import { MesasModule } from './mesas/mesas.module';
import { HorariosModule } from './horarios/horarios.module';

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
    // `AuthModule` (auth-admin, PR #25/#33) y `ZonasModule`/`MesasModule`/`HorariosModule`
    // (gestion-salon) importan `PrismaModule` (`@Global()`), así que registrarlos acá hace
    // que `PrismaService.onModuleInit` llame `$connect()` al arrancar la app — incluido
    // `test/app.e2e-spec.ts` y `test/auth.e2e-spec.ts`, que instancian `AppModule` completo.
    // Hasta que se mergeó `ci-integracion-db` (PR #28), el job "Tests (backend)" de CI corría
    // sin PostgreSQL disponible durante ese paso, así que se dejaban deliberadamente afuera
    // (los tests que los ejercitan armaban su propio módulo mínimo con
    // `Test.createTestingModule({ imports: [PrismaModule, AuthModule] })`, como todavía hacen
    // `auth.integration-spec.ts` y `gestion-salon-admin.integration-spec.ts` para no depender
    // de que `AppModule` los registre). Con #28 en `main`, el job migra y seedea Postgres
    // antes de correr ningún test — ya no aplica esa razón, así que se registran acá. El job
    // `spec` (`openapi:check`) también construye esta app con `NestFactory.create`, pero sin
    // `app.init()`, así que no abre ninguna conexión. `ReservasModule` (`modelo-dominio`,
    // PR #12) sigue sin controller propio (nace en el change `reservas-crear`, todavía no
    // implementado) y por eso no se registra todavía — no es el mismo motivo que los de
    // arriba.
    AuthModule,
    ZonasModule,
    MesasModule,
    HorariosModule,
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
