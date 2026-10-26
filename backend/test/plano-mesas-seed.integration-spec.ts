import { execFileSync } from 'node:child_process';

import { PrismaClient } from '@prisma/client';

import { seedCatalogo } from '../prisma/catalogo';
import { seedPlano } from '../prisma/plano-desarrollo';
import { validarLayout } from '../src/plano-mesas/layout-plano';

/**
 * Tarea 2.6 de `plano-mesas` (spec `modelo-dominio`, requisito "Layout inicial del seed"). El
 * layout lo carga solo el seed de desarrollo (`prisma/plano-desarrollo.ts`), no el catálogo
 * compartido con producción.
 *
 * Usa un schema de Postgres propio dentro de la base de test (mismo patrón que
 * `seed-produccion.integration-spec.ts`): las suites compartidas mueven mesas de zona o crean
 * mesas sin posición, y acá hace falta partir de una base vacía para afirmar el layout exacto.
 */
const SCHEMA = 'plano_mesas_seed_test';

function urlDelSchema(): string {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error('Falta DATABASE_URL para los tests de integración');
  }
  const url = new URL(base);
  url.searchParams.set('schema', SCHEMA);
  return url.toString();
}

/** Layout de design.md D1: etiqueta → [forma, posX, posY, ancho, alto]. */
const LAYOUT_ESPERADO = {
  STANDARD: {
    grilla: { planoColumnas: 12, planoFilas: 8 },
    mesas: {
      S1: ['REDONDA', 0, 0, 1, 1],
      S2: ['REDONDA', 2, 0, 1, 1],
      S3: ['CUADRADA', 5, 0, 2, 2],
      S4: ['RECTANGULAR', 0, 3, 3, 2],
      S5: ['RECTANGULAR', 5, 3, 4, 2],
    },
  },
  VIP: {
    grilla: { planoColumnas: 10, planoFilas: 6 },
    mesas: {
      V1: ['REDONDA', 0, 0, 1, 1],
      V2: ['CUADRADA', 3, 0, 2, 2],
      V3: ['RECTANGULAR', 0, 3, 3, 2],
      V4: ['RECTANGULAR', 4, 3, 6, 2],
    },
  },
} as const;

describe('Layout del plano en el seed (integración)', () => {
  let baseCompartida: PrismaClient;
  let prisma: PrismaClient;
  const silencio = () => undefined;

  beforeAll(async () => {
    baseCompartida = new PrismaClient();
    prisma = new PrismaClient({ datasourceUrl: urlDelSchema() });
    await baseCompartida.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`,
    );
    execFileSync(
      process.execPath,
      [
        require.resolve('prisma/build/index.js'),
        'migrate',
        'deploy',
        '--schema',
        'prisma/schema.prisma',
      ],
      { env: { ...process.env, DATABASE_URL: urlDelSchema() }, stdio: 'pipe' },
    );
  }, 120_000);

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

  /** Lo que hace `seed.ts` con el catálogo: cargarlo y después ubicar las mesas. */
  async function correrSeed() {
    await seedCatalogo(prisma, silencio);
    await seedPlano(prisma, silencio);
  }

  async function leerPlano() {
    const zonas = await prisma.zona.findMany({
      select: {
        nombre: true,
        planoColumnas: true,
        planoFilas: true,
        mesas: {
          select: {
            etiqueta: true,
            forma: true,
            posX: true,
            posY: true,
            ancho: true,
            alto: true,
          },
          orderBy: { etiqueta: 'asc' },
        },
      },
      orderBy: { nombre: 'asc' },
    });
    return zonas;
  }

  it('ubica cada mesa según el layout de design.md D1 y cada zona con su grilla', async () => {
    await correrSeed();

    const zonas = await leerPlano();
    for (const zona of zonas) {
      const esperado = LAYOUT_ESPERADO[zona.nombre];
      expect({
        planoColumnas: zona.planoColumnas,
        planoFilas: zona.planoFilas,
      }).toEqual(esperado.grilla);
      const layout = Object.fromEntries(
        zona.mesas.map((m) => [
          m.etiqueta,
          [m.forma, m.posX, m.posY, m.ancho, m.alto],
        ]),
      );
      expect(layout).toEqual(esperado.mesas);
    }
    expect(zonas.map((z) => z.nombre)).toEqual(['STANDARD', 'VIP']);
  });

  it('todas las mesas entran en su grilla y ninguna se superpone', async () => {
    await correrSeed();

    for (const zona of await leerPlano()) {
      expect(validarLayout(zona, zona.mesas)).toEqual([]);
    }
  });

  it('es idempotente: dos corridas dejan las mismas mesas en las mismas posiciones', async () => {
    await correrSeed();
    const primera = await leerPlano();

    await correrSeed();
    const segunda = await leerPlano();

    expect(segunda).toEqual(primera);
    expect(await prisma.mesa.count()).toBe(9);
  });

  it('una segunda corrida restaura el layout si alguien movió una mesa', async () => {
    await correrSeed();
    await prisma.mesa.update({
      where: { etiqueta: 'S3' },
      data: { posX: 9, posY: 6 },
    });

    await correrSeed();

    const s3 = await prisma.mesa.findUniqueOrThrow({
      where: { etiqueta: 'S3' },
    });
    expect([s3.posX, s3.posY]).toEqual([5, 0]);
  });
});
