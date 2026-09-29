import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { EstadoReserva } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { diaDe, FECHA } from './support/fechas-e2e';
import { configurarZonasYConfiguracionDeSeed } from './support/zonas-seed-e2e';

/**
 * Tareas 3.5, 3.6 y 3.7 de `reserva-consultar`: `GET /admin/reservas` por HTTP con
 * Supertest, contra la base de TEST real. `ReservasService.listar` (filtros, paginación) ya
 * está probado en `reserva-consultar-listado.integration-spec.ts`; acá lo que se agrega es
 * lo que solo se ve por HTTP: los guards, los `400` de validación de query y el rate
 * limiting.
 *
 * Los tokens de rol incorrecto/admin se firman directo con `JwtService` (mismo patrón que
 * `gestion-salon-admin.integration-spec.ts` y `auth.integration-spec.ts`), para no pegarle a
 * `POST /auth/login` (que tiene su propio throttling, ajeno a lo que se prueba acá).
 */
describe('GET /admin/reservas (e2e)', () => {
  let prisma: PrismaService;
  let adminToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const setupApp = moduleRef.createNestApplication();
    await setupApp.init();
    prisma = setupApp.get(PrismaService);

    const jwtService = setupApp.get(JwtService);
    const jwtSecret = setupApp
      .get(ConfigService)
      .getOrThrow<string>('JWT_SECRET');
    adminToken = jwtService.sign(
      { sub: 'admin-listado-e2e', rol: 'ADMIN' },
      { secret: jwtSecret },
    );

    await configurarZonasYConfiguracionDeSeed(prisma);
    await setupApp.close();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('guards y validación de filtros', () => {
    let app: INestApplication<App>;
    let tokenRolIncorrecto: string;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleRef.createNestApplication<INestApplication<App>>();
      app.useGlobalPipes(
        new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
      );
      await app.init();

      const jwtService = app.get(JwtService);
      const jwtSecret = app.get(ConfigService).getOrThrow<string>('JWT_SECRET');
      tokenRolIncorrecto = jwtService.sign(
        { sub: 'no-admin-listado-e2e', rol: 'CLIENTE' },
        { secret: jwtSecret },
      );
    });

    afterAll(async () => {
      await app.close();
    });

    function listar(query = '', token?: string) {
      const req = request(app.getHttpServer()).get(`/admin/reservas${query}`);
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    }

    it('401 sin token, y sin datos de Reservas en el cuerpo', async () => {
      const respuesta = await listar().expect(401);

      expect(JSON.stringify(respuesta.body)).not.toContain('codigoReserva');
    });

    it('403 con un JWT válido de rol distinto de ADMIN, y sin datos de Reservas', async () => {
      const respuesta = await listar('', tokenRolIncorrecto).expect(403);

      expect(JSON.stringify(respuesta.body)).not.toContain('codigoReserva');
    });

    it('200 con un JWT de ADMIN: devuelve items, total, limit y offset', async () => {
      const respuesta = await listar('', adminToken).expect(200);

      expect(respuesta.body).toEqual(
        expect.objectContaining({
          items: expect.any(Array) as unknown[],
          total: expect.any(Number) as number,
          limit: expect.any(Number) as number,
          offset: expect.any(Number) as number,
        }),
      );
    });

    it('400 con una fecha de calendario inexistente', async () => {
      await listar('?fecha=2026-02-30', adminToken).expect(400);
    });

    it('400 con un estado que no existe', async () => {
      await listar('?estado=INVENTADO', adminToken).expect(400);
    });

    it('400 con un zonaId que no es UUID', async () => {
      await listar('?zonaId=abc', adminToken).expect(400);
    });

    it.each(['limit=101', 'limit=0', 'limit=abc', 'offset=-1'])(
      '400 con %s',
      async (queryString) => {
        await listar(`?${queryString}`, adminToken).expect(400);
      },
    );

    it('400 con un parámetro no declarado, en vez de devolver el listado completo', async () => {
      await listar('?estdo=PENDIENTE', adminToken).expect(400);
    });

    it('200 con lista vacía cuando el zonaId tiene formato válido pero no existe', async () => {
      const respuesta = await listar(
        '?zonaId=00000000-0000-4000-8000-000000000000',
        adminToken,
      ).expect(200);

      expect(respuesta.body).toMatchObject({ items: [], total: 0 });
    });
  });

  describe('el listado incluye el id interno y los datos de contacto', () => {
    let app: INestApplication<App>;
    let turnoId: string;
    let mesaId: string;
    let reservaId: string;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleRef.createNestApplication<INestApplication<App>>();
      app.useGlobalPipes(
        new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
      );
      await app.init();

      const { zonaStandardId } =
        await configurarZonasYConfiguracionDeSeed(prisma);
      const turno = await prisma.turno.create({
        data: {
          diaSemana: diaDe(FECHA),
          horaInicio: new Date(Date.UTC(1970, 0, 1, 12, 30, 0)),
          horaFin: new Date(Date.UTC(1970, 0, 1, 15, 0, 0)),
          activo: true,
        },
      });
      turnoId = turno.id;
      const mesa = await prisma.mesa.create({
        data: {
          zonaId: zonaStandardId,
          capacidad: 4,
          etiqueta: 'RCO-ADMIN-E2E',
        },
      });
      mesaId = mesa.id;
      const reserva = await prisma.reserva.create({
        data: {
          mesaId,
          turnoId,
          fecha: FECHA,
          comensales: 3,
          estado: EstadoReserva.PENDIENTE,
          nombreCliente: 'Cliente Listado E2E',
          emailCliente: 'listado-admin-e2e@example.com',
          telefonoCliente: '+54 9 11 5555-9876',
          codigoReserva: 'RCOADME2',
        },
      });
      reservaId = reserva.id;
    });

    afterAll(async () => {
      await prisma.reserva.deleteMany({ where: { id: reservaId } });
      await prisma.mesa.deleteMany({ where: { id: mesaId } });
      await prisma.turno.deleteMany({ where: { id: turnoId } });
      await app.close();
    });

    it('la Reserva creada aparece con su id, contacto y mesa al filtrar por turnoId', async () => {
      const jwtService = app.get(JwtService);
      const jwtSecret = app.get(ConfigService).getOrThrow<string>('JWT_SECRET');
      const token = jwtService.sign(
        { sub: 'admin-listado-item-e2e', rol: 'ADMIN' },
        { secret: jwtSecret },
      );

      const respuesta = await request(app.getHttpServer())
        .get(`/admin/reservas?turnoId=${turnoId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const items = (
        respuesta.body as { items: Array<Record<string, unknown>> }
      ).items;
      const item = items.find((i) => i.id === reservaId);
      expect(item).toMatchObject({
        id: reservaId,
        codigoReserva: 'RCOADME2',
        nombreCliente: 'Cliente Listado E2E',
        emailCliente: 'listado-admin-e2e@example.com',
        telefonoCliente: '+54 9 11 5555-9876',
        mesa: { id: mesaId, etiqueta: 'RCO-ADMIN-E2E' },
      });
    });
  });

  describe('rate limiting', () => {
    // Cada test levanta su propia app: comparten el mismo `ThrottlerStorage` en memoria
    // dentro de una app, así que "uso normal" (pocas solicitudes) y "supera el límite" (60)
    // no pueden convivir en la misma instancia sin que uno le coma cupo al otro.
    let app: INestApplication<App>;

    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleRef.createNestApplication<INestApplication<App>>();
      app.useGlobalPipes(
        new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
      );
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it('permite el uso normal de un panel que cambia filtros varias veces seguidas', async () => {
      const consultas = ['', '?estado=PENDIENTE', '?estado=CONFIRMADA'];
      for (const query of consultas) {
        await request(app.getHttpServer())
          .get(`/admin/reservas${query}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      }
    });

    it('supera el límite propio (60/min) y responde 429 a la solicitud siguiente', async () => {
      const limite = 60;

      for (let i = 0; i < limite; i++) {
        await request(app.getHttpServer())
          .get('/admin/reservas')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      }

      await request(app.getHttpServer())
        .get('/admin/reservas')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(429);
    });
  });
});
