import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DiaSemana, EstadoReserva } from '@prisma/client';

import { MesasModule } from '../src/mesas/mesas.module';
import { MesasService } from '../src/mesas/mesas.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { upsertSeguro } from './helpers/upsert-seguro';

/**
 * Tests de integración de `MesasService` contra la base de TEST real (`reservas_test`),
 * no contra mocks de Prisma.
 *
 * `eliminar`: la garantía de que no queden Reservas huérfanas la da la FK restrictiva
 * `Reserva.mesaId` (`ON DELETE RESTRICT`), no el `count` previo del service — spec: "Baja
 * de Mesa preserva las Reservas activas e históricas". No cubre la carrera de promesas
 * entre el `count` y el `DELETE` (tasks.md 5.6.1, "Prueba determinística de la carrera
 * entre consulta y DELETE") — ver la nota en `openspec/changes/gestion-salon/tasks.md`
 * sobre por qué queda pendiente.
 *
 * `actualizar`: confirma que la llamada a
 * `prisma.$transaction(..., { isolationLevel: Serializable })` es válida contra Postgres
 * real (los tests unitarios de `mesas.service.spec.ts` mockean `$transaction`) y que dos
 * ediciones concurrentes sobre la misma Mesa no corrompen el valor final — hallazgo P1 de
 * cubic sobre PR #24. No repite la carrera específica contra
 * `ReservasService.crearReserva` (que ya corre en `Serializable`, mismo mecanismo) porque
 * `reservas-crear` todavía no existe como capability con su propio flujo de creación.
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

    // Este archivo corre en paralelo (worker propio de Jest) con
    // reservas-invariantes.integration-spec.ts, que hace su propio upsert de la misma fila
    // Zona.nombre = 'STANDARD' (es un valor de enum, efectivamente singleton) — ver
    // `helpers/upsert-seguro.ts`. A este archivo no le importan los valores de
    // configuración de la Zona (ningún test usa `aforoMaximo`/etc.), así que si pierde la
    // carrera de creación alcanza con releer la fila.
    const standard = await upsertSeguro(
      () =>
        prisma.zona.upsert({
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
        }),
      () => prisma.zona.findUniqueOrThrow({ where: { nombre: 'STANDARD' } }),
    );
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

    const listado = await service.listar();
    expect(listado.find((m) => m.id === mesa.id)).toBeUndefined();

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

  describe('actualizar', () => {
    it('persiste una actualización válida', async () => {
      const mesa = await crearMesa('INT-ACT-1');

      const resultado = await service.actualizar(mesa.id, { capacidad: 9 });
      expect(resultado.capacidad).toBe(9);

      const persistida = await prisma.mesa.findUniqueOrThrow({
        where: { id: mesa.id },
      });
      expect(persistida.capacidad).toBe(9);
    });

    it('dos cambios concurrentes de capacidad dejan uno de los valores solicitados', async () => {
      const mesa = await crearMesa('INT-ACT-2');

      const resultados = await Promise.allSettled([
        service.actualizar(mesa.id, { capacidad: 3 }),
        service.actualizar(mesa.id, { capacidad: 5 }),
      ]);

      const cumplidas = resultados.filter(
        (resultado) => resultado.status === 'fulfilled',
      );
      expect(cumplidas.length).toBeGreaterThanOrEqual(1);
      for (const resultado of resultados) {
        if (resultado.status === 'fulfilled') {
          expect([3, 5]).toContain(resultado.value.capacidad);
        } else {
          expect(resultado.reason).toBeInstanceOf(ConflictException);
        }
      }

      const final = await prisma.mesa.findUniqueOrThrow({
        where: { id: mesa.id },
      });
      expect([3, 5]).toContain(final.capacidad);
    });
  });
});
