/**
 * Seed idempotente del modelo de dominio (change `modelo-dominio`).
 *
 * Deja la base en un estado usable para probar disponibilidad, siguiendo
 * openspec/config.yaml §10:
 * - 1 usuario admin con credenciales conocidas (documentadas en el README, no son secreto).
 * - Las 2 zonas (STANDARD, VIP) con los valores de config.yaml §6.
 * - Mesas de capacidades variadas en cada zona.
 * - Los 2 turnos base (almuerzo, cena), activos de martes a domingo.
 * - Algunas reservas de ejemplo en distintos estados.
 *
 * Idempotencia: todo se escribe con `upsert` por clave natural (design.md → Seed
 * idempotente), nunca con `create`. Correr este script dos veces no duplica filas.
 *
 * NOTA sobre valores de aforo: config.yaml §6 fijaba los rangos de comensales, las
 * anticipaciones y la ventana de cancelación por zona, pero no el número concreto de aforo
 * máximo. Confirmado por el equipo: `aforoMaximo` STANDARD = 40, `aforoMaximo` VIP = 20,
 * `aforoGlobal` = 60 (ver openspec/config.yaml §6, sección Aforo).
 */
import { PrismaClient, DiaSemana, EstadoReserva } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BCRYPT_SALT_ROUNDS = 10;

// Credenciales del admin de seed. No son secretas: están documentadas en el README para
// que cualquiera del equipo pueda loguearse en su entorno local (config.yaml §10).
const ADMIN_EMAIL = 'admin@restaurante-mvp.local';
const ADMIN_PASSWORD = 'AdminMVP2026!';

// Días en los que el salón abre (config.yaml §6: "activos de martes a domingo").
const DIAS_ABIERTOS: DiaSemana[] = [
  DiaSemana.MARTES,
  DiaSemana.MIERCOLES,
  DiaSemana.JUEVES,
  DiaSemana.VIERNES,
  DiaSemana.SABADO,
  DiaSemana.DOMINGO,
];
const DIAS_CERRADOS: DiaSemana[] = [DiaSemana.LUNES];

// Turno se persiste como hora del día (@db.Time); la parte de fecha es irrelevante y se
// fija a un valor arbitrario fijo para que Prisma la serialice de forma consistente.
function hora(hh: number, mm: number): Date {
  return new Date(Date.UTC(1970, 0, 1, hh, mm, 0));
}

async function seedAdmin() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_SALT_ROUNDS);
  return prisma.usuario.upsert({
    where: { email: ADMIN_EMAIL },
    update: {}, // no pisar el hash en corridas siguientes: el email ya identifica al admin
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      rol: 'ADMIN',
    },
  });
}

async function seedZonas() {
  // Valores de config.yaml §6, incluido aforoMaximo (confirmado, ver nota de cabecera).
  const standard = await prisma.zona.upsert({
    where: { nombre: 'STANDARD' },
    update: {
      minComensales: 1,
      maxComensales: 8,
      anticipacionMinHoras: 2,
      anticipacionMaxDias: 30,
      ventanaCancelacionHoras: 2,
      requiereConfirmacionAdmin: false,
      aforoMaximo: 40,
    },
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
  });

  const vip = await prisma.zona.upsert({
    where: { nombre: 'VIP' },
    update: {
      minComensales: 2,
      maxComensales: 12,
      anticipacionMinHoras: 24,
      anticipacionMaxDias: 60,
      ventanaCancelacionHoras: 24,
      requiereConfirmacionAdmin: true,
      aforoMaximo: 20,
    },
    create: {
      nombre: 'VIP',
      minComensales: 2,
      maxComensales: 12,
      anticipacionMinHoras: 24,
      anticipacionMaxDias: 60,
      ventanaCancelacionHoras: 24,
      requiereConfirmacionAdmin: true,
      aforoMaximo: 20,
    },
  });

  return { standard, vip };
}

async function seedConfiguracionGlobal() {
  // Fila única (id fijo = 1). Ver nota de cabecera sobre el valor ilustrativo.
  return prisma.configuracionNegocio.upsert({
    where: { id: 1 },
    update: { aforoGlobal: 60 },
    create: { id: 1, aforoGlobal: 60 },
  });
}

