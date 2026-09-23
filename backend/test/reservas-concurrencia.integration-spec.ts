import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DiaSemana } from '@prisma/client';

import { bloquearTurnoFecha } from '../src/disponibilidad/contexto/bloquear-turno-fecha';
import { CodigoMotivo } from '../src/disponibilidad/reglas/tipos';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as elegirMesaBestFitModule from '../src/reservas/elegir-mesa-best-fit';
import { ReservasModule } from '../src/reservas/reservas.module';
import {
  CrearReservaInput,
  ReservasService,
} from '../src/reservas/reservas.service';
import { ocuparMesasAjenas as ocuparMesasAjenasCompartido } from './helpers/ocupar-mesas-ajenas';

/**
 * Tests de concurrencia de `ReservasService.crearReserva` (tasks.md 4.1 y 4.2, design.md D2 y
 * D10). Sin mocks de Prisma: corren contra la base de TEST real levantada por
 * `docker-compose`, con datos propios y `Reserva` limpia en cada test.
 *
 * Comparten archivo con la garantía de aforo bajo concurrencia (4.1, con `Promise.allSettled`
 * sobre `crearReserva`) y los choques que tienen que devolver `409` y no `500` con errores
 * reales de la base (4.2): el `P2002` de mesa (con `elegirMesaBestFit` espiado para forzar el
 * choque) y el `P2028`/timeout de la transacción por una espera excesiva en el lock.
 *
 * Aislamiento del resto de las suites de integración/e2e (comparten la misma base, y
 * `jest-integration.json` corre con `maxWorkers: 1`, así que no compiten entre sí en el
 * tiempo, pero sí comparten las filas de `Zona` y `ConfiguracionNegocio`):
 * - Turnos en la banda horaria 09:00–09:59 (el seed usa 12:00 y 20:00;
 *   `reservas-invariantes` usa 01:xx, `disponibilidad-contexto` 05:xx, `disponibilidad`
 *   06:xx y `disponibilidad-lock` 07:xx).
 * - Mesas con etiqueta `CONC-…`.
 * - `Zona` y `ConfiguracionNegocio` son filas compartidas: cada test dueño de un valor
 *   (`aforoMaximo` de una zona, `aforoGlobal`) lo restaura en su propio `finally`/`afterEach`.
 */
