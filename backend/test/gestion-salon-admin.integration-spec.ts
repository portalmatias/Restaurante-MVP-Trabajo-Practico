import { execFileSync } from 'node:child_process';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { DiaSemana, EstadoReserva, Mesa } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';

import { seedCatalogo } from '../prisma/catalogo';
import { seedPlano } from '../prisma/plano-desarrollo';
import { fechaCalendarioAIso } from '../src/common/timezone';

import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthModule } from '../src/auth/auth.module';
import { ZonasModule } from '../src/zonas/zonas.module';
import { MesasModule } from '../src/mesas/mesas.module';
import { HorariosModule } from '../src/horarios/horarios.module';
import { PlanoMesasModule } from '../src/plano-mesas/plano-mesas.module';
import { PlanoMesasService } from '../src/plano-mesas/plano-mesas.service';
import { upsertSeguro } from './helpers/upsert-seguro';
import { diaDe, hoyLocal, sumarDias } from './support/fechas-e2e';

/**
 * Tests HTTP (Supertest) de los tres controllers admin de `gestion-salon`
 * (`ZonasController`, `MesasController`, `HorariosController`), contra Postgres real.
 *
 * `AppModule` todavía no registra estos módulos (mismo motivo documentado en
 * `app.module.ts` y en `auth.integration-spec.ts`: el job `test` de CI corre sin
 * PostgreSQL hasta que se mergee `ci-integracion-db`), así que este archivo arma su
 * propio módulo mínimo con `AuthModule` + los tres módulos de dominio, igual que ya
 * hace `auth.integration-spec.ts`. Cubre lo que los tests unitarios de cada
 * `*.controller.spec.ts` no pueden (mockean el service): que las guardas
 * `JwtAuthGuard`/`RolesGuard` están realmente enganchadas en cada ruta (tasks.md 5.1) y
 * que el pipeline completo (guardas + `ValidationPipe` + service + Prisma) funciona de
 * punta a punta.
 */
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
      ZonasModule,
      MesasModule,
      HorariosModule,
    ],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  }).compile();

  const app: INestApplication<App> = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  await app.init();
  return app;
}

