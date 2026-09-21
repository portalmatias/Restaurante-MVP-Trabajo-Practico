import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';

import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthModule } from '../src/auth/auth.module';
import { ZonasModule } from '../src/zonas/zonas.module';
import { MesasModule } from '../src/mesas/mesas.module';
import { HorariosModule } from '../src/horarios/horarios.module';
import { upsertSeguro } from './helpers/upsert-seguro';

/**
 * Tests HTTP (Supertest) de los tres controllers admin de `gestion-salon`
 * (`ZonasController`, `MesasController`, `HorariosController`), contra Postgres real.
 *
 * `AppModule` todavía no registra estos módulos (mismo motivo documentado en
 * `app.module.ts` y en `auth.integration-spec.ts`: el job `test` de CI corre sin
 * PostgreSQL hasta que se mergee `ci-integracion-db`), así que este archivo arma su
 * propio módulo mínimo con `AuthModule` + los tres módulos de dominio, igual que ya
 * hace `auth.integration-spec.ts`. Cubre lo que los tests unitarios de cada
 * `*.controller.spec.ts` no pueden (mockean el service): que las guardas
 * `JwtAuthGuard`/`RolesGuard` están realmente enganchadas en cada ruta (tasks.md 5.1) y
 * que el pipeline completo (guardas + `ValidationPipe` + service + Prisma) funciona de
 * punta a punta.
 */
async function crearAppDeTest(): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: ['../.env', '.env'],
      }),
      ThrottlerModule.forRootAsync({
        inject: [ConfigService],
        useFactory: (config: ConfigService) => [
          {
            ttl: Number(config.get<string>('THROTTLE_TTL', '60')) * 1000,
            limit: Number(config.get<string>('THROTTLE_LIMIT', '10')),
          },
        ],
      }),
      PrismaModule,
      AuthModule,
      ZonasModule,
      MesasModule,
      HorariosModule,
    ],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  }).compile();

  const app: INestApplication<App> = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  await app.init();
  return app;
}

