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

import {
  ADMIN_EMAIL_DESARROLLO as ADMIN_EMAIL,
  ADMIN_PASSWORD_DESARROLLO as ADMIN_PASSWORD,
} from './admin-desarrollo';
import { seedCatalogo } from './catalogo';

const prisma = new PrismaClient();

const BCRYPT_SALT_ROUNDS = 10;

async function seedAdmin() {
  // Buscar primero y hashear solo si no existe: `bcrypt.hash` es trabajo costoso que no
  // tiene sentido repetir en cada corrida si el `update` de un upsert lo va a descartar de
  // todas formas, y si algún día se rota ADMIN_PASSWORD acá, una base existente conservaría
  // el hash viejo sin que nadie lo note.
  const existente = await prisma.usuario.findUnique({
    where: { email: ADMIN_EMAIL },
  });
  if (existente) return existente;

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_SALT_ROUNDS);
  return prisma.usuario.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash,
      rol: 'ADMIN',
    },
  });
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
  //
  // Los códigos siguen el formato real que genera `generarCodigoReserva()` en
  // reservas.service.ts: 8 caracteres del alfabeto CODIGO_RESERVA_ALFABETO
  // ('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', sin I/O/0/1 por ambigüedad visual).
  //
  // Nota sobre cambiar estas claves: como son la clave del `upsert`, modificarlas no
  // actualiza filas ya creadas con códigos anteriores, sino que crea filas nuevas y deja
  // huérfanas las viejas. Esto es aceptable acá: este seed es exclusivamente para bases de
  // desarrollo/test locales (nunca producción — no hay usuarios reales todavía, el
  // proyecto es un TP), así que no hace falta una migración de datos. Si tenías datos del
  // seed anterior, alcanza con resetear tu base local:
  //   docker compose down -v && docker compose up -d
  //   npm run db:migrate -w backend && npm run db:seed -w backend
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
      codigoReserva: 'SEEDPND2',
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
      codigoReserva: 'SEEDCNF2',
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
      codigoReserva: 'SEEDCAN2',
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
      codigoReserva: 'SEEDNSW2',
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
    // El campo `estado` se excluye del `update`: si el seed corre de nuevo sobre una base
    // donde alguien ya transicionó esta reserva de ejemplo (a mano o por un test), no debe
    // pisarla de vuelta a su valor inicial — eso violaría el invariante 5 (los estados
    // terminales no retroceden) para CANCELADA/NO_SHOW, y para PENDIENTE/CONFIRMADA
    // simplemente descartaría trabajo real sin que nadie lo pidiera.
    await prisma.reserva.upsert({
      where: { codigoReserva: reserva.codigoReserva },
      update: {
        mesaId: reserva.mesaId,
        turnoId: reserva.turnoId,
        fecha: reserva.fecha,
        comensales: reserva.comensales,
        nombreCliente: reserva.nombreCliente,
        emailCliente: reserva.emailCliente,
        telefonoCliente: reserva.telefonoCliente,
      },
      create: reserva,
    });
  }
}

async function main() {
  console.log('Seed: usuario admin...');
  await seedAdmin();

  // Catálogo compartido con el seed de producción (prisma/catalogo.ts, D8 de
  // despliegue-continuo-ec2): zonas, configuración global, mesas y turnos.
  const { mesas, turnos } = await seedCatalogo(prisma);

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
