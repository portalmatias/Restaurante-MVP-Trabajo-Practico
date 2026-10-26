import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { PlanoMesasRespuesta } from '../src/plano-mesas/dto/plano-mesas-respuesta.dto';
import { PlanoMesasService } from '../src/plano-mesas/plano-mesas.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { diaDe, FECHA, fechaISO } from './support/fechas-e2e';
import {
  configurarZonasYConfiguracionDeSeed,
  TURNO_UUID_INEXISTENTE,
  ZONA_UUID_INEXISTENTE,
} from './support/zonas-seed-e2e';

/**
 * Tarea 4.1 de `plano-mesas`: `GET /plano-mesas` por HTTP con la app completa (ruta pública,
 * validación, códigos de error, `Cache-Control` y límite de 120 solicitudes por minuto).
 *
 * El límite se prueba con las 121 solicitudes reales, como `throttle-rutas-admin.e2e-spec.ts`:
 * no se baja por configuración. Cada `describe` crea su propia app, así el contador del
 * throttler (en memoria) arranca de cero.
 *
 * Banda horaria propia del turno de esta suite: 19:10–19:50 (ninguna otra la usa).
 */
const LIMITE_PLANO = 120;
const HORA_INICIO_TURNO = new Date(Date.UTC(1970, 0, 1, 19, 10, 0));

async function crearApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();
  return app;
}

describe('GET /plano-mesas (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let consulta: Record<string, string | number>;

  async function limpiarRestos() {
    await prisma.turno.deleteMany({
      where: { diaSemana: diaDe(FECHA), horaInicio: HORA_INICIO_TURNO },
    });
  }

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    const { zonaStandardId } =
      await configurarZonasYConfiguracionDeSeed(prisma);
    await limpiarRestos();
    const turno = await prisma.turno.create({
      data: {
        diaSemana: diaDe(FECHA),
        horaInicio: HORA_INICIO_TURNO,
        horaFin: new Date(Date.UTC(1970, 0, 1, 19, 50, 0)),
        activo: true,
      },
    });
    consulta = {
      fecha: fechaISO(FECHA),
      turnoId: turno.id,
      zonaId: zonaStandardId,
      comensales: 2,
    };
  });

  afterAll(async () => {
    await limpiarRestos();
    await app.close();
  });

  it('responde 200 sin token, con el plano de la zona y Cache-Control: no-store', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/plano-mesas')
      .query(consulta)
      .expect(200);

    expect(respuesta.headers['cache-control']).toBe('no-store');
    const cuerpo = respuesta.body as PlanoMesasRespuesta;
    expect(cuerpo.zona).toBe('STANDARD');
    expect(typeof cuerpo.disponible).toBe('boolean');
    expect(Array.isArray(cuerpo.mesas)).toBe(true);
  });

  it('responde 400 con comensales en 0', async () => {
    await request(app.getHttpServer())
      .get('/plano-mesas')
      .query({ ...consulta, comensales: 0 })
      .expect(400);
  });

  it('responde 404 con una zona inexistente', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/plano-mesas')
      .query({ ...consulta, zonaId: ZONA_UUID_INEXISTENTE })
      .expect(404);
    expect((respuesta.body as { message: string }).message).toBe(
      `No existe una zona con id ${ZONA_UUID_INEXISTENTE}`,
    );
  });

  it('responde 404 con un turno inexistente', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/plano-mesas')
      .query({ ...consulta, turnoId: TURNO_UUID_INEXISTENTE })
      .expect(404);
    expect((respuesta.body as { message: string }).message).toBe(
      `No existe un turno con id ${TURNO_UUID_INEXISTENTE}`,
    );
  });

  describe('límite de solicitudes', () => {
    let appLimite: INestApplication<App>;

    beforeAll(async () => {
      appLimite = await crearApp();
    });

    afterAll(async () => {
      await appLimite.close();
    });

    it('atiende 120 solicitudes y rechaza la 121 con 429 sin consultar la base', async () => {
      const consultar = jest.spyOn(
        appLimite.get(PlanoMesasService),
        'consultar',
      );

      for (let i = 0; i < LIMITE_PLANO; i++) {
        await request(appLimite.getHttpServer())
          .get('/plano-mesas')
          .query(consulta)
          .expect(200);
      }
      await request(appLimite.getHttpServer())
        .get('/plano-mesas')
        .query(consulta)
        .expect(429);

      expect(consultar).toHaveBeenCalledTimes(LIMITE_PLANO);
    });
  });
});
