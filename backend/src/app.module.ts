import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ReservasModule } from './reservas/reservas.module';

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
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: Number(config.getOrThrow<string>('THROTTLE_TTL')) * 1000,
          limit: Number(config.getOrThrow<string>('THROTTLE_LIMIT')),
        },
      ],
    }),
    AuthModule,
    ReservasModule,
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