describe('Controllers admin de gestión de salón (integration)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let nonAdminToken: string;
  let zonaStandardId: string;

  beforeAll(async () => {
    app = await crearAppDeTest();
    prisma = app.get(PrismaService);

    // Tokens firmados directamente con JwtService (como ya hace
    // `auth.integration-spec.ts` para el caso non-admin): evita pegarle a
    // `POST /auth/login`, que tiene rate limiting (5 intentos/60s) y no hace falta acá,
    // ya que lo que se está probando es el guard de estas rutas, no el login en sí.
    const jwtService = app.get(JwtService);
    const configService = app.get(ConfigService);
    const jwtSecret = configService.getOrThrow<string>('JWT_SECRET');
    adminToken = jwtService.sign(
      { sub: 'admin-test-uuid', rol: 'ADMIN' },
      { secret: jwtSecret },
    );
    nonAdminToken = jwtService.sign(
      { sub: 'other-test-uuid', rol: 'CLIENTE' },
      { secret: jwtSecret },
    );

    // Zona STANDARD real, necesaria para crear Mesas — mismo patrón que
    // `mesas.integration-spec.ts` (upsert seguro: este archivo corre en paralelo con
    // otros que también hacen upsert de la misma fila enum-singleton).
    const standard = await upsertSeguro(
      () =>
        prisma.zona.upsert({
          where: { nombre: 'STANDARD' },
          update: {},
          create: {
            nombre: 'STANDARD',
            minComensales: 1,
            maxComensales: 8,
            anticipacionMinHoras: 2,
            anticipacionMaxDias: 30,
            ventanaCancelacionHoras: 2,
            requiereConfirmacionAdmin: false,
            aforoMaximo: 40,
          },
        }),
      () => prisma.zona.findUniqueOrThrow({ where: { nombre: 'STANDARD' } }),
    );
    zonaStandardId = standard.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /admin/zonas', () => {
    it('401 sin token', async () => {
      await request(app.getHttpServer()).get('/admin/zonas').expect(401);
    });

    it('403 con token de rol distinto de ADMIN', async () => {
      await request(app.getHttpServer())
        .get('/admin/zonas')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);
    });

    it('200 con token admin, devuelve las zonas', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/zonas')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const nombres = (response.body as { nombre: string }[]).map(
        (z) => z.nombre,
      );
      expect(nombres).toContain('STANDARD');
    });
  });

  describe('PATCH /admin/zonas/:id', () => {
    it('401 sin token', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/zonas/${zonaStandardId}`)
        .send({ aforoMaximo: 45 })
        .expect(401);
    });

    it('200 con token admin, persiste el cambio', async () => {
      try {
        const response = await request(app.getHttpServer())
          .patch(`/admin/zonas/${zonaStandardId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ aforoMaximo: 45 })
          .expect(200);

        expect((response.body as { aforoMaximo: number }).aforoMaximo).toBe(45);
      } finally {
        // Deja el valor conocido para no interferir con otros archivos de test, incluso
        // si el `expect` de arriba falla (cubic: la fila STANDARD es compartida).
        await prisma.zona.update({
          where: { id: zonaStandardId },
          data: { aforoMaximo: 40 },
        });
      }
    });

    it('400 con id que no es UUID', async () => {
      await request(app.getHttpServer())
        .patch('/admin/zonas/no-es-un-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ aforoMaximo: 45 })
        .expect(400);
    });
  });

  describe('/admin/mesas', () => {
    let mesaId: string;

    beforeAll(async () => {
      // Limpieza defensiva: si una corrida anterior se interrumpió antes del DELETE
      // final, no dejar que la fila residual con la misma etiqueta rompa el POST de más
      // abajo con un 409 inesperado (cubic: los identificadores fijos son únicos en la
      // base y el afterAll descarta errores de limpieza).
      await prisma.mesa.deleteMany({
        where: { etiqueta: 'HTTP-1', zonaId: zonaStandardId },
      });
    });

    afterAll(async () => {
      if (mesaId) {
        await prisma.mesa
          .delete({ where: { id: mesaId } })
          .catch(() => undefined);
      }
    });

    it('POST 401 sin token', async () => {
      await request(app.getHttpServer())
        .post('/admin/mesas')
        .send({ zonaId: zonaStandardId, capacidad: 4, etiqueta: 'HTTP-1' })
        .expect(401);
    });

    it('POST 403 con token de rol distinto de ADMIN', async () => {
      await request(app.getHttpServer())
        .post('/admin/mesas')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send({ zonaId: zonaStandardId, capacidad: 4, etiqueta: 'HTTP-1' })
        .expect(403);
    });

    it('POST 201 con token admin, crea la mesa', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/mesas')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ zonaId: zonaStandardId, capacidad: 4, etiqueta: 'HTTP-1' })
        .expect(201);

      const body = response.body as { id: string; etiqueta: string };
      expect(body.etiqueta).toBe('HTTP-1');
      mesaId = body.id;
    });

    it('GET 200 con token admin, filtra por zonaId', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/mesas')
        .query({ zonaId: zonaStandardId })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const mesas = response.body as { id: string; zonaId: string }[];
      expect(mesas.every((m) => m.zonaId === zonaStandardId)).toBe(true);
      expect(mesas.find((m) => m.id === mesaId)).toBeDefined();
    });

    it('PATCH 200 con token admin, edita la capacidad', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/admin/mesas/${mesaId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ capacidad: 6 })
        .expect(200);

      expect((response.body as { capacidad: number }).capacidad).toBe(6);
    });

    it('DELETE 204 con token admin, elimina la mesa', async () => {
      await request(app.getHttpServer())
        .delete(`/admin/mesas/${mesaId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const encontrada = await prisma.mesa.findUnique({
        where: { id: mesaId },
      });
      expect(encontrada).toBeNull();
      mesaId = '';
    });
  });

  describe('/admin/turnos', () => {
    let turnoId: string;
    const turnoHoraInicio = new Date(Date.UTC(1970, 0, 1, 11, 30, 0));

    beforeAll(async () => {
      // Misma limpieza defensiva que en '/admin/mesas' de arriba: `diaSemana` + hora de
      // inicio son la clave única real (`@@unique([diaSemana, horaInicio])`), así que una
      // fila residual de una corrida interrumpida rompería el POST de más abajo con 409.
      await prisma.turno.deleteMany({
        where: { diaSemana: 'LUNES', horaInicio: turnoHoraInicio },
      });
    });

    afterAll(async () => {
      if (turnoId) {
        await prisma.turno
          .delete({ where: { id: turnoId } })
          .catch(() => undefined);
      }
    });

    it('POST 401 sin token', async () => {
      await request(app.getHttpServer())
        .post('/admin/turnos')
        .send({ diaSemana: 'LUNES', horaInicio: '11:30', horaFin: '15:00' })
        .expect(401);
    });

    it('POST 201 con token admin, crea el turno', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/turnos')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ diaSemana: 'LUNES', horaInicio: '11:30', horaFin: '15:00' })
        .expect(201);

      const body = response.body as { id: string; activo: boolean };
      expect(body.activo).toBe(true);
      turnoId = body.id;
    });

    it('GET 200 con token admin, incluye el turno creado', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/turnos')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const turnos = response.body as { id: string }[];
      expect(turnos.find((t) => t.id === turnoId)).toBeDefined();
    });

    it('PATCH 200 con token admin, desactiva el turno en el mismo PATCH de edición', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/admin/turnos/${turnoId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ activo: false })
        .expect(200);

      expect((response.body as { activo: boolean }).activo).toBe(false);
    });
  });
});