async function seedMesas(zonaStandardId: string, zonaVipId: string) {
  // Capacidades variadas dentro del rango de comensales de cada zona (config.yaml §6),
  // para poder ejercitar la asignación best fit en capabilities futuras.
  const mesasStandard = [
    { etiqueta: 'S1', capacidad: 2 },
    { etiqueta: 'S2', capacidad: 2 },
    { etiqueta: 'S3', capacidad: 4 },
    { etiqueta: 'S4', capacidad: 6 },
    { etiqueta: 'S5', capacidad: 8 },
  ];
  const mesasVip = [
    { etiqueta: 'V1', capacidad: 2 },
    { etiqueta: 'V2', capacidad: 4 },
    { etiqueta: 'V3', capacidad: 6 },
    { etiqueta: 'V4', capacidad: 12 },
  ];

  const creadas: Record<
    string,
    { id: string; zonaId: string; capacidad: number }
  > = {};

  for (const mesa of mesasStandard) {
    // Clave natural: etiqueta (única dentro del negocio, aunque no está declarada como
    // @@unique en el schema porque no se especifica como invariante — se resuelve acá con
    // findFirst + upsert manual para no duplicar entre corridas).
    const existente = await prisma.mesa.findFirst({
      where: { etiqueta: mesa.etiqueta },
    });
    const row = existente
      ? await prisma.mesa.update({
          where: { id: existente.id },
          data: { capacidad: mesa.capacidad, zonaId: zonaStandardId },
        })
      : await prisma.mesa.create({
          data: {
            etiqueta: mesa.etiqueta,
            capacidad: mesa.capacidad,
            zonaId: zonaStandardId,
          },
        });
    creadas[mesa.etiqueta] = row;
  }

  for (const mesa of mesasVip) {
    const existente = await prisma.mesa.findFirst({
      where: { etiqueta: mesa.etiqueta },
    });
    const row = existente
      ? await prisma.mesa.update({
          where: { id: existente.id },
          data: { capacidad: mesa.capacidad, zonaId: zonaVipId },
        })
      : await prisma.mesa.create({
          data: {
            etiqueta: mesa.etiqueta,
            capacidad: mesa.capacidad,
            zonaId: zonaVipId,
          },
        });
    creadas[mesa.etiqueta] = row;
  }

  return creadas;
}

async function seedTurnos() {
  // Turnos base del MVP (config.yaml §6): almuerzo 12:00–15:00 y cena 20:00–23:30,
  // activos de martes a domingo. Lunes queda con las mismas franjas pero `activo=false`
  // (día de cierre), útil para ejercitar el invariante 3 con datos reales del seed.
  const turnos: Record<string, { id: string }> = {};

  for (const dia of [...DIAS_ABIERTOS, ...DIAS_CERRADOS]) {
    const activo = DIAS_ABIERTOS.includes(dia);

    const almuerzo = await prisma.turno.upsert({
      where: {
        diaSemana_horaInicio: { diaSemana: dia, horaInicio: hora(12, 0) },
      },
      update: { horaFin: hora(15, 0), activo },
      create: {
        diaSemana: dia,
        horaInicio: hora(12, 0),
        horaFin: hora(15, 0),
        activo,
      },
    });
    turnos[`${dia}_ALMUERZO`] = almuerzo;

    const cena = await prisma.turno.upsert({
      where: {
        diaSemana_horaInicio: { diaSemana: dia, horaInicio: hora(20, 0) },
      },
      update: { horaFin: hora(23, 30), activo },
      create: {
        diaSemana: dia,
        horaInicio: hora(20, 0),
        horaFin: hora(23, 30),
        activo,
      },
    });
    turnos[`${dia}_CENA`] = cena;
  }

  return turnos;
}

