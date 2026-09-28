import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DiaSemana, EstadoReserva, PrismaClient } from '@prisma/client';

import { MesasModule } from '../src/mesas/mesas.module';
import { MesasService } from '../src/mesas/mesas.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { upsertSeguro } from './helpers/upsert-seguro';

/** Resultado de una operación capturado sin dejar rechazos de promesas sin manejar. */
type ResultadoOperacion<T> =
  { estado: 'cumplida'; valor: T } | { estado: 'rechazada'; error: unknown };

function capturarResultado<T>(
  promesa: Promise<T>,
): Promise<ResultadoOperacion<T>> {
  return promesa.then(
    (valor) => ({ estado: 'cumplida' as const, valor }),
    (error: unknown) => ({ estado: 'rechazada' as const, error }),
  );
}

/**
 * Intercepta `prisma.mesa.delete` sin reemplazar Postgres: el mock solo demora la llamada
 * hasta que se libera `permitirDelete`, y después delega en el método original (capturado
 * antes de espiar). No fabrica resultados ni errores — design.md, "Prueba determinística de
 * la carrera entre consulta y DELETE".
 */
function interceptarDelete(prisma: PrismaService) {
  let notificarDeleteAlcanzado!: () => void;
  const deleteAlcanzado = new Promise<void>((resolve) => {
    notificarDeleteAlcanzado = resolve;
  });
  let liberarDelete!: () => void;
  const permitirDelete = new Promise<void>((resolve) => {
    liberarDelete = resolve;
  });

  // `prisma.mesa.delete` devuelve un `Prisma__MesaClient` "fluent" (soporta
  // `.include()` encadenado), no una `Promise` llana — el service solo hace `await` de
  // él, así que un mock que devuelve una `Promise` común es funcionalmente equivalente;
  // se castea para no pelear con ese tipo extendido que nada acá necesita.
  // `.bind()` sobre un método sobrecargado colapsa a `any` en TS — se castea de vuelta
  // al tipo real en vez de dejar pasar ese `any` implícito.
  const deleteOriginal = prisma.mesa.delete.bind(
    prisma.mesa,
  ) as typeof prisma.mesa.delete;
  const spy = jest.spyOn(prisma.mesa, 'delete').mockImplementation(((
    ...args: Parameters<typeof prisma.mesa.delete>
  ) => {
    return (async () => {
      notificarDeleteAlcanzado();
      await permitirDelete;
      return deleteOriginal(...args);
    })();
  }) as unknown as typeof prisma.mesa.delete);

  return { deleteAlcanzado, liberarDelete, spy };
}

type ResultadoDeEspera<T> =
  | { tipo: 'delete-alcanzado' }
  | { tipo: 'operacion-anticipada'; resultado: ResultadoOperacion<T> }
  | { tipo: 'timeout' };

/**
 * Corre la carrera real: `Promise.race` entre alcanzar el DELETE interceptado, que la
 * operación termine antes de llegar ahí (éxito o error), y un plazo explícito. El timer se
 * cancela siempre al concluir — nunca queda pendiente esperando el timeout externo de Jest.
 */
