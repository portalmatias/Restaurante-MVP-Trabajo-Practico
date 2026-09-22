import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DiaSemana, EstadoReserva } from '@prisma/client';

import { bloquearTurnoFecha } from '../src/disponibilidad/contexto/bloquear-turno-fecha';
import { cargarContexto } from '../src/disponibilidad/contexto/cargar-contexto';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Tareas 4.1–4.3 del change `disponibilidad`. `cargarContexto` es el único punto del
 * validador que lee la base (design.md D1), así que se prueba contra la base de TEST real
 * (`reservas_test`, ver jest-e2e.setup.ts) y no contra mocks de Prisma (config.yaml §9).
 * Las reglas puras ya están cubiertas en `evaluar-reglas.spec.ts`: acá se prueba solo qué
 * datos se leen y cuáles se ignoran.
 *
 * Cada test crea sus propias Mesas, Turnos y Reservas (etiqueta con prefijo `CTX-` y una
 * `horaInicio` distinta por Turno, para no chocar con la clave natural de Turno ni con el
 * seed) y los borra en `afterEach`. Las dos Zonas y la fila única de `ConfiguracionNegocio`
 * son compartidas y se dejan con los valores del seed en `beforeAll`: `NombreZona` es un
 * enum de dos valores, así que no se pueden crear zonas propias.
 *
 * Las fechas son fijas y se construyen con `Date.UTC(y, m - 1, d)`, que es la forma en que
 * Prisma devuelve y espera un `@db.Date` (design.md → Trampas de fechas). `cargarContexto`
 * no mira el reloj ni el día de la semana, así que no hace falta calcularlas desde hoy.
 */
