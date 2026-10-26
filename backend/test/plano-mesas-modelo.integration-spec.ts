import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';

import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configurarZonasYConfiguracionDeSeed } from './support/zonas-seed-e2e';

/**
 * Columnas del plano en `Mesa` y `Zona` (change `plano-mesas`, D1 y spec `modelo-dominio`):
 * valores por defecto y `CHECK` que la base impone.
 *
 * Todo va por SQL directo y no por el cliente de Prisma: lo que se prueba es la base (los
 * defaults y los `CHECK` de la migración), no la validación de ningún service. Cada escritura
 * corre dentro de una transacción que siempre se revierte, así el archivo no deja filas.
 */

/** Error que fuerza el rollback de la transacción sin ser un fallo del test. */
class Revertir extends Error {}

/** Código de Postgres para la violación de un `CHECK` (`check_violation`). */
const VIOLACION_DE_CHECK = '23514';

describe('Columnas del plano de mesas (modelo-dominio)', () => {
  let prisma: PrismaService;
  let zonaStandardId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
    ({ zonaStandardId } = await configurarZonasYConfiguracionDeSeed(prisma));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** Corre `paso` en una transacción y la revierte siempre; devuelve lo que `paso` devolvió. */
  async function enTransaccionRevertida<T>(
    paso: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    let resultado!: T;
    try {
      await prisma.$transaction(async (tx) => {
        resultado = await paso(tx);
        throw new Revertir();
      });
    } catch (error) {
      if (!(error instanceof Revertir)) {
        throw error;
      }
    }
    return resultado;
  }

  /** Código SQLSTATE de un error de `$executeRaw`, o `undefined` si no es uno de Postgres. */
  async function codigoDeError(
    sentencia: Prisma.Sql,
  ): Promise<string | undefined> {
    try {
      await enTransaccionRevertida((tx) => tx.$executeRaw(sentencia));
      return undefined;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return (error.meta?.code as string | undefined) ?? error.code;
      }
      throw error;
    }
  }

  /** Inserta una mesa de prueba en STANDARD con las columnas del plano indicadas. */
  function insertarMesa(columnas: Record<string, number | null>): Prisma.Sql {
    const nombres = Object.keys(columnas).map((nombre) =>
      Prisma.raw(`"${nombre}"`),
    );
    const valores = Object.values(columnas);
    return Prisma.sql`
      INSERT INTO "Mesa" ("id", "zonaId", "capacidad", "etiqueta", ${Prisma.join(nombres)})
      VALUES (gen_random_uuid()::text, ${zonaStandardId}, 2, ${`TEST-PLANO-${Date.now()}`},
              ${Prisma.join(valores)})
    `;
  }

  it('una mesa nueva queda sin ubicar, de 1 por 1 y RECTANGULAR', async () => {
    const [mesa] = await enTransaccionRevertida(
      (tx) =>
        tx.$queryRaw<
          Array<{
            posX: number | null;
            posY: number | null;
            ancho: number;
            alto: number;
            forma: string;
          }>
        >`
        INSERT INTO "Mesa" ("id", "zonaId", "capacidad", "etiqueta")
        VALUES (gen_random_uuid()::text, ${zonaStandardId}, 2, ${`TEST-PLANO-${Date.now()}`})
        RETURNING "posX", "posY", "ancho", "alto", "forma"::text AS "forma"
      `,
    );

    expect(mesa).toEqual({
      posX: null,
      posY: null,
      ancho: 1,
      alto: 1,
      forma: 'RECTANGULAR',
    });
  });

  it('una zona nueva tiene una grilla de 12 columnas por 8 filas', async () => {
    // `NombreZona` solo admite STANDARD y VIP, y las dos ya existen: no se puede insertar una
    // zona nueva sin borrar una existente. Se lee el valor por defecto que la base aplicaría.
    const columnas = await prisma.$queryRaw<
      Array<{ column_name: string; column_default: string | null }>
    >`
      SELECT column_name, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Zona'
        AND column_name IN ('planoColumnas', 'planoFilas')
      ORDER BY column_name
    `;

    expect(columnas).toEqual([
      { column_name: 'planoColumnas', column_default: '12' },
      { column_name: 'planoFilas', column_default: '8' },
    ]);
  });

  it('una mesa ubicada dentro de los límites se acepta', async () => {
    await expect(
      codigoDeError(insertarMesa({ posX: 0, posY: 0, ancho: 2, alto: 1 })),
    ).resolves.toBeUndefined();
  });

  it.each([
    ['posX sin posY', { posX: 2, posY: null }],
    ['posY sin posX', { posX: null, posY: 2 }],
    ['posX negativo', { posX: -1, posY: 0 }],
    ['posY negativo', { posX: 0, posY: -1 }],
    ['ancho 0', { ancho: 0 }],
    ['alto 0', { alto: 0 }],
  ])('rechaza una mesa con %s', async (_caso, columnas) => {
    await expect(codigoDeError(insertarMesa(columnas))).resolves.toBe(
      VIOLACION_DE_CHECK,
    );
  });

  it.each([['planoColumnas'], ['planoFilas']])(
    'rechaza una zona con %s en 0',
    async (columna) => {
      const sentencia = Prisma.sql`
        UPDATE "Zona" SET ${Prisma.raw(`"${columna}"`)} = 0 WHERE "id" = ${zonaStandardId}
      `;
      await expect(codigoDeError(sentencia)).resolves.toBe(VIOLACION_DE_CHECK);
    },
  );
});