/** Próxima fecha (a partir de mañana) que cae en el día de semana pedido. */
function proximaFecha(dia: DiaSemana): Date {
  const orden: DiaSemana[] = [
    DiaSemana.DOMINGO,
    DiaSemana.LUNES,
    DiaSemana.MARTES,
    DiaSemana.MIERCOLES,
    DiaSemana.JUEVES,
    DiaSemana.VIERNES,
    DiaSemana.SABADO,
  ];
  const objetivo = orden.indexOf(dia);
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  for (let i = 1; i <= 7; i++) {
    const candidata = new Date(base);
    candidata.setUTCDate(base.getUTCDate() + i);
    if (candidata.getUTCDay() === objetivo) return candidata;
  }
  return base;
}

async function seedReservas(
  mesas: Record<string, { id: string }>,
  turnos: Record<string, { id: string }>,
) {
  // Reservas de ejemplo en distintos estados, identificadas por un código de reserva fijo
  // para que el upsert sea idempotente (el código de reserva es la clave natural pública
  // del dominio — config.yaml §5).
  const ejemplos: Array<{
    codigoReserva: string;
    mesaId: string;
    turnoId: string;
    fecha: Date;
    comensales: number;
    estado: EstadoReserva;
    nombreCliente: string;
    emailCliente: string;
    telefonoCliente: string;
  }> = [
    {
      codigoReserva: 'SEEDPEND1',
      mesaId: mesas['V1'].id,
      turnoId: turnos['VIERNES_CENA'].id,
      fecha: proximaFecha(DiaSemana.VIERNES),
      comensales: 2,
      estado: 'PENDIENTE',
      nombreCliente: 'Lucía Fernández',
      emailCliente: 'lucia.fernandez@example.com',
      telefonoCliente: '+54 9 11 5555-0001',
    },
    {
      codigoReserva: 'SEEDCONF1',
      mesaId: mesas['S3'].id,
      turnoId: turnos['SABADO_CENA'].id,
      fecha: proximaFecha(DiaSemana.SABADO),
      comensales: 4,
      estado: 'CONFIRMADA',
      nombreCliente: 'Martín Gómez',
      emailCliente: 'martin.gomez@example.com',
      telefonoCliente: '+54 9 11 5555-0002',
    },
    {
      codigoReserva: 'SEEDCANC1',
      mesaId: mesas['S1'].id,
      turnoId: turnos['DOMINGO_ALMUERZO'].id,
      fecha: proximaFecha(DiaSemana.DOMINGO),
      comensales: 2,
      estado: 'CANCELADA',
      nombreCliente: 'Sofía Ramírez',
      emailCliente: 'sofia.ramirez@example.com',
      telefonoCliente: '+54 9 11 5555-0003',
    },
    {
      codigoReserva: 'SEEDNOSH1',
      mesaId: mesas['S4'].id,
      turnoId: turnos['MARTES_ALMUERZO'].id,
      // NO_SHOW solo se marca después de que pasó el turno (config.yaml §6): se usa una
      // fecha pasada para que el dato de ejemplo sea coherente con esa regla.
      fecha: new Date(Date.UTC(2026, 0, 6)), // martes pasado, fijo para reproducibilidad
      comensales: 5,
      estado: 'NO_SHOW',
      nombreCliente: 'Diego Torres',
      emailCliente: 'diego.torres@example.com',
      telefonoCliente: '+54 9 11 5555-0004',
    },
  ];

  for (const reserva of ejemplos) {
    await prisma.reserva.upsert({
      where: { codigoReserva: reserva.codigoReserva },
      update: reserva,
      create: reserva,
    });
  }
}

async function main() {
  console.log('Seed: usuario admin...');
  await seedAdmin();

  console.log('Seed: zonas...');
  const { standard, vip } = await seedZonas();

  console.log('Seed: configuración global...');
  await seedConfiguracionGlobal();

  console.log('Seed: mesas...');
  const mesas = await seedMesas(standard.id, vip.id);

  console.log('Seed: turnos...');
  const turnos = await seedTurnos();

  console.log('Seed: reservas de ejemplo...');
  await seedReservas(mesas, turnos);

  console.log('Seed completado.');
}

main()
  .catch((error) => {
    console.error('Error corriendo el seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