describe('cargarContexto y bloquearTurnoFecha (e2e)', () => {
  let prisma: PrismaService;

  let zonaStandardId: string;
  let zonaVipId: string;

  let mesaIds: string[] = [];
  let turnoIds: string[] = [];
  let reservaIds: string[] = [];

  function fechaCalendario(anio: number, mes: number, dia: number): Date {
    return new Date(Date.UTC(anio, mes - 1, dia));
  }

  /** Sábado. El día de la semana no lo usa `cargarContexto`, pero mantiene el ejemplo de la spec. */
  const FECHA = fechaCalendario(2026, 9, 19);
  /** Domingo siguiente, para probar que la ocupación se filtra por fecha exacta. */
  const FECHA_SIGUIENTE = fechaCalendario(2026, 9, 20);

  // Los turnos de este archivo viven en la banda horaria 05:00–05:59 (el seed usa 12:00 y
  // 20:00, y `reservas-invariantes` la banda 01:xx), así que no colisionan con nadie.
  let horaContador = 0;
  function horaDeTestUnica(): Date {
    horaContador += 1;
    return new Date(Date.UTC(1970, 0, 1, 5, horaContador, 0));
  }

  let codigoContador = 0;
  function codigoUnico(): string {
    codigoContador += 1;
    return `CTX${String(codigoContador).padStart(5, '0')}`;
  }

  async function crearMesa(
    zonaId: string,
    capacidad: number,
    etiqueta: string,
  ) {
    const mesa = await prisma.mesa.create({
      data: { zonaId, capacidad, etiqueta: `CTX-${etiqueta}` },
    });
    mesaIds.push(mesa.id);
    return mesa;
  }

  /**
   * Las zonas STANDARD y VIP son singleton (el enum `NombreZona` solo tiene esos dos
   * valores) y el seed de `modelo-dominio` ya les carga mesas: S1-S5 y V1-V4. Desde que
   * `ci-integracion-db` corre `db:seed` antes de los tests, esas mesas aparecen en
   * `mesasLibres` junto con las de este archivo. Las aserciones de exclusividad se hacen
   * entonces sobre las mesas propias, que `crearMesa` prefija con `CTX-`; las del seed no
   * se tocan ni se borran.
   */
  function soloDelTest<T extends { etiqueta: string }>(mesas: T[]): T[] {
    return mesas.filter((mesa) => mesa.etiqueta.startsWith('CTX-'));
  }

  async function crearTurno(
    diaSemana: DiaSemana = DiaSemana.SABADO,
    activo = true,
  ) {
    const turno = await prisma.turno.create({
      data: {
        diaSemana,
        horaInicio: horaDeTestUnica(),
        horaFin: new Date(Date.UTC(1970, 0, 1, 8, 0, 0)),
        activo,
      },
    });
    turnoIds.push(turno.id);
    return turno;
  }

  async function crearReserva(entrada: {
    mesaId: string;
    turnoId: string;
    fecha: Date;
    comensales: number;
    estado: EstadoReserva;
  }) {
    const reserva = await prisma.reserva.create({
      data: {
        ...entrada,
        nombreCliente: 'Cliente Contexto',
        emailCliente: 'contexto@example.com',
        telefonoCliente: '+54 9 11 5555-9999',
        codigoReserva: codigoUnico(),
      },
    });
    reservaIds.push(reserva.id);
    return reserva;
  }

  /** Borra lo que haya quedado de una corrida anterior interrumpida. */
  async function limpiarResiduos() {
    const turnosResiduales = await prisma.turno.findMany({
      where: {
        horaInicio: {
          gte: new Date(Date.UTC(1970, 0, 1, 5, 0, 0)),
          lt: new Date(Date.UTC(1970, 0, 1, 6, 0, 0)),
        },
      },
      select: { id: true },
    });
    const mesasResiduales = await prisma.mesa.findMany({
      where: { etiqueta: { startsWith: 'CTX-' } },
      select: { id: true },
    });
    const idsTurnos = turnosResiduales.map((turno) => turno.id);
    const idsMesas = mesasResiduales.map((mesa) => mesa.id);
    await prisma.reserva.deleteMany({
      where: {
        OR: [{ turnoId: { in: idsTurnos } }, { mesaId: { in: idsMesas } }],
      },
    });
    await prisma.mesa.deleteMany({ where: { id: { in: idsMesas } } });
    await prisma.turno.deleteMany({ where: { id: { in: idsTurnos } } });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    // Valores del seed (backend/prisma/seed.ts): así la suite no deja la base distinta de
    // como la encontró y no hace falta restaurarlos en afterAll.
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
    zonaStandardId = standard.id;
    zonaVipId = vip.id;

    await prisma.configuracionNegocio.upsert({
      where: { id: 1 },
      update: { aforoGlobal: 60 },
      create: { id: 1, aforoGlobal: 60 },
    });

    await limpiarResiduos();
  });

  afterEach(async () => {
    // Orden: Reserva primero (FK a Mesa y Turno), después Mesa y Turno.
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // --- Forma del contexto -------------------------------------------------------------
  it('devuelve el turno, la zona, el aforo global y las mesas libres de la zona', async () => {
    const turno = await crearTurno();
    const mesaChica = await crearMesa(zonaVipId, 2, 'FORMA-CHICA');
    const mesaGrande = await crearMesa(zonaVipId, 12, 'FORMA-GRANDE');
    // Una mesa de otra zona no tiene que aparecer en `mesasLibres` de VIP.
    await crearMesa(zonaStandardId, 4, 'FORMA-OTRA-ZONA');

    const contexto = await cargarContexto(prisma, {
      fecha: FECHA,
      turnoId: turno.id,
      zonaId: zonaVipId,
      comensales: 2,
    });

    expect(contexto.turno).toEqual({
      activo: true,
      diaSemana: DiaSemana.SABADO,
      horaInicio: turno.horaInicio,
    });
    expect(contexto.zona).toEqual({
      nombre: 'VIP',
      minComensales: 2,
      maxComensales: 12,
      anticipacionMinHoras: 24,
      anticipacionMaxDias: 60,
      aforoMaximo: 20,
      requiereConfirmacionAdmin: true,
    });
    expect(contexto.aforoGlobal).toBe(60);
    expect(contexto.ocupadosZona).toBe(0);
    expect(contexto.ocupadosGlobal).toBe(0);
    expect(contexto.mesasLibres).toEqual(
      expect.arrayContaining([
        { id: mesaChica.id, etiqueta: mesaChica.etiqueta, capacidad: 2 },
        { id: mesaGrande.id, etiqueta: mesaGrande.etiqueta, capacidad: 12 },
      ]),
    );
    expect(soloDelTest(contexto.mesasLibres)).toHaveLength(2);
  });

  it('refleja un turno inactivo sin lanzar error (la regla la evalúa evaluarReglas)', async () => {
    const turno = await crearTurno(DiaSemana.SABADO, false);
    await crearMesa(zonaStandardId, 4, 'INACTIVO-M1');

    const contexto = await cargarContexto(prisma, {
      fecha: FECHA,
      turnoId: turno.id,
      zonaId: zonaStandardId,
      comensales: 2,
    });

    expect(contexto.turno.activo).toBe(false);
  });

  // --- Estados que ocupan --------------------------------------------------------------
  it('suma a los ocupados solo las reservas PENDIENTE y CONFIRMADA', async () => {
    const turno = await crearTurno();
    const mesaPendiente = await crearMesa(zonaStandardId, 8, 'ESTADOS-M1');
    const mesaConfirmada = await crearMesa(zonaStandardId, 8, 'ESTADOS-M2');
    const mesaCancelada = await crearMesa(zonaStandardId, 8, 'ESTADOS-M3');
    const mesaNoShow = await crearMesa(zonaStandardId, 8, 'ESTADOS-M4');

    await crearReserva({
      mesaId: mesaPendiente.id,
      turnoId: turno.id,
      fecha: FECHA,
      comensales: 3,
      estado: 'PENDIENTE',
    });
    await crearReserva({
      mesaId: mesaConfirmada.id,
      turnoId: turno.id,
      fecha: FECHA,
      comensales: 2,
      estado: 'CONFIRMADA',
    });
    await crearReserva({
      mesaId: mesaCancelada.id,
      turnoId: turno.id,
      fecha: FECHA,
      comensales: 4,
      estado: 'CANCELADA',
    });
    await crearReserva({
      mesaId: mesaNoShow.id,
      turnoId: turno.id,
      fecha: FECHA,
      comensales: 5,
      estado: 'NO_SHOW',
    });

    const contexto = await cargarContexto(prisma, {
      fecha: FECHA,
      turnoId: turno.id,
      zonaId: zonaStandardId,
      comensales: 2,
    });

    // 3 (PENDIENTE) + 2 (CONFIRMADA); la CANCELADA y la NO_SHOW no cuentan.
    expect(contexto.ocupadosZona).toBe(5);
    expect(contexto.ocupadosGlobal).toBe(5);
  });

  // --- Zona por la mesa y aforo global -------------------------------------------------
  it('resuelve la zona de una reserva por su mesa y suma todas las zonas en el global', async () => {
    const turno = await crearTurno();
    const mesaVip = await crearMesa(zonaVipId, 12, 'ZONA-MVIP');
    const mesaStandard = await crearMesa(zonaStandardId, 8, 'ZONA-MSTD');

    await crearReserva({
      mesaId: mesaVip.id,
      turnoId: turno.id,
      fecha: FECHA,
      comensales: 6,
      estado: 'CONFIRMADA',
    });
    await crearReserva({
      mesaId: mesaStandard.id,
      turnoId: turno.id,
      fecha: FECHA,
      comensales: 3,
      estado: 'PENDIENTE',
    });

    const solicitudBase = { fecha: FECHA, turnoId: turno.id, comensales: 2 };

    const enVip = await cargarContexto(prisma, {
      ...solicitudBase,
      zonaId: zonaVipId,
    });
    expect(enVip.ocupadosZona).toBe(6);
    expect(enVip.ocupadosGlobal).toBe(9);

    const enStandard = await cargarContexto(prisma, {
      ...solicitudBase,
      zonaId: zonaStandardId,
    });
    expect(enStandard.ocupadosZona).toBe(3);
    expect(enStandard.ocupadosGlobal).toBe(9);
  });

  // --- Filtro por fecha y por turno ----------------------------------------------------
  it('no cuenta una reserva de otra fecha ni de otro turno', async () => {
    const turno = await crearTurno();
    const otroTurno = await crearTurno();
    const mesaOtraFecha = await crearMesa(zonaStandardId, 8, 'FECHA-M1');
    const mesaOtroTurno = await crearMesa(zonaStandardId, 8, 'FECHA-M2');

    await crearReserva({
      mesaId: mesaOtraFecha.id,
      turnoId: turno.id,
      fecha: FECHA_SIGUIENTE,
      comensales: 4,
      estado: 'CONFIRMADA',
    });
    await crearReserva({
      mesaId: mesaOtroTurno.id,
      turnoId: otroTurno.id,
      fecha: FECHA,
      comensales: 7,
      estado: 'CONFIRMADA',
    });

    const delSabado = await cargarContexto(prisma, {
      fecha: FECHA,
      turnoId: turno.id,
      zonaId: zonaStandardId,
      comensales: 2,
    });
    expect(delSabado.ocupadosZona).toBe(0);
    expect(delSabado.ocupadosGlobal).toBe(0);
    expect(
      soloDelTest(delSabado.mesasLibres)
        .map((mesa) => mesa.id)
        .sort(),
    ).toEqual([mesaOtraFecha.id, mesaOtroTurno.id].sort());

    // La misma reserva sí cuenta para su propia fecha.
    const delDomingo = await cargarContexto(prisma, {
      fecha: FECHA_SIGUIENTE,
      turnoId: turno.id,
      zonaId: zonaStandardId,
      comensales: 2,
    });
    expect(delDomingo.ocupadosZona).toBe(4);
    expect(delDomingo.ocupadosGlobal).toBe(4);
  });

  // --- Mesas libres ---------------------------------------------------------------------
  it('excluye de mesasLibres las mesas con reserva activa e incluye las que solo tienen una cancelada', async () => {
    const turno = await crearTurno();
    const mesaOcupada = await crearMesa(zonaStandardId, 4, 'LIBRES-OCUPADA');
    const mesaConCancelada = await crearMesa(
      zonaStandardId,
      6,
      'LIBRES-CANCELADA',
    );
    const mesaConNoShow = await crearMesa(zonaStandardId, 2, 'LIBRES-NOSHOW');
    const mesaLibre = await crearMesa(zonaStandardId, 8, 'LIBRES-LIBRE');

    await crearReserva({
      mesaId: mesaOcupada.id,
      turnoId: turno.id,
      fecha: FECHA,
      comensales: 3,
      estado: 'PENDIENTE',
    });
    await crearReserva({
      mesaId: mesaConCancelada.id,
      turnoId: turno.id,
      fecha: FECHA,
      comensales: 6,
      estado: 'CANCELADA',
    });
    await crearReserva({
      mesaId: mesaConNoShow.id,
      turnoId: turno.id,
      fecha: FECHA,
      comensales: 2,
      estado: 'NO_SHOW',
    });

    const contexto = await cargarContexto(prisma, {
      fecha: FECHA,
      turnoId: turno.id,
      zonaId: zonaStandardId,
      comensales: 2,
    });

    const idsLibres = soloDelTest(contexto.mesasLibres).map((mesa) => mesa.id);
    expect(idsLibres).not.toContain(mesaOcupada.id);
    expect(idsLibres.sort()).toEqual(
      [mesaConCancelada.id, mesaConNoShow.id, mesaLibre.id].sort(),
    );
  });

  // --- 404 ------------------------------------------------------------------------------
  it('lanza NotFoundException si el turno no existe', async () => {
    const turnoInexistente = '3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73';

    await expect(
      cargarContexto(prisma, {
        fecha: FECHA,
        turnoId: turnoInexistente,
        zonaId: zonaStandardId,
        comensales: 2,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lanza NotFoundException si la zona no existe', async () => {
    const turno = await crearTurno();
    const zonaInexistente = 'b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19';

    await expect(
      cargarContexto(prisma, {
        fecha: FECHA,
        turnoId: turno.id,
        zonaId: zonaInexistente,
        comensales: 2,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // --- Dentro de una transacción (tarea 4.2) ---------------------------------------------
  it('devuelve el mismo contexto cuando recibe un tx de $transaction', async () => {
    const turno = await crearTurno();
    const mesa = await crearMesa(zonaVipId, 12, 'TX-M1');
    await crearReserva({
      mesaId: mesa.id,
      turnoId: turno.id,
      fecha: FECHA,
      comensales: 5,
      estado: 'CONFIRMADA',
    });

    const solicitud = {
      fecha: FECHA,
      turnoId: turno.id,
      zonaId: zonaVipId,
      comensales: 2,
    };

    const fueraDeTransaccion = await cargarContexto(prisma, solicitud);
    const dentroDeTransaccion = await prisma.$transaction((tx) =>
      cargarContexto(tx, solicitud),
    );

    expect(dentroDeTransaccion).toEqual(fueraDeTransaccion);
    expect(dentroDeTransaccion.ocupadosZona).toBe(5);
    expect(soloDelTest(dentroDeTransaccion.mesasLibres)).toEqual([]);
  });

  // --- Lock advisory (tarea 4.3) ---------------------------------------------------------
  describe('bloquearTurnoFecha', () => {
    it('no falla dentro de una transacción y deja cargar el contexto después', async () => {
      const turno = await crearTurno();
      const mesa = await crearMesa(zonaStandardId, 4, 'LOCK-M1');

      const contexto = await prisma.$transaction(async (tx) => {
        await bloquearTurnoFecha(tx, turno.id, FECHA);
        return cargarContexto(tx, {
          fecha: FECHA,
          turnoId: turno.id,
          zonaId: zonaStandardId,
          comensales: 2,
        });
      });

      expect(soloDelTest(contexto.mesasLibres)).toEqual([
        { id: mesa.id, etiqueta: mesa.etiqueta, capacidad: 4 },
      ]);
    });

    it('es reentrante dentro de la misma transacción y acepta varias claves', async () => {
      const turno = await crearTurno();

      await expect(
        prisma.$transaction(async (tx) => {
          await bloquearTurnoFecha(tx, turno.id, FECHA);
          await bloquearTurnoFecha(tx, turno.id, FECHA);
          await bloquearTurnoFecha(tx, turno.id, FECHA_SIGUIENTE);
          return true;
        }),
      ).resolves.toBe(true);
    });

    it('libera el lock al terminar la transacción', async () => {
      const turno = await crearTurno();

      // Si el lock no se liberara con el COMMIT, la segunda vuelta quedaría esperando
      // hasta el timeout de la transacción interactiva (design.md D6).
      for (let i = 0; i < 3; i++) {
        await prisma.$transaction(async (tx) => {
          await bloquearTurnoFecha(tx, turno.id, FECHA);
        });
      }

      const advisoryVivos = await prisma.$queryRaw<
        { total: bigint }[]
      >`SELECT count(*)::bigint AS total FROM pg_locks WHERE locktype = 'advisory'`;
      expect(Number(advisoryVivos[0].total)).toBe(0);
    });
  });
});
