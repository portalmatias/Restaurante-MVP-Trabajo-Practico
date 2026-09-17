import { Test } from '@nestjs/testing';
import { DiaSemana, Prisma } from '@prisma/client';

import { bloquearTurnoFecha } from '../src/disponibilidad/contexto/bloquear-turno-fecha';
import { cargarContexto } from '../src/disponibilidad/contexto/cargar-contexto';
import { evaluarReglas } from '../src/disponibilidad/reglas/evaluar-reglas';
import {
  CodigoMotivo,
  SolicitudDisponibilidad,
} from '../src/disponibilidad/reglas/tipos';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Tarea 8.1 del change `disponibilidad`: test de integración del lock advisory por
 * `(turno, fecha)` (design.md D6 y D7).
 *
 * `crearReservaConLock` reproduce el flujo que va a usar `reservas-crear`: una transacción
 * interactiva que toma `bloquearTurnoFecha` como PRIMERA sentencia, después lee el contexto
 * con el mismo `tx`, evalúa las reglas puras y, si no hay motivos, inserta la reserva en la
 * mesa libre más chica que alcance. No hay HTTP acá a propósito: los 409 del requisito
 * compartido se prueban por HTTP en `reservas-crear`; lo que se prueba acá es que dos
 * creaciones simultáneas no puedan pasarse del aforo.
 *
 * Por qué el test sirve: en `READ COMMITTED` cada sentencia ve lo confirmado antes de
 * empezar, así que el `aggregate` de `cargarContexto` que corre DESPUÉS de obtener el lock
 * ya incluye la reserva que insertó quien tenía el lock antes (design.md D6). Sin el lock,
 * las cuatro transacciones leen `ocupadosZona = 0` y todas creen tener lugar: se comprobó
 * quitando la llamada a `bloquearTurnoFecha` y el test falla en las 10 rondas. Con la
 * asignación best fit las cuatro eligen la misma mesa y tres de cada cuatro mueren con
 * `P2002` contra el índice único parcial; si además se le da a cada una una mesa distinta,
 * para que ese índice no tape el problema, las cuatro insertan y quedan 12 comensales sobre
 * un aforo de 8. El índice único protege la mesa; el aforo lo protege solo este lock.
 *
 * IMPORTANTE — esta suite necesita `--runInBand` (o `maxWorkers: 1` en jest-e2e.json): las
 * suites e2e comparten la base y `disponibilidad-contexto` asserta sobre estado global
 * (`count(*)` de `pg_locks` con `locktype = 'advisory'`, y `mesasLibres` de una zona sin
 * filtrar por las mesas de otras suites), así que cualquier archivo e2e que tome un lock
 * advisory o cree mesas en paralelo con él lo hace fallar. En serie pasa todo.
 *
 * Aislamiento del resto de las suites (comparten la misma base):
 * - Turnos en la banda horaria 07:00–07:59 (el seed usa 12:00 y 20:00, `reservas-invariantes`
 *   la 01:xx, `disponibilidad-contexto` la 05:xx y `disponibilidad` la 06:xx).
 * - Mesas con etiqueta `LOCK-…` y códigos de reserva `LCK…`.
 * - Las Reservas se borran por `turnoId` de los turnos propios, nunca con un `deleteMany`
 *   sin filtro.
 * - `Zona` y `ConfiguracionNegocio` son filas compartidas (`NombreZona` es un enum de dos
 *   valores, así que no se pueden crear zonas propias): se dejan con los valores del seed
 *   salvo `Zona.VIP.aforoMaximo`, que la tarea fija en 8 y que `afterAll` devuelve a su
 *   valor original aunque el test falle.
 */
