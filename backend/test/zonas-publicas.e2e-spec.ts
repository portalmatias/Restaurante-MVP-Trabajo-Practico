import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NombreZona } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { upsertSeguro } from './helpers/upsert-seguro';

/**
 * Tarea 5.1 del change `catalogo-publico`: `GET /zonas` por HTTP con Supertest contra la
 * base de TEST real. Se levanta `AppModule` con el mismo `ValidationPipe` que `main.ts`.
 *
 * `Zona.nombre` es un enum de exactamente dos valores, así que no se crean Zonas nuevas:
 * se fijan valores conocidos de STANDARD y VIP con `upsertSeguro` (mismo patrón que
 * `zonas.integration-spec.ts`) y se restauran los originales al terminar.
 */
describe('GET /zonas (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const valoresStandard = {
    minComensales: 1,
    maxComensales: 8,
    anticipacionMinHoras: 2,
    anticipacionMaxDias: 30,
    ventanaCancelacionHoras: 2,
    requiereConfirmacionAdmin: false,
    aforoMaximo: 40,
  };
  const valoresVip = {
    minComensales: 2,
    maxComensales: 12,
    anticipacionMinHoras: 24,
    anticipacionMaxDias: 60,
    ventanaCancelacionHoras: 24,
    requiereConfirmacionAdmin: true,
    aforoMaximo: 20,
  };
  const CLAVES_PUBLICAS = [
    'anticipacionMaxDias',
    'anticipacionMinHoras',
    'id',
    'maxComensales',
    'minComensales',
    'nombre',
    'requiereConfirmacionAdmin',
    'ventanaCancelacionHoras',
  ];

  const originales: Partial<
    Record<NombreZona, typeof valoresVip & { id: string }>
  > = {};

  async function fijarValores(
    nombre: NombreZona,
    valores: typeof valoresVip,
  ): Promise<void> {
    await upsertSeguro(
      () =>
        prisma.zona.upsert({
          where: { nombre },
          update: valores,
          create: { nombre, ...valores },
        }),
      () => prisma.zona.update({ where: { nombre }, data: valores }),
    );
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<INestApplication<App>>();
    // Mismas opciones que main.ts.
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    for (const nombre of [NombreZona.STANDARD, NombreZona.VIP]) {
      const zona = await prisma.zona.findUnique({ where: { nombre } });
      if (zona) originales[nombre] = zona;
    }
    await fijarValores(NombreZona.STANDARD, valoresStandard);
    await fijarValores(NombreZona.VIP, valoresVip);
  });

  afterAll(async () => {
    for (const nombre of [NombreZona.STANDARD, NombreZona.VIP]) {
      const original = originales[nombre];
      if (original) {
        await prisma.zona.update({
          where: { nombre },
          data: { ...original, id: undefined },
        });
      } else {
        // La Zona no existía antes de la suite: la creó `fijarValores`, se borra para no
        // dejar filas en la base de TEST compartida.
        await prisma.zona.deleteMany({ where: { nombre } });
      }
    }
    await app.close();
  });

  it('responde 200 sin header Authorization', async () => {
    const res = await request(app.getHttpServer()).get('/zonas').expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const nombres = (res.body as Array<{ nombre: string }>).map(
      (z) => z.nombre,
    );
    expect(nombres).toEqual(expect.arrayContaining(['STANDARD', 'VIP']));
  });

  it('ordena las Zonas de forma determinística: STANDARD antes que VIP', async () => {
    const res = await request(app.getHttpServer()).get('/zonas').expect(200);

    const nombres = (res.body as Array<{ nombre: string }>).map(
      (z) => z.nombre,
    );
    expect(nombres).toEqual(['STANDARD', 'VIP']);
  });

  it('ningún elemento expone aforoMaximo ni mesas', async () => {
    const res = await request(app.getHttpServer()).get('/zonas').expect(200);

    for (const zona of res.body as Array<Record<string, unknown>>) {
      expect(zona).not.toHaveProperty('aforoMaximo');
      expect(zona).not.toHaveProperty('mesas');
      expect(Object.keys(zona).sort()).toEqual(CLAVES_PUBLICAS);
    }
  });

  it('la Zona VIP trae los campos públicos con los valores fijados', async () => {
    const res = await request(app.getHttpServer()).get('/zonas').expect(200);

    const vip = (res.body as Array<Record<string, unknown>>).find(
      (z) => z.nombre === 'VIP',
    );
    expect(vip).toMatchObject({
      minComensales: 2,
      maxComensales: 12,
      anticipacionMinHoras: 24,
      anticipacionMaxDias: 60,
      ventanaCancelacionHoras: 24,
      requiereConfirmacionAdmin: true,
    });
    expect(Object.keys(vip ?? {}).sort()).toEqual(CLAVES_PUBLICAS);
  });
});