describe('ReservasService — concurrencia (integración)', () => {
  let prisma: PrismaService;
  let service: ReservasService;

  let zonaStandardId: string;
  let zonaVipId: string;

  let mesaIds: string[] = [];
  let turnoIds: string[] = [];

  let horaContador = 0;
  function horaDeTestUnica(): Date {
    horaContador += 1;
    return new Date(Date.UTC(1970, 0, 1, 9, horaContador, 0));
  }

  /**
   * Sábado futuro, calculado en vez de fijo a mano: un valor hardcodeado envejece (deja de
   * estar en el futuro respecto del reloj real, que es el que usa `crearReserva` para
   * `evaluarReglas`) y todas las creaciones empezarían a rechazar por `ANTICIPACION_MINIMA`.
   * Se busca desde una semana a partir de mañana, bien lejos de cualquier borde de
   * anticipación (mínima de 24 h en VIP, máxima de 30 días en STANDARD, fijadas en
   * `beforeAll`).
   */
  const SABADO_GET_UTC_DAY = 6;
  function proximoSabado(diasDesdeMañana: number): Date {
    const fecha = new Date();
    fecha.setUTCHours(0, 0, 0, 0);
    fecha.setUTCDate(fecha.getUTCDate() + 1 + diasDesdeMañana);
    while (fecha.getUTCDay() !== SABADO_GET_UTC_DAY) {
      fecha.setUTCDate(fecha.getUTCDate() + 1);
    }
    return fecha;
  }

  /** Sábado futuro: coincide con el `diaSemana` de los turnos que crea el archivo. */
  const FECHA = proximoSabado(7);

  async function crearMesa(
    zonaId: string,
    capacidad: number,
    etiqueta: string,
  ) {
    const mesa = await prisma.mesa.create({
      data: { zonaId, capacidad, etiqueta: `CONC-${etiqueta}` },
    });
    mesaIds.push(mesa.id);
    return mesa;
  }

  async function crearTurno() {
    const turno = await prisma.turno.create({
      data: {
        diaSemana: DiaSemana.SABADO,
        horaInicio: horaDeTestUnica(),
        horaFin: new Date(Date.UTC(1970, 0, 1, 12, 0, 0)),
        activo: true,
      },
    });
    turnoIds.push(turno.id);
    return turno;
  }

  async function limpiarFixtures() {
    try {
      if (turnoIds.length) {
        await prisma.reserva.deleteMany({
          where: { turnoId: { in: turnoIds } },
        });
      }
      if (mesaIds.length) {
        await prisma.mesa.deleteMany({ where: { id: { in: mesaIds } } });
      }
      if (turnoIds.length) {
        await prisma.turno.deleteMany({ where: { id: { in: turnoIds } } });
      }
    } finally {
      mesaIds = [];
      turnoIds = [];
    }
  }

  /**
   * Ocupa las mesas ajenas de una zona/turno/fecha (helper compartido con
   * `reservas-invariantes.integration-spec.ts`, ver `helpers/ocupar-mesas-ajenas.ts`). Este
   * archivo limpia por `turnoId` en `limpiarFixtures`, así que no necesita los ids que
   * devuelve.
   */
  async function ocuparMesasAjenas(
    zonaId: string,
    turnoId: string,
    fecha: Date,
    propias: string[],
  ) {
    await ocuparMesasAjenasCompartido({
      prisma,
      zonaId,
      turnoId,
      fecha,
      propias,
      datosCliente,
    });
  }

  function datosCliente(sufijo: string) {
    return {
      nombreCliente: `Cliente Conc ${sufijo}`,
      emailCliente: `conc.${sufijo}@example.com`,
      telefonoCliente: '+54 9 11 5555-8888',
    };
  }

  function solicitud(
    turnoId: string,
    zonaId: string,
    comensales: number,
    sufijo: string,
  ): CrearReservaInput {
    return {
      turnoId,
      zonaId,
      fecha: FECHA,
      comensales,
      ...datosCliente(sufijo),
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, ReservasModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(ReservasService);
    await prisma.$connect();

    const valoresStandard = {
      minComensales: 1,
      maxComensales: 8,
      anticipacionMinHoras: 2,
      anticipacionMaxDias: 30,
      ventanaCancelacionHoras: 2,
      requiereConfirmacionAdmin: false,
      aforoMaximo: 100,
    };
    const standard = await prisma.zona.upsert({
      where: { nombre: 'STANDARD' },
      update: valoresStandard,
      create: { nombre: 'STANDARD', ...valoresStandard },
    });
    const valoresVip = {
      minComensales: 2,
      maxComensales: 12,
      anticipacionMinHoras: 24,
      anticipacionMaxDias: 60,
      ventanaCancelacionHoras: 24,
      requiereConfirmacionAdmin: true,
      aforoMaximo: 100,
    };
    const vip = await prisma.zona.upsert({
      where: { nombre: 'VIP' },
      update: valoresVip,
      create: { nombre: 'VIP', ...valoresVip },
    });
    zonaStandardId = standard.id;
    zonaVipId = vip.id;

    await prisma.configuracionNegocio.upsert({
      where: { id: 1 },
      update: { aforoGlobal: 1000 },
      create: { id: 1, aforoGlobal: 1000 },
    });
  });

  afterEach(async () => {
    await limpiarFixtures();
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.zona.update({
      where: { nombre: 'STANDARD' },
      data: { aforoMaximo: 40 },
    });
    await prisma.zona.update({
      where: { nombre: 'VIP' },
      data: { aforoMaximo: 20 },
    });
    await prisma.configuracionNegocio.update({
      where: { id: 1 },
      data: { aforoGlobal: 60 },
    });
    await prisma.$disconnect();
  });

  /** Ningún rechazo concurrente puede ser un error distinto de `ConflictException` (4.1). */
  function esperarSoloConflictException(
    resultados: PromiseSettledResult<unknown>[],
  ) {
    for (const resultado of resultados) {
      if (resultado.status === 'rejected') {
        expect(resultado.reason).toBeInstanceOf(ConflictException);
      }
    }
  }

  function motivosDe(resultado: PromiseSettledResult<unknown>): CodigoMotivo[] {
    if (resultado.status !== 'rejected') return [];
    const respuesta = (resultado.reason as ConflictException).getResponse() as {
      motivos?: { codigo: CodigoMotivo; mensaje: string }[];
    };
    return (respuesta.motivos ?? []).map((motivo) => motivo.codigo);
  }

  describe('4.1 — aforo bajo creaciones concurrentes', () => {
    const AFORO_VIP_TEST = 8;
    const COMENSALES = 3;
    const CREACIONES = 4;
    const RONDAS = 10;
    const RESERVAS_ESPERADAS = 2; // floor(8 / 3)
    const COMENSALES_ESPERADOS = RESERVAS_ESPERADAS * COMENSALES;

    it('con aforo VIP en 8, cuatro creaciones simultáneas de 3 comensales dan exactamente 2 resueltas y 2 rechazadas por AFORO_ZONA, con suma activa 6 — repetido 10 veces', async () => {
      try {
        for (let ronda = 1; ronda <= RONDAS; ronda++) {
          await prisma.zona.update({
            where: { id: zonaVipId },
            data: { aforoMaximo: AFORO_VIP_TEST },
          });

          const turno = await crearTurno();
          // Cuatro mesas con lugar de sobra para 3: lo único que puede frenar a dos de las
          // cuatro creaciones es el aforo, no la falta de mesa.
          for (const [indice, capacidad] of [3, 4, 5, 6].entries()) {
            await crearMesa(zonaVipId, capacidad, `AFORO-R${ronda}-M${indice}`);
          }

          const resultados = await Promise.allSettled(
            Array.from({ length: CREACIONES }, (_, i) =>
              service.crearReserva(
                solicitud(
                  turno.id,
                  zonaVipId,
                  COMENSALES,
                  `aforo-r${ronda}-${i}`,
                ),
              ),
            ),
          );

          esperarSoloConflictException(resultados);

          const creadas = resultados.filter((r) => r.status === 'fulfilled');
          const rechazadas = resultados.filter((r) => r.status === 'rejected');

          expect({ ronda, creadas: creadas.length }).toEqual({
            ronda,
            creadas: RESERVAS_ESPERADAS,
          });
          expect({ ronda, rechazadas: rechazadas.length }).toEqual({
            ronda,
            rechazadas: CREACIONES - RESERVAS_ESPERADAS,
          });
          for (const rechazada of rechazadas) {
            expect({ ronda, motivos: motivosDe(rechazada) }).toEqual({
              ronda,
              motivos: [CodigoMotivo.AFORO_ZONA],
            });
          }

          const persistidas = await prisma.reserva.findMany({
            where: {
              turnoId: turno.id,
              fecha: FECHA,
              estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
            },
            select: { comensales: true },
          });
          expect({ ronda, persistidas: persistidas.length }).toEqual({
            ronda,
            persistidas: RESERVAS_ESPERADAS,
          });
          const comensalesActivos = persistidas.reduce(
            (total, r) => total + r.comensales,
            0,
          );
          expect({ ronda, comensalesActivos }).toEqual({
            ronda,
            comensalesActivos: COMENSALES_ESPERADOS,
          });

          await limpiarFixtures();
        }
      } finally {
        // El loop deja `aforoMaximo` de VIP en `AFORO_VIP_TEST` (8): se restaura acá al valor
        // que fija el `beforeAll` de la suite (100), siguiendo la política de aislamiento del
        // encabezado del archivo (cada test dueño de un valor lo restaura en su propio
        // `finally`/`afterEach`), sin depender de que `afterAll` corra para dejarlo consistente
        // para el resto de los tests de este archivo.
        await prisma.zona.update({
          where: { id: zonaVipId },
          data: { aforoMaximo: 100 },
        });
      }
    }, 120_000);

    it('con aforo global en 10, una creación de 6 en STANDARD y otra de 6 en VIP simultáneas dan exactamente 1 resuelta y 1 rechazada por AFORO_GLOBAL', async () => {
      await prisma.configuracionNegocio.update({
        where: { id: 1 },
        data: { aforoGlobal: 10 },
      });

      try {
        const turno = await crearTurno();
        await crearMesa(zonaStandardId, 8, 'GLOBAL-STD');
        await crearMesa(zonaVipId, 8, 'GLOBAL-VIP');

        const [resStandard, resVip] = await Promise.allSettled([
          service.crearReserva(
            solicitud(turno.id, zonaStandardId, 6, 'global-standard'),
          ),
          service.crearReserva(solicitud(turno.id, zonaVipId, 6, 'global-vip')),
        ]);

        esperarSoloConflictException([resStandard, resVip]);

        const resultados = [resStandard, resVip];
        const creadas = resultados.filter((r) => r.status === 'fulfilled');
        const rechazadas = resultados.filter((r) => r.status === 'rejected');

        expect(creadas.length).toBe(1);
        expect(rechazadas.length).toBe(1);
        expect(motivosDe(rechazadas[0])).toEqual([CodigoMotivo.AFORO_GLOBAL]);
      } finally {
        await prisma.configuracionNegocio.update({
          where: { id: 1 },
          data: { aforoGlobal: 1000 },
        });
      }
    });

    it('dos creaciones simultáneas de 7 comensales en STANDARD, con una única mesa que alcanza, dan exactamente 1 resuelta en esa mesa y 1 rechazada por SIN_MESA_DISPONIBLE', async () => {
      const turno = await crearTurno();
      const mesaUnica = await crearMesa(zonaStandardId, 8, 'MESA-UNICA');
      // Sin esto, S5 del seed (capacidad 8) también alcanzaría para 7 comensales y dejaría
      // de ser cierto que mesaUnica es la única mesa que alcanza.
      await ocuparMesasAjenas(zonaStandardId, turno.id, FECHA, mesaIds);

      const resultados = await Promise.allSettled([
        service.crearReserva(
          solicitud(turno.id, zonaStandardId, 7, 'mesa-unica-a'),
        ),
        service.crearReserva(
          solicitud(turno.id, zonaStandardId, 7, 'mesa-unica-b'),
        ),
      ]);

      esperarSoloConflictException(resultados);

      const creadas = resultados.filter((r) => r.status === 'fulfilled');
      const rechazadas = resultados.filter((r) => r.status === 'rejected');

      expect(creadas.length).toBe(1);
      expect(rechazadas.length).toBe(1);
      expect(motivosDe(rechazadas[0])).toEqual([
        CodigoMotivo.SIN_MESA_DISPONIBLE,
      ]);

      const creadaValor = creadas[0].value;
      expect(creadaValor.mesaId).toBe(mesaUnica.id);
    });
  });

  describe('4.2 — choques que devuelven 409 y no 500, con errores reales de la base', () => {
    it('P2002 sobre mesaId: elegirMesaBestFit devuelve una mesa ya ocupada y el índice parcial real rechaza el INSERT con SIN_MESA_DISPONIBLE', async () => {
      const turno = await crearTurno();
      const mesaOcupada = await crearMesa(zonaStandardId, 4, 'P2002-OCUPADA');
      // Mesa libre de sobra para que evaluarReglas NO informe SIN_MESA_DISPONIBLE (si lo
      // hiciera, el service rechazaría por D8 antes de llegar a elegirMesaBestFit, y el
      // choque de escritura que este test ejercita nunca correría).
      await crearMesa(zonaStandardId, 4, 'P2002-LIBRE');

      // Ocupa mesaOcupada a mano, por fuera del service, para el mismo turno y fecha.
      const previa = await prisma.reserva.create({
        data: {
          mesaId: mesaOcupada.id,
          turnoId: turno.id,
          fecha: FECHA,
          comensales: 2,
          estado: 'CONFIRMADA',
          codigoReserva: 'P2002OCP',
          ...datosCliente('p2002-previa'),
        },
      });

      jest.spyOn(elegirMesaBestFitModule, 'elegirMesaBestFit').mockReturnValue({
        id: mesaOcupada.id,
        etiqueta: mesaOcupada.etiqueta,
        capacidad: mesaOcupada.capacidad,
      });

      const intento = service.crearReserva(
        solicitud(turno.id, zonaStandardId, 2, 'p2002-intento'),
      );

      await expect(intento).rejects.toBeInstanceOf(ConflictException);
      await expect(intento).rejects.toMatchObject({
        status: 409,
        response: {
          statusCode: 409,
          error: 'Conflict',
          motivos: [{ codigo: CodigoMotivo.SIN_MESA_DISPONIBLE }],
        },
      });

      // No se creó una segunda reserva sobre esa mesa: sigue existiendo solo la previa.
      const activasEnMesa = await prisma.reserva.count({
        where: {
          mesaId: mesaOcupada.id,
          turnoId: turno.id,
          fecha: FECHA,
          estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
        },
      });
      expect(activasEnMesa).toBe(1);
      expect(previa.id).toBeDefined();
    });

    it('P2028: una transacción auxiliar retiene el lock del mismo (turno, fecha) más que el timeout y la creación responde 409 sin motivos', async () => {
      const turno = await crearTurno();
      await crearMesa(zonaStandardId, 4, 'P2028-MESA');

      // Prisma usa por defecto timeout: 5000ms para la transacción interactiva (design.md
      // D9/Trampas). Se retiene el lock 6500ms, por encima de ese default, para forzar el
      // P2028 sin bajar el timeout de `crearReserva` (que usa el default de Prisma, sin
      // override — D9 no lo cambia salvo que la concurrencia real lo exija).
      const RETENCION_MS = 6500;
      let avisarLockTomado!: () => void;
      const lockTomado = new Promise<void>((resolve) => {
        avisarLockTomado = resolve;
      });
      const bloqueo = prisma.$transaction(
        async (tx) => {
          await bloquearTurnoFecha(tx, turno.id, FECHA);
          avisarLockTomado();
          await new Promise((resolve) => setTimeout(resolve, RETENCION_MS));
        },
        { timeout: RETENCION_MS + 5000, maxWait: 5000 },
      );

      // Se crea recién cuando la transacción auxiliar ya tiene el lock, sin depender de una
      // espera fija que en una base lenta podría no alcanzar. Si la transacción auxiliar falla
      // antes de tomar el lock, `bloqueo` rechaza primero y el test falla con ese error en vez
      // de quedar colgado hasta el timeout de Jest.
      await Promise.race([lockTomado, bloqueo]);

      const intento = service.crearReserva(
        solicitud(turno.id, zonaStandardId, 2, 'p2028-intento'),
      );

      await expect(intento).rejects.toBeInstanceOf(ConflictException);
      await expect(intento).rejects.toMatchObject({
        status: 409,
        response: {
          statusCode: 409,
          error: 'Conflict',
          motivos: [],
        },
      });

      await bloqueo;

      const persistidas = await prisma.reserva.count({
        where: { turnoId: turno.id, fecha: FECHA },
      });
      expect(persistidas).toBe(0);
    }, 20_000);
  });
});
