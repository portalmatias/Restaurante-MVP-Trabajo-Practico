import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DiaSemana } from '@prisma/client';
import { diaSemanaDeFecha } from '../src/common/timezone';

import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ReservasModule } from '../src/reservas/reservas.module';
import { ReservasService } from '../src/reservas/reservas.service';

/**
 * Tests de integración de los cinco invariantes de negocio (config.yaml §6, sección
 * "Invariantes") más la unicidad del código de reserva. Corren contra la base de TEST real
 * (`reservas_test`, ver jest-e2e.setup.ts) — no contra mocks de Prisma — porque el
 * invariante 1 solo lo garantiza el índice único parcial de la base (design.md).
 *
 * Cada test crea sus propias Mesas y Turnos con identificadores que no colisionan entre
 * tests (Turno usa una `horaInicio` única por test) y los borra en `afterEach`, para que
 * los tests sean independientes entre sí (config.yaml §9). Las dos Zonas (STANDARD y VIP)
 * son compartidas y se dejan en un estado conocido en `beforeAll`: como `NombreZona` es un
 * enum de solo dos valores, solo puede existir una fila por nombre, así que reutilizarlas
 * (en vez de crear/borrar Zonas por test) es la única opción viable.
 */
describe('ReservasService — invariantes de negocio (e2e)', () => {
  let prisma: PrismaService;
  let service: ReservasService;

  let zonaStandardId: string;
  let zonaVipId: string;

  // Ids creados durante el test en curso, para poder limpiarlos en afterEach sin afectar
  // los de otros tests que corran en la misma suite.
  let mesaIds: string[] = [];
  let turnoIds: string[] = [];
  let reservaIds: string[] = [];

  // Contador para que cada Turno de cada test tenga una horaInicio distinta (clave natural
  // @@unique([diaSemana, horaInicio]) de Turno) sin colisionar con el seed (12:00/20:00) ni
  // entre tests.
  let horaContador = 0;
  function horaDeTestUnica(): Date {
    horaContador += 1;
    return new Date(Date.UTC(1970, 0, 1, 1, horaContador, 0));
  }

  function fechaFutura(diasDesdeHoy: number): Date {
    const fecha = new Date();
    fecha.setUTCHours(0, 0, 0, 0);
    fecha.setUTCDate(fecha.getUTCDate() + diasDesdeHoy);
    return fecha;
  }

  /**
   * Devuelve una fecha futura que cae en el día de la semana indicado (0 = domingo ... 6 = sábado).
   * Busca hacia adelante desde hoy hasta encontrar el primer día que coincida.
   */
  function fechaFuturaConDiaSemana(diaSemanaObjetivo: number): Date {
    const fecha = new Date();
    fecha.setUTCHours(0, 0, 0, 0);
    // Avanzamos días hasta que getUTCDay() coincida con el objetivo
    while (fecha.getUTCDay() !== diaSemanaObjetivo) {
      fecha.setUTCDate(fecha.getUTCDate() + 1);
    }
    return fecha;
  }

  const DIAS_SEMANA_ENUM: DiaSemana[] = [
    DiaSemana.DOMINGO,
    DiaSemana.LUNES,
    DiaSemana.MARTES,
    DiaSemana.MIERCOLES,
    DiaSemana.JUEVES,
    DiaSemana.VIERNES,
    DiaSemana.SABADO,
  ];

  /**
   * El nuevo invariante de "turno coincide con el día de la semana de la reserva" exige que
   * el Turno usado en cada test tenga el mismo diaSemana que la fecha (fechaFutura) que ese
   * test va a usar. Este helper deriva el DiaSemana correcto para un offset dado, para no
   * tener que hardcodear manualmente qué día de la semana cae "hoy + N" en cada test.
   */
  function diaSemanaParaOffset(diasDesdeHoy: number): DiaSemana {
    return DIAS_SEMANA_ENUM[diaSemanaDeFecha(fechaFutura(diasDesdeHoy))];
  }

  async function crearMesa(
    zonaId: string,
    capacidad: number,
    etiqueta: string,
  ) {
    const mesa = await prisma.mesa.create({
      data: { zonaId, capacidad, etiqueta },
    });
    mesaIds.push(mesa.id);
    return mesa;
  }

  async function crearTurno(
    diaSemana: DiaSemana = DiaSemana.MIERCOLES,
    activo = true,
  ) {
    const turno = await prisma.turno.create({
      data: {
        diaSemana,
        horaInicio: horaDeTestUnica(),
        horaFin: new Date(Date.UTC(1970, 0, 1, 4, 0, 0)),
        activo,
      },
    });
    turnoIds.push(turno.id);
    return turno;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, ReservasModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(ReservasService);
    await prisma.$connect();

    const standard = await prisma.zona.upsert({
      where: { nombre: 'STANDARD' },
      update: {
        minComensales: 1,
        maxComensales: 8,
        anticipacionMinHoras: 2,
        anticipacionMaxDias: 30,
        ventanaCancelacionHoras: 2,
        requiereConfirmacionAdmin: false,
        aforoMaximo: 10,
      },
      create: {
        nombre: 'STANDARD',
        minComensales: 1,
        maxComensales: 8,
        anticipacionMinHoras: 2,
        anticipacionMaxDias: 30,
        ventanaCancelacionHoras: 2,
        requiereConfirmacionAdmin: false,
        aforoMaximo: 10,
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
        aforoMaximo: 10,
      },
      create: {
        nombre: 'VIP',
        minComensales: 2,
        maxComensales: 12,
        anticipacionMinHoras: 24,
        anticipacionMaxDias: 60,
        ventanaCancelacionHoras: 24,
        requiereConfirmacionAdmin: true,
        aforoMaximo: 10,
      },
    });
    zonaStandardId = standard.id;
    zonaVipId = vip.id;

    // aforoGlobal alto por defecto (muy por encima de cualquier aforoMaximo de zona usado
    // en este archivo) para que ningún test existente lo choque sin querer. El test del
    // invariante de aforo global lo baja temporalmente y lo restaura al terminar.
    await prisma.configuracionNegocio.upsert({
      where: { id: 1 },
      update: { aforoGlobal: 1000 },
      create: { id: 1, aforoGlobal: 1000 },
    });
  });
  afterEach(async () => {
    // Orden: Reserva primero (FK a Mesa/Turno), después Mesa y Turno.
    if (reservaIds.length) {
      await prisma.reserva.deleteMany({ where: { id: { in: reservaIds } } });
    }
    if (mesaIds.length) {
      await prisma.mesa.deleteMany({ where: { id: { in: mesaIds } } });
    }
    if (turnoIds.length) {
      await prisma.turno.deleteMany({ where: { id: { in: turnoIds } } });
    }
    reservaIds = [];
    mesaIds = [];
    turnoIds = [];

    // Restaurar mocks por si algún test falló antes de restaurarlos
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    // Restaurar aforoMaximo original de las zonas (valores del seed: STANDARD=40, VIP=20)
    await prisma.zona.update({
      where: { nombre: 'STANDARD' },
      data: { aforoMaximo: 40 },
    });
    await prisma.zona.update({
      where: { nombre: 'VIP' },
      data: { aforoMaximo: 20 },
    });
    // Restaurar aforoGlobal original (valor del seed: 60, ver config.yaml §6).
    await prisma.configuracionNegocio.update({
      where: { id: 1 },
      data: { aforoGlobal: 60 },
    });
    await prisma.$disconnect();
  });

  function datosClienteBase(sufijo: string) {
    return {
      nombreCliente: `Cliente Test ${sufijo}`,
      emailCliente: `cliente.${sufijo}@example.com`,
      telefonoCliente: '+54 9 11 5555-9999',
    };
  }

  // --- 4.1 — Invariante 1: exclusividad de mesa por turno y fecha ---------------------
  it('rechaza una segunda reserva activa para la misma mesa, turno y fecha', async () => {
    const mesa = await crearMesa(zonaStandardId, 4, 'INV1-M1');
    const turno = await crearTurno(diaSemanaParaOffset(10));
    const fecha = fechaFutura(10);

    const primera = await service.crearReserva({
      mesaId: mesa.id,
      turnoId: turno.id,
      zonaSolicitadaId: zonaStandardId,
      fecha,
      comensales: 2,
      ...datosClienteBase('inv1-a'),
    });
    reservaIds.push(primera.id);

    await expect(
      service.crearReserva({
        mesaId: mesa.id,
        turnoId: turno.id,
        zonaSolicitadaId: zonaStandardId,
        fecha,
        comensales: 2,
        ...datosClienteBase('inv1-b'),
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    // Verificación adicional: sigue existiendo una sola Reserva activa para esa combinación.
    const activas = await prisma.reserva.count({
      where: {
        mesaId: mesa.id,
        turnoId: turno.id,
        fecha,
        estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
      },
    });
    expect(activas).toBe(1);
  });

  it('permite una nueva reserva activa si la anterior sobre esa mesa/turno/fecha fue cancelada', async () => {
    // Refuerza que el índice es PARCIAL: una Reserva CANCELADA no debe bloquear la
    // combinación (a diferencia de un índice único "a secas").
    const mesa = await crearMesa(zonaStandardId, 4, 'INV1-M2');
    const turno = await crearTurno(diaSemanaParaOffset(11));
    const fecha = fechaFutura(11);

    const primera = await service.crearReserva({
      mesaId: mesa.id,
      turnoId: turno.id,
      zonaSolicitadaId: zonaStandardId,
      fecha,
      comensales: 2,
      ...datosClienteBase('inv1-c'),
    });
    reservaIds.push(primera.id);

    await service.transicionarEstado(primera.id, 'CANCELADA');

    const segunda = await service.crearReserva({
      mesaId: mesa.id,
      turnoId: turno.id,
      zonaSolicitadaId: zonaStandardId,
      fecha,
      comensales: 2,
      ...datosClienteBase('inv1-d'),
    });
    reservaIds.push(segunda.id);

    expect(segunda.id).not.toBe(primera.id);
  });

  // --- 4.2 — Invariante 2: capacidad de la mesa no excedida ---------------------------
  it('rechaza una reserva con más comensales que la capacidad de la mesa', async () => {
    const mesa = await crearMesa(zonaStandardId, 4, 'INV2-M1');
    const turno = await crearTurno(diaSemanaParaOffset(12));

    await expect(
      service.crearReserva({
        mesaId: mesa.id,
        turnoId: turno.id,
        zonaSolicitadaId: zonaStandardId,
        fecha: fechaFutura(12),
        comensales: 5,
        ...datosClienteBase('inv2'),
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const creadas = await prisma.reserva.count({ where: { mesaId: mesa.id } });
    expect(creadas).toBe(0);
  });

  it('rechaza una reserva con una cantidad de comensales no positiva', async () => {
    const mesa = await crearMesa(zonaStandardId, 4, 'INV2-M2');
    const turno = await crearTurno(diaSemanaParaOffset(12));

    await expect(
      service.crearReserva({
        mesaId: mesa.id,
        turnoId: turno.id,
        zonaSolicitadaId: zonaStandardId,
        fecha: fechaFutura(12),
        comensales: 0,
        ...datosClienteBase('inv2-cero'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.crearReserva({
        mesaId: mesa.id,
        turnoId: turno.id,
        zonaSolicitadaId: zonaStandardId,
        fecha: fechaFutura(12),
        comensales: -1,
        ...datosClienteBase('inv2-negativo'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const creadas = await prisma.reserva.count({ where: { mesaId: mesa.id } });
    expect(creadas).toBe(0);
  });

  // --- 4.3 — Invariante 3: turno activo y mesa de la zona solicitada ------------------
  it('rechaza una reserva sobre un turno inactivo', async () => {
    const mesa = await crearMesa(zonaStandardId, 4, 'INV3-M1');
    const turnoInactivo = await crearTurno(diaSemanaParaOffset(13), false);

    await expect(
      service.crearReserva({
        mesaId: mesa.id,
        turnoId: turnoInactivo.id,
        zonaSolicitadaId: zonaStandardId,
        fecha: fechaFutura(13),
        comensales: 2,
        ...datosClienteBase('inv3-turno'),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza una reserva cuya mesa pertenece a otra zona distinta de la solicitada', async () => {
    const mesaVip = await crearMesa(zonaVipId, 4, 'INV3-M2');
    const turno = await crearTurno(diaSemanaParaOffset(14));

    await expect(
      service.crearReserva({
        mesaId: mesaVip.id,
        turnoId: turno.id,
        zonaSolicitadaId: zonaStandardId, // se pidió STANDARD, pero la mesa es de VIP
        fecha: fechaFutura(14),
        comensales: 2,
        ...datosClienteBase('inv3-zona'),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  // --- 4.3b — Invariante 3: turno coincide con el día de la semana de la reserva ---
  it('rechaza una reserva cuya fecha no cae en el día de la semana del turno', async () => {
    // El turno por defecto en crearTurno() es MIERCOLES (diaSemana = 3 en getUTCDay).
    // Buscamos una fecha que caiga en JUEVES (4) para que no coincida.
    const mesa = await crearMesa(zonaStandardId, 4, 'INV3B-M1');
    const turno = await crearTurno(); // MIERCOLES
    const fechaJueves = fechaFuturaConDiaSemana(4); // JUEVES

    // Sanity check: la fecha efectivamente cae en jueves y el turno es miércoles
    expect(diaSemanaDeFecha(fechaJueves)).toBe(4);
    expect(turno.diaSemana).toBe(DiaSemana.MIERCOLES);

    await expect(
      service.crearReserva({
        mesaId: mesa.id,
        turnoId: turno.id,
        zonaSolicitadaId: zonaStandardId,
        fecha: fechaJueves,
        comensales: 2,
        ...datosClienteBase('inv3b-dia'),
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const creadas = await prisma.reserva.count({ where: { mesaId: mesa.id } });
    expect(creadas).toBe(0);
  });

  it('permite una reserva cuando la fecha cae en el mismo día de la semana del turno', async () => {
    // Mismo turno (MIERCOLES), pero fecha que cae en miércoles
    const mesa = await crearMesa(zonaStandardId, 4, 'INV3B-M2');
    const turno = await crearTurno(); // MIERCOLES
    const fechaMiercoles = fechaFuturaConDiaSemana(3); // MIERCOLES

    expect(diaSemanaDeFecha(fechaMiercoles)).toBe(3);
    expect(turno.diaSemana).toBe(DiaSemana.MIERCOLES);

    const reserva = await service.crearReserva({
      mesaId: mesa.id,
      turnoId: turno.id,
      zonaSolicitadaId: zonaStandardId,
      fecha: fechaMiercoles,
      comensales: 2,
      ...datosClienteBase('inv3b-ok'),
    });
    reservaIds.push(reserva.id);

    expect(reserva.id).toBeDefined();
  });

  // --- 4.4 — Invariante 4: aforo de zona respetado ------------------------------------
  it('rechaza una reserva que excede el aforo restante de la zona aunque haya mesa libre', async () => {
    // aforoMaximo de STANDARD en este test = 10 (ver beforeAll).
    const mesaA = await crearMesa(zonaStandardId, 8, 'INV4-M1');
    const mesaB = await crearMesa(zonaStandardId, 8, 'INV4-M2');
    const turno = await crearTurno(diaSemanaParaOffset(15));
    const fecha = fechaFutura(15);

    const primera = await service.crearReserva({
      mesaId: mesaA.id,
      turnoId: turno.id,
      zonaSolicitadaId: zonaStandardId,
      fecha,
      comensales: 8, // deja 2 lugares de aforo (10 - 8) para esa zona/turno/fecha
      ...datosClienteBase('inv4-a'),
    });
    reservaIds.push(primera.id);

    // mesaB está físicamente libre y tiene capacidad de sobra, pero pedir 3 comensales más
    // superaría el aforo restante de la zona (2).
    await expect(
      service.crearReserva({
        mesaId: mesaB.id,
        turnoId: turno.id,
        zonaSolicitadaId: zonaStandardId,
        fecha,
        comensales: 3,
        ...datosClienteBase('inv4-b'),
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const creadasEnMesaB = await prisma.reserva.count({
      where: { mesaId: mesaB.id },
    });
    expect(creadasEnMesaB).toBe(0);
  });

  it('rechaza una reserva que excede el aforo global aunque el aforo de su propia zona alcance', async () => {
    // Baja aforoGlobal a 12 solo para este test (se restaura al final). El aforo por zona
    // (10 en STANDARD y en VIP, ver beforeAll) sigue intacto: la reserva de STANDARD de
    // abajo pasa esa validación individual sin problema — lo que la tiene que rechazar es
    // el aforo GLOBAL, sumando ambas zonas.
    await prisma.configuracionNegocio.update({
      where: { id: 1 },
      data: { aforoGlobal: 12 },
    });

    try {
      const mesaVip = await crearMesa(zonaVipId, 8, 'INV4B-MVIP');
      const mesaStandard = await crearMesa(zonaStandardId, 8, 'INV4B-MSTD');
      const turno = await crearTurno(diaSemanaParaOffset(20));
      const fecha = fechaFutura(20);

      const enVip = await service.crearReserva({
        mesaId: mesaVip.id,
        turnoId: turno.id,
        zonaSolicitadaId: zonaVipId,
        fecha,
        comensales: 8, // aforo de VIP: 8/10, todavía le sobra lugar individualmente
        ...datosClienteBase('inv4b-vip'),
      });
      reservaIds.push(enVip.id);

      // 6 comensales en STANDARD pasa el aforo de zona (0+6 <= 10), pero 8 (VIP) + 6
      // (STANDARD) = 14 > 12 (aforoGlobal): el rechazo tiene que venir del chequeo global.
      await expect(
        service.crearReserva({
          mesaId: mesaStandard.id,
          turnoId: turno.id,
          zonaSolicitadaId: zonaStandardId,
          fecha,
          comensales: 6,
          ...datosClienteBase('inv4b-standard'),
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      const creadasEnStandard = await prisma.reserva.count({
        where: { mesaId: mesaStandard.id },
      });
      expect(creadasEnStandard).toBe(0);
    } finally {
      await prisma.configuracionNegocio.update({
        where: { id: 1 },
        data: { aforoGlobal: 1000 },
      });
    }
  });

  // --- 4.5 — Invariante 5: estados terminales no retroceden ---------------------------
  it('rechaza transicionar una reserva CANCELADA a cualquier otro estado', async () => {
    const mesa = await crearMesa(zonaStandardId, 4, 'INV5-M1');
    const turno = await crearTurno(diaSemanaParaOffset(16));

    const reserva = await service.crearReserva({
      mesaId: mesa.id,
      turnoId: turno.id,
      zonaSolicitadaId: zonaStandardId,
      fecha: fechaFutura(16),
      comensales: 2,
      ...datosClienteBase('inv5'),
    });
    reservaIds.push(reserva.id);

    await service.transicionarEstado(reserva.id, 'CANCELADA');

    await expect(
      service.transicionarEstado(reserva.id, 'CONFIRMADA'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.transicionarEstado(reserva.id, 'PENDIENTE'),
    ).rejects.toBeInstanceOf(ConflictException);

    const actual = await prisma.reserva.findUniqueOrThrow({
      where: { id: reserva.id },
    });
    expect(actual.estado).toBe('CANCELADA');
  });

  it('rechaza transicionar una reserva NO_SHOW a cualquier otro estado', async () => {
    const mesa = await crearMesa(zonaStandardId, 4, 'INV5-M2');
    const turno = await crearTurno(diaSemanaParaOffset(17));

    const reserva = await service.crearReserva({
      mesaId: mesa.id,
      turnoId: turno.id,
      zonaSolicitadaId: zonaStandardId,
      fecha: fechaFutura(17),
      comensales: 2,
      ...datosClienteBase('inv5-noshow'),
    });
    reservaIds.push(reserva.id);

    // La zona STANDARD no requiere confirmación del admin (config.yaml §6): la Reserva ya
    // nace CONFIRMADA, no hace falta transicionarla explícitamente antes del NO_SHOW.
    expect(reserva.estado).toBe('CONFIRMADA');
    await service.transicionarEstado(reserva.id, 'NO_SHOW');

    await expect(
      service.transicionarEstado(reserva.id, 'CANCELADA'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  // --- 4.6 — Código de reserva único ---------------------------------------------------
  it('reintenta con un código nuevo si el generado colisiona con uno existente', async () => {
    const mesa = await crearMesa(zonaStandardId, 4, 'INV6-M1');
    const turno = await crearTurno(diaSemanaParaOffset(19));

    // Pre-inserta una Reserva "ocupando" un código de reserva conocido.
    const otraMesa = await crearMesa(zonaStandardId, 2, 'INV6-M-colision');
    const otroTurno = await crearTurno(diaSemanaParaOffset(18));
    const codigoColisionado = 'COLISION';
    const existente = await prisma.reserva.create({
      data: {
        mesaId: otraMesa.id,
        turnoId: otroTurno.id,
        fecha: fechaFutura(18),
        comensales: 1,
        estado: 'CONFIRMADA',
        codigoReserva: codigoColisionado,
        ...datosClienteBase('inv6-existente'),
      },
    });
    reservaIds.push(existente.id);

    // Fuerza que el primer código generado colisione con el ya existente, y que el
    // segundo intento use un código realmente aleatorio (y por lo tanto distinto).
    const generarCodigoSpy = jest
      .spyOn(
        service as unknown as { generarCodigoReserva: () => string },
        'generarCodigoReserva',
      )
      .mockReturnValueOnce(codigoColisionado)
      .mockReturnValueOnce('LIBRE001');

    const nueva = await service.crearReserva({
      mesaId: mesa.id,
      turnoId: turno.id,
      zonaSolicitadaId: zonaStandardId,
      fecha: fechaFutura(19),
      comensales: 2,
      ...datosClienteBase('inv6-nueva'),
    });
    reservaIds.push(nueva.id);

    expect(generarCodigoSpy).toHaveBeenCalledTimes(2);
    expect(nueva.codigoReserva).toBe('LIBRE001');
    expect(nueva.codigoReserva).not.toBe(codigoColisionado);

    generarCodigoSpy.mockRestore();
  });

  it('genera códigos de reserva distintos entre sí para reservas creadas en secuencia', async () => {
    const mesa = await crearMesa(zonaStandardId, 4, 'INV6-M2');
    const turno = await crearTurno(diaSemanaParaOffset(100));
    const cantidad = 15;

    const codigos: string[] = [];
    for (let i = 0; i < cantidad; i++) {
      const reserva = await service.crearReserva({
        mesaId: mesa.id,
        turnoId: turno.id,
        // Distinta fecha en cada iteración (una semana de diferencia, para no chocar con
        // el invariante 1 que no es lo que este test quiere ejercitar) que además cae
        // siempre en el mismo día de la semana que `turno` (invariante nuevo).
        fecha: fechaFutura(100 + i * 7),
        zonaSolicitadaId: zonaStandardId,
        comensales: 2,
        ...datosClienteBase(`inv6-seq-${i}`),
      });
      reservaIds.push(reserva.id);
      codigos.push(reserva.codigoReserva);
    }

    expect(new Set(codigos).size).toBe(cantidad);
  });
});
