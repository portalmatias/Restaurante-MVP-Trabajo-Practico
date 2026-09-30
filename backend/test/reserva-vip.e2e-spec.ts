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
 * Tests HTTP (Supertest, tareas 2.3 y sección 3) de `reserva-vip` contra la base de TEST
 * real: `PATCH /admin/reservas/:id/confirmar` y `PATCH /admin/reservas/:id/rechazar`.
 *
 * Alcance: lo que agregan los endpoints sobre lo ya probado en
 * `reservas-vip.service.spec.ts` (unitario, con `transicionarEstado` espiado) — los códigos
 * HTTP, los guards de admin y, sobre todo, que `rechazar` de verdad rechace una Reserva
 * `CONFIRMADA` contra Postgres real: es la garantía que motivó agregar
 * `desdeEstadoEsperado` a `transicionarEstado` (ver `reservas.service.ts`), y solo se puede
 * verificar de punta a punta acá, no con `transicionarEstado` mockeado.
 *
 * No hace falta que la Zona sea VIP: ni `confirmar` ni `rechazar` validan la Zona (design.md
 * — "El gate de la transición es el estado, no la Zona"), así que las Reservas de prueba
 * usan la Zona STANDARD del seed, como el resto de las suites e2e de `reservas`.
 */
describe('reserva-vip (e2e)', () => {
  let prisma: PrismaService;
  let turnoId: string;
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
      { sub: 'admin-reserva-vip-e2e', rol: 'ADMIN' },
      { secret: jwtSecret },
    );
    nonAdminToken = jwtService.sign(
      { sub: 'no-admin-reserva-vip-e2e', rol: 'CLIENTE' },
      { secret: jwtSecret },
    );

    await configurarZonasYConfiguracionDeSeed(prisma);

    // Banda horaria 18:30-21:00: no la usa ninguna otra suite e2e (cancelacion-turnos usa
    // 17:45, reserva-consultar 11:00, reservas-crear 10:00, disponibilidad 05/06/07:xx).
    const turno = await prisma.turno.create({
      data: {
        diaSemana: diaDe(FECHA),
        horaInicio: new Date(Date.UTC(1970, 0, 1, 18, 30, 0)),
        horaFin: new Date(Date.UTC(1970, 0, 1, 21, 0, 0)),
        activo: true,
      },
    });
    turnoId = turno.id;

    await setupApp.close();
  });

  afterAll(async () => {
    await prisma.reserva.deleteMany({ where: { mesaId: { in: mesaIds } } });
    await prisma.mesa.deleteMany({ where: { id: { in: mesaIds } } });
    await prisma.turno.deleteMany({ where: { id: { in: [turnoId] } } });
    await prisma.$disconnect();
  });

  async function crearReserva(estado: EstadoReserva, codigoReserva: string) {
    const zonaStandard = await prisma.zona.findUniqueOrThrow({
      where: { nombre: 'STANDARD' },
    });
    const mesa = await prisma.mesa.create({
      data: {
        zonaId: zonaStandard.id,
        capacidad: 4,
        etiqueta: `RVIP-${codigoReserva}`,
      },
    });
    mesaIds.push(mesa.id);

    return prisma.reserva.create({
      data: {
        mesaId: mesa.id,
        turnoId,
        fecha: FECHA,
        comensales: 2,
        estado,
        nombreCliente: 'Cliente Reserva VIP E2E',
        emailCliente: 'reserva-vip-e2e@example.com',
        telefonoCliente: '+54 9 11 5555-1234',
        codigoReserva,
      },
    });
  }

  describe('PATCH /admin/reservas/:id/confirmar y /rechazar', () => {
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

    function patch(path: string, token?: string) {
      const req = request(app.getHttpServer()).patch(path);
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    }

    it('confirmar: 401 sin token', async () => {
      const reserva = await crearReserva(EstadoReserva.PENDIENTE, 'RVIP401A');
      await patch(`/admin/reservas/${reserva.id}/confirmar`).expect(401);
    });

    it('rechazar: 401 sin token', async () => {
      const reserva = await crearReserva(EstadoReserva.PENDIENTE, 'RVIP401B');
      await patch(`/admin/reservas/${reserva.id}/rechazar`).expect(401);
    });

    it('confirmar: 403 con un JWT válido de rol distinto de ADMIN', async () => {
      const reserva = await crearReserva(EstadoReserva.PENDIENTE, 'RVIP403A');
      await patch(
        `/admin/reservas/${reserva.id}/confirmar`,
        nonAdminToken,
      ).expect(403);
    });

    it('rechazar: 403 con un JWT válido de rol distinto de ADMIN', async () => {
      const reserva = await crearReserva(EstadoReserva.PENDIENTE, 'RVIP403B');
      await patch(
        `/admin/reservas/${reserva.id}/rechazar`,
        nonAdminToken,
      ).expect(403);
    });

    it('confirmar: 400 con un identificador que no es UUID', async () => {
      await patch('/admin/reservas/no-es-un-uuid/confirmar', adminToken).expect(
        400,
      );
    });

    it('rechazar: 400 con un identificador que no es UUID', async () => {
      await patch('/admin/reservas/no-es-un-uuid/rechazar', adminToken).expect(
        400,
      );
    });

    it('confirmar: 404 con un UUID válido que no identifica ninguna Reserva', async () => {
      await patch(
        '/admin/reservas/00000000-0000-4000-8000-000000000000/confirmar',
        adminToken,
      ).expect(404);
    });

    it('rechazar: 404 con un UUID válido que no identifica ninguna Reserva', async () => {
      await patch(
        '/admin/reservas/00000000-0000-4000-8000-000000000000/rechazar',
        adminToken,
      ).expect(404);
    });

    it('confirmar: 204 sin cuerpo y persiste CONFIRMADA', async () => {
      const reserva = await crearReserva(EstadoReserva.PENDIENTE, 'RVIP204A');

      const respuesta = await patch(
        `/admin/reservas/${reserva.id}/confirmar`,
        adminToken,
      ).expect(204);
      expect(respuesta.body).toEqual({});

      const actual = await prisma.reserva.findUniqueOrThrow({
        where: { id: reserva.id },
      });
      expect(actual.estado).toBe('CONFIRMADA');
    });

    it('confirmar: 409 si la Reserva no está PENDIENTE', async () => {
      const reserva = await crearReserva(EstadoReserva.CONFIRMADA, 'RVIP409A');
      await patch(`/admin/reservas/${reserva.id}/confirmar`, adminToken).expect(
        409,
      );
    });

    it('rechazar: 204 sin cuerpo y persiste CANCELADA', async () => {
      const reserva = await crearReserva(EstadoReserva.PENDIENTE, 'RVIP204B');

      const respuesta = await patch(
        `/admin/reservas/${reserva.id}/rechazar`,
        adminToken,
      ).expect(204);
      expect(respuesta.body).toEqual({});

      const actual = await prisma.reserva.findUniqueOrThrow({
        where: { id: reserva.id },
      });
      expect(actual.estado).toBe('CANCELADA');
    });

    it('rechazar: 409 si la Reserva ya está CANCELADA', async () => {
      const reserva = await crearReserva(EstadoReserva.CANCELADA, 'RVIP409B');
      await patch(`/admin/reservas/${reserva.id}/rechazar`, adminToken).expect(
        409,
      );
    });

    /**
     * El test que de verdad justifica `desdeEstadoEsperado` en `transicionarEstado`: sin él,
     * `CONFIRMADA -> CANCELADA` es una transición válida en `TRANSICIONES_VALIDAS` (la usa
     * `cancelar`, del cliente) y `rechazar` la aceptaría igual, violando la spec ("Rechazo
     * bloqueado si la Reserva no está pendiente"). Contra Postgres real, no contra un mock de
     * `transicionarEstado`.
     */
    it('rechazar: 409 si la Reserva ya está CONFIRMADA (no la cancela silenciosamente)', async () => {
      const reserva = await crearReserva(EstadoReserva.CONFIRMADA, 'RVIP409C');

      await patch(`/admin/reservas/${reserva.id}/rechazar`, adminToken).expect(
        409,
      );

      const actual = await prisma.reserva.findUniqueOrThrow({
        where: { id: reserva.id },
      });
      expect(actual.estado).toBe('CONFIRMADA');
    });
  });
});
