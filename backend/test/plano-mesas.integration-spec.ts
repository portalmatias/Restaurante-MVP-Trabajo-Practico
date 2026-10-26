import { execFileSync } from 'node:child_process';

import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DiaSemana, EstadoReserva } from '@prisma/client';

import { seedCatalogo } from '../prisma/catalogo';
import { seedPlano } from '../prisma/plano-desarrollo';
import { fechaCalendarioAIso } from '../src/common/timezone';
import { DisponibilidadModule } from '../src/disponibilidad/disponibilidad.module';
import { DisponibilidadService } from '../src/disponibilidad/disponibilidad.service';
import { CodigoMotivo } from '../src/disponibilidad/reglas/tipos';
import { EstadoMesaPlano } from '../src/plano-mesas/estado-mesa';
import { PlanoMesasModule } from '../src/plano-mesas/plano-mesas.module';
import { PlanoMesasService } from '../src/plano-mesas/plano-mesas.service';
import { RELOJ } from '../src/plano-mesas/reloj';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ReservasModule } from '../src/reservas/reservas.module';
import { ReservasService } from '../src/reservas/reservas.service';
import { diaDe, hoyLocal, sumarDias } from './support/fechas-e2e';

/**
 * Tareas 3.3 y 3.4 de `plano-mesas`: `PlanoMesasService.consultar` contra PostgreSQL real, con
 * los escenarios de la spec `plano-mesas`.
 *
 * Usa un schema de Postgres propio (mismo patrón que `seed-produccion.integration-spec.ts`):
 * los escenarios afirman la lista exacta de mesas de cada zona, y la base de test compartida
 * tiene mesas y reservas que dejan otras suites. Antes de cada caso se borran las reservas y
 * las mesas que no son del seed.
 *
 * Fechas (design.md D8): las literales de la spec se traducen a fechas relativas a hoy (el
 * próximo sábado y el próximo lunes a 3 días o más), y el reloj del plano se fija al instante
 * en que arranca la suite. Así el veredicto se puede comparar con el de
 * `DisponibilidadService`, que usa el reloj real.
 */
const SCHEMA = 'plano_mesas_servicio_test';

function urlDelSchema(): string {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error('Falta DATABASE_URL para los tests de integración');
  }
  const url = new URL(base);
  url.searchParams.set('schema', SCHEMA);
  return url.toString();
}

/** Primera fecha que cae en `dia` a `minimoDias` días o más de hoy. */
function proximo(dia: DiaSemana, minimoDias: number): Date {
  let candidata = sumarDias(hoyLocal(), minimoDias);
  while (diaDe(candidata) !== dia) {
    candidata = sumarDias(candidata, 1);
  }
  return candidata;
}

const ETIQUETAS_SEED = ['S1', 'S2', 'S3', 'S4', 'S5', 'V1', 'V2', 'V3', 'V4'];
const CLAVES_RESPUESTA = [
  'columnas',
  'disponible',
  'filas',
  'lugaresRestantes',
  'mesas',
  'motivos',
  'zona',
];
const CLAVES_MESA = [
  'alto',
  'ancho',
  'capacidad',
  'estado',
  'etiqueta',
  'forma',
  'posX',
  'posY',
];

