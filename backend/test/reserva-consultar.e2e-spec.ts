import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EstadoReserva } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { RESERVA_NO_ENCONTRADA_MENSAJE } from '../src/reservas/reserva-no-encontrada';
import { PrismaService } from '../src/prisma/prisma.service';
import { diaDe, FECHA } from './support/fechas-e2e';
import { configurarZonasYConfiguracionDeSeed } from './support/zonas-seed-e2e';

interface ReservaConsultadaBody {
  codigoReserva: string;
  estado: string;
  fecha: string;
  comensales: number;
  turno: { id: string; horaInicio: string; horaFin: string };
  zona: { id: string; nombre: string };
}

/**
 * Tareas 2.4, 2.5 y 2.7 (a nivel HTTP) de `reserva-consultar`: `POST /reservas/consultar`
 * con Supertest, contra la base de TEST real.
 *
 * Alcance: lo que agrega el endpoint sobre lo ya probado en
 * `reservas-consultar.service.spec.ts` (unitario) y
 * `test/reserva-consultar.integration-spec.ts` (búsqueda contra Postgres real): los códigos
 * HTTP, la forma exacta del cuerpo, `forbidNonWhitelisted` sobre el body, y que el service
 * esté bien cableado detrás del controller. Los bordes de la comparación (mayúsculas,
 * comodines de email) no se repiten acá.
 *
 * **Datos:** la Reserva de prueba se crea una sola vez en `beforeAll` (banda horaria
 * 11:00–11:59, que no usa ninguna otra suite e2e: `reservas-crear` usa 10:00–10:59 y
 * `disponibilidad` 05/06/07:xx) y se lee, nunca se escribe, así que compartirla entre tests
 * es seguro.
 *
 * **App:** a diferencia de `reservas-crear.e2e-spec.ts` (cuya ruta tiene `@SkipThrottle()`),
 * `POST /reservas/consultar` SÍ pasa por el límite global (D5 del design). Por eso cada test
 * de las secciones "200" y "rechazos" levanta su propia app en `beforeEach` — mismo patrón
 * que `auth.e2e-spec.ts` —, para que ningún test agote el cupo de `THROTTLE_LIMIT` que
 * necesita otro. La sección "rate limiting" hace lo contrario a propósito: comparte una sola
 * app para agotar el límite y comprobar el `429`.
 */
