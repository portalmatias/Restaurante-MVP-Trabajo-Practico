import { execFileSync } from 'node:child_process';

import { DiaSemana, PrismaClient } from '@prisma/client';

import { seedCatalogo } from '../prisma/catalogo';
import {
  elegirTurnoEnVentana,
  seedReservasDemo,
} from '../prisma/reservas-demo';
import { finTurnoUtc, inicioTurnoUtc } from '../src/common/timezone';

/**
 * Change `seed-datos-demo` (spec `modelo-dominio`, requisito "Reservas de demostración del
 * seed"). Las reservas de demostración las carga solo el seed de desarrollo.
 *
 * Usa un schema de Postgres propio dentro de la base de test (mismo patrón que
 * `plano-mesas-seed.integration-spec.ts`) para partir de una base vacía.
 */
const SCHEMA = 'reservas_demo_seed_test';

function urlDelSchema(): string {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error('Falta DATABASE_URL para los tests de integración');
  }
  const url = new URL(base);
  url.searchParams.set('schema', SCHEMA);
  return url.toString();
}

/** Instante UTC de una fecha y hora de Argentina (offset fijo −3). */
function horaArgentina(iso: string): Date {
  return new Date(`${iso}-03:00`);
}

/** Días de la semana en el orden lunes a domingo. */
const DIAS: DiaSemana[] = [
  DiaSemana.LUNES,
  DiaSemana.MARTES,
  DiaSemana.MIERCOLES,
  DiaSemana.JUEVES,
  DiaSemana.VIERNES,
  DiaSemana.SABADO,
  DiaSemana.DOMINGO,
];

