import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      // No hace falta `async`: la config sale directo de `ConfigService.get`, sin I/O.
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') as string,
        signOptions: {
          // `JWT_EXPIRES_IN` ya está documentada en config.yaml §10 y en .env.example,
          // pero quedaba sin usar: el valor de vigencia del JWT estaba hardcodeado acá
          // en vez de leerse de la config (con '60m' como default si no está seteada).
          expiresIn:
            (configService.get<string>('JWT_EXPIRES_IN') as
              StringValue | undefined) ?? '60m',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  // `PrismaService` (el que usa AuthService) lo provee `PrismaModule`, que se importa
  // explícito arriba como hacen `MesasModule`/`ReservasModule` (ambos registrados en
  // `AppModule`): aunque sea `@Global()`, un módulo global solo existe si alguien lo importa.
  // No hace falta proveer acá un `PrismaClient` propio: crear uno nuevo sin gestionar su
  // ciclo de vida (sin `onModuleInit`/`onModuleDestroy`) dejaba una conexión a la base sin
  // cerrar nunca.
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtModule, PassportModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
