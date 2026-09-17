import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
// `mesas.integration-spec.ts`. Replica también el `ThrottlerModule`/`APP_GUARD` de
// `AppModule` — sin eso, `@Throttle()` en `AuthController` queda decorado pero sin ningún
// guard que lo haga cumplir.
async function crearAppDeTest(): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: ['../.env', '.env'],
      }),
      ThrottlerModule.forRootAsync({
        inject: [ConfigService],
        useFactory: (config: ConfigService) => [
          {
            ttl: Number(config.get<string>('THROTTLE_TTL', '60')) * 1000,
            limit: Number(config.get<string>('THROTTLE_LIMIT', '10')),
          },
        ],
      }),
      PrismaModule,
      AuthModule,
    ],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  }).compile();

  const app: INestApplication<App> = moduleFixture.createNestApplication();
  // Mismo pipe que `main.ts`: sin esto, LoginDto no valida nada en runtime.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  await app.init();
  return app;
}

describe('AuthController (integration)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let jwtSecret: string;

  beforeAll(async () => {
    app = await crearAppDeTest();
    const jwtServiceRef = app.get(JwtService);
    jwtService = jwtServiceRef;
    const configService = app.get(ConfigService);
    jwtSecret = configService.getOrThrow<string>('JWT_SECRET');
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

// Instancia de app separada (y por lo tanto un ThrottlerStorage en memoria propio): estos
// tests pegan contra /auth/login igual que la suite de arriba, y compartir la misma app
// pisaría la cuenta del rate limiter que usa el test de 429 de más arriba (5 intentos/60s).
describe('POST /auth/login — validación de input (DTO)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await crearAppDeTest();
  });

  afterAll(async () => {
    await app.close();
  });

  it('debería devolver 400 con un email mal formado', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'no-es-un-email', password: 'AdminMVP2026!' })
      .expect(400);
  });

  it('debería devolver 400 si el body trae campos no declarados en el DTO', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@restaurante-mvp.local',
        password: 'AdminMVP2026!',
        esAdmin: true,
      })
      .expect(400);
  });
});