describe('Reservas de demostración en el seed (integración)', () => {
  let baseCompartida: PrismaClient;
  let prisma: PrismaClient;
  const silencio = () => undefined;
  let turnos: Record<string, { id: string }>;

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
    ({ turnos } = await seedCatalogo(prisma, silencio));
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await baseCompartida.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`,
    );
    await baseCompartida.$disconnect();
  });

  function leerReserva(codigoReserva: string) {
    return prisma.reserva.findUnique({
      where: { codigoReserva },
      include: { turno: true, mesa: { include: { zona: true } } },
    });
  }

  it('SEEDPAS2 queda CONFIRMADA, con el turno terminado y en su día de la semana', async () => {
    await seedReservasDemo(
      prisma,
      turnos,
      silencio,
      horaArgentina('2026-11-10T10:00'),
    );

    const reserva = await leerReserva('SEEDPAS2');
    expect(reserva?.estado).toBe('CONFIRMADA');
    const fin = finTurnoUtc(
      reserva!.fecha,
      reserva!.turno.horaInicio,
      reserva!.turno.horaFin,
    );
    expect(fin.getTime()).toBeLessThan(Date.now());
    expect(reserva!.turno.activo).toBe(true);
    expect(DIAS[(reserva!.fecha.getUTCDay() + 6) % 7]).toBe(
      reserva!.turno.diaSemana,
    );
    expect(reserva!.comensales).toBeLessThanOrEqual(reserva!.mesa.capacidad);
  });

  it('SEEDVTN2 queda en una mesa VIP, en el turno más próximo dentro de la ventana', async () => {
    const ahora = horaArgentina('2026-11-10T13:00');

    await seedReservasDemo(prisma, turnos, silencio, ahora);

    const reserva = await leerReserva('SEEDVTN2');
    expect(reserva?.estado).toBe('CONFIRMADA');
    expect(reserva!.mesa.zona.nombre).toBe('VIP');
    expect(reserva!.turno.diaSemana).toBe(DiaSemana.MARTES);
    expect(reserva!.fecha.toISOString()).toBe('2026-11-10T00:00:00.000Z');
    const faltanMs =
      inicioTurnoUtc(reserva!.fecha, reserva!.turno.horaInicio).getTime() -
      ahora.getTime();
    expect(faltanMs).toBeGreaterThan(0);
    expect(faltanMs).toBeLessThan(
      reserva!.mesa.zona.ventanaCancelacionHoras * 60 * 60 * 1000,
    );
    expect(reserva!.comensales).toBeLessThanOrEqual(reserva!.mesa.capacidad);
  });

  it('sin turno dentro de la ventana, omite SEEDVTN2 y lo avisa', async () => {
    const log = jest.fn();

    await seedReservasDemo(
      prisma,
      turnos,
      log,
      horaArgentina('2026-11-15T23:00'),
    );

    expect(await leerReserva('SEEDVTN2')).toBeNull();
    expect(await leerReserva('SEEDPAS2')).not.toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('SEEDVTN2'));
  });

  it('es idempotente, re-ubica SEEDVTN2 y conserva los estados transicionados', async () => {
    await seedReservasDemo(
      prisma,
      turnos,
      silencio,
      horaArgentina('2026-11-10T10:00'),
    );
    await prisma.reserva.update({
      where: { codigoReserva: 'SEEDPAS2' },
      data: { estado: 'NO_SHOW' },
    });

    await seedReservasDemo(
      prisma,
      turnos,
      silencio,
      horaArgentina('2026-11-14T21:00'),
    );

    expect(
      await prisma.reserva.count({
        where: { codigoReserva: { in: ['SEEDPAS2', 'SEEDVTN2'] } },
      }),
    ).toBe(2);
    expect((await leerReserva('SEEDPAS2'))?.estado).toBe('NO_SHOW');
    const vtn = await leerReserva('SEEDVTN2');
    expect(vtn!.turno.diaSemana).toBe(DiaSemana.DOMINGO);
    expect(vtn!.fecha.toISOString()).toBe('2026-11-15T00:00:00.000Z');
  });

  it('no re-ubica SEEDVTN2 si ya está en un estado terminal', async () => {
    await seedReservasDemo(
      prisma,
      turnos,
      silencio,
      horaArgentina('2026-11-10T10:00'),
    );
    await prisma.reserva.update({
      where: { codigoReserva: 'SEEDVTN2' },
      data: { estado: 'NO_SHOW' },
    });
    const log = jest.fn();

    await seedReservasDemo(
      prisma,
      turnos,
      log,
      horaArgentina('2026-11-14T21:00'),
    );

    const vtn = await leerReserva('SEEDVTN2');
    expect(vtn!.estado).toBe('NO_SHOW');
    expect(vtn!.turno.diaSemana).toBe(DiaSemana.MARTES);
    expect(vtn!.fecha.toISOString()).toBe('2026-11-10T00:00:00.000Z');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('SEEDVTN2'));
  });

  it('si la mesa ya está ocupada en ese turno, avisa y termina sin error', async () => {
    const ahora = horaArgentina('2026-11-10T10:00');
    const elegido = elegirTurnoEnVentana(
      ahora,
      await prisma.turno.findMany(),
      24,
    );
    const v2 = await prisma.mesa.findUniqueOrThrow({
      where: { etiqueta: 'V2' },
    });
    await prisma.reserva.create({
      data: {
        codigoReserva: 'MANUAL22',
        mesaId: v2.id,
        turnoId: elegido!.turno.id,
        fecha: elegido!.fecha,
        comensales: 4,
        estado: 'CONFIRMADA',
        nombreCliente: 'Reserva manual',
        emailCliente: 'manual@example.com',
        telefonoCliente: '+54 9 11 5555-0099',
      },
    });
    const log = jest.fn();

    await expect(
      seedReservasDemo(prisma, turnos, log, ahora),
    ).resolves.toBeUndefined();

    expect(await leerReserva('SEEDVTN2')).toBeNull();
    expect(await leerReserva('SEEDPAS2')).not.toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('V2'));
  });

  it('con la mesa ocupada, avisa que la SEEDVTN2 anterior queda con su fecha vieja', async () => {
    await seedReservasDemo(
      prisma,
      turnos,
      silencio,
      horaArgentina('2026-11-10T10:00'),
    );
    const ahora = horaArgentina('2026-11-14T21:00');
    const elegido = elegirTurnoEnVentana(
      ahora,
      await prisma.turno.findMany(),
      24,
    );
    const v2 = await prisma.mesa.findUniqueOrThrow({
      where: { etiqueta: 'V2' },
    });
    await prisma.reserva.create({
      data: {
        codigoReserva: 'MANUAL23',
        mesaId: v2.id,
        turnoId: elegido!.turno.id,
        fecha: elegido!.fecha,
        comensales: 4,
        estado: 'CONFIRMADA',
        nombreCliente: 'Reserva manual',
        emailCliente: 'manual@example.com',
        telefonoCliente: '+54 9 11 5555-0099',
      },
    });
    const log = jest.fn();

    await expect(
      seedReservasDemo(prisma, turnos, log, ahora),
    ).resolves.toBeUndefined();

    const vtn = await leerReserva('SEEDVTN2');
    expect(vtn!.fecha.toISOString()).toBe('2026-11-10T00:00:00.000Z');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('fecha vieja'));
  });
});
