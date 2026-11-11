import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';

/**
 * La migración `reserva_nota_cliente` aplicada sobre una base que YA tiene reservas (spec
 * `modelo-dominio`, escenario "Reservas anteriores sin nota").
 *
 * Mismo esquema que `plano-mesas-migracion.integration-spec.ts`: crea una base descartable, le
 * aplica solo las migraciones anteriores a `reserva_nota_cliente` (desde una copia de la carpeta
 * de migraciones), carga una reserva con el esquema viejo, aplica el resto y compara. Al final
 * borra la base y la copia.
 *
 * Requisito: el rol de `DATABASE_URL` tiene que poder ejecutar `CREATE DATABASE` y
 * `DROP DATABASE` (el usuario `postgres` del `docker compose` y el de CI pueden).
 */

const RAIZ_PRISMA = join(__dirname, '..', 'prisma');
const CLI_PRISMA = require.resolve('prisma/build/index.js');
const NOMBRE_MIGRACION = /_reserva_nota_cliente$/;

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

describe('Migración reserva_nota_cliente sobre datos previos', () => {
  const nombreBase = `reserva_nota_migracion_${process.pid}`;
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

    // Copia del schema y de las migraciones anteriores a `reserva_nota_cliente`. Las
    // carpetas empiezan con la fecha, así que el orden alfabético es el de aplicación.
    carpeta = mkdtempSync(join(tmpdir(), 'reserva-nota-migracion-'));
    cpSync(join(RAIZ_PRISMA, 'schema.prisma'), join(carpeta, 'schema.prisma'));
    const migraciones = readdirSync(join(RAIZ_PRISMA, 'migrations')).sort();
    const propia = migraciones.find((entrada) =>
      NOMBRE_MIGRACION.test(entrada),
    );
    for (const entrada of migraciones) {
      if (entrada === 'migration_lock.toml' || !propia || entrada < propia) {
        cpSync(
          join(RAIZ_PRISMA, 'migrations', entrada),
          join(carpeta, 'migrations', entrada),
          { recursive: true },
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

  it('deja las reservas existentes sin nota y con el resto de sus datos', async () => {
    // Datos cargados con el esquema anterior (sin la columna de la nota).
    await base.$executeRaw`
      INSERT INTO "Zona" ("id", "nombre", "minComensales", "maxComensales", "anticipacionMinHoras",
                          "anticipacionMaxDias", "ventanaCancelacionHoras", "aforoMaximo")
      VALUES ('zona-standard', 'STANDARD', 1, 8, 2, 30, 2, 40)`;
    await base.$executeRaw`
      INSERT INTO "Turno" ("id", "diaSemana", "horaInicio", "horaFin")
      VALUES ('turno-cena', 'SABADO', '20:00', '23:30')`;
    await base.$executeRaw`
      INSERT INTO "Mesa" ("id", "zonaId", "capacidad", "etiqueta")
      VALUES ('mesa-1', 'zona-standard', 4, 'S3')`;
    await base.$executeRaw`
      INSERT INTO "Reserva" ("id", "mesaId", "turnoId", "fecha", "comensales", "estado",
                             "nombreCliente", "emailCliente", "telefonoCliente", "codigoReserva",
                             "updatedAt")
      VALUES ('reserva-1', 'mesa-1', 'turno-cena', '2026-09-19', 4, 'CONFIRMADA',
              'Ana', 'ana@ejemplo.com', '+54 11 5555-0000', 'ABCD2345', now())`;

    migrarHasta(join(RAIZ_PRISMA), urlBase);

    const reservas = await base.$queryRaw<
      Array<{
        id: string;
        comensales: number;
        estado: string;
        nombreCliente: string;
        codigoReserva: string;
        notaCliente: string | null;
      }>
    >`SELECT "id", "comensales", "estado"::text AS "estado", "nombreCliente", "codigoReserva",
             "notaCliente"
      FROM "Reserva"`;
    expect(reservas).toEqual([
      {
        id: 'reserva-1',
        comensales: 4,
        estado: 'CONFIRMADA',
        nombreCliente: 'Ana',
        codigoReserva: 'ABCD2345',
        notaCliente: null,
      },
    ]);
  }, 120_000);
});
