/**
 * Catálogo necesario para operar el restaurante: configuración global, zonas, mesas y turnos.
 *
 * Lo comparten el seed de desarrollo (`seed.ts`) y el de producción (`seed-produccion.ts`),
 * según D8 de `despliegue-continuo-ec2`. Se extrajo de `seed.ts` sin cambiar el
 * comportamiento: los valores son los de config.yaml §6 y todo se escribe con `upsert` por
 * clave natural, así que cargarlo dos veces no duplica filas.
 *
 * NOTA sobre valores de aforo: config.yaml §6 fijaba los rangos de comensales, las
 * anticipaciones y la ventana de cancelación por zona, pero no el número concreto de aforo
 * máximo. Confirmado por el equipo: `aforoMaximo` STANDARD = 40, `aforoMaximo` VIP = 20,
 * `aforoGlobal` = 60 (ver openspec/config.yaml §6, sección Aforo).
 */
import { DiaSemana, PrismaClient } from '@prisma/client';

// Días en los que el salón abre (config.yaml §6: "activos de martes a domingo").
export const DIAS_ABIERTOS: DiaSemana[] = [
  DiaSemana.MARTES,
  DiaSemana.MIERCOLES,
  DiaSemana.JUEVES,
  DiaSemana.VIERNES,
  DiaSemana.SABADO,
  DiaSemana.DOMINGO,
];
export const DIAS_CERRADOS: DiaSemana[] = [DiaSemana.LUNES];

// Turno se persiste como hora del día (@db.Time); la parte de fecha es irrelevante y se
// fija a un valor arbitrario fijo para que Prisma la serialice de forma consistente.
function hora(hh: number, mm: number): Date {
  return new Date(Date.UTC(1970, 0, 1, hh, mm, 0));
}

export async function seedZonas(prisma: PrismaClient) {
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

export async function seedConfiguracionGlobal(prisma: PrismaClient) {
  // Fila única (id fijo = 1). Ver nota de cabecera sobre el valor de aforo.
  return prisma.configuracionNegocio.upsert({
    where: { id: 1 },
    update: { aforoGlobal: 60 },
    create: { id: 1, aforoGlobal: 60 },
  });
}

export async function seedMesas(
  prisma: PrismaClient,
  zonaStandardId: string,
  zonaVipId: string,
) {
  // Capacidades variadas dentro del rango de comensales de cada zona (config.yaml §6),
  // para poder ejercitar la asignación best fit.
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

  // Clave natural: etiqueta, respaldada por un índice único real en la base
  // (schema.prisma: Mesa.etiqueta @unique). El upsert es atómico: dos corridas
  // concurrentes del seed no pueden crear la misma mesa duplicada.
  for (const mesa of mesasStandard) {
    const row = await prisma.mesa.upsert({
      where: { etiqueta: mesa.etiqueta },
      update: { capacidad: mesa.capacidad, zonaId: zonaStandardId },
      create: {
        etiqueta: mesa.etiqueta,
        capacidad: mesa.capacidad,
        zonaId: zonaStandardId,
      },
    });
    creadas[mesa.etiqueta] = row;
  }

  for (const mesa of mesasVip) {
    const row = await prisma.mesa.upsert({
      where: { etiqueta: mesa.etiqueta },
      update: { capacidad: mesa.capacidad, zonaId: zonaVipId },
      create: {
        etiqueta: mesa.etiqueta,
        capacidad: mesa.capacidad,
        zonaId: zonaVipId,
      },
    });
    creadas[mesa.etiqueta] = row;
  }

  return creadas;
}

export async function seedTurnos(prisma: PrismaClient) {
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

/**
 * Carga el catálogo completo, en el mismo orden que usaba `seed.ts`: zonas, configuración
 * global, mesas y turnos. Devuelve las mesas y los turnos por clave, que el seed de desarrollo
 * usa para sus reservas de ejemplo.
 */
export async function seedCatalogo(
  prisma: PrismaClient,
  log: (mensaje: string) => void = console.log,
) {
  log('Seed: zonas...');
  const { standard, vip } = await seedZonas(prisma);

  log('Seed: configuración global...');
  await seedConfiguracionGlobal(prisma);

  log('Seed: mesas...');
  const mesas = await seedMesas(prisma, standard.id, vip.id);

  log('Seed: turnos...');
  const turnos = await seedTurnos(prisma);

  return { mesas, turnos };
}
