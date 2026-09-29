import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';

/**
 * Tarea 5.3 del change `catalogo-publico`: no regresión. Agregar los controllers públicos
 * `GET /zonas` y `GET /turnos` no puede abrir las rutas de administración, que siguen
 * exigiendo JWT.
 */
describe('Catálogo público: no regresión de las rutas admin (e2e)', () => {
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

  it('GET /admin/zonas sin Authorization sigue respondiendo 401', async () => {
    await request(app.getHttpServer()).get('/admin/zonas').expect(401);
  });

  it('GET /admin/turnos sin Authorization sigue respondiendo 401', async () => {
    await request(app.getHttpServer()).get('/admin/turnos').expect(401);
  });
});
