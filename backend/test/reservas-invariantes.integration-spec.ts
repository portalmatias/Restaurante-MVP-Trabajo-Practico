import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DiaSemana } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { diaSemanaDeFecha } from '../src/common/timezone';
import { CodigoMotivo } from '../src/disponibilidad/reglas/tipos';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ReservasModule } from '../src/reservas/reservas.module';
import { ReservasService } from '../src/reservas/reservas.service';
import { upsertSeguro } from './helpers/upsert-seguro';

/**
 * Tests de integración de los cinco invariantes de negocio (config.yaml §6, sección
 * "Invariantes") más la unicidad del código de reserva, adaptados a la entrada de
 * `reservas-crear` (design.md D1): `crearReserva` ya no recibe `mesaId` ni
 * `zonaSolicitadaId`, recibe `zonaId` y la mesa la elige `elegirMesaBestFit` con el contexto
 * de `disponibilidad`. Corren contra la base de TEST real (`reservas_test`, ver
 * jest-integration.setup.ts) — no contra mocks de Prisma — porque el invariante 1 solo lo
 * garantiza el índice único parcial de la base y el lock advisory de `disponibilidad`
 * (design.md D2), y porque `cargarContexto`/`evaluarReglas` leen la base real.
 *
 * Varios de los invariantes que antes se probaban rechazando un `mesaId` elegido a mano ahora
 * los garantiza la construcción del flujo (design.md D1, "Los invariantes quedan cubiertos
 * así"): el invariante 2 (capacidad) porque best fit solo elige mesas que alcanzan, y la
 * mitad del invariante 3 (mesa de la zona pedida) porque best fit solo mira
 * `contexto.mesasLibres` de la zona solicitada. Esos casos se prueban en positivo (afirmando
 * la propiedad sobre la mesa asignada) en vez de en negativo.
 *
 * Cada test crea sus propias Mesas y Turnos con identificadores que no colisionan entre tests
 * (Turno usa una `horaInicio` única por test) y los borra en `afterEach`. Las dos Zonas
 * (STANDARD y VIP) son compartidas y se dejan en un estado conocido en `beforeAll`.
 */
