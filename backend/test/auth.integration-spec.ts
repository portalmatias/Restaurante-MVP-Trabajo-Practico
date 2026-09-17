import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtService } from '@nestjs/jwt';
import { PrismaModule } from '../src/prisma/prisma.module';
import { AuthModule } from '../src/auth/auth.module';

interface LoginResponseBody {
  accessToken: string;
}

// Necesita Postgres real (login contra el admin del seed, vía PrismaService) — por eso es
// `.integration-spec.ts` y no `.e2e-spec.ts`. `AppModule` todavía no registra `AuthModule`
// (ver el comentario en `app.module.ts`: el job `test` de CI corre sin PostgreSQL hasta
// `ci-integracion-db`), así que este test arma su propio módulo mínimo con lo que
// `AuthModule` necesita, igual que ya hacen `reservas-invariantes.integration-spec.ts` y
// `mesas.integration-spec.ts`.
describe('AuthController (integration)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let jwtSecret: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../.env', '.env'] }),
        PrismaModule,
        AuthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mismo pipe que `main.ts`: sin esto, LoginDto no valida nada en runtime.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    jwtService = moduleFixture.get<JwtService>(JwtService);
    const configService = moduleFixture.get<ConfigService>(ConfigService);
    jwtSecret = configService.getOrThrow<string>('JWT_SECRET');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const ADMIN_EMAIL = 'admin@restaurante-mvp.local';
  const ADMIN_PASSWORD = 'AdminMVP2026!';

  let adminToken: string;

  beforeAll(async () => {
    // Obtener un token de admin válido ANTES de los tests de rate limiting
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    adminToken = (loginResponse.body as LoginResponseBody).accessToken;
  });

  describe('POST /auth/login', () => {
    it('debería devolver un JWT válido con credenciales correctas', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        .expect(200);

      const body = response.body as LoginResponseBody;
      expect(body).toHaveProperty('accessToken');
      expect(typeof body.accessToken).toBe('string');
      expect(body.accessToken.length).toBeGreaterThan(0);

      // Verificar que el token es válido decodificándolo
      const decoded = jwtService.decode<{ sub: string; rol: string }>(
        body.accessToken,
      );
      expect(decoded).toHaveProperty('sub');
      expect(decoded).toHaveProperty('rol', 'ADMIN');
    });

    it('debería devolver 401 con error genérico para email inexistente', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'noexiste@test.com', password: 'password123' })
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Credenciales inválidas');
      expect(response.body).not.toHaveProperty('accessToken');
    });

    it('debería devolver 401 con error genérico para contraseña incorrecta', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: 'wrongpassword' })
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Credenciales inválidas');
      expect(response.body).not.toHaveProperty('accessToken');
    });

    it('debería devolver 400 con un email mal formado', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'no-es-un-email', password: ADMIN_PASSWORD })
        .expect(400);
    });

    it('debería devolver 400 si el body trae campos no declarados en el DTO', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, esAdmin: true })
        .expect(400);
    });

    it('debería devolver 429 después de superar el límite de intentos (rate limiting)', async () => {
      const attempts = 6; // Límite es 5 por 60s

      for (let i = 0; i < attempts - 1; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: ADMIN_EMAIL, password: 'wrongpassword' });
      }

      // El intento 6 debería devolver 429
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: 'wrongpassword' })
        .expect(429);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Rutas protegidas con JwtAuthGuard', () => {
    // Se reutiliza `adminToken` (obtenido una sola vez en el beforeAll de más arriba,
    // antes de que corra el test de rate limiting) en vez de loguearse de nuevo acá:
    // un segundo login en este punto cae dentro de la misma ventana de 60s que el test
    // de rate limiting de arriba ya agotó para /auth/login, así que devolvía 429 en vez
    // de un token y este test fallaba con 401 de forma intermitente.

    it('debería devolver 200 con un token válido', async () => {
      await request(app.getHttpServer())
        .get('/auth/test-protected')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('debería devolver 401 sin header Authorization', async () => {
      await request(app.getHttpServer())
        .get('/auth/test-protected')
        .expect(401);
    });

    it('debería devolver 401 con token inválido', async () => {
      await request(app.getHttpServer())
        .get('/auth/test-protected')
        .set('Authorization', 'Bearer token-invalido')
        .expect(401);
    });

    it('debería devolver 401 con token expirado', async () => {
      // Crear un token expirado (firmado con expiración en el pasado)
      const expiredToken = jwtService.sign(
        { sub: 'user-uuid', rol: 'ADMIN' },
        { expiresIn: '-1h', secret: jwtSecret },
      );

      await request(app.getHttpServer())
        .get('/auth/test-protected')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('Rutas protegidas con RolesGuard', () => {
    let nonAdminToken: string;

    beforeAll(() => {
      // Crear un token con rol diferente (no ADMIN)
      nonAdminToken = jwtService.sign(
        { sub: 'other-user-uuid', rol: 'CLIENTE' },
        { secret: jwtSecret },
      );
    });

    it('debería permitir acceso a admin con rol ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/test-admin-only')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty(
        'message',
        'Ruta solo para admins accesible',
      );
    });

    it('debería devolver 403 con JWT válido pero rol incorrecto', async () => {
      await request(app.getHttpServer())
        .get('/auth/test-admin-only')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);
    });
  });
});
