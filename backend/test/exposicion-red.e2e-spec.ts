import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configurarRed } from '../src/configurar-red';

/**
 * Tareas 3.1 a 3.3 de `exposicion-red-local` (design.md D2 y D3): el origen con el que
 * `ThrottlerGuard` cuenta los límites no se puede falsificar con `X-Forwarded-For`.
 *
 * Se arma la `AppModule` real con `configurarRed`, la misma función que usa `main.ts`, y el
 * `ThrottlerGuard` global de verdad. Necesita Postgres migrado (el login busca el usuario y la
 * consulta busca la reserva), igual que `auth.e2e-spec.ts`; no necesita datos propios: los
 * intentos son con credenciales o códigos que no existen.
 *
 * Se crea una app nueva por test: cada una tiene su propio `ThrottlerStorage` en memoria, así
 * ningún test agota el cupo de otro (mismo patrón que `auth.e2e-spec.ts`).
 *
 * Las IPs de los encabezados son de los bloques reservados para documentación (RFC 5737), así
 * que no pueden coincidir con la IP real de la conexión de Supertest (loopback).
 */
describe('Origen del cliente y X-Forwarded-For (e2e)', () => {
  let app: NestExpressApplication | undefined;

  /** Límite de `/auth/login` (`@Throttle` de `AuthController`, design.md de auth-admin). */
  const LIMITE_LOGIN = 5;

  /**
   * `valorTrustProxy` va siempre explícito (`''` para "sin TRUST_PROXY"): con `undefined`,
   * `configurarRed` leería el `TRUST_PROXY` del `.env` de quien corre los tests.
   */
  async function crearApp(
    valorTrustProxy: string,
  ): Promise<NestExpressApplication> {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const nueva = moduleRef.createNestApplication<NestExpressApplication>();
    configurarRed(nueva, valorTrustProxy);
    // Mismo pipe que `main.ts`: `createNestApplication` no lo trae.
    nueva.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await nueva.init();
    app = nueva;
    return nueva;
  }

  function servidor(): App {
    if (!app) {
      throw new Error('La app del test no se creó');
    }
    return app.getHttpServer();
  }

  function loginFallido(xForwardedFor?: string): request.Test {
    const pedido = request(servidor()).post('/auth/login').send({
      email: 'no-existe@restaurante-mvp.local',
      password: 'contraseña-incorrecta',
    });
    return xForwardedFor
      ? pedido.set('X-Forwarded-For', xForwardedFor)
      : pedido;
  }

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  describe('sin TRUST_PROXY (default)', () => {
    it('cambiar X-Forwarded-For en cada intento no evita el límite de login', async () => {
      await crearApp('');

      for (let i = 1; i <= LIMITE_LOGIN; i++) {
        await loginFallido(`198.51.100.${i}`).expect(401);
      }

      // El sexto, con otra IP inventada más, cae en el mismo cupo: el backend cuenta por la
      // conexión, no por lo que dice el encabezado.
      await loginFallido('198.51.100.99').expect(429);
    });

    it('tampoco lo evitan X-Real-IP ni Forwarded', async () => {
      await crearApp('');

      for (let i = 1; i <= LIMITE_LOGIN; i++) {
        await request(servidor())
          .post('/auth/login')
          .set('X-Real-IP', `198.51.100.${i}`)
          .set('Forwarded', `for=198.51.100.${i}`)
          .send({
            email: 'no-existe@restaurante-mvp.local',
            password: 'contraseña-incorrecta',
          })
          .expect(401);
      }

      await loginFallido().expect(429);
    });

    it('cambiar X-Forwarded-For no evita el límite de la consulta pública', async () => {
      await crearApp('');
      const limite = Number(process.env.THROTTLE_LIMIT ?? '10');

      for (let i = 1; i <= limite; i++) {
        await request(servidor())
          .post('/reservas/consultar')
          .set('X-Forwarded-For', `198.51.100.${i}`)
          .send({ codigo: 'NOEXISTE', email: 'agota-el-limite@example.com' })
          .expect(404);
      }

      // `429` en la misma solicitud que sin el encabezado: la siguiente a `THROTTLE_LIMIT`
      // (ver el caso equivalente en `reserva-consultar.e2e-spec.ts`).
      await request(servidor())
        .post('/reservas/consultar')
        .set('X-Forwarded-For', '198.51.100.99')
        .send({ codigo: 'NOEXISTE', email: 'agota-el-limite@example.com' })
        .expect(429);
    });
  });

  describe('con TRUST_PROXY=loopback (salto confiable declarado)', () => {
    // Supertest se conecta por loopback, así que hace de proxy de borde: agrega la IP "real"
    // al final del encabezado, después de lo que haya inventado el cliente.
    const IP_REAL = '203.0.113.10';
    const OTRA_IP_REAL = '203.0.113.20';

    it('cuenta el límite para la IP que agregó el proxy, no para la que inventó el cliente', async () => {
      await crearApp('loopback');

      for (let i = 1; i <= LIMITE_LOGIN; i++) {
        await loginFallido(`198.51.100.${i}, ${IP_REAL}`).expect(401);
      }

      // Mismo cliente real, con otra IP inventada: sigue bloqueado.
      await loginFallido(`198.51.100.99, ${IP_REAL}`).expect(429);

      // Otro cliente real, detrás del mismo proxy: tiene su propio cupo.
      await loginFallido(`198.51.100.1, ${OTRA_IP_REAL}`).expect(401);
    });

    /**
     * Control del test anterior (tarea 3.3: "verificar que el test falla si se configura
     * `trust proxy` con `true`"). Con `true`, Express toma la primera IP del encabezado, la
     * que escribe el cliente, y el mismo recorrido NO llega al `429`. `configurarRed` rechaza
     * `true`, así que se configura directo sobre Express: es justo lo que la validación evita.
     */
    it('control: con `trust proxy` en `true` el cliente evade el límite (por eso se rechaza)', async () => {
      const inseguro = await crearApp('');
      inseguro.set('trust proxy', true);

      for (let i = 1; i <= LIMITE_LOGIN + 1; i++) {
        await loginFallido(`198.51.100.${i}, ${IP_REAL}`).expect(401);
      }
      expect(() => configurarRed(inseguro, 'true')).toThrow(
        /declarar los saltos confiables/,
      );
    });
  });
});
