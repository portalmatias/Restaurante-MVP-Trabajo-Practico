import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DiaSemana, EstadoReserva } from '@prisma/client';

import { MesasModule } from '../src/mesas/mesas.module';
import { MesasService } from '../src/mesas/mesas.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Tests de integración de `MesasService.eliminar` contra la base de TEST real
 * (`reservas_test`), no contra mocks de Prisma: la garantía de que no queden Reservas
 * huérfanas la da la FK restrictiva `Reserva.mesaId` (`ON DELETE RESTRICT`), no el `count`
 * previo del service — spec: "Baja de Mesa preserva las Reservas activas e históricas".
 *
 * No cubre la carrera de promesas entre el `count` y el `DELETE` (tasks.md 5.6.1,
 * "Prueba determinística de la carrera entre consulta y DELETE") — ver la nota en
 * `openspec/changes/gestion-salon/tasks.md` sobre por qué queda pendiente.
 */
describe('MesasService.eliminar — integración con Postgres real', () => {
  let prisma: PrismaService;
  let service: MesasService;

  let zonaStandardId: string;
  let mesaIds: string[] = [];
  let turnoIds: string[] = [];
  let reservaIds: string[] = [];

  let horaContador = 0;
  function horaDeTestUnica(): Date {
    horaContador += 1;
    return new Date(Date.UTC(1970, 0, 1, 5, horaContador, 0));
  }

  async function crearMesa(etiqueta: string) {
    const mesa = await prisma.mesa.create({
      data: { zonaId: zonaStandardId, capacidad: 4, etiqueta },
    });
    mesaIds.push(mesa.id);
    return mesa;
  }

  async function crearTurno() {
    const turno = await prisma.turno.create({
      data: {
        diaSemana: DiaSemana.MIERCOLES,
        horaInicio: horaDeTestUnica(),
        horaFin: new Date(Date.UTC(1970, 0, 1, 8, 0, 0)),
        activo: true,
      },
    });
    turnoIds.push(turno.id);
    return turno;
  }

  async function crearReserva(
    mesaId: string,
    turnoId: string,
    estado: EstadoReserva,
  ) {
    const reserva = await prisma.reserva.create({
      data: {
        mesaId,
        turnoId,
        fecha: new Date(Date.UTC(2030, 0, 1)),
        comensales: 2,
        estado,
        nombreCliente: 'Cliente de prueba',
        emailCliente: `test-${Date.now()}-${Math.random()}@example.com`,
        telefonoCliente: '+5490000000',
        codigoReserva: Math.random().toString(36).slice(2, 10).toUpperCase(),
      },
    });
    reservaIds.push(reserva.id);
    return reserva;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, MesasModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(MesasService);
    await prisma.$connect();

    const standard = await prisma.zona.upsert({
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
    });
    zonaStandardId = standard.id;
  });

  afterEach(async () => {
    if (reservaIds.length > 0) {
      await prisma.reserva.deleteMany({ where: { id: { in: reservaIds } } });
    }
    if (mesaIds.length > 0) {
      await prisma.mesa.deleteMany({ where: { id: { in: mesaIds } } });
    }
    if (turnoIds.length > 0) {
      await prisma.turno.deleteMany({ where: { id: { in: turnoIds } } });
    }
    reservaIds = [];
    mesaIds = [];
    turnoIds = [];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('elimina físicamente una Mesa sin Reservas asociadas', async () => {
    const mesa = await crearMesa('INT-1');

    await service.eliminar(mesa.id);

    const encontrada = await prisma.mesa.findUnique({
      where: { id: mesa.id },
    });
    expect(encontrada).toBeNull();
    // Ya no hace falta borrarla en afterEach.
    mesaIds = mesaIds.filter((id) => id !== mesa.id);
  });

  it('responde NotFoundException si la Mesa no existe', async () => {
    await expect(
      service.eliminar('00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    EstadoReserva.PENDIENTE,
    EstadoReserva.CONFIRMADA,
    EstadoReserva.CANCELADA,
    EstadoReserva.NO_SHOW,
  ])(
    'rechaza la baja si la Mesa tiene una Reserva %s asociada, y no borra nada',
    async (estado) => {
      const mesa = await crearMesa(`INT-${estado}`);
      const turno = await crearTurno();
      const reserva = await crearReserva(mesa.id, turno.id, estado);

      await expect(service.eliminar(mesa.id)).rejects.toBeInstanceOf(
        ConflictException,
      );

      const mesaIntacta = await prisma.mesa.findUnique({
        where: { id: mesa.id },
      });
      const reservaIntacta = await prisma.reserva.findUnique({
        where: { id: reserva.id },
      });
      expect(mesaIntacta).not.toBeNull();
      expect(reservaIntacta).not.toBeNull();
      expect(reservaIntacta?.mesaId).toBe(mesa.id);
    },
  );
});
