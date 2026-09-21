import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

interface LoginResponseBody {
  accessToken: string;
}

const ADMIN_EMAIL = 'admin@restaurante-mvp.local';
const ADMIN_PASSWORD = 'AdminMVP2026!';

/**
 * Login de admin contra la `AppModule` REAL, la misma que arranca `main.ts`: verifica que
 * `AuthModule` esté registrado en ella, con el `ThrottlerGuard` global y sus dependencias
 * (`PrismaModule`, `JwtModule`) resueltas. `auth.integration-spec.ts` cubre los guards y el
 * detalle del login con un módulo mínimo propio; ese módulo no detectaría que `AppModule`
 * se olvidó de importar `AuthModule`.
 *
 * Necesita Postgres migrado y con el seed aplicado (el admin sale de `backend/prisma/seed.ts`)
 * y `JWT_SECRET` en el entorno: en CI llegan del job `test`.
 *
 * Se crea una app nueva por test: cada una tiene su propio `ThrottlerStorage` en memoria, y
 * `/auth/login` corta a los 5 intentos por minuto, así que compartir una sola app haría que
 * un test agotara el cupo del siguiente.
 */
describe('Auth en la AppModule real (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mismo pipe que `main.ts`: `createNestApplication` no lo trae, y sin él LoginDto no
    // valida nada en runtime.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /auth/login', () => {
    it('devuelve un JWT de ADMIN con las credenciales del seed', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        .expect(200);

      const { accessToken } = response.body as LoginResponseBody;
      expect(typeof accessToken).toBe('string');

      const decoded = app
        .get(JwtService)
        .decode<{ sub: string; rol: string }>(accessToken);
      expect(decoded).toHaveProperty('sub');
      expect(decoded).toHaveProperty('rol', 'ADMIN');
    });

    it('responde 401 idéntico para contraseña incorrecta y para email inexistente', async () => {
      const passwordIncorrecta = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: 'contraseña-incorrecta' })
        .expect(401);

      const emailInexistente = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'no-existe@restaurante-mvp.local', password: 'x' })
        .expect(401);

      // Mismo cuerpo completo (statusCode, message, error): nada que le permita a quien
      // ataca distinguir si el email existe.
      expect(passwordIncorrecta.body).toEqual(emailInexistente.body);
      expect(passwordIncorrecta.body).not.toHaveProperty('accessToken');
    });

    it('responde 400 con un email mal formado, sin contraseña o con campos no declarados', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'no-es-un-email', password: ADMIN_PASSWORD })
        .expect(400);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL })
        .expect(400);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, rol: 'ADMIN' })
        .expect(400);
    });

    it('responde 429 al superar los 5 intentos por minuto, incluso con credenciales correctas', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: ADMIN_EMAIL, password: 'contraseña-incorrecta' })
          .expect(401);
      }

      // El límite se aplica antes de validar credenciales: ni con la contraseña correcta
      // se emite un token una vez superado.
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        .expect(429);

      expect(response.body).not.toHaveProperty('accessToken');
    });
  });

  // `AuthController` no debe exponer rutas de prueba en la API real: las que ejercitan los
  // guards viven en `test/support/guards-probe.controller.ts` y solo las monta el módulo de
  // prueba de `auth.integration-spec.ts`.
  describe('rutas de prueba de los guards', () => {
    it.each(['/auth/test-protected', '/auth/test-admin-only'])(
      'GET %s no existe en la app real (404), ni siquiera con un token de admin',
      async (ruta) => {
        await request(app.getHttpServer()).get(ruta).expect(404);

        const login = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
          .expect(200);

        await request(app.getHttpServer())
          .get(ruta)
          .set(
            'Authorization',
            `Bearer ${(login.body as LoginResponseBody).accessToken}`,
          )
          .expect(404);
      },
    );
  });
});
