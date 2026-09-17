import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { JwtService } from '@nestjs/jwt';

interface LoginResponseBody {
  accessToken: string;
}

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let jwtSecret: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    jwtService = moduleFixture.get<JwtService>(JwtService);
    // Obtener el JWT_SECRET del ConfigService
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
