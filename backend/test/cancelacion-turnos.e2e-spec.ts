import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { EstadoReserva } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { RESERVA_NO_ENCONTRADA_MENSAJE } from '../src/reservas/reserva-no-encontrada';
import { PrismaService } from '../src/prisma/prisma.service';
import { diaDe, FECHA, hoyLocal, sumarDias } from './support/fechas-e2e';
import { configurarZonasYConfiguracionDeSeed } from './support/zonas-seed-e2e';

/**
 * Tests HTTP (Supertest, tareas 2.3, 3.2 y sección 4) de `cancelacion-turnos`, contra la
 * base de TEST real: `POST /reservas/:codigo/cancelar` y `PATCH /admin/reservas/:id/no-show`.
 *
 * Alcance: lo que agregan los endpoints sobre lo ya probado en
 * `reservas-cancelar.service.spec.ts` y `reservas-no-show.service.spec.ts` (unitarios, con
 * el borde exacto de la ventana y del fin de turno) — los códigos HTTP, los guards de admin,
 * el rate limiting (4.4, 4.8) y que el service esté bien cableado detrás de cada controller
 * (4.10). No repite los bordes exactos de fecha/hora, ya cubiertos sin tocar la base.
 *
 * **Turnos:** banda horaria 17:45–20:45 local para "turno lejos en el futuro" (no la usa
 * ninguna otra suite e2e) y un turno propio en el pasado (08:15–09:15 local, `fecha` de
 * ayer) para poder marcar NO_SHOW exitosamente contra la base real sin esperar. Cada
 * Reserva de este archivo usa su propia Mesa (`crearReserva` la crea): el índice único
 * parcial `(mesaId, turnoId, fecha)` (invariante 1 de `modelo-dominio`) admite una sola
 * Reserva activa por combinación, y varios tests de esta suite comparten a propósito el
 * mismo turno y la misma fecha.
 */
