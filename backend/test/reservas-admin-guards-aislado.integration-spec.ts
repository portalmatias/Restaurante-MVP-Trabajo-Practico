import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { PrismaModule } from '../src/prisma/prisma.module';
import { ReservasModule } from '../src/reservas/reservas.module';

/**
 * Hallazgo de Cubic sobre el PR de `reserva-consultar` (#35): `ReservasModule` no
 * importaba `AuthModule`, así que `JwtAuthGuard`/`RolesGuard` de `ReservasAdminController`
 * funcionaban dentro de `AppModule` (porque `AuthModule` ya se instancia ahí para
 * `/auth/login`, y Passport registra la estrategia `'jwt'` en un registro global propio,
 * no en el contenedor de DI de Nest), pero no en un módulo de test que arme `ReservasModule`
 * aislado — exactamente el patrón que ya usan `gestion-salon-admin.integration-spec.ts` y
 * `reserva-consultar-listado.integration-spec.ts` (esta última importa
 * `[PrismaModule, ReservasModule]` para llamar a `ReservasService.listar` directo).
 *
 * Reproducido antes del fix: `GET /admin/reservas` sin token daba `500 Internal Server
 * Error` ("Unknown authentication strategy jwt"), no `401`. `zonas.module.ts`,
 * `mesas.module.ts` y `horarios.module.ts` ya importan `AuthModule` por el mismo motivo,
 * documentado en cada uno; `reservas.module.ts` ahora hace lo mismo.
 *
 * Este test arma `ReservasModule` **sin** `AppModule` a propósito, para que un futuro
 * `imports: [PrismaModule]` sin `AuthModule` vuelva a fallar acá, no solo en producción.
 */
describe('ReservasModule expone los guards de admin incluso aislado de AppModule (integración)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['../.env', '.env'],
        }),
        PrismaModule,
        ReservasModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('401 (no 500) sin token en GET /admin/reservas', async () => {
    await request(app.getHttpServer()).get('/admin/reservas').expect(401);
  });
});
