import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';

/**
 * La migración `plano_mesas` aplicada sobre una base que YA tiene mesas y reservas (spec
 * `modelo-dominio`, escenario "Mesa existente conserva sus datos tras la migración").
 *
 * Crea una base descartable, le aplica todas las migraciones anteriores a `plano_mesas` con
 * `prisma migrate deploy` (desde una copia de la carpeta de migraciones sin la última), carga
 * datos con el esquema viejo, aplica `plano_mesas` y compara. Al final borra la base y la
 * copia. No toca la base de test compartida más que para crear y borrar la descartable.
 *
 * Requisito: el rol de `DATABASE_URL` tiene que poder ejecutar `CREATE DATABASE` y
 * `DROP DATABASE` (el usuario `postgres` del `docker compose` y el de CI pueden).
 */

const RAIZ_PRISMA = join(__dirname, '..', 'prisma');
const CLI_PRISMA = require.resolve('prisma/build/index.js');
const NOMBRE_MIGRACION = /_plano_mesas$/;

/** Corre `prisma migrate deploy` con el schema y las migraciones de `carpeta`. */
function migrarHasta(carpeta: string, url: string): void {
  execFileSync(
    process.execPath,
    [
      CLI_PRISMA,
      'migrate',
      'deploy',
      '--schema',
      join(carpeta, 'schema.prisma'),
    ],
    { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' },
  );
}

describe('Migración plano_mesas sobre datos previos', () => {
  const nombreBase = `plano_mesas_migracion_${process.pid}`;
  const urlTest = process.env.DATABASE_URL as string;
  const urlBase = urlTest.replace(/\/[^/?]+(\?|$)/, `/${nombreBase}$1`);
  const administrador = new PrismaClient({ datasourceUrl: urlTest });
  let carpeta: string;
  let base: PrismaClient;

  beforeAll(async () => {
    await administrador.$executeRawUnsafe(
      `DROP DATABASE IF EXISTS "${nombreBase}" WITH (FORCE)`,
    );
    await administrador.$executeRawUnsafe(`CREATE DATABASE "${nombreBase}"`);

    // Copia del schema y de las migraciones anteriores a `plano_mesas`.
    carpeta = mkdtempSync(join(tmpdir(), 'plano-mesas-migracion-'));
    cpSync(join(RAIZ_PRISMA, 'schema.prisma'), join(carpeta, 'schema.prisma'));
    const migraciones = readdirSync(join(RAIZ_PRISMA, 'migrations'));
    for (const entrada of migraciones) {
      if (!NOMBRE_MIGRACION.test(entrada)) {
        cpSync(
          join(RAIZ_PRISMA, 'migrations', entrada),
          join(carpeta, 'migrations', entrada),
          {
            recursive: true,
          },
        );
      }
    }
    migrarHasta(carpeta, urlBase);
    base = new PrismaClient({ datasourceUrl: urlBase });
  }, 120_000);

  afterAll(async () => {
    await base?.$disconnect();
    await administrador.$executeRawUnsafe(
      `DROP DATABASE IF EXISTS "${nombreBase}" WITH (FORCE)`,
    );
    await administrador.$disconnect();
    if (carpeta) {
      rmSync(carpeta, { recursive: true, force: true });
    }
  });

  it('conserva mesas y reservas, y las deja sin ubicar con los valores por defecto', async () => {
    // Datos cargados con el esquema anterior (sin las columnas del plano).
    await base.$executeRaw`
      INSERT INTO "Zona" ("id", "nombre", "minComensales", "maxComensales", "anticipacionMinHoras",
                          "anticipacionMaxDias", "ventanaCancelacionHoras", "aforoMaximo")
      VALUES ('zona-standard', 'STANDARD', 1, 8, 2, 30, 2, 40)`;
    await base.$executeRaw`
      INSERT INTO "Turno" ("id", "diaSemana", "horaInicio", "horaFin")
      VALUES ('turno-cena', 'SABADO', '20:00', '23:30')`;
    await base.$executeRaw`
      INSERT INTO "Mesa" ("id", "zonaId", "capacidad", "etiqueta")
      VALUES ('mesa-1', 'zona-standard', 2, 'S1'), ('mesa-2', 'zona-standard', 6, 'S4')`;
    await base.$executeRaw`
      INSERT INTO "Reserva" ("id", "mesaId", "turnoId", "fecha", "comensales", "estado",
                             "nombreCliente", "emailCliente", "telefonoCliente", "codigoReserva",
                             "updatedAt")
      VALUES ('reserva-1', 'mesa-2', 'turno-cena', '2026-09-19', 5, 'CONFIRMADA',
              'Ana', 'ana@ejemplo.com', '+54 11 5555-0000', 'ABCD2345', now())`;

    migrarHasta(join(RAIZ_PRISMA), urlBase);

    const mesas = await base.$queryRaw<
      Array<{
        id: string;
        zonaId: string;
        capacidad: number;
        etiqueta: string;
        posX: number | null;
        posY: number | null;
        ancho: number;
        alto: number;
        forma: string;
      }>
    >`SELECT "id", "zonaId", "capacidad", "etiqueta", "posX", "posY", "ancho", "alto",
             "forma"::text AS "forma"
      FROM "Mesa" ORDER BY "id"`;
    expect(mesas).toEqual([
      {
        id: 'mesa-1',
        zonaId: 'zona-standard',
        capacidad: 2,
        etiqueta: 'S1',
        posX: null,
        posY: null,
        ancho: 1,
        alto: 1,
        forma: 'RECTANGULAR',
      },
      {
        id: 'mesa-2',
        zonaId: 'zona-standard',
        capacidad: 6,
        etiqueta: 'S4',
        posX: null,
        posY: null,
        ancho: 1,
        alto: 1,
        forma: 'RECTANGULAR',
      },
    ]);

    const reservas = await base.$queryRaw<
      Array<{ id: string; mesaId: string }>
    >`
      SELECT "id", "mesaId" FROM "Reserva"`;
    expect(reservas).toEqual([{ id: 'reserva-1', mesaId: 'mesa-2' }]);

    const [zona] = await base.$queryRaw<
      Array<{ planoColumnas: number; planoFilas: number }>
    >`
      SELECT "planoColumnas", "planoFilas" FROM "Zona"`;
    expect(zona).toEqual({ planoColumnas: 12, planoFilas: 8 });
  }, 120_000);
});