describe('PlanoMesasService (integración)', () => {
  const urlCompartida = process.env.DATABASE_URL;
  const AHORA = new Date();
  const SABADO = proximo(DiaSemana.SABADO, 3);
  const LUNES = proximo(DiaSemana.LUNES, 3);

  let prisma: PrismaService;
  let plano: PlanoMesasService;
  let disponibilidad: DisponibilidadService;
  let reservas: ReservasService;
  let zonas: { STANDARD: string; VIP: string };
  let turnos: Record<string, { id: string }>;
  let mesas: Record<string, { id: string }>;
  let contadorReservas = 0;

  beforeAll(async () => {
    const baseCompartida = new PrismaService();
    await baseCompartida.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`,
    );
    await baseCompartida.$disconnect();
    execFileSync(
      process.execPath,
      [
        require.resolve('prisma/build/index.js'),
        'migrate',
        'deploy',
        '--schema',
        'prisma/schema.prisma',
      ],
      { env: { ...process.env, DATABASE_URL: urlDelSchema() }, stdio: 'pipe' },
    );

    // `PrismaService` lee `DATABASE_URL` al construirse: se apunta al schema propio solo
    // mientras se compila el módulo.
    process.env.DATABASE_URL = urlDelSchema();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['../.env', '.env'],
        }),
        PrismaModule,
        DisponibilidadModule,
        PlanoMesasModule,
        ReservasModule,
      ],
    })
      .overrideProvider(RELOJ)
      .useValue(() => AHORA)
      .compile();
    process.env.DATABASE_URL = urlCompartida;

    prisma = moduleRef.get(PrismaService);
    plano = moduleRef.get(PlanoMesasService);
    disponibilidad = moduleRef.get(DisponibilidadService);
    reservas = moduleRef.get(ReservasService);
    await prisma.$connect();

    const silencio = () => undefined;
    const catalogo = await seedCatalogo(prisma, silencio);
    await seedPlano(prisma, silencio);
    turnos = catalogo.turnos;
    mesas = catalogo.mesas;
    const filas = await prisma.zona.findMany({
      select: { id: true, nombre: true },
    });
    zonas = Object.fromEntries(
      filas.map((z) => [z.nombre, z.id]),
    ) as typeof zonas;
  }, 120_000);

  beforeEach(async () => {
    await prisma.reserva.deleteMany();
    await prisma.mesa.deleteMany({
      where: { etiqueta: { notIn: ETIQUETAS_SEED } },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    const baseCompartida = new PrismaService();
    await baseCompartida.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`,
    );
    await baseCompartida.$disconnect();
  });

  function consulta(
    zona: 'STANDARD' | 'VIP',
    comensales: number,
    opciones: { fecha?: Date; turno?: 'CENA' | 'ALMUERZO' } = {},
  ) {
    const fecha = opciones.fecha ?? SABADO;
    return {
      fecha: fechaCalendarioAIso(fecha),
      turnoId: turnos[`${diaDe(fecha)}_${opciones.turno ?? 'CENA'}`].id,
      zonaId: zonas[zona],
      comensales,
    };
  }

  async function reservar(
    etiqueta: string,
    estado: EstadoReserva,
    comensales: number,
    opciones: {
      fecha?: Date;
      turno?: 'CENA' | 'ALMUERZO';
      datos?: Partial<{
        nombreCliente: string;
        emailCliente: string;
        telefonoCliente: string;
        codigoReserva: string;
      }>;
    } = {},
  ) {
    contadorReservas += 1;
    const fecha = opciones.fecha ?? SABADO;
    return prisma.reserva.create({
      data: {
        mesaId: mesas[etiqueta].id,
        turnoId: turnos[`${diaDe(fecha)}_${opciones.turno ?? 'CENA'}`].id,
        fecha,
        comensales,
        estado,
        nombreCliente: 'Cliente de prueba',
        emailCliente: 'cliente@ejemplo.com',
        telefonoCliente: '+54 11 5555-0000',
        codigoReserva: `PLN${String(contadorReservas).padStart(5, '0')}`,
        ...opciones.datos,
      },
    });
  }

  function estados(respuesta: {
    mesas: { etiqueta: string; estado: string }[];
  }) {
    return Object.fromEntries(
      respuesta.mesas.map((m) => [m.etiqueta, m.estado]),
    );
  }

  describe('forma de la respuesta', () => {
    it('plano de STANDARD sin reservas: grilla, veredicto y las cinco mesas en orden', async () => {
      const respuesta = await plano.consultar(consulta('STANDARD', 4));

      expect(respuesta).toMatchObject({
        zona: 'STANDARD',
        columnas: 12,
        filas: 8,
        disponible: true,
        motivos: [],
      });
      expect(respuesta.mesas.map((m) => m.etiqueta)).toEqual([
        'S1',
        'S2',
        'S3',
        'S4',
        'S5',
      ]);
      expect(respuesta.mesas[2]).toEqual({
        etiqueta: 'S3',
        capacidad: 4,
        forma: 'CUADRADA',
        posX: 5,
        posY: 0,
        ancho: 2,
        alto: 2,
        estado: 'LIBRE',
      });
    });

    it('ordena las etiquetas en orden natural e incluye una mesa sin ubicar (S10)', async () => {
      await prisma.mesa.create({
        data: { etiqueta: 'S10', capacidad: 4, zonaId: zonas.STANDARD },
      });

      const respuesta = await plano.consultar(consulta('STANDARD', 2));

      expect(respuesta.mesas.map((m) => m.etiqueta)).toEqual([
        'S1',
        'S2',
        'S3',
        'S4',
        'S5',
        'S10',
      ]);
      expect(respuesta.mesas[5]).toMatchObject({
        posX: null,
        posY: null,
        estado: 'LIBRE',
      });
    });

    it('sin lugar responde igual, con los motivos y todas las mesas (lunes inactivo)', async () => {
      const respuesta = await plano.consultar(
        consulta('STANDARD', 2, { fecha: LUNES, turno: 'ALMUERZO' }),
      );

      expect(respuesta.disponible).toBe(false);
      expect(respuesta.motivos.map((m) => m.codigo)).toContain(
        CodigoMotivo.TURNO_INACTIVO,
      );
      expect(respuesta.mesas).toHaveLength(5);
    });

    it('una zona inexistente es un 404', async () => {
      await expect(
        plano.consultar({
          ...consulta('STANDARD', 2),
          zonaId: 'b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('consultar no modifica datos', async () => {
      await reservar('S5', 'CONFIRMADA', 3);
      const antes = [await prisma.reserva.count(), await prisma.mesa.count()];

      for (let i = 0; i < 5; i++) {
        await plano.consultar(consulta('STANDARD', 4));
      }

      expect([await prisma.reserva.count(), await prisma.mesa.count()]).toEqual(
        antes,
      );
    });
  });

  describe('estado de cada mesa', () => {
    it('una reserva CONFIRMADA ocupa la mesa', async () => {
      await reservar('S5', 'CONFIRMADA', 3);

      expect(estados(await plano.consultar(consulta('STANDARD', 2)))).toEqual({
        S1: 'LIBRE',
        S2: 'LIBRE',
        S3: 'LIBRE',
        S4: 'LIBRE',
        S5: 'OCUPADA',
      });
    });

    it('una reserva PENDIENTE ocupa la mesa', async () => {
      await reservar('V3', 'PENDIENTE', 4);

      expect(estados(await plano.consultar(consulta('VIP', 2))).V3).toBe(
        'OCUPADA',
      );
    });

    it('las mesas chicas no alcanzan para 5 comensales', async () => {
      expect(estados(await plano.consultar(consulta('STANDARD', 5)))).toEqual({
        S1: 'NO_ALCANZA',
        S2: 'NO_ALCANZA',
        S3: 'NO_ALCANZA',
        S4: 'LIBRE',
        S5: 'LIBRE',
      });
    });

    it('la capacidad exacta está LIBRE', async () => {
      expect(estados(await plano.consultar(consulta('STANDARD', 4))).S3).toBe(
        'LIBRE',
      );
    });

    it('OCUPADA tiene precedencia sobre NO_ALCANZA', async () => {
      await reservar('S1', 'CONFIRMADA', 2);

      expect(estados(await plano.consultar(consulta('STANDARD', 4))).S1).toBe(
        'OCUPADA',
      );
    });

    it('las reservas CANCELADA y NO_SHOW no ocupan la mesa', async () => {
      await reservar('V4', 'CANCELADA', 8);
      await reservar('V3', 'NO_SHOW', 4);

      const plan = estados(await plano.consultar(consulta('VIP', 2)));
      expect([plan.V3, plan.V4]).toEqual(['LIBRE', 'LIBRE']);
    });

    it('las reservas de otra fecha, turno o zona no ocupan la mesa', async () => {
      await reservar('S5', 'CONFIRMADA', 3, { turno: 'ALMUERZO' });
      await reservar('S4', 'CONFIRMADA', 3, { fecha: sumarDias(SABADO, 7) });
      await reservar('V4', 'CONFIRMADA', 3);

      const respuesta = await plano.consultar(consulta('STANDARD', 2));
      expect(estados(respuesta).S5).toBe('LIBRE');
      expect(estados(respuesta).S4).toBe('LIBRE');
      expect(respuesta.mesas.some((m) => m.etiqueta.startsWith('V'))).toBe(
        false,
      );
    });
  });

  describe('el plano no contradice la reserva real', () => {
    it('sin mesa libre que alcance coincide con SIN_MESA_DISPONIBLE', async () => {
      await reservar('S5', 'CONFIRMADA', 3);

      const respuesta = await plano.consultar(consulta('STANDARD', 7));

      expect(
        respuesta.mesas.filter((m) => m.estado === EstadoMesaPlano.LIBRE),
      ).toEqual([]);
      expect(estados(respuesta).S5).toBe('OCUPADA');
      expect(respuesta.motivos.map((m) => m.codigo)).toEqual([
        CodigoMotivo.SIN_MESA_DISPONIBLE,
      ]);
    });

    it('una mesa puede estar LIBRE aunque el aforo de la zona impida reservar', async () => {
      await reservar('V4', 'CONFIRMADA', 12);
      await reservar('V3', 'PENDIENTE', 6);

      const respuesta = await plano.consultar(consulta('VIP', 4));

      expect(estados(respuesta).V2).toBe('LIBRE');
      expect(respuesta.disponible).toBe(false);
      expect(respuesta.motivos.map((m) => m.codigo)).toEqual([
        CodigoMotivo.AFORO_ZONA,
      ]);
    });

    it('el veredicto es igual al de la consulta de disponibilidad', async () => {
      await reservar('S5', 'CONFIRMADA', 3);
      await reservar('V4', 'CONFIRMADA', 12);

      const combinaciones = [
        consulta('STANDARD', 2),
        consulta('STANDARD', 7),
        consulta('VIP', 4),
        consulta('VIP', 13),
        consulta('STANDARD', 2, { fecha: LUNES, turno: 'ALMUERZO' }),
      ];
      for (const combinacion of combinaciones) {
        const { disponible, lugaresRestantes, motivos } =
          await plano.consultar(combinacion);
        expect({ disponible, lugaresRestantes, motivos }).toEqual(
          await disponibilidad.consultar(combinacion),
        );
      }
    });

    it('existe una mesa LIBRE si y solo si no aparece SIN_MESA_DISPONIBLE', async () => {
      // Ocupación mixta: en STANDARD quedan S1, S2 y S4; en VIP, V1 y V2.
      await reservar('S3', 'CONFIRMADA', 3);
      await reservar('S5', 'PENDIENTE', 8);
      await reservar('V3', 'CONFIRMADA', 5);
      await reservar('V4', 'CANCELADA', 10);
      await reservar('V4', 'PENDIENTE', 2);

      for (const zona of ['STANDARD', 'VIP'] as const) {
        for (let comensales = 1; comensales <= 13; comensales++) {
          const respuesta = await plano.consultar(consulta(zona, comensales));
          const hayLibre = respuesta.mesas.some(
            (m) => m.estado === EstadoMesaPlano.LIBRE,
          );
          const sinMesa = respuesta.motivos.some(
            (m) => m.codigo === CodigoMotivo.SIN_MESA_DISPONIBLE,
          );
          expect({ zona, comensales, hayLibre }).toEqual({
            zona,
            comensales,
            hayLibre: !sinMesa,
          });
        }
      }
    });
  });

  describe('consistencia con la creación de reservas', () => {
    /** Lo mismo que pide `POST /reservas`, con los datos de `consulta`. */
    function crearComo(
      zona: 'STANDARD' | 'VIP',
      comensales: number,
      sufijo: string,
    ) {
      return reservas.crearReserva({
        turnoId: turnos[`${diaDe(SABADO)}_CENA`].id,
        zonaId: zonas[zona],
        fecha: SABADO,
        comensales,
        nombreCliente: `Cliente ${sufijo}`,
        emailCliente: `cliente-${sufijo}@ejemplo.com`,
        telefonoCliente: '+54 11 5555-0000',
      });
    }

    async function etiquetaDe(mesaId: string) {
      const mesa = await prisma.mesa.findUniqueOrThrow({
        where: { id: mesaId },
      });
      return mesa.etiqueta;
    }

    it('la mesa que asigna la reserva figuraba LIBRE y después figura OCUPADA', async () => {
      const antes = estados(await plano.consultar(consulta('STANDARD', 3)));

      const reserva = await crearComo('STANDARD', 3, 'consistencia');
      const asignada = await etiquetaDe(reserva.mesaId);

      expect(antes[asignada]).toBe('LIBRE');
      const despues = estados(await plano.consultar(consulta('STANDARD', 3)));
      expect(despues[asignada]).toBe('OCUPADA');
    });

    it('dos reservas concurrentes sobre la última mesa: una gana y el plano la muestra OCUPADA', async () => {
      // Para 7 comensales solo alcanza S5 (8); el resto de STANDARD tiene 6 o menos.
      expect(
        (await plano.consultar(consulta('STANDARD', 7))).mesas
          .filter((m) => m.estado === EstadoMesaPlano.LIBRE)
          .map((m) => m.etiqueta),
      ).toEqual(['S5']);

      const resultados = await Promise.allSettled([
        crearComo('STANDARD', 7, 'concurrente-a'),
        crearComo('STANDARD', 7, 'concurrente-b'),
      ]);

      const creadas = resultados.filter((r) => r.status === 'fulfilled');
      const rechazadas = resultados.filter((r) => r.status === 'rejected');
      expect(creadas).toHaveLength(1);
      expect(rechazadas).toHaveLength(1);
      expect(rechazadas[0].reason).toBeInstanceOf(ConflictException);
      expect(estados(await plano.consultar(consulta('STANDARD', 7))).S5).toBe(
        'OCUPADA',
      );
    });
  });

  describe('no expone datos de reservas ni de terceros', () => {
    it('el cuerpo no contiene datos personales ni ids, y cada mesa trae solo ocho propiedades', async () => {
      const reserva = await reservar('S4', 'CONFIRMADA', 5, {
        datos: {
          nombreCliente: 'Raúl Benítez',
          emailCliente: 'raul@ejemplo.com',
          telefonoCliente: '+54 11 5555-1234',
          codigoReserva: 'RAUL2345',
        },
      });

      const respuesta = await plano.consultar(consulta('STANDARD', 2));
      const cuerpo = JSON.stringify(respuesta);

      for (const texto of [
        'Raúl Benítez',
        'raul@ejemplo.com',
        '+54 11 5555-1234',
        'RAUL2345',
        reserva.id,
        ...Object.values(mesas).map((m) => m.id),
      ]) {
        expect(cuerpo).not.toContain(texto);
      }
      expect(Object.keys(respuesta).sort()).toEqual(CLAVES_RESPUESTA);
      for (const mesa of respuesta.mesas) {
        expect(Object.keys(mesa).sort()).toEqual(CLAVES_MESA);
      }
    });

    it('una mesa ocupada por una PENDIENTE y otra por una CONFIRMADA se ven igual', async () => {
      await reservar('V3', 'PENDIENTE', 4);
      await reservar('V4', 'CONFIRMADA', 4);

      const respuesta = await plano.consultar(consulta('VIP', 2));
      const [v3, v4] = ['V3', 'V4'].map((etiqueta) =>
        respuesta.mesas.find((m) => m.etiqueta === etiqueta),
      );
      expect(v3?.estado).toBe('OCUPADA');
      expect(v4?.estado).toBe('OCUPADA');
      expect(Object.keys(v3 ?? {})).toEqual(Object.keys(v4 ?? {}));
    });
  });
});
