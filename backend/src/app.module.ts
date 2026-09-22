import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
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
    // change `auth-admin`: `POST /auth/login` y los guards de admin. Importa PrismaModule,
    // así que `PrismaService.onModuleInit` hace `$connect()` al inicializar la app: por eso
    // `test/app.e2e-spec.ts` y `test/auth.e2e-spec.ts` (job de CI "Tests (backend)") necesitan
    // PostgreSQL. Desde `ci-integracion-db` ese job levanta un service container con la
    // base migrada y el seed aplicado, y `JWT_SECRET` llega como variable del workflow. El
    // job `spec` (`openapi:check`) también construye esta app con `NestFactory.create`, pero
    // sin `app.init()`, así que no abre ninguna conexión.
    AuthModule,
    // Los demás módulos de dominio NO se registran acá todavía, a propósito:
    // - `ZonasModule`, `MesasModule` y `HorariosModule` (change `gestion-salon`) son
    //   services sin controller; se registran cuando tengan uno (tasks.md, prerrequisito
    //   1.2), porque un módulo sin rutas no aporta nada a la API y solo suma una conexión.
    // - `ReservasModule` (`modelo-dominio`, PR #12) tampoco tiene controller todavía.
    // Los tests que ejercitan estos módulos los instancian directo con
    // `Test.createTestingModule({ imports: [PrismaModule, MesasModule] })`, como ya hacen
    // `reservas-invariantes.integration-spec.ts` y `mesas.integration-spec.ts`.
    // change `disponibilidad`: `GET /disponibilidad`, público (sin auth). Sí tiene
    // controller, así que se registra; importa PrismaModule igual que AuthModule.
    DisponibilidadModule,
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