describe('cancelacion-turnos (e2e)', () => {
  let prisma: PrismaService;
  let zonaStandardId: string;
  let turnoFuturoId: string;
  let turnoPasadoId: string;
  let adminToken: string;
  let nonAdminToken: string;
  const mesaIds: string[] = [];

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
      { sub: 'admin-cancelacion-e2e', rol: 'ADMIN' },
      { secret: jwtSecret },
    );
    nonAdminToken = jwtService.sign(
      { sub: 'no-admin-cancelacion-e2e', rol: 'CLIENTE' },
      { secret: jwtSecret },
    );

    const zonas = await configurarZonasYConfiguracionDeSeed(prisma);
    zonaStandardId = zonas.zonaStandardId;

    const turnoFuturo = await prisma.turno.create({
      data: {
        diaSemana: diaDe(FECHA),
        horaInicio: new Date(Date.UTC(1970, 0, 1, 17, 45, 0)),
        horaFin: new Date(Date.UTC(1970, 0, 1, 20, 45, 0)),
        activo: true,
      },
    });
    turnoFuturoId = turnoFuturo.id;

    // Turno propio, ya terminado: `fecha` de ayer con horario de mañana, para poder marcar
    // NO_SHOW exitosamente contra Postgres real sin esperar a que pase un turno de verdad.
    const ayer = sumarDias(hoyLocal(), -1);
    const turnoPasado = await prisma.turno.create({
      data: {
        diaSemana: diaDe(ayer),
        horaInicio: new Date(Date.UTC(1970, 0, 1, 8, 15, 0)),
        horaFin: new Date(Date.UTC(1970, 0, 1, 9, 15, 0)),
        activo: true,
      },
    });
    turnoPasadoId = turnoPasado.id;

    await setupApp.close();
  });

  afterAll(async () => {
    await prisma.reserva.deleteMany({ where: { mesaId: { in: mesaIds } } });
    await prisma.mesa.deleteMany({ where: { id: { in: mesaIds } } });
    await prisma.turno.deleteMany({
      where: { id: { in: [turnoFuturoId, turnoPasadoId] } },
    });
    await prisma.$disconnect();
  });

  async function crearReserva(
    overrides: Partial<{
      turnoId: string;
      fecha: Date;
      estado: EstadoReserva;
      emailCliente: string;
      codigoReserva: string;
    }> = {},
  ) {
    const codigoReserva =
      overrides.codigoReserva ?? `CTU${Date.now() % 100000}`;
    const mesa = await prisma.mesa.create({
      data: {
        zonaId: zonaStandardId,
        capacidad: 4,
        etiqueta: `CTU-${codigoReserva}`,
      },
    });
    mesaIds.push(mesa.id);

    return prisma.reserva.create({
      data: {
        mesaId: mesa.id,
        turnoId: overrides.turnoId ?? turnoFuturoId,
        fecha: overrides.fecha ?? FECHA,
        comensales: 2,
        estado: overrides.estado ?? EstadoReserva.CONFIRMADA,
        nombreCliente: 'Cliente Cancelación E2E',
        emailCliente: overrides.emailCliente ?? 'cancelacion-e2e@example.com',
        telefonoCliente: '+54 9 11 5555-1234',
        codigoReserva,
      },
    });
  }

  describe('POST /reservas/:codigo/cancelar', () => {
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

    function cancelar(codigo: string, email: unknown) {
      return request(app.getHttpServer())
        .post(`/reservas/${codigo}/cancelar`)
        .send({ email });
    }

    it('204 sin cuerpo, y persiste la Reserva como CANCELADA', async () => {
      const reserva = await crearReserva({
        codigoReserva: 'CTUOK001',
        emailCliente: 'ok-cancelar@example.com',
      });

      const respuesta = await cancelar(
        reserva.codigoReserva,
        'ok-cancelar@example.com',
      ).expect(204);
      expect(respuesta.body).toEqual({});

      const actual = await prisma.reserva.findUniqueOrThrow({
        where: { id: reserva.id },
      });
      expect(actual.estado).toBe('CANCELADA');
    });

    it('204 con el código en minúsculas', async () => {
      const reserva = await crearReserva({
        codigoReserva: 'CTUOK002',
        emailCliente: 'ok-minusculas@example.com',
      });

      await cancelar(
        reserva.codigoReserva.toLowerCase(),
        'ok-minusculas@example.com',
      ).expect(204);
    });

    it('404 idéntico ante email incorrecto y ante código inexistente', async () => {
      const reserva = await crearReserva({
        codigoReserva: 'CTU404A1',
        emailCliente: 'e404@example.com',
      });

      const emailIncorrecto = await cancelar(
        reserva.codigoReserva,
        'no-es-el-email@example.com',
      ).expect(404);
      const codigoInexistente = await cancelar(
        'ZZZZZZZZ',
        'e404@example.com',
      ).expect(404);

      expect(emailIncorrecto.body).toEqual(codigoInexistente.body);
      expect(emailIncorrecto.body).toEqual({
        statusCode: 404,
        message: RESERVA_NO_ENCONTRADA_MENSAJE,
        error: 'Not Found',
      });
    });

    it('409 al cancelar una Reserva ya CANCELADA', async () => {
      const reserva = await crearReserva({
        codigoReserva: 'CTU409A1',
        estado: EstadoReserva.CANCELADA,
        emailCliente: 'ya-cancelada@example.com',
      });

      await cancelar(reserva.codigoReserva, 'ya-cancelada@example.com').expect(
        409,
      );
    });

    it('400 con un código de formato inválido', async () => {
      await cancelar('CORTO12', 'valido@example.com').expect(400);
    });

    it('400 con un email inválido', async () => {
      const reserva = await crearReserva({ codigoReserva: 'CTU400EM' });
      await cancelar(reserva.codigoReserva, 'no-es-un-email').expect(400);
    });

    it('400 con un campo extra en el body (forbidNonWhitelisted)', async () => {
      const reserva = await crearReserva({ codigoReserva: 'CTU400EX' });
      await request(app.getHttpServer())
        .post(`/reservas/${reserva.codigoReserva}/cancelar`)
        .send({ email: reserva.emailCliente, rol: 'ADMIN' })
        .expect(400);
    });
  });

  describe('POST /reservas/:codigo/cancelar — rate limiting (4.4)', () => {
    let app: INestApplication<App>;

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
    });

    afterAll(async () => {
      await app.close();
    });

    it('supera THROTTLE_LIMIT y rechaza con 429, sin validar código ni email', async () => {
      const limite = Number(process.env.THROTTLE_LIMIT ?? '10');

      for (let i = 0; i < limite; i++) {
        await request(app.getHttpServer())
          .post('/reservas/ZZZZZZZZ/cancelar')
          .send({ email: 'agota-el-limite@example.com' })
          .expect(404);
      }

      const respuesta = await request(app.getHttpServer())
        .post('/reservas/ZZZZZZZZ/cancelar')
        .send({ email: 'agota-el-limite@example.com' })
        .expect(429);

      expect(JSON.stringify(respuesta.body)).not.toContain(
        RESERVA_NO_ENCONTRADA_MENSAJE,
      );
    });
  });

  describe('PATCH /admin/reservas/:id/no-show', () => {
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

    function marcarNoShow(id: string, token?: string) {
      const req = request(app.getHttpServer()).patch(
        `/admin/reservas/${id}/no-show`,
      );
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    }

    it('401 sin token', async () => {
      const reserva = await crearReserva({ codigoReserva: 'CTU401AA' });
      await marcarNoShow(reserva.id).expect(401);
    });

    it('403 con un JWT válido de rol distinto de ADMIN', async () => {
      const reserva = await crearReserva({ codigoReserva: 'CTU403AA' });
      await marcarNoShow(reserva.id, nonAdminToken).expect(403);
    });

    it('400 con un identificador que no es UUID', async () => {
      await marcarNoShow('no-es-un-uuid', adminToken).expect(400);
    });

    it('404 con un UUID válido que no identifica ninguna Reserva', async () => {
      await marcarNoShow(
        '00000000-0000-4000-8000-000000000000',
        adminToken,
      ).expect(404);
    });

    it('409 si el turno todavía no terminó', async () => {
      const reserva = await crearReserva({
        codigoReserva: 'CTU409NS',
        turnoId: turnoFuturoId,
        fecha: FECHA,
      });

      await marcarNoShow(reserva.id, adminToken).expect(409);
    });

    it('409 si la Reserva no está CONFIRMADA (aunque el turno ya haya terminado)', async () => {
      const reserva = await crearReserva({
        codigoReserva: 'CTU409PD',
        turnoId: turnoPasadoId,
        fecha: sumarDias(hoyLocal(), -1),
        estado: EstadoReserva.PENDIENTE,
      });

      await marcarNoShow(reserva.id, adminToken).expect(409);
    });

    it('204 sin cuerpo, y persiste la Reserva como NO_SHOW', async () => {
      const reserva = await crearReserva({
        codigoReserva: 'CTU204NS',
        turnoId: turnoPasadoId,
        fecha: sumarDias(hoyLocal(), -1),
        estado: EstadoReserva.CONFIRMADA,
      });

      const respuesta = await marcarNoShow(reserva.id, adminToken).expect(204);
      expect(respuesta.body).toEqual({});

      const actual = await prisma.reserva.findUniqueOrThrow({
        where: { id: reserva.id },
      });
      expect(actual.estado).toBe('NO_SHOW');
    });
  });
});