describe('POST /reservas/consultar (e2e)', () => {
  let prisma: PrismaService;
  let turnoId: string;
  let mesaId: string;
  let reservaConfirmada: { codigoReserva: string; emailCliente: string };
  let reservaCancelada: { codigoReserva: string; emailCliente: string };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const setupApp = moduleRef.createNestApplication();
    await setupApp.init();
    prisma = setupApp.get(PrismaService);

    const { zonaStandardId } =
      await configurarZonasYConfiguracionDeSeed(prisma);

    const turno = await prisma.turno.create({
      data: {
        diaSemana: diaDe(FECHA),
        horaInicio: new Date(Date.UTC(1970, 0, 1, 11, 0, 0)),
        horaFin: new Date(Date.UTC(1970, 0, 1, 14, 0, 0)),
        activo: true,
      },
    });
    turnoId = turno.id;

    const mesa = await prisma.mesa.create({
      data: { zonaId: zonaStandardId, capacidad: 4, etiqueta: 'RCO-E2E' },
    });
    mesaId = mesa.id;

    const confirmada = await prisma.reserva.create({
      data: {
        mesaId,
        turnoId,
        fecha: FECHA,
        comensales: 2,
        estado: EstadoReserva.CONFIRMADA,
        nombreCliente: 'Cliente Consulta E2E',
        emailCliente: 'consulta-e2e@example.com',
        telefonoCliente: '+54 9 11 5555-1234',
        codigoReserva: 'RCOE2EC1',
      },
    });
    reservaConfirmada = {
      codigoReserva: confirmada.codigoReserva,
      emailCliente: confirmada.emailCliente,
    };

    const cancelada = await prisma.reserva.create({
      data: {
        mesaId,
        turnoId,
        fecha: FECHA,
        comensales: 2,
        estado: EstadoReserva.CANCELADA,
        nombreCliente: 'Cliente Consulta E2E Cancelada',
        emailCliente: 'consulta-e2e-cancelada@example.com',
        telefonoCliente: '+54 9 11 5555-4321',
        codigoReserva: 'RCOE2EC2',
      },
    });
    reservaCancelada = {
      codigoReserva: cancelada.codigoReserva,
      emailCliente: cancelada.emailCliente,
    };

    await setupApp.close();
  });

  afterAll(async () => {
    await prisma.reserva.deleteMany({ where: { mesaId } });
    await prisma.mesa.deleteMany({ where: { id: mesaId } });
    await prisma.turno.deleteMany({ where: { id: turnoId } });
    await prisma.$disconnect();
  });

  describe('200 y rechazos', () => {
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

    function consultar(body: unknown) {
      return request(app.getHttpServer())
        .post('/reservas/consultar')
        .send(body as object);
    }

    it('200 con código y email correctos, con la forma exacta de la vista mínima', async () => {
      const respuesta = await consultar({
        codigo: reservaConfirmada.codigoReserva,
        email: reservaConfirmada.emailCliente,
      }).expect(200);

      const cuerpo = respuesta.body as ReservaConsultadaBody;
      expect(cuerpo).toEqual({
        codigoReserva: reservaConfirmada.codigoReserva,
        estado: 'CONFIRMADA',
        fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) as string,
        comensales: 2,
        turno: {
          id: turnoId,
          horaInicio: '11:00',
          horaFin: '14:00',
        },
        zona: { id: expect.any(String) as string, nombre: 'STANDARD' },
      });
    });

    it('200 con el código en minúsculas', async () => {
      await consultar({
        codigo: reservaConfirmada.codigoReserva.toLowerCase(),
        email: reservaConfirmada.emailCliente,
      }).expect(200);
    });

    it('200 con una Reserva CANCELADA: sigue siendo consultable', async () => {
      const respuesta = await consultar({
        codigo: reservaCancelada.codigoReserva,
        email: reservaCancelada.emailCliente,
      }).expect(200);

      expect((respuesta.body as ReservaConsultadaBody).estado).toBe(
        'CANCELADA',
      );
    });

    it('404 idéntico ante email incorrecto y ante código inexistente', async () => {
      const emailIncorrecto = await consultar({
        codigo: reservaConfirmada.codigoReserva,
        email: 'no-es-el-email@example.com',
      }).expect(404);

      const codigoInexistente = await consultar({
        codigo: 'ZZZZZZZZ',
        email: reservaConfirmada.emailCliente,
      }).expect(404);

      expect(emailIncorrecto.body).toEqual(codigoInexistente.body);
      expect(emailIncorrecto.body).toEqual({
        statusCode: 404,
        message: RESERVA_NO_ENCONTRADA_MENSAJE,
        error: 'Not Found',
      });
    });

    it('el 404 no repite el código ni el email que se enviaron', async () => {
      const email = 'sin-eco-en-el-error@example.com';
      const respuesta = await consultar({
        codigo: reservaConfirmada.codigoReserva,
        email,
      }).expect(404);

      const cuerpo = JSON.stringify(respuesta.body);
      expect(cuerpo).not.toContain(reservaConfirmada.codigoReserva);
      expect(cuerpo).not.toContain(email);
    });

    it('400 con un código de 7 caracteres', async () => {
      await consultar({
        codigo: 'CORTO12',
        email: reservaConfirmada.emailCliente,
      }).expect(400);
    });

    it('400 con un código con símbolos', async () => {
      await consultar({
        codigo: 'ABC-123!',
        email: reservaConfirmada.emailCliente,
      }).expect(400);
    });

    it('400 con un email inválido', async () => {
      await consultar({
        codigo: reservaConfirmada.codigoReserva,
        email: 'no-es-un-email',
      }).expect(400);
    });

    it('400 con un body vacío, y el mensaje nombra los campos faltantes', async () => {
      const respuesta = await consultar({}).expect(400);

      const mensajes = (respuesta.body as { message: string[] }).message;
      expect(mensajes.some((m) => m.includes('codigo'))).toBe(true);
      expect(mensajes.some((m) => m.includes('email'))).toBe(true);
    });

    it('400 con un campo extra en el body (forbidNonWhitelisted)', async () => {
      await consultar({
        codigo: reservaConfirmada.codigoReserva,
        email: reservaConfirmada.emailCliente,
        rol: 'ADMIN',
      }).expect(400);
    });

    it('es de solo lectura por HTTP: dos consultas devuelven lo mismo y no cambian la Reserva', async () => {
      const antes = await prisma.reserva.findUniqueOrThrow({
        where: { codigoReserva: reservaConfirmada.codigoReserva },
      });

      const primera = await consultar({
        codigo: reservaConfirmada.codigoReserva,
        email: reservaConfirmada.emailCliente,
      }).expect(200);
      const segunda = await consultar({
        codigo: reservaConfirmada.codigoReserva,
        email: reservaConfirmada.emailCliente,
      }).expect(200);

      const despues = await prisma.reserva.findUniqueOrThrow({
        where: { codigoReserva: reservaConfirmada.codigoReserva },
      });
      expect(segunda.body).toEqual(primera.body);
      expect(despues.estado).toBe(antes.estado);
      expect(despues.mesaId).toBe(antes.mesaId);
      expect(despues.updatedAt.getTime()).toBe(antes.updatedAt.getTime());
    });
  });

  describe('rate limiting', () => {
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

    it('supera THROTTLE_LIMIT y rechaza con 429, incluso con código y email correctos', async () => {
      const limite = Number(process.env.THROTTLE_LIMIT ?? '10');

      for (let i = 0; i < limite; i++) {
        await request(app.getHttpServer())
          .post('/reservas/consultar')
          .send({
            codigo: reservaConfirmada.codigoReserva,
            email: 'agota-el-limite@example.com',
          })
          .expect(404);
      }

      const respuesta = await request(app.getHttpServer())
        .post('/reservas/consultar')
        .send({
          codigo: reservaConfirmada.codigoReserva,
          email: reservaConfirmada.emailCliente,
        })
        .expect(429);

      expect(respuesta.body).not.toHaveProperty('codigoReserva');
    });
  });
});