async function esperarBarreraODeteccionTemprana<T>(
  deleteAlcanzado: Promise<void>,
  operacion: Promise<ResultadoOperacion<T>>,
  plazoMs: number,
): Promise<ResultadoDeEspera<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const plazo = new Promise<ResultadoDeEspera<T>>((resolve) => {
    timer = setTimeout(() => resolve({ tipo: 'timeout' }), plazoMs);
  });
  try {
    return await Promise.race([
      deleteAlcanzado.then((): ResultadoDeEspera<T> => ({
        tipo: 'delete-alcanzado',
      })),
      operacion.then((resultado): ResultadoDeEspera<T> => ({
        tipo: 'operacion-anticipada',
        resultado,
      })),
      plazo,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['../.env', '.env'],
        }),
        PrismaModule,
        MesasModule,
      ],
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

  /**
   * tasks.md 5.6.1 — antes deliberadamente sin escribir por necesitar Postgres real para
   * iterar (ver la nota que queda en `openspec/changes/gestion-salon/tasks.md`).
   */
  describe('eliminar — carrera entre la consulta y el DELETE (tasks.md 5.6.1)', () => {
    const PLAZO_BARRERA_MS = 5000;
    const PLAZO_LIMPIEZA_MS = 5000;

    it(
      'una Reserva insertada por otro cliente justo antes del DELETE hace que la FK ' +
        'rechace la baja con 409, preservando la Mesa y la Reserva',
      async () => {
        const mesa = await crearMesa('INT-CARRERA-1');
        const turno = await crearTurno();

        const { deleteAlcanzado, liberarDelete, spy } =
          interceptarDelete(prisma);
        const operacion = capturarResultado(service.eliminar(mesa.id));

        let segundoCliente: PrismaClient | undefined;
        try {
          const espera = await esperarBarreraODeteccionTemprana(
            deleteAlcanzado,
            operacion,
            PLAZO_BARRERA_MS,
          );

          if (espera.tipo === 'timeout') {
            throw new Error(
              `Se agotó el plazo de ${PLAZO_BARRERA_MS}ms esperando a que el DELETE ` +
                'fuera interceptado.',
            );
          }
          if (espera.tipo === 'operacion-anticipada') {
            throw new Error(
              'La operación terminó antes de alcanzar el DELETE (estado: ' +
                `${espera.resultado.estado}); no se pudo ejercitar la carrera.`,
            );
          }

          // espera.tipo === 'delete-alcanzado': el service ya confirmó que no había
          // Reservas, pero el DELETE todavía no llegó a Postgres. Insertamos una Reserva
          // real con un segundo cliente, conectado aparte y fuera de cualquier
          // transacción de la operación en curso — límites de conexión/consulta propios
          // (menores al plazo de esta prueba) para no quedar colgado si algo sale mal.
          const url = new URL(process.env.DATABASE_URL!);
          url.searchParams.set('connection_limit', '2');
          url.searchParams.set('statement_timeout', '5000');
          url.searchParams.set('connect_timeout', '5');
          segundoCliente = new PrismaClient({
            datasources: { db: { url: url.toString() } },
          });
          await segundoCliente.$connect();

          const reserva = await segundoCliente.reserva.create({
            data: {
              mesaId: mesa.id,
              turnoId: turno.id,
              fecha: new Date(Date.UTC(2030, 0, 1)),
              comensales: 2,
              estado: EstadoReserva.PENDIENTE,
              nombreCliente: 'Cliente de la carrera',
              emailCliente: `carrera-${Date.now()}@example.com`,
              telefonoCliente: '+5490000000',
              codigoReserva: Math.random()
                .toString(36)
                .slice(2, 10)
                .toUpperCase(),
            },
          });
          reservaIds.push(reserva.id);

          liberarDelete();

          const resultado = await operacion;
          expect(resultado.estado).toBe('rechazada');
          if (resultado.estado === 'rechazada') {
            expect(resultado.error).toBeInstanceOf(ConflictException);
          }

          const mesaIntacta = await prisma.mesa.findUnique({
            where: { id: mesa.id },
          });
          const reservaIntacta = await prisma.reserva.findUnique({
            where: { id: reserva.id },
          });
          expect(mesaIntacta).not.toBeNull();
          expect(reservaIntacta).not.toBeNull();
          expect(reservaIntacta?.mesaId).toBe(mesa.id);
        } finally {
          try {
            // Liberar siempre, aunque ya se haya liberado (idempotente): si algo de
            // arriba falló antes de llegar a `liberarDelete()`, el DELETE interceptado
            // seguiría esperando para siempre sin esto.
            liberarDelete();
            let timerLimpieza: ReturnType<typeof setTimeout> | undefined;
            const plazoLimpieza = new Promise<'timeout'>((resolve) => {
              timerLimpieza = setTimeout(
                () => resolve('timeout'),
                PLAZO_LIMPIEZA_MS,
              );
            });
            try {
              const remate = await Promise.race([operacion, plazoLimpieza]);
              if (remate === 'timeout') {
                console.error(
                  'La operación de eliminar no terminó dentro del plazo de ' +
                    'limpieza; puede seguir corriendo en segundo plano.',
                );
              }
            } finally {
              if (timerLimpieza) clearTimeout(timerLimpieza);
            }
          } finally {
            try {
              spy.mockRestore();
            } finally {
              if (segundoCliente) {
                await segundoCliente.$disconnect();
              }
            }
          }
        }
      },
    );

    it(
      'con una Mesa inexistente, el mecanismo de la prueba detecta que la operación ' +
        'termina antes del DELETE (NotFoundException) sin esperar el plazo completo',
      async () => {
        const { deleteAlcanzado, spy } = interceptarDelete(prisma);
        const operacion = capturarResultado(
          service.eliminar('00000000-0000-0000-0000-000000000000'),
        );

        try {
          const espera = await esperarBarreraODeteccionTemprana(
            deleteAlcanzado,
            operacion,
            PLAZO_BARRERA_MS,
          );

          // `espera.tipo` ya prueba que la detección temprana ganó la carrera contra el
          // plazo completo (`Promise.race` no elige 'timeout' si 'operacion-anticipada'
          // resolvió antes) — no hace falta además medir el reloj de pared, que en un
          // runner de CI lento podría dar un test flaky sin aportar nada que el propio
          // resultado de la carrera no garantice.
          expect(espera.tipo).toBe('operacion-anticipada');
          if (espera.tipo === 'operacion-anticipada') {
            expect(espera.resultado.estado).toBe('rechazada');
            if (espera.resultado.estado === 'rechazada') {
              expect(espera.resultado.error).toBeInstanceOf(NotFoundException);
            }
          }
        } finally {
          spy.mockRestore();
        }
      },
    );
  });
});