describe('Controllers admin de gestión de salón (integration)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let nonAdminToken: string;
  let zonaStandardId: string;

  beforeAll(async () => {
    app = await crearAppDeTest();
    prisma = app.get(PrismaService);

    // Tokens firmados directamente con JwtService (como ya hace
    // `auth.integration-spec.ts` para el caso non-admin): evita pegarle a
    // `POST /auth/login`, que tiene rate limiting (5 intentos/60s) y no hace falta acá,
    // ya que lo que se está probando es el guard de estas rutas, no el login en sí.
    const jwtService = app.get(JwtService);
    const configService = app.get(ConfigService);
    const jwtSecret = configService.getOrThrow<string>('JWT_SECRET');
    adminToken = jwtService.sign(
      { sub: 'admin-test-uuid', rol: 'ADMIN' },
      { secret: jwtSecret },
    );
    nonAdminToken = jwtService.sign(
      { sub: 'other-test-uuid', rol: 'CLIENTE' },
      { secret: jwtSecret },
    );

    // Zona STANDARD real, necesaria para crear Mesas — mismo patrón que
    // `mesas.integration-spec.ts` (upsert seguro: este archivo corre en paralelo con
    // otros que también hacen upsert de la misma fila enum-singleton).
    const standard = await upsertSeguro(
      () =>
        prisma.zona.upsert({
          where: { nombre: 'STANDARD' },
          update: {},
          create: {
            nombre: 'STANDARD',
            minComensales: 1,
            maxComensales: 8,
            anticipacionMinHoras: 2,
            anticipacionMaxDias: 30,
            ventanaCancelacionHoras: 2,
            requiereConfirmacionAdmin: false,
            aforoMaximo: 40,
          },
        }),
      () => prisma.zona.findUniqueOrThrow({ where: { nombre: 'STANDARD' } }),
    );
    zonaStandardId = standard.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /admin/zonas', () => {
    it('401 sin token', async () => {
      await request(app.getHttpServer()).get('/admin/zonas').expect(401);
    });

    it('403 con token de rol distinto de ADMIN', async () => {
      await request(app.getHttpServer())
        .get('/admin/zonas')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);
    });

    it('200 con token admin, devuelve las zonas', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/zonas')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const nombres = (response.body as { nombre: string }[]).map(
        (z) => z.nombre,
      );
      expect(nombres).toContain('STANDARD');
    });
  });

  describe('PATCH /admin/zonas/:id', () => {
    it('401 sin token', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/zonas/${zonaStandardId}`)
        .send({ aforoMaximo: 45 })
        .expect(401);
    });

    it('200 con token admin, persiste el cambio', async () => {
      try {
        const response = await request(app.getHttpServer())
          .patch(`/admin/zonas/${zonaStandardId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ aforoMaximo: 45 })
          .expect(200);

        expect((response.body as { aforoMaximo: number }).aforoMaximo).toBe(45);
      } finally {
        // Deja el valor conocido para no interferir con otros archivos de test, incluso
        // si el `expect` de arriba falla (cubic: la fila STANDARD es compartida).
        await prisma.zona.update({
          where: { id: zonaStandardId },
          data: { aforoMaximo: 40 },
        });
      }
    });

    it('400 con id que no es UUID', async () => {
      await request(app.getHttpServer())
        .patch('/admin/zonas/no-es-un-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ aforoMaximo: 45 })
        .expect(400);
    });
  });

  describe('/admin/mesas', () => {
    let mesaId: string;

    beforeAll(async () => {
      // Limpieza defensiva: si una corrida anterior se interrumpió antes del DELETE
      // final, no dejar que la fila residual con la misma etiqueta rompa el POST de más
      // abajo con un 409 inesperado (cubic: los identificadores fijos son únicos en la
      // base y el afterAll descarta errores de limpieza).
      await prisma.mesa.deleteMany({
        where: { etiqueta: 'HTTP-1', zonaId: zonaStandardId },
      });
    });

    afterAll(async () => {
      if (mesaId) {
        await prisma.mesa
          .delete({ where: { id: mesaId } })
          .catch(() => undefined);
      }
    });

    it('POST 401 sin token', async () => {
      await request(app.getHttpServer())
        .post('/admin/mesas')
        .send({ zonaId: zonaStandardId, capacidad: 4, etiqueta: 'HTTP-1' })
        .expect(401);
    });

    it('POST 403 con token de rol distinto de ADMIN', async () => {
      await request(app.getHttpServer())
        .post('/admin/mesas')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send({ zonaId: zonaStandardId, capacidad: 4, etiqueta: 'HTTP-1' })
        .expect(403);
    });

    it('POST 201 con token admin, crea la mesa', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/mesas')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ zonaId: zonaStandardId, capacidad: 4, etiqueta: 'HTTP-1' })
        .expect(201);

      const body = response.body as { id: string; etiqueta: string };
      expect(body.etiqueta).toBe('HTTP-1');
      mesaId = body.id;
    });

    it('GET 200 con token admin, filtra por zonaId', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/mesas')
        .query({ zonaId: zonaStandardId })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const mesas = response.body as { id: string; zonaId: string }[];
      expect(mesas.every((m) => m.zonaId === zonaStandardId)).toBe(true);
      expect(mesas.find((m) => m.id === mesaId)).toBeDefined();
    });

    it('PATCH 200 con token admin, edita la capacidad', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/admin/mesas/${mesaId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ capacidad: 6 })
        .expect(200);

      expect((response.body as { capacidad: number }).capacidad).toBe(6);
    });

    it('DELETE 204 con token admin, elimina la mesa', async () => {
      await request(app.getHttpServer())
        .delete(`/admin/mesas/${mesaId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const encontrada = await prisma.mesa.findUnique({
        where: { id: mesaId },
      });
      expect(encontrada).toBeNull();
      mesaId = '';
    });
  });

  describe('/admin/turnos', () => {
    let turnoId: string;
    const turnoHoraInicio = new Date(Date.UTC(1970, 0, 1, 11, 30, 0));

    beforeAll(async () => {
      // Misma limpieza defensiva que en '/admin/mesas' de arriba: `diaSemana` + hora de
      // inicio son la clave única real (`@@unique([diaSemana, horaInicio])`), así que una
      // fila residual de una corrida interrumpida rompería el POST de más abajo con 409.
      await prisma.turno.deleteMany({
        where: { diaSemana: 'LUNES', horaInicio: turnoHoraInicio },
      });
    });

    afterAll(async () => {
      if (turnoId) {
        await prisma.turno
          .delete({ where: { id: turnoId } })
          .catch(() => undefined);
      }
    });

    it('POST 401 sin token', async () => {
      await request(app.getHttpServer())
        .post('/admin/turnos')
        .send({ diaSemana: 'LUNES', horaInicio: '11:30', horaFin: '15:00' })
        .expect(401);
    });

    it('POST 201 con token admin, crea el turno', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/turnos')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ diaSemana: 'LUNES', horaInicio: '11:30', horaFin: '15:00' })
        .expect(201);

      const body = response.body as { id: string; activo: boolean };
      expect(body.activo).toBe(true);
      turnoId = body.id;
    });

    it('GET 200 con token admin, incluye el turno creado', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/turnos')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const turnos = response.body as { id: string }[];
      expect(turnos.find((t) => t.id === turnoId)).toBeDefined();
    });

    it('PATCH 200 con token admin, desactiva el turno en el mismo PATCH de edición', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/admin/turnos/${turnoId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ activo: false })
        .expect(200);

      expect((response.body as { activo: boolean }).activo).toBe(false);
    });
  });
});

/**
 * Change `plano-mesas-admin`, tareas 3.1 a 3.6: un test por escenario de "Ubicación de Mesa en
 * el plano" de `specs/gestion-salon/spec.md`, por HTTP (guardas + `ValidationPipe` + service +
 * Prisma).
 *
 * Usa un schema de Postgres propio (mismo patrón que `plano-mesas.integration-spec.ts`): los
 * escenarios parten del layout exacto del seed y lo modifican, y la base de test compartida
 * tiene mesas que dejan otras suites. Antes de cada caso se borran las reservas y las mesas que
 * no son del seed, y se vuelven a cargar el catálogo y el layout.
 *
 * La app no registra el `ThrottlerGuard`: los límites de las rutas de admin los prueba
 * `throttle-rutas-admin.e2e-spec.ts`, y acá se hacen más pedidos por minuto que esos límites.
 */
const SCHEMA_UBICACION = 'gestion_salon_ubicacion_test';
const ETIQUETAS_SEED = ['S1', 'S2', 'S3', 'S4', 'S5', 'V1', 'V2', 'V3', 'V4'];
const MENSAJE_COORDENADAS =
  'posX y posY van juntos: los dos con valor o los dos en null.';

function urlDelSchemaDeUbicacion(): string {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error('Falta DATABASE_URL para los tests de integración');
  }
  const url = new URL(base);
  url.searchParams.set('schema', SCHEMA_UBICACION);
  return url.toString();
}

/** Primera fecha que cae en `dia` a `minimoDias` días o más de hoy. */
function proximo(dia: DiaSemana, minimoDias: number): Date {
  let candidata = sumarDias(hoyLocal(), minimoDias);
  while (diaDe(candidata) !== dia) {
    candidata = sumarDias(candidata, 1);
  }
  return candidata;
}

async function borrarSchemaDeUbicacion(): Promise<void> {
  const baseCompartida = new PrismaService();
  await baseCompartida.$executeRawUnsafe(
    `DROP SCHEMA IF EXISTS "${SCHEMA_UBICACION}" CASCADE`,
  );
  await baseCompartida.$disconnect();
}

describe('Ubicación de Mesa en el plano (integration)', () => {
  const urlCompartida = process.env.DATABASE_URL;
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let zonas: { STANDARD: string; VIP: string };
  let turnos: Record<string, { id: string }>;
  /** Mesas del seed por etiqueta, leídas de nuevo antes de cada caso. */
  let mesas: Record<string, Mesa>;

  beforeAll(async () => {
    await borrarSchemaDeUbicacion();
    execFileSync(
      process.execPath,
      [
        require.resolve('prisma/build/index.js'),
        'migrate',
        'deploy',
        '--schema',
        'prisma/schema.prisma',
      ],
      {
        env: { ...process.env, DATABASE_URL: urlDelSchemaDeUbicacion() },
        stdio: 'pipe',
      },
    );

    // `PrismaService` lee `DATABASE_URL` al construirse: se apunta al schema propio solo
    // mientras se compila el módulo.
    process.env.DATABASE_URL = urlDelSchemaDeUbicacion();
    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['../.env', '.env'],
        }),
        PrismaModule,
        AuthModule,
        ZonasModule,
        MesasModule,
        PlanoMesasModule,
      ],
    }).compile();
    process.env.DATABASE_URL = urlCompartida;

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const jwtSecret = app.get(ConfigService).getOrThrow<string>('JWT_SECRET');
    adminToken = app
      .get(JwtService)
      .sign({ sub: 'admin-test-uuid', rol: 'ADMIN' }, { secret: jwtSecret });

    const catalogo = await seedCatalogo(prisma, () => undefined);
    turnos = catalogo.turnos;
    const filas = await prisma.zona.findMany({
      select: { id: true, nombre: true },
    });
    zonas = Object.fromEntries(
      filas.map((z) => [z.nombre, z.id]),
    ) as typeof zonas;
  }, 120_000);

  beforeEach(async () => {
    await prisma.reserva.deleteMany();
    await prisma.mesa.deleteMany({
      where: { etiqueta: { notIn: ETIQUETAS_SEED } },
    });
    await seedCatalogo(prisma, () => undefined);
    await seedPlano(prisma, () => undefined);
    const filas = await prisma.mesa.findMany();
    mesas = Object.fromEntries(filas.map((m) => [m.etiqueta, m]));
  });

  afterAll(async () => {
    await app.close();
    await borrarSchemaDeUbicacion();
  });

  function patch(mesa: Mesa, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .patch(`/admin/mesas/${mesa.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);
  }

  function leer(mesa: Mesa): Promise<Mesa> {
    return prisma.mesa.findUniqueOrThrow({ where: { id: mesa.id } });
  }

  /** Todo rechazo deja la mesa exactamente como estaba en la base. */
  async function esperarSinCambios(mesa: Mesa): Promise<void> {
    expect(await leer(mesa)).toEqual(mesa);
  }

  /** Carga una ubicación directo en la base, sin pasar por la API (un layout cargado a mano). */
  async function ubicarEnLaBase(
    mesa: Mesa,
    datos: Partial<Pick<Mesa, 'posX' | 'posY' | 'ancho' | 'alto'>>,
  ): Promise<Mesa> {
    return prisma.mesa.update({ where: { id: mesa.id }, data: datos });
  }

  /** S6: mesa de STANDARD de 1 por 1 y sin reservas, cargada en la base en (10,7). */
  function cargarS6(): Promise<Mesa> {
    return prisma.mesa.create({
      data: {
        zonaId: zonas.STANDARD,
        capacidad: 2,
        etiqueta: 'S6',
        posX: 10,
        posY: 7,
      },
    });
  }

  function mensaje(respuesta: request.Response): unknown {
    return (respuesta.body as { message: unknown }).message;
  }

  describe('valores de entrada (tarea 3.1)', () => {
    it.each([
      ['posX', { posX: -1, posY: 0 }],
      ['posY', { posX: 0, posY: -1 }],
      ['posX', { posX: 1.5, posY: 0 }],
      ['ancho', { ancho: 0 }],
      ['alto', { alto: 0 }],
      ['ancho', { ancho: null }],
      ['alto', { alto: null }],
      ['forma', { forma: null }],
      ['forma', { forma: 'TRIANGULAR' }],
    ])(
      'responde 400 por el valor de %s en %j sin modificar la mesa',
      async (campo, body) => {
        const respuesta = await patch(mesas.S1, body).expect(400);

        // El `400` tiene que venir de la validación del campo, no de que el DTO no lo
        // conozca (`forbidNonWhitelisted`).
        const mensajes = mensaje(respuesta) as string[];
        expect(mensajes.some((m) => m.startsWith(`${campo} `))).toBe(true);
        expect(mensajes.some((m) => m.includes('should not exist'))).toBe(
          false,
        );
        await esperarSinCambios(mesas.S1);
      },
    );

    it('un pedido sin campos del plano no cambia la ubicación', async () => {
      await patch(mesas.S3, { etiqueta: 'S3-nueva' }).expect(200);

      expect(await leer(mesas.S3)).toEqual({
        ...mesas.S3,
        etiqueta: 'S3-nueva',
      });
    });
  });

  describe('coordenadas juntas y lugar final (tarea 3.2)', () => {
    it.each([
      ['solo posX', { posX: 4 }],
      ['solo posX, igual al guardado', { posX: 0 }],
      ['posX en null junto a posY con valor', { posX: null, posY: 3 }],
    ])('responde 400 con %s sin modificar la mesa', async (_, body) => {
      const respuesta = await patch(mesas.S1, body).expect(400);

      expect(mensaje(respuesta)).toBe(MENSAJE_COORDENADAS);
      await esperarSinCambios(mesas.S1);
    });

    it('guarda la forma y la mesa conserva su posición y su tamaño', async () => {
      await patch(mesas.S3, { forma: 'REDONDA' }).expect(200);

      expect(await leer(mesas.S3)).toEqual({ ...mesas.S3, forma: 'REDONDA' });
    });

    it('cambia la forma de una mesa con un problema previo sin validar la superposición', async () => {
      // S2 cargada a mano en (5,0), encima de S3.
      const s2 = await ubicarEnLaBase(mesas.S2, { posX: 5, posY: 0 });

      await patch(s2, { forma: 'CUADRADA' }).expect(200);

      expect(await leer(s2)).toEqual({ ...s2, forma: 'CUADRADA' });
    });

    it('reenviar la ubicación de una mesa con un problema previo no valida la superposición', async () => {
      const s2 = await ubicarEnLaBase(mesas.S2, { posX: 5, posY: 0 });

      await patch(s2, {
        posX: 5,
        posY: 0,
        ancho: 1,
        alto: 1,
        etiqueta: 'S2-nueva',
      }).expect(200);

      expect(await leer(s2)).toEqual({ ...s2, etiqueta: 'S2-nueva' });
    });

    it('quita la mesa del plano y el plano de STANDARD la lista como sin ubicar', async () => {
      await patch(mesas.S2, { posX: null, posY: null }).expect(200);

      expect(await leer(mesas.S2)).toEqual({
        ...mesas.S2,
        posX: null,
        posY: null,
      });
      const fecha = proximo(DiaSemana.SABADO, 3);
      const plano = await app.get(PlanoMesasService).consultar({
        fecha: fechaCalendarioAIso(fecha),
        turnoId: turnos[`${diaDe(fecha)}_CENA`].id,
        zonaId: zonas.STANDARD,
        comensales: 2,
      });
      expect(plano.mesas.find((m) => m.etiqueta === 'S2')).toMatchObject({
        posX: null,
        posY: null,
      });
    });

    it('las validaciones existentes corren antes que las de ubicación', async () => {
      const fecha = proximo(DiaSemana.SABADO, 3);
      await prisma.reserva.create({
        data: {
          mesaId: mesas.S4.id,
          turnoId: turnos[`${diaDe(fecha)}_CENA`].id,
          fecha,
          comensales: 3,
          estado: EstadoReserva.CONFIRMADA,
          nombreCliente: 'Cliente de prueba',
          emailCliente: 'cliente@ejemplo.com',
          telefonoCliente: '+54 11 5555-0000',
          codigoReserva: 'UBI00001',
        },
      });

      const respuesta = await patch(mesas.S4, {
        capacidad: 2,
        posX: 10,
        posY: 6,
      }).expect(409);

      expect(mensaje(respuesta)).toBe(
        'La mesa tiene una reserva activa con más comensales que la nueva capacidad.',
      );
      await esperarSinCambios(mesas.S4);
    });
  });

  describe('grilla y superposición (tarea 3.3)', () => {
    it('mueve S4 a un lugar libre', async () => {
      await patch(mesas.S4, { posX: 8, posY: 5 }).expect(200);

      expect(await leer(mesas.S4)).toEqual({ ...mesas.S4, posX: 8, posY: 5 });
    });

    it('acepta mesas que se tocan por un lado', async () => {
      await patch(mesas.S1, { posX: 1, posY: 0 }).expect(200);

      expect(await leer(mesas.S1)).toEqual({ ...mesas.S1, posX: 1, posY: 0 });
    });

    it.each([
      ['S1 dentro de S3', 'S1', { posX: 5, posY: 1 }, 'S3'],
      ['S1 con ancho 6 sobre S2 y S3', 'S1', { ancho: 6 }, 'S2 y S3'],
      ['S4 con ancho 6 sobre S5', 'S4', { ancho: 6 }, 'S5'],
    ])(
      'rechaza con 409 la superposición de %s',
      async (_, etiqueta, body, superpuestas) => {
        const respuesta = await patch(mesas[etiqueta], body).expect(409);

        expect(mensaje(respuesta)).toBe(
          `La mesa se superpone con ${superpuestas}.`,
        );
        await esperarSinCambios(mesas[etiqueta]);
      },
    );

    it('rechaza con 400 una mesa que queda fuera de la grilla', async () => {
      const respuesta = await patch(mesas.S5, { posX: 10, posY: 3 }).expect(
        400,
      );

      expect(mensaje(respuesta)).toBe(
        'La mesa queda fuera de la grilla de 12 por 8.',
      );
      await esperarSinCambios(mesas.S5);
    });

    it('rechaza con 400 un tamaño mayor que la grilla en una mesa sin ubicar', async () => {
      const s2 = await ubicarEnLaBase(mesas.S2, { posX: null, posY: null });

      const respuesta = await patch(s2, { ancho: 13 }).expect(400);

      expect(mensaje(respuesta)).toBe(
        'La mesa no entra en la grilla de 12 por 8.',
      );
      await esperarSinCambios(s2);
    });

    it('la coordenada a medias gana sobre el tamaño mayor que la grilla', async () => {
      const respuesta = await patch(mesas.S1, { posX: 4, ancho: 13 }).expect(
        400,
      );

      expect(mensaje(respuesta)).toBe(MENSAJE_COORDENADAS);
      await esperarSinCambios(mesas.S1);
    });

    it('el tamaño mayor que la grilla gana sobre la mesa fuera de la grilla', async () => {
      const respuesta = await patch(mesas.S4, {
        posX: 10,
        posY: 3,
        ancho: 13,
      }).expect(400);

      expect(mensaje(respuesta)).toBe(
        'La mesa no entra en la grilla de 12 por 8.',
      );
      await esperarSinCambios(mesas.S4);
    });

    it('la mesa fuera de la grilla gana sobre la superposición', async () => {
      // S4 (3 por 2) en (10,6) se sale por la derecha y además pisa a S6 en (10,7).
      await cargarS6();

      const respuesta = await patch(mesas.S4, { posX: 10, posY: 6 }).expect(
        400,
      );

      expect(mensaje(respuesta)).toBe(
        'La mesa queda fuera de la grilla de 12 por 8.',
      );
      await esperarSinCambios(mesas.S4);
    });
  });

  describe('cambio de zona (tarea 3.4)', () => {
    it('reenviar la misma zona no es un cambio de zona', async () => {
      await patch(mesas.S3, { zonaId: zonas.STANDARD }).expect(200);

      expect(await leer(mesas.S3)).toEqual(mesas.S3);
    });

    it('el cambio de zona sin ubicación nueva deja la mesa sin ubicar', async () => {
      const s6 = await cargarS6();

      await patch(s6, { zonaId: zonas.VIP }).expect(200);

      expect(await leer(s6)).toEqual({
        ...s6,
        zonaId: zonas.VIP,
        posX: null,
        posY: null,
      });
    });

    it('el cambio de zona con ubicación nueva la valida contra la zona nueva', async () => {
      const s6 = await cargarS6();

      await patch(s6, { zonaId: zonas.VIP, posX: 7, posY: 0 }).expect(200);

      expect(await leer(s6)).toEqual({
        ...s6,
        zonaId: zonas.VIP,
        posX: 7,
        posY: 0,
      });
    });

    it('rechaza el cambio de zona con una ubicación fuera de la grilla nueva', async () => {
      const s6 = await cargarS6();

      const respuesta = await patch(s6, {
        zonaId: zonas.VIP,
        posX: 10,
        posY: 0,
      }).expect(400);

      expect(mensaje(respuesta)).toBe(
        'La mesa queda fuera de la grilla de 10 por 6.',
      );
      await esperarSinCambios(s6);
    });

    it('rechaza el cambio de zona de una mesa que no entra en la grilla nueva', async () => {
      // S8: mesa de STANDARD sin ubicar, de 11 por 1 y sin reservas.
      const s8 = await prisma.mesa.create({
        data: {
          zonaId: zonas.STANDARD,
          capacidad: 2,
          etiqueta: 'S8',
          ancho: 11,
          alto: 1,
        },
      });

      const respuesta = await patch(s8, { zonaId: zonas.VIP }).expect(400);

      expect(mensaje(respuesta)).toBe(
        'La mesa no entra en la grilla de 10 por 6.',
      );
      await esperarSinCambios(s8);
    });
  });

  describe('ediciones simultáneas (tarea 3.5)', () => {
    it('de dos pedidos simultáneos hacia la misma celda libre, exactamente uno responde 200', async () => {
      const [r1, r2] = await Promise.all([
        patch(mesas.S1, { posX: 9, posY: 6 }),
        patch(mesas.S2, { posX: 9, posY: 6 }),
      ]);

      expect([r1.status, r2.status].sort()).toEqual([200, 409]);
      const [ganadora, perdedora] =
        r1.status === 200 ? [mesas.S1, mesas.S2] : [mesas.S2, mesas.S1];
      expect(await leer(ganadora)).toEqual({ ...ganadora, posX: 9, posY: 6 });
      await esperarSinCambios(perdedora);
    });
  });
});
