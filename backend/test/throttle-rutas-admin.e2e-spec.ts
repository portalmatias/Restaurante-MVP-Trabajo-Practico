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
 * Tests HTTP (Supertest, sección 3 de `throttle-rutas-admin`) del límite común de las rutas
 * de administración, contra `AppModule` y la base de TEST real (D4).
 *
 * Cada test levanta su propia app, igual que `reserva-consultar-listado.e2e-spec.ts` y
 * `auth.e2e-spec.ts`: cada instancia tiene su propio `ThrottlerStorage` en memoria, así que
 * agotar el cupo de una ruta en un test no puede comerle cupo al siguiente.
 *
 * Sin efectos secundarios (D4): el guard global del throttler corre antes que los guards de
 * controller, los pipes y el handler, así que cuenta igual una solicitud que termina en
 * `404` (UUID inexistente en `PATCH`/`DELETE`) o en `400` (body vacío en `POST`). Solo los
 * escenarios que necesitan comprobar el estado de una Reserva crean datos propios.
 *
 * Los tokens se firman directo con `JwtService` (mismo patrón que
 * `reserva-consultar-listado.e2e-spec.ts`), para no pegarle a `POST /auth/login`, que tiene su
 * propio límite de 5 por minuto, ajeno a lo que se prueba acá, salvo en la regresión que lo
 * comprueba a propósito.
 */

/** Límite común de las rutas de admin (D2): 60 solicitudes por ventana de 60 segundos. */
const LIMITE_ADMIN = 60;

/** UUID bien formado que no identifica ninguna Zona, Mesa, Turno ni Reserva. */
const UUID_INEXISTENTE = '7c9e2b41-3d5a-4f68-9b17-0e4c8a2d6f35';

/** Credenciales del admin del seed (`backend/prisma/seed.ts`), documentadas en el README. */
const ADMIN_EMAIL = 'admin@restaurante-mvp.local';
const ADMIN_PASSWORD = 'AdminMVP2026!';

type Metodo = 'get' | 'post' | 'patch' | 'delete';

interface OperacionAdmin {
  metodo: Metodo;
  ruta: string;
  /** Código que corresponde a la operación con un UUID inexistente o un body vacío (D4). */
  esperado: number;
}

/**
 * Las 12 operaciones de `design.md` → "Contrato OpenAPI", más `GET /admin/reservas`, que ya
 * tenía el mismo límite y ahora lo hereda de la clase: si se perdiera el decorador de método
 * sin que el de clase lo cubra, este test lo detecta.
 */
const OPERACIONES_ADMIN: OperacionAdmin[] = [
  { metodo: 'get', ruta: '/admin/zonas', esperado: 200 },
  { metodo: 'patch', ruta: `/admin/zonas/${UUID_INEXISTENTE}`, esperado: 404 },
  { metodo: 'post', ruta: '/admin/mesas', esperado: 400 },
  { metodo: 'get', ruta: '/admin/mesas', esperado: 200 },
  { metodo: 'patch', ruta: `/admin/mesas/${UUID_INEXISTENTE}`, esperado: 404 },
  { metodo: 'delete', ruta: `/admin/mesas/${UUID_INEXISTENTE}`, esperado: 404 },
  { metodo: 'post', ruta: '/admin/turnos', esperado: 400 },
  { metodo: 'get', ruta: '/admin/turnos', esperado: 200 },
  { metodo: 'patch', ruta: `/admin/turnos/${UUID_INEXISTENTE}`, esperado: 404 },
  { metodo: 'get', ruta: '/admin/reservas', esperado: 200 },
  {
    metodo: 'patch',
    ruta: `/admin/reservas/${UUID_INEXISTENTE}/no-show`,
    esperado: 404,
  },
  {
    metodo: 'patch',
    ruta: `/admin/reservas/${UUID_INEXISTENTE}/confirmar`,
    esperado: 404,
  },
  {
    metodo: 'patch',
    ruta: `/admin/reservas/${UUID_INEXISTENTE}/rechazar`,
    esperado: 404,
  },
];

