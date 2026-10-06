import { execFileSync } from 'node:child_process';

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import {
  ADMIN_EMAIL_DESARROLLO,
  ADMIN_PASSWORD_DESARROLLO,
} from '../prisma/admin-desarrollo';
import { seedProduccion } from '../prisma/seed-produccion';

/**
 * Tareas 2.2 y 2.3 de `despliegue-continuo-ec2` (D8, requisito "Datos iniciales y admin
 * propios de producción").
 *
 * El seed de producción tiene que dejar la base **sin reservas** y con un único admin, pero la
 * base de test compartida ya tiene el admin y las reservas del seed de desarrollo (y lo que
 * dejan otras suites). Por eso esta suite usa un schema de Postgres propio dentro de la base
 * de test: lo borra, le aplica las migraciones versionadas con `prisma migrate deploy` (lo
 * mismo que corre producción) y lo vacía antes de cada caso. Al terminar, lo borra.
 */
const SCHEMA = 'seed_produccion_test';

/** `DATABASE_URL` de test (ver `support/entorno-de-test.ts`) apuntando al schema propio. */
function urlDelSchema(): string {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error('Falta DATABASE_URL para los tests de integración');
  }
  const url = new URL(base);
  url.searchParams.set('schema', SCHEMA);
  return url.toString();
}

/** Credenciales válidas de ejemplo: no son de ningún entorno real. */
const EMAIL_PRODUCCION = 'admin-produccion@example.com';
const PASSWORD_PRODUCCION = 'contraseña-de-prueba-larga-0123';

describe('seed de producción (integración)', () => {
  let baseCompartida: PrismaClient;
  let prisma: PrismaClient;
  const silencio = () => undefined;

  beforeAll(() => {
    baseCompartida = new PrismaClient();
    prisma = new PrismaClient({ datasourceUrl: urlDelSchema() });
  });

  beforeAll(async () => {
    await baseCompartida.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`,
    );
    // El CLI de Prisma se invoca con el mismo Node que corre Jest, sin `npx` ni shell, para
    // que funcione igual en Linux (CI) y en Windows.
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
        env: { ...process.env, DATABASE_URL: urlDelSchema() },
        stdio: 'pipe',
      },
    );
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Reserva", "Mesa", "Turno", "Zona", "Usuario", "ConfiguracionNegocio" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await baseCompartida.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`,
    );
    await baseCompartida.$disconnect();
  });

  async function conteos() {
    return {
      usuarios: await prisma.usuario.count(),
      zonas: await prisma.zona.count(),
      mesas: await prisma.mesa.count(),
      turnos: await prisma.turno.count(),
      configuracion: await prisma.configuracionNegocio.count(),
      reservas: await prisma.reserva.count(),
    };
  }

  const BASE_VACIA = {
    usuarios: 0,
    zonas: 0,
    mesas: 0,
    turnos: 0,
    configuracion: 0,
    reservas: 0,
  };

  describe('credenciales inválidas: falla sin crear la cuenta', () => {
    it.each([
      [
        'sin ADMIN_EMAIL',
        { ADMIN_PASSWORD: PASSWORD_PRODUCCION },
        /ADMIN_EMAIL/,
      ],
      [
        'sin ADMIN_PASSWORD',
        { ADMIN_EMAIL: EMAIL_PRODUCCION },
        /ADMIN_PASSWORD/,
      ],
      ['sin ninguna de las dos', {}, /ADMIN_EMAIL/],
      [
        'con ADMIN_EMAIL vacío',
        { ADMIN_EMAIL: '   ', ADMIN_PASSWORD: PASSWORD_PRODUCCION },
        /ADMIN_EMAIL/,
      ],
      [
        'con una contraseña de 15 caracteres',
        { ADMIN_EMAIL: EMAIL_PRODUCCION, ADMIN_PASSWORD: 'a'.repeat(15) },
        /16 caracteres/,
      ],
      [
        'con la contraseña de desarrollo',
        {
          ADMIN_EMAIL: EMAIL_PRODUCCION,
          ADMIN_PASSWORD: ADMIN_PASSWORD_DESARROLLO,
        },
        /desarrollo/,
      ],
      [
        'con el email de desarrollo',
        {
          ADMIN_EMAIL: ADMIN_EMAIL_DESARROLLO,
          ADMIN_PASSWORD: PASSWORD_PRODUCCION,
        },
        /desarrollo/,
      ],
      [
        'con el email de desarrollo en otra combinación de mayúsculas',
        {
          ADMIN_EMAIL: ADMIN_EMAIL_DESARROLLO.toUpperCase(),
          ADMIN_PASSWORD: PASSWORD_PRODUCCION,
        },
        /desarrollo/,
      ],
    ])('%s', async (_caso, entorno, mensaje) => {
      await expect(seedProduccion(prisma, entorno, silencio)).rejects.toThrow(
        mensaje,
      );
      // Se detiene antes de escribir: ni la cuenta ni el catálogo.
      expect(await conteos()).toEqual(BASE_VACIA);
    });

    it('el mensaje de error no incluye la contraseña recibida', async () => {
      const corta = 'secreta-corta-1';
      await expect(
        seedProduccion(
          prisma,
          { ADMIN_EMAIL: EMAIL_PRODUCCION, ADMIN_PASSWORD: corta },
          silencio,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          message: expect.not.stringContaining(corta) as string,
        }) as Error,
      );
    });
  });

  describe('credenciales válidas', () => {
    const entorno = {
      ADMIN_EMAIL: EMAIL_PRODUCCION,
      ADMIN_PASSWORD: PASSWORD_PRODUCCION,
    };

    it('crea el catálogo y el admin, sin reservas', async () => {
      await seedProduccion(prisma, entorno, silencio);

      expect(await conteos()).toEqual({
        usuarios: 1,
        zonas: 2,
        mesas: 9,
        turnos: 14,
        configuracion: 1,
        reservas: 0,
      });

      const admin = await prisma.usuario.findUniqueOrThrow({
        where: { email: EMAIL_PRODUCCION },
      });
      expect(admin.rol).toBe('ADMIN');
      expect(admin.passwordHash).not.toBe(PASSWORD_PRODUCCION);
      expect(
        await bcrypt.compare(PASSWORD_PRODUCCION, admin.passwordHash),
      ).toBe(true);
      // Nunca el admin de desarrollo.
      expect(
        await prisma.usuario.findUnique({
          where: { email: ADMIN_EMAIL_DESARROLLO },
        }),
      ).toBeNull();
    });

    it('correrlo dos veces no duplica nada', async () => {
      await seedProduccion(prisma, entorno, silencio);
      const primera = await conteos();

      await seedProduccion(prisma, entorno, silencio);

      expect(await conteos()).toEqual(primera);
    });

    it('con otra contraseña en la segunda corrida, no cambia el hash del admin existente', async () => {
      await seedProduccion(prisma, entorno, silencio);
      const antes = await prisma.usuario.findUniqueOrThrow({
        where: { email: EMAIL_PRODUCCION },
      });

      await seedProduccion(
        prisma,
        { ...entorno, ADMIN_PASSWORD: 'otra-contraseña-larga-de-prueba-9' },
        silencio,
      );

      const despues = await prisma.usuario.findUniqueOrThrow({
        where: { email: EMAIL_PRODUCCION },
      });
      expect(despues.passwordHash).toBe(antes.passwordHash);
      expect(
        await bcrypt.compare(PASSWORD_PRODUCCION, despues.passwordHash),
      ).toBe(true);
    });
  });
});