describe('lock advisory de (turno, fecha) bajo concurrencia (e2e)', () => {
  let prisma: PrismaService;
  let zonaVipId: string;
  let aforoVipOriginal = 20;

  /** Aforo de la zona VIP durante el test: entran dos reservas de 3 y no una tercera. */
  const AFORO_VIP_TEST = 8;
  const COMENSALES = 3;
  const CREACIONES_CONCURRENTES = 4;
  const RONDAS = 10;
  /** `floor(8 / 3)`: dos reservas de 3 entran (6 ≤ 8) y la tercera no (9 > 8). */
  const RESERVAS_ESPERADAS = 2;
  const COMENSALES_ESPERADOS = RESERVAS_ESPERADAS * COMENSALES;

  function fechaCalendario(anio: number, mes: number, dia: number): Date {
    return new Date(Date.UTC(anio, mes - 1, dia));
  }

  /** Sábado, para que coincida con el `diaSemana` de los turnos que crea el test. */
  const FECHA = fechaCalendario(2026, 9, 19);
  /**
   * Instante inyectado en `evaluarReglas` (es una función pura, no lee el reloj). Está ~10
   * días antes del inicio del turno: pasa la anticipación mínima de VIP (24 h) y la máxima
   * (60 días) sin depender de la fecha real ni de la zona horaria del proceso.
   */
  const AHORA = new Date(Date.UTC(2026, 8, 9, 12, 0, 0));

  let mesaIds: string[] = [];
  let turnoIds: string[] = [];

  let horaContador = 0;
  function horaDeTestUnica(): Date {
    horaContador += 1;
    return new Date(Date.UTC(1970, 0, 1, 7, horaContador, 0));
  }

  let codigoContador = 0;
  function codigoUnico(): string {
    codigoContador += 1;
    return `LCK${String(codigoContador).padStart(5, '0')}`;
  }

  async function crearMesa(capacidad: number, etiqueta: string) {
    const mesa = await prisma.mesa.create({
      data: { zonaId: zonaVipId, capacidad, etiqueta: `LOCK-${etiqueta}` },
    });
    mesaIds.push(mesa.id);
    return mesa;
  }

  async function crearTurno() {
    const turno = await prisma.turno.create({
      data: {
        diaSemana: DiaSemana.SABADO,
        horaInicio: horaDeTestUnica(),
        horaFin: new Date(Date.UTC(1970, 0, 1, 10, 0, 0)),
        activo: true,
      },
    });
    turnoIds.push(turno.id);
    return turno;
  }

  /** Lo que devuelve una creación: distingue el rechazo por reglas del error de base. */
  type ResultadoCreacion =
    | { tipo: 'creada'; reservaId: string; mesaId: string }
    | { tipo: 'rechazada'; motivos: CodigoMotivo[] }
    | { tipo: 'error'; codigo: string; mensaje: string };

  /**
   * Flujo de creación que va a usar `reservas-crear`: transacción → `bloquearTurnoFecha`
   * (primera sentencia; el lock se libera recién en el COMMIT o el ROLLBACK) →
   * `cargarContexto(tx)` → `evaluarReglas` → si no hay motivos, INSERT en la mesa libre más
   * chica que alcance.
   *
   * La transacción usa los timeouts por defecto de Prisma (`maxWait` 2 s, `timeout` 5 s) a
   * propósito: si el lock hiciera esperar de más, la transacción abortaría con `P2028` y el
   * test tiene que verlo, no taparlo con un timeout generoso.
   */
  async function crearReservaConLock(
    solicitud: SolicitudDisponibilidad,
    codigoReserva: string,
  ): Promise<ResultadoCreacion> {
    try {
      return await prisma.$transaction(
        async (tx): Promise<ResultadoCreacion> => {
          await bloquearTurnoFecha(tx, solicitud.turnoId, solicitud.fecha);

          const contexto = await cargarContexto(tx, solicitud);
          const motivos = evaluarReglas(contexto, solicitud, AHORA);
          if (motivos.length > 0) {
            return {
              tipo: 'rechazada',
              motivos: motivos.map((motivo) => motivo.codigo),
            };
          }

          // Best fit: `mesasLibres` ya viene ordenada por capacidad y después etiqueta, y
          // `evaluarReglas` garantiza que alguna alcanza (si no, habría SIN_MESA_DISPONIBLE).
          const mesa = contexto.mesasLibres.find(
            (candidata) => candidata.capacidad >= solicitud.comensales,
          );
          if (!mesa) {
            throw new Error(
              'No hay mesa libre pese a que evaluarReglas no devolvió motivos',
            );
          }

          const reserva = await tx.reserva.create({
            data: {
              mesaId: mesa.id,
              turnoId: solicitud.turnoId,
              fecha: solicitud.fecha,
              comensales: solicitud.comensales,
              nombreCliente: 'Cliente Lock',
              emailCliente: 'lock@example.com',
              telefonoCliente: '+54 9 11 5555-0000',
              codigoReserva,
            },
          });
          return { tipo: 'creada', reservaId: reserva.id, mesaId: mesa.id };
        },
      );
    } catch (error) {
      // Una transacción que aborta se informa como resultado en vez de tumbar el
      // `Promise.all`: el test necesita ver TODOS los resultados para poder distinguir un
      // `P2028` (transacción cerrada) de un `P2002` (choque contra el índice único parcial).
      return {
        tipo: 'error',
        codigo:
          error instanceof Prisma.PrismaClientKnownRequestError
            ? error.code
            : 'SIN_CODIGO',
        mensaje: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /** Borra lo que haya quedado de una corrida anterior interrumpida. */
  async function limpiarResiduos() {
    const turnosResiduales = await prisma.turno.findMany({
      where: {
        horaInicio: {
          gte: new Date(Date.UTC(1970, 0, 1, 7, 0, 0)),
          lt: new Date(Date.UTC(1970, 0, 1, 8, 0, 0)),
        },
      },
      select: { id: true },
    });
    const mesasResiduales = await prisma.mesa.findMany({
      where: { etiqueta: { startsWith: 'LOCK-' } },
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

  /** Borra las reservas de los turnos propios y después las mesas y los turnos propios. */
  async function limpiarFixtures() {
    if (turnoIds.length) {
      await prisma.reserva.deleteMany({ where: { turnoId: { in: turnoIds } } });
    }
    if (mesaIds.length) {
      await prisma.mesa.deleteMany({ where: { id: { in: mesaIds } } });
    }
    if (turnoIds.length) {
      await prisma.turno.deleteMany({ where: { id: { in: turnoIds } } });
    }
    mesaIds = [];
    turnoIds = [];
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    // Valores del seed (backend/prisma/seed.ts) salvo `aforoMaximo`, que la tarea fija en 8.
    const vipPrevia = await prisma.zona.findUnique({
      where: { nombre: 'VIP' },
    });
    aforoVipOriginal = vipPrevia?.aforoMaximo ?? 20;

    const vip = await prisma.zona.upsert({
      where: { nombre: 'VIP' },
      update: {
        minComensales: 2,
        maxComensales: 12,
        anticipacionMinHoras: 24,
        anticipacionMaxDias: 60,
        ventanaCancelacionHoras: 24,
        requiereConfirmacionAdmin: true,
        aforoMaximo: AFORO_VIP_TEST,
      },
      create: {
        nombre: 'VIP',
        minComensales: 2,
        maxComensales: 12,
        anticipacionMinHoras: 24,
        anticipacionMaxDias: 60,
        ventanaCancelacionHoras: 24,
        requiereConfirmacionAdmin: true,
        aforoMaximo: AFORO_VIP_TEST,
      },
    });
    zonaVipId = vip.id;

    await prisma.configuracionNegocio.upsert({
      where: { id: 1 },
      update: { aforoGlobal: 60 },
      create: { id: 1, aforoGlobal: 60 },
    });

    await limpiarResiduos();
  });

  afterEach(async () => {
    await limpiarFixtures();
  });

  afterAll(async () => {
    // Se restaura aunque el test haya fallado: `afterAll` corre igual.
    await prisma.zona.update({
      where: { nombre: 'VIP' },
      data: { aforoMaximo: aforoVipOriginal },
    });
    await prisma.$disconnect();
  });

  it('con aforo VIP en 8, cuatro creaciones simultáneas de 3 comensales persisten exactamente 2 (6 comensales) y ninguna aborta con P2028', async () => {
    const erroresDeTodasLasRondas: { codigo: string; mensaje: string }[] = [];

    for (let ronda = 1; ronda <= RONDAS; ronda++) {
      // Otra suite e2e pudo haber reescrito la zona compartida entre rondas: se vuelve a
      // fijar el aforo para que la ronda mida lo que dice medir.
      await prisma.zona.update({
        where: { nombre: 'VIP' },
        data: { aforoMaximo: AFORO_VIP_TEST },
      });

      const turno = await crearTurno();
      // Cuatro mesas y todas con lugar para 3: así lo único que puede frenar a la tercera
      // y la cuarta creación es el aforo, no la falta de mesa.
      for (const [indice, capacidad] of [3, 4, 5, 6].entries()) {
        await crearMesa(capacidad, `R${ronda}-M${indice}`);
      }

      const solicitud: SolicitudDisponibilidad = {
        fecha: FECHA,
        turnoId: turno.id,
        zonaId: zonaVipId,
        comensales: COMENSALES,
      };

      const resultados = await Promise.all(
        Array.from({ length: CREACIONES_CONCURRENTES }, () =>
          crearReservaConLock(solicitud, codigoUnico()),
        ),
      );

      const creadas = resultados.filter(
        (resultado) => resultado.tipo === 'creada',
      );
      const rechazadas = resultados.filter(
        (resultado) => resultado.tipo === 'rechazada',
      );
      const errores = resultados.filter(
        (resultado) => resultado.tipo === 'error',
      );
      erroresDeTodasLasRondas.push(
        ...errores.map(({ codigo, mensaje }) => ({ codigo, mensaje })),
      );

      // Ninguna transacción tiene que abortar: el lock hace esperar, no fallar.
      expect({ ronda, errores }).toEqual({ ronda, errores: [] });
      expect({ ronda, creadas: creadas.length }).toEqual({
        ronda,
        creadas: RESERVAS_ESPERADAS,
      });
      // Las que sobran se rechazan por aforo de zona, no por falta de mesa.
      expect({ ronda, rechazadas: rechazadas.length }).toEqual({
        ronda,
        rechazadas: CREACIONES_CONCURRENTES - RESERVAS_ESPERADAS,
      });
      for (const rechazada of rechazadas) {
        expect({ ronda, motivos: rechazada.motivos }).toEqual({
          ronda,
          motivos: [CodigoMotivo.AFORO_ZONA],
        });
      }

      // Lo que importa no es lo que devolvió el helper sino lo que quedó en la base.
      const persistidas = await prisma.reserva.findMany({
        where: {
          turnoId: turno.id,
          fecha: FECHA,
          estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
        },
        select: { id: true, mesaId: true, comensales: true },
      });

      expect({ ronda, persistidas: persistidas.length }).toEqual({
        ronda,
        persistidas: RESERVAS_ESPERADAS,
      });
      const comensalesActivos = persistidas.reduce(
        (total, reserva) => total + reserva.comensales,
        0,
      );
      expect({ ronda, comensalesActivos }).toEqual({
        ronda,
        comensalesActivos: COMENSALES_ESPERADOS,
      });
      // Y cada una en su propia mesa (índice único parcial de `modelo-dominio`).
      const mesasUsadas = new Set(persistidas.map((reserva) => reserva.mesaId));
      expect({ ronda, mesasUsadas: mesasUsadas.size }).toEqual({
        ronda,
        mesasUsadas: RESERVAS_ESPERADAS,
      });

      await limpiarFixtures();
    }

    // Redundante con el assert por ronda, pero deja explícito lo que pide la tarea 8.1.
    expect(
      erroresDeTodasLasRondas.filter((error) => error.codigo === 'P2028'),
    ).toEqual([]);
  }, 120_000);
});