describe('throttle-rutas-admin (e2e)', () => {
  let prisma: PrismaService;
  let adminToken: string;
  let tokenRolIncorrecto: string;
  let turnoId: string;
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
      { sub: 'admin-throttle-e2e', rol: 'ADMIN' },
      { secret: jwtSecret },
    );
    tokenRolIncorrecto = jwtService.sign(
      { sub: 'no-admin-throttle-e2e', rol: 'CLIENTE' },
      { secret: jwtSecret },
    );

    await configurarZonasYConfiguracionDeSeed(prisma);

    // Banda horaria 16:15-17:30: no la usa ninguna otra suite e2e ni de integración.
    const turno = await prisma.turno.create({
      data: {
        diaSemana: diaDe(FECHA),
        horaInicio: new Date(Date.UTC(1970, 0, 1, 16, 15, 0)),
        horaFin: new Date(Date.UTC(1970, 0, 1, 17, 30, 0)),
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

  /** Una Reserva `PENDIENTE` en una Mesa propia, para no chocar con el índice único parcial. */
  async function crearReservaPendiente(codigoReserva: string) {
    const zonaStandard = await prisma.zona.findUniqueOrThrow({
      where: { nombre: 'STANDARD' },
    });
    const mesa = await prisma.mesa.create({
      data: {
        zonaId: zonaStandard.id,
        capacidad: 4,
        etiqueta: `THR-${codigoReserva}`,
      },
    });
    mesaIds.push(mesa.id);

    return prisma.reserva.create({
      data: {
        mesaId: mesa.id,
        turnoId,
        fecha: FECHA,
        comensales: 2,
        estado: EstadoReserva.PENDIENTE,
        nombreCliente: 'Cliente Throttle Admin E2E',
        emailCliente: 'throttle-admin-e2e@example.com',
        telefonoCliente: '+54 9 11 5555-4321',
        codigoReserva,
      },
    });
  }

  describe('límite común de las rutas de administración', () => {
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

    function enviar(metodo: Metodo, ruta: string, token?: string) {
      const req = request(app.getHttpServer())[metodo](ruta);
      if (token) req.set('Authorization', `Bearer ${token}`);
      return metodo === 'post' ? req.send({}) : req;
    }

    async function agotarCupoDeConfirmar() {
      for (let i = 0; i < LIMITE_ADMIN; i++) {
        await enviar(
          'patch',
          `/admin/reservas/${UUID_INEXISTENTE}/confirmar`,
          adminToken,
        ).expect(404);
      }
    }

    // Escenarios "Solicitudes dentro del límite se atienden" y "La solicitud 61 se rechaza".
    it.each(OPERACIONES_ADMIN)(
      '$metodo $ruta: atiende 60 solicitudes sin 429 y rechaza la 61 con 429',
      async ({ metodo, ruta, esperado }) => {
        for (let i = 0; i < LIMITE_ADMIN; i++) {
          await enviar(metodo, ruta, adminToken).expect(esperado);
        }

        await enviar(metodo, ruta, adminToken).expect(429);
      },
    );

    it('una solicitud rechazada por el límite no confirma la Reserva PENDIENTE', async () => {
      const reserva = await crearReservaPendiente('THRLIM01');
      await agotarCupoDeConfirmar();

      await enviar(
        'patch',
        `/admin/reservas/${reserva.id}/confirmar`,
        adminToken,
      ).expect(429);

      const persistida = await prisma.reserva.findUniqueOrThrow({
        where: { id: reserva.id },
      });
      expect(persistida.estado).toBe(EstadoReserva.PENDIENTE);
    });

    it('con el cupo de confirmar agotado, GET /admin/mesas se atiende con normalidad', async () => {
      await agotarCupoDeConfirmar();
      await enviar(
        'patch',
        `/admin/reservas/${UUID_INEXISTENTE}/confirmar`,
        adminToken,
      ).expect(429);

      await enviar('get', '/admin/mesas', adminToken).expect(200);
    });

    it('una ráfaga de 20 confirmaciones seguidas desde el panel no recibe 429', async () => {
      // Con el límite global anterior (THROTTLE_LIMIT = 10) la solicitud 11 respondía 429.
      const reservas: Awaited<ReturnType<typeof crearReservaPendiente>>[] = [];
      for (let i = 0; i < 20; i++) {
        reservas.push(
          await crearReservaPendiente(`THRRAF${String(i).padStart(2, '0')}`),
        );
      }

      for (const reserva of reservas) {
        await enviar(
          'patch',
          `/admin/reservas/${reserva.id}/confirmar`,
          adminToken,
        ).expect(204);
      }

      const confirmadas = await prisma.reserva.count({
        where: {
          id: { in: reservas.map((r) => r.id) },
          estado: EstadoReserva.CONFIRMADA,
        },
      });
      expect(confirmadas).toBe(20);
    });
  });

  describe('las rutas de admin siguen exigiendo JWT y rol ADMIN', () => {
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

    // El límite más holgado no cambia la autorización: el throttler deja pasar la solicitud
    // y los guards de controller la siguen rechazando.
    it.each(OPERACIONES_ADMIN)(
      '$metodo $ruta: 401 sin token y 403 con un rol distinto de ADMIN',
      async ({ metodo, ruta }) => {
        const sinToken = request(app.getHttpServer())[metodo](ruta);
        await (metodo === 'post' ? sinToken.send({}) : sinToken).expect(401);

        const rolIncorrecto = request(app.getHttpServer())
          [metodo](ruta)
          .set('Authorization', `Bearer ${tokenRolIncorrecto}`);
        await (
          metodo === 'post' ? rolIncorrecto.send({}) : rolIncorrecto
        ).expect(403);
      },
    );
  });

  /**
   * Regresión del requisito "El login y las rutas públicas con código de reserva conservan
   * su límite": los tests originales siguen en `auth.e2e-spec.ts`,
   * `reserva-consultar.e2e-spec.ts` y `cancelacion-turnos.e2e-spec.ts` sin cambios (tarea
   * 3.5). Estos lo comprueban además en una app en la que las rutas de admin ya se usaron, para
   * que `LimiteAdmin()` no pueda filtrarse a una ruta accesible sin token.
   */
  describe('el login y las rutas públicas conservan su límite', () => {
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

      await request(app.getHttpServer())
        .get('/admin/reservas')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    afterEach(async () => {
      await app.close();
    });

    it('POST /auth/login sigue respondiendo 429 al sexto intento, aunque las credenciales sean correctas', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: ADMIN_EMAIL, password: 'contraseña-incorrecta' })
          .expect(401);
      }

      const respuesta = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        .expect(429);

      expect(respuesta.body).not.toHaveProperty('accessToken');
    });

    it('POST /reservas/consultar sigue con el límite general (THROTTLE_LIMIT)', async () => {
      const limite = Number(process.env.THROTTLE_LIMIT ?? '10');
      // Defensa en profundidad del propio test: si alguien subiera THROTTLE_LIMIT por
      // encima del límite de admin, la ruta pública dejaría de ser la más estricta.
      expect(limite).toBeLessThanOrEqual(LIMITE_ADMIN);

      for (let i = 0; i < limite; i++) {
        await request(app.getHttpServer())
          .post('/reservas/consultar')
          .send({ codigo: 'THRNOEX1', email: 'throttle-admin-e2e@example.com' })
          .expect(404);
      }

      await request(app.getHttpServer())
        .post('/reservas/consultar')
        .send({ codigo: 'THRNOEX1', email: 'throttle-admin-e2e@example.com' })
        .expect(429);
    });
  });
});