describe('ReservasService — invariantes de negocio (integración)', () => {
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
   * Busca hacia adelante desde MAÑANA (nunca hoy: si "hoy" ya fuera ese día, el margen contra
   * `ahora` real podría quedar por debajo de la anticipación mínima de la zona, y ese no es lo
   * que estos tests quieren ejercitar) hasta encontrar el primer día que coincida.
   */
  function fechaFuturaConDiaSemana(diaSemanaObjetivo: number): Date {
    const fecha = new Date();
    fecha.setUTCHours(0, 0, 0, 0);
    fecha.setUTCDate(fecha.getUTCDate() + 1);
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
   * El invariante "turno coincide con el día de la semana de la reserva" exige que el Turno
   * usado en cada test tenga el mismo diaSemana que la fecha (fechaFutura) que ese test usa.
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
    horaInicio: Date = horaDeTestUnica(),
    horaFin: Date = new Date(Date.UTC(1970, 0, 1, 4, 0, 0)),
  ) {
    const turno = await prisma.turno.create({
      data: { diaSemana, horaInicio, horaFin, activo },
    });
    turnoIds.push(turno.id);
    return turno;
  }

  let ocupacionContador = 0;
  /**
   * Ocupa, con una Reserva `CONFIRMADA` propia (1 comensal, no cuenta casi nada para el
   * aforo), todas las mesas que YA existan en `zonaId` para ese turno/fecha y no estén en
   * `propias` — en la práctica, las mesas del seed (`S1..S5`, `V1..V4`), que son filas
   * compartidas y por lo tanto siempre "libres" para un turno nuevo creado por un test.
   *
   * Varios tests de este archivo necesitan que la ÚNICA mesa candidata de la zona sea la que
   * el test controla (para poder afirmar `SIN_MESA_DISPONIBLE` o la identidad exacta de la
   * mesa asignada); sin esto, el best fit real compite contra el seed completo, no contra la
   * mesa que arma el test.
   */
  async function ocuparMesasAjenas(
    zonaId: string,
    turnoId: string,
    fecha: Date,
    propias: string[],
  ) {
    const ajenas = await prisma.mesa.findMany({
      where: { zonaId, id: { notIn: propias } },
      select: { id: true },
    });
    for (const ajena of ajenas) {
      ocupacionContador += 1;
      const dummy = await prisma.reserva.create({
        data: {
          mesaId: ajena.id,
          turnoId,
          fecha,
          comensales: 1,
          estado: 'CONFIRMADA',
          codigoReserva: `OCP${String(ocupacionContador).padStart(5, '0')}`,
          ...datosClienteBase(`ocupacion-${ocupacionContador}`),
        },
      });
      reservaIds.push(dummy.id);
    }
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, ReservasModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(ReservasService);
    await prisma.$connect();

    // Ver `helpers/upsert-seguro.ts`: este archivo corre en paralelo (worker propio de
    // Jest) con otros *.integration-spec.ts que también hacen upsert de las mismas Zonas
    // STANDARD/VIP. Los valores importan (los usan los tests de aforo y anticipación), por
    // eso el fallback ante una colisión de creación es un `update` con esos mismos valores.
    const valoresStandard = {
      minComensales: 1,
      maxComensales: 8,
      anticipacionMinHoras: 2,
      anticipacionMaxDias: 30,
      ventanaCancelacionHoras: 2,
      requiereConfirmacionAdmin: false,
      aforoMaximo: 10,
    };
    const standard = await upsertSeguro(
      () =>
        prisma.zona.upsert({
          where: { nombre: 'STANDARD' },
          update: valoresStandard,
          create: { nombre: 'STANDARD', ...valoresStandard },
        }),
      () =>
        prisma.zona.update({
          where: { nombre: 'STANDARD' },
          data: valoresStandard,
        }),
    );

    const valoresVip = {
      minComensales: 2,
      maxComensales: 12,
      anticipacionMinHoras: 24,
      anticipacionMaxDias: 60,
      ventanaCancelacionHoras: 24,
      requiereConfirmacionAdmin: true,
      aforoMaximo: 10,
    };
    const vip = await upsertSeguro(
      () =>
        prisma.zona.upsert({
          where: { nombre: 'VIP' },
          update: valoresVip,
          create: { nombre: 'VIP', ...valoresVip },
        }),
      () => prisma.zona.update({ where: { nombre: 'VIP' }, data: valoresVip }),
    );
    zonaStandardId = standard.id;
    zonaVipId = vip.id;

    // aforoGlobal alto por defecto (muy por encima de cualquier aforoMaximo de zona usado en
    // este archivo) para que ningún test lo choque sin querer. El test del invariante de
    // aforo global lo baja temporalmente y lo restaura al terminar.
    await prisma.configuracionNegocio.upsert({
      where: { id: 1 },
      update: { aforoGlobal: 1000 },
      create: { id: 1, aforoGlobal: 1000 },
    });
  });

  afterEach(async () => {
    // Los arrays se resetean en el `finally` aunque un `deleteMany` falle (por ejemplo si un
    // test dejó una Reserva sin trackear en `reservaIds` y por eso bloquea el borrado de su
    // Mesa/Turno por FK): que el cleanup de UN test falle no debe poner en un estado
    // inconsistente (ids repetidos) el cleanup del siguiente.
    try {
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
    } finally {
      reservaIds = [];
      mesaIds = [];
      turnoIds = [];
    }

    // Restaurar mocks por si algún test falló antes de restaurarlos.
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    // Restaurar aforoMaximo original de las zonas (valores del seed: STANDARD=40, VIP=20)
    await prisma.zona.update({
      where: { nombre: 'STANDARD' },
      data: { aforoMaximo: 40, requiereConfirmacionAdmin: false },
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

  /** Afirma que la promesa rechaza con el 409 de D8: exactamente esos códigos, en ese orden. */
  async function esperarRechazoPorMotivos(
    promesa: Promise<unknown>,
    codigosEsperados: CodigoMotivo[],
  ) {
    let capturado: unknown;
    try {
      await promesa;
    } catch (error) {
      capturado = error;
    }
    if (capturado === undefined) {
      throw new Error(
        'Se esperaba que la promesa rechazara con un ConflictException y no rechazó.',
      );
    }
    expect(capturado).toBeInstanceOf(ConflictException);
    const conflictError = capturado as ConflictException;
    expect(conflictError.getStatus()).toBe(409);
    const respuesta = conflictError.getResponse() as {
      statusCode: number;
      error: string;
      motivos: { codigo: CodigoMotivo; mensaje: string }[];
    };
    expect(respuesta.error).toBe('Conflict');
    expect(respuesta.motivos.map((motivo) => motivo.codigo)).toEqual(
      codigosEsperados,
    );
  }

  // --- Invariante 1: exclusividad de mesa por turno y fecha ---------------------------
  describe('invariante 1 — exclusividad de mesa por turno y fecha', () => {
    it('rechaza una segunda reserva cuando la única mesa que alcanza ya está ocupada', async () => {
      const mesa = await crearMesa(zonaStandardId, 4, 'INV1-M1');
      const turno = await crearTurno(diaSemanaParaOffset(10));
      const fecha = fechaFutura(10);
      // Sin esto, las mesas del seed (S1..S5) también estarían libres para este turno nuevo
      // y "la única mesa que alcanza" dejaría de ser cierto.
      await ocuparMesasAjenas(zonaStandardId, turno.id, fecha, mesaIds);

      const primera = await service.crearReserva({
        turnoId: turno.id,
        zonaId: zonaStandardId,
        fecha,
        comensales: 2,
        ...datosClienteBase('inv1-a'),
      });
      reservaIds.push(primera.id);
      expect(primera.mesaId).toBe(mesa.id);

      const segunda = service.crearReserva({
        turnoId: turno.id,
        zonaId: zonaStandardId,
        fecha,
        comensales: 2,
        ...datosClienteBase('inv1-b'),
      });
      await esperarRechazoPorMotivos(segunda, [
        CodigoMotivo.SIN_MESA_DISPONIBLE,
      ]);

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
      const mesa = await crearMesa(zonaStandardId, 4, 'INV1-M2');
      const turno = await crearTurno(diaSemanaParaOffset(11));
      const fecha = fechaFutura(11);
      await ocuparMesasAjenas(zonaStandardId, turno.id, fecha, mesaIds);

      const primera = await service.crearReserva({
        turnoId: turno.id,
        zonaId: zonaStandardId,
        fecha,
        comensales: 2,
        ...datosClienteBase('inv1-c'),
      });
      reservaIds.push(primera.id);

      await service.transicionarEstado(primera.id, 'CANCELADA');

      const segunda = await service.crearReserva({
        turnoId: turno.id,
        zonaId: zonaStandardId,
        fecha,
        comensales: 2,
        ...datosClienteBase('inv1-d'),
      });
      reservaIds.push(segunda.id);

      expect(segunda.id).not.toBe(primera.id);
      expect(segunda.mesaId).toBe(mesa.id);
    });
  });

  // --- Invariante 2: capacidad de la mesa nunca excedida -------------------------------
  describe('invariante 2 — capacidad de la mesa nunca excedida', () => {
    it('rechaza con SIN_MESA_DISPONIBLE cuando ninguna mesa alcanza la capacidad pedida', async () => {
      const mesa = await crearMesa(zonaStandardId, 4, 'INV2-M1');
      const turno = await crearTurno(diaSemanaParaOffset(12));
      const fecha = fechaFutura(12);
      // Sin esto, S4 (capacidad 6) y S5 (capacidad 8) del seed seguirían libres para este
      // turno nuevo y sí alcanzarían para 5 comensales.
      await ocuparMesasAjenas(zonaStandardId, turno.id, fecha, mesaIds);

      const intento = service.crearReserva({
        turnoId: turno.id,
        zonaId: zonaStandardId,
        fecha,
        comensales: 5,
        ...datosClienteBase('inv2'),
      });
      await esperarRechazoPorMotivos(intento, [
        CodigoMotivo.SIN_MESA_DISPONIBLE,
      ]);

      // Ninguna reserva nueva sobre la mesa propia del test (las de ocupación son fixture,
      // no lo que este test intentó crear).
      const creadas = await prisma.reserva.count({
        where: { mesaId: mesa.id },
      });
      expect(creadas).toBe(0);
    });

    it('la mesa asignada siempre tiene capacidad mayor o igual a los comensales pedidos', async () => {
      await crearMesa(zonaStandardId, 2, 'INV2-M2');
      await crearMesa(zonaStandardId, 4, 'INV2-M3');
      await crearMesa(zonaStandardId, 8, 'INV2-M4');
      const turno = await crearTurno(diaSemanaParaOffset(12));

      const reserva = await service.crearReserva({
        turnoId: turno.id,
        zonaId: zonaStandardId,
        fecha: fechaFutura(12),
        comensales: 5,
        ...datosClienteBase('inv2-ok'),
      });
      reservaIds.push(reserva.id);

      // No importa cuál mesa exacta ganó el best fit (puede ser una del seed): lo que
      // afirma el invariante es que, sea cual sea, su capacidad alcanza.
      const mesaAsignada = await prisma.mesa.findUniqueOrThrow({
        where: { id: reserva.mesaId },
      });
      expect(mesaAsignada.capacidad).toBeGreaterThanOrEqual(5);
    });

    it('rechaza con COMENSALES_FUERA_DE_RANGO una cantidad de comensales no positiva', async () => {
      await crearMesa(zonaStandardId, 4, 'INV2-M5');
      const turno = await crearTurno(diaSemanaParaOffset(12));

      const conCero = service.crearReserva({
        turnoId: turno.id,
        zonaId: zonaStandardId,
        fecha: fechaFutura(12),
        comensales: 0,
        ...datosClienteBase('inv2-cero'),
      });
      await esperarRechazoPorMotivos(conCero, [
        CodigoMotivo.COMENSALES_FUERA_DE_RANGO,
      ]);

      const conNegativo = service.crearReserva({
        turnoId: turno.id,
        zonaId: zonaStandardId,
        fecha: fechaFutura(12),
        comensales: -1,
        ...datosClienteBase('inv2-negativo'),
      });
      await esperarRechazoPorMotivos(conNegativo, [
        CodigoMotivo.COMENSALES_FUERA_DE_RANGO,
      ]);

      const creadas = await prisma.reserva.count({
        where: { turnoId: turno.id },
      });
      expect(creadas).toBe(0);
    });
  });

  // --- Invariante 3: turno activo, turno acorde a la fecha y mesa de la zona pedida ----
  describe('invariante 3 — turno activo, fecha acorde y mesa de la zona pedida', () => {
    it('rechaza una reserva sobre un turno inactivo y no persiste nada', async () => {
      await crearMesa(zonaStandardId, 4, 'INV3-M1');
      const turnoInactivo = await crearTurno(diaSemanaParaOffset(13), false);
      const fecha = fechaFutura(13);

      const antes = await prisma.reserva.count({
        where: { turnoId: turnoInactivo.id },
      });
      const intento = service.crearReserva({
        turnoId: turnoInactivo.id,
        zonaId: zonaStandardId,
        fecha,
        comensales: 2,
        ...datosClienteBase('inv3-turno'),
      });
      await esperarRechazoPorMotivos(intento, [CodigoMotivo.TURNO_INACTIVO]);

      const despues = await prisma.reserva.count({
        where: { turnoId: turnoInactivo.id },
      });
      expect({ antes, despues }).toEqual({ antes: 0, despues: 0 });
    });

    it('rechaza una reserva cuya fecha no cae en el día de la semana del turno', async () => {
      // El turno por defecto es MIERCOLES (diaSemana = 3 en getUTCDay).
      const mesa = await crearMesa(zonaStandardId, 4, 'INV3B-M1');
      const turno = await crearTurno(); // MIERCOLES
      const fechaJueves = fechaFuturaConDiaSemana(4); // JUEVES

      expect(diaSemanaDeFecha(fechaJueves)).toBe(4);
      expect(turno.diaSemana).toBe(DiaSemana.MIERCOLES);

      const intento = service.crearReserva({
        turnoId: turno.id,
        zonaId: zonaStandardId,
        fecha: fechaJueves,
        comensales: 2,
        ...datosClienteBase('inv3b-dia'),
      });
      await esperarRechazoPorMotivos(intento, [
        CodigoMotivo.TURNO_NO_CORRESPONDE_A_FECHA,
      ]);

      const creadas = await prisma.reserva.count({
        where: { mesaId: mesa.id },
      });
      expect(creadas).toBe(0);
    });

    it('permite una reserva cuando la fecha cae en el mismo día de la semana del turno', async () => {
      const turno = await crearTurno(); // MIERCOLES
      const fechaMiercoles = fechaFuturaConDiaSemana(3); // MIERCOLES
      await crearMesa(zonaStandardId, 4, 'INV3B-M2');

      expect(diaSemanaDeFecha(fechaMiercoles)).toBe(3);
      expect(turno.diaSemana).toBe(DiaSemana.MIERCOLES);

      const reserva = await service.crearReserva({
        turnoId: turno.id,
        zonaId: zonaStandardId,
        fecha: fechaMiercoles,
        comensales: 2,
        ...datosClienteBase('inv3b-ok'),
      });
      reservaIds.push(reserva.id);

      expect(reserva.id).toBeDefined();
    });

    it('la mesa asignada siempre pertenece a la zona pedida, aunque otra zona tenga mesas libres', async () => {
      // Mesa libre en VIP con capacidad de sobra: si el best fit mirara todas las mesas en
      // vez de solo las de `contexto.mesasLibres` (ya filtradas por zona), la elegiría.
      await crearMesa(zonaVipId, 12, 'INV3-VIP');
      await crearMesa(zonaStandardId, 4, 'INV3-STD');
      const turno = await crearTurno(diaSemanaParaOffset(14));

      const reserva = await service.crearReserva({
        turnoId: turno.id,
        zonaId: zonaStandardId,
        fecha: fechaFutura(14),
        comensales: 2,
        ...datosClienteBase('inv3-zona'),
      });
      reservaIds.push(reserva.id);

      // No importa si el best fit terminó en la mesa propia del test o en una del seed
      // (STANDARD también las tiene): lo que afirma el invariante es que, sea cual sea,
      // pertenece a la zona pedida y nunca a VIP.
      const mesaAsignada = await prisma.mesa.findUniqueOrThrow({
        where: { id: reserva.mesaId },
      });
      expect(mesaAsignada.zonaId).toBe(zonaStandardId);
    });
  });

  // --- Invariante 4: aforo de zona y aforo global respetados ---------------------------
  describe('invariante 4 — aforo de zona y aforo global respetados', () => {
    it('rechaza con AFORO_ZONA una reserva que excede el aforo restante aunque haya mesa libre', async () => {
      // aforoMaximo de STANDARD en este test = 10 (ver beforeAll).
      const mesaA = await crearMesa(zonaStandardId, 8, 'INV4-M1');
      const mesaB = await crearMesa(zonaStandardId, 8, 'INV4-M2');
      const turno = await crearTurno(diaSemanaParaOffset(15));
      const fecha = fechaFutura(15);

      const primera = await service.crearReserva({
        turnoId: turno.id,
        zonaId: zonaStandardId,
        fecha,
        comensales: 8, // deja 2 lugares de aforo (10 - 8) para esa zona/turno/fecha
        ...datosClienteBase('inv4-a'),
      });
      reservaIds.push(primera.id);
      expect(primera.mesaId).toBe(mesaA.id);

      // mesaB está físicamente libre y tiene capacidad de sobra, pero pedir 3 comensales más
      // superaría el aforo restante de la zona (2).
      const intento = service.crearReserva({
        turnoId: turno.id,
        zonaId: zonaStandardId,
        fecha,
        comensales: 3,
        ...datosClienteBase('inv4-b'),
      });
      await esperarRechazoPorMotivos(intento, [CodigoMotivo.AFORO_ZONA]);

      const creadasEnMesaB = await prisma.reserva.count({
        where: { mesaId: mesaB.id },
      });
      expect(creadasEnMesaB).toBe(0);
    });

    it('rechaza con AFORO_GLOBAL una reserva que excede el aforo global aunque el aforo de su zona alcance', async () => {
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
          turnoId: turno.id,
          zonaId: zonaVipId,
          fecha,
          comensales: 8, // aforo de VIP: 8/10, todavía le sobra lugar individualmente
          ...datosClienteBase('inv4b-vip'),
        });
        reservaIds.push(enVip.id);
        expect(enVip.mesaId).toBe(mesaVip.id);

        // 6 comensales en STANDARD pasa el aforo de zona (0+6 <= 10), pero 8 (VIP) + 6
        // (STANDARD) = 14 > 12 (aforoGlobal): el rechazo tiene que venir del chequeo global.
        const intento = service.crearReserva({
          turnoId: turno.id,
          zonaId: zonaStandardId,
          fecha,
          comensales: 6,
          ...datosClienteBase('inv4b-standard'),
        });
        await esperarRechazoPorMotivos(intento, [CodigoMotivo.AFORO_GLOBAL]);

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
  });

  // --- Invariante 5: estados terminales no retroceden (transicionarEstado, sin cambios) -
  describe('invariante 5 — estados terminales no retroceden', () => {
    it('rechaza transicionar una reserva CANCELADA a cualquier otro estado', async () => {
      await crearMesa(zonaStandardId, 4, 'INV5-M1');
      const turno = await crearTurno(diaSemanaParaOffset(16));

      const reserva = await service.crearReserva({
        turnoId: turno.id,
        zonaId: zonaStandardId,
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
      await crearMesa(zonaStandardId, 4, 'INV5-M2');
      const turno = await crearTurno(diaSemanaParaOffset(17));

      const reserva = await service.crearReserva({
        turnoId: turno.id,
        zonaId: zonaStandardId,
        fecha: fechaFutura(17),
        comensales: 2,
        ...datosClienteBase('inv5-noshow'),
      });
      reservaIds.push(reserva.id);

      // STANDARD no requiere confirmación del admin: la Reserva ya nace CONFIRMADA.
      expect(reserva.estado).toBe('CONFIRMADA');
      await service.transicionarEstado(reserva.id, 'NO_SHOW');

      await expect(
        service.transicionarEstado(reserva.id, 'CANCELADA'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // --- Turno o zona inexistentes (404, cargarContexto) ----------------------------------
  describe('turno o zona inexistentes', () => {
    it('lanza NotFoundException si el turno no existe', async () => {
      await crearMesa(zonaStandardId, 4, 'INV404-M1');

      await expect(
        service.crearReserva({
          turnoId: randomUUID(),
          zonaId: zonaStandardId,
          fecha: fechaFutura(21),
          comensales: 2,
          ...datosClienteBase('inv404-turno'),
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lanza NotFoundException si la zona no existe', async () => {
      const turno = await crearTurno(diaSemanaParaOffset(21));

      await expect(
        service.crearReserva({
          turnoId: turno.id,
          zonaId: randomUUID(),
          fecha: fechaFutura(21),
          comensales: 2,
          ...datosClienteBase('inv404-zona'),
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // --- Estado inicial según requiereConfirmacionAdmin (D4) ------------------------------
  describe('estado inicial según requiereConfirmacionAdmin', () => {
    it('una reserva en zona STANDARD (requiereConfirmacionAdmin=false) queda CONFIRMADA', async () => {
      await crearMesa(zonaStandardId, 4, 'INV-ESTADO-STD');
      const turno = await crearTurno(diaSemanaParaOffset(22));

      const reserva = await service.crearReserva({
        turnoId: turno.id,
        zonaId: zonaStandardId,
        fecha: fechaFutura(22),
        comensales: 2,
        ...datosClienteBase('estado-standard'),
      });
      reservaIds.push(reserva.id);

      expect(reserva.estado).toBe('CONFIRMADA');
    });

    it('una reserva en zona VIP (requiereConfirmacionAdmin=true) queda PENDIENTE', async () => {
      await crearMesa(zonaVipId, 4, 'INV-ESTADO-VIP');
      const turno = await crearTurno(diaSemanaParaOffset(23));

      const reserva = await service.crearReserva({
        turnoId: turno.id,
        zonaId: zonaVipId,
        fecha: fechaFutura(23),
        comensales: 2,
        ...datosClienteBase('estado-vip'),
      });
      reservaIds.push(reserva.id);

      expect(reserva.estado).toBe('PENDIENTE');
    });

    it('el estado sigue a requiereConfirmacionAdmin y no al nombre de la zona: STANDARD en true queda PENDIENTE', async () => {
      await prisma.zona.update({
        where: { id: zonaStandardId },
        data: { requiereConfirmacionAdmin: true },
      });

      try {
        await crearMesa(zonaStandardId, 4, 'INV-ESTADO-STD-TRUE');
        const turno = await crearTurno(diaSemanaParaOffset(24));

        const reserva = await service.crearReserva({
          turnoId: turno.id,
          zonaId: zonaStandardId,
          fecha: fechaFutura(24),
          comensales: 2,
          ...datosClienteBase('estado-standard-true'),
        });
        reservaIds.push(reserva.id);

        expect(reserva.estado).toBe('PENDIENTE');
      } finally {
        await prisma.zona.update({
          where: { id: zonaStandardId },
          data: { requiereConfirmacionAdmin: false },
        });
      }
    });
  });

  // --- Trampa de fechas: cena cuyo inicio en UTC cae al día siguiente (D9, Trampas) -----
  describe('fecha de calendario local (design.md → Trampas)', () => {
    it('persiste la misma fecha enviada aunque el inicio del turno en UTC caiga al día siguiente', async () => {
      const fechaSabado = fechaFuturaConDiaSemana(6); // SABADO
      const turnoCena22 = await crearTurno(
        DiaSemana.SABADO,
        true,
        new Date(Date.UTC(1970, 0, 1, 22, 0, 0)), // 22:00 local
        new Date(Date.UTC(1970, 0, 1, 23, 30, 0)), // 23:30 local
      );
      await crearMesa(zonaStandardId, 4, 'INV-FECHA-22');

      const reserva = await service.crearReserva({
        turnoId: turnoCena22.id,
        zonaId: zonaStandardId,
        fecha: fechaSabado,
        comensales: 2,
        ...datosClienteBase('fecha-22'),
      });
      reservaIds.push(reserva.id);

      expect(reserva.fecha.getUTCFullYear()).toBe(fechaSabado.getUTCFullYear());
      expect(reserva.fecha.getUTCMonth()).toBe(fechaSabado.getUTCMonth());
      expect(reserva.fecha.getUTCDate()).toBe(fechaSabado.getUTCDate());

      const persistida = await prisma.reserva.findUniqueOrThrow({
        where: { id: reserva.id },
      });
      expect(persistida.fecha.getUTCFullYear()).toBe(
        fechaSabado.getUTCFullYear(),
      );
      expect(persistida.fecha.getUTCMonth()).toBe(fechaSabado.getUTCMonth());
      expect(persistida.fecha.getUTCDate()).toBe(fechaSabado.getUTCDate());
    });
  });

  // --- Código de reserva único (design.md D5, conservado de #12) ------------------------
  describe('código de reserva único', () => {
    it('reintenta con un código nuevo si el generado colisiona con uno existente', async () => {
      await crearMesa(zonaStandardId, 4, 'INV6-M1');
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
        turnoId: turno.id,
        zonaId: zonaStandardId,
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
      const cantidad = 15;
      const turno = await crearTurno(diaSemanaParaOffset(30));
      const fecha = fechaFutura(30);
      // Una mesa por reserva, mismo turno y misma fecha: cada llamada secuencial ocupa una
      // mesa distinta de `contexto.mesasLibres` (las propias ordenan alfabéticamente antes
      // que las del seed: 'I' < 'S', así que best fit las agota primero), sin chocar contra
      // el índice único parcial (invariante 1).
      for (let i = 0; i < cantidad; i++) {
        await crearMesa(
          zonaStandardId,
          2,
          `INV6-SEQ-${String(i).padStart(2, '0')}`,
        );
      }

      // 15 × 2 comensales = 30 supera el aforoMaximo de 10 fijado en beforeAll para los
      // demás tests: se sube solo para esta prueba (no le importa el aforo, sino los
      // códigos) y se restaura al final.
      await prisma.zona.update({
        where: { id: zonaStandardId },
        data: { aforoMaximo: 1000 },
      });

      try {
        const codigos: string[] = [];
        for (let i = 0; i < cantidad; i++) {
          const reserva = await service.crearReserva({
            turnoId: turno.id,
            zonaId: zonaStandardId,
            fecha,
            comensales: 2,
            ...datosClienteBase(`inv6-seq-${i}`),
          });
          reservaIds.push(reserva.id);
          codigos.push(reserva.codigoReserva);
        }

        expect(new Set(codigos).size).toBe(cantidad);
      } finally {
        await prisma.zona.update({
          where: { id: zonaStandardId },
          data: { aforoMaximo: 10 },
        });
      }
    });
  });
});
