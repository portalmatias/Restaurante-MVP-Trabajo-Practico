import { randomInt } from 'node:crypto';

import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DiaSemana, EstadoReserva } from '@prisma/client';

import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RESERVA_NO_ENCONTRADA_MENSAJE } from '../src/reservas/reserva-no-encontrada';
import { ReservasModule } from '../src/reservas/reservas.module';
import { ReservasService } from '../src/reservas/reservas.service';

/**
 * Tests de integración de la búsqueda por código + email y de la consulta pública
 * (capability `reserva-consultar`, design.md D2 y D3). Corren contra la base de TEST real:
 * lo que hay que comprobar es cómo Prisma traduce `mode: 'insensitive'` a SQL, y eso no se
 * puede probar con un mock (ver el escenario "Caracteres de patrón en el email no
 * funcionan como comodín").
 *
 * Cada suite crea sus propias Mesas y su propio Turno con identificadores que no colisionan
 * con el seed ni con las otras suites (que corren en paralelo contra la misma base), y los
 * borra en `afterAll`. La Zona STANDARD es la del seed y solo se lee.
 */
describe('ReservasService — búsqueda y consulta por código y email (integración)', () => {
  let prisma: PrismaService;
  let service: ReservasService;

  const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  // Sufijo por corrida: los emails no son únicos en el schema, pero así ninguna otra suite
  // puede compartir un email con estas Reservas.
  const sufijo = randomInt(0, 0xffffff).toString(16).padStart(6, '0');
  // El prefijo `ZQ` deja el código fuera del alcance de las otras suites y del seed.
  const codigoNuevo = () =>
    'ZQ' +
    Array.from({ length: 6 }, () => ALFABETO[randomInt(ALFABETO.length)]).join(
      '',
    );
  // '00000000' nunca lo genera `generarCodigoReserva` (el alfabeto no tiene 0) ni lo usa el
  // seed, así que garantiza un código con formato válido que no corresponde a ninguna Reserva.
  const CODIGO_INEXISTENTE = '00000000';

  const FECHA = new Date(Date.UTC(2026, 8, 19));
  // Turno propio: LUNES (el seed abre de martes a domingo) a una hora con minutos y segundos
  // al azar, para no chocar con `@@unique([diaSemana, horaInicio])` de otras suites.
  const minutoDelTurno = randomInt(1, 60);
  const horaInicioTurno = new Date(
    Date.UTC(1970, 0, 1, 20, minutoDelTurno, randomInt(0, 60)),
  );
  const horaFinTurno = new Date(Date.UTC(1970, 0, 1, 23, 30, 0));

  let turnoId: string;
  const mesaIds: string[] = [];
  const reservaIds: string[] = [];

  interface ReservaDePrueba {
    id: string;
    mesaId: string;
    codigo: string;
    email: string;
    estado: EstadoReserva;
  }
  let confirmada: ReservaDePrueba;
  let pendiente: ReservaDePrueba;
  let cancelada: ReservaDePrueba;
  let noShow: ReservaDePrueba;

  async function crearReserva(
    zonaId: string,
    etiqueta: string,
    estado: EstadoReserva,
    email: string,
  ): Promise<ReservaDePrueba> {
    const mesa = await prisma.mesa.create({
      data: { zonaId, capacidad: 4, etiqueta },
    });
    mesaIds.push(mesa.id);
    const codigo = codigoNuevo();
    const reserva = await prisma.reserva.create({
      data: {
        mesaId: mesa.id,
        turnoId,
        fecha: FECHA,
        comensales: 4,
        estado,
        nombreCliente: 'Cliente de prueba',
        emailCliente: email,
        telefonoCliente: '+54 9 11 5555-0000',
        codigoReserva: codigo,
      },
    });
    reservaIds.push(reserva.id);
    return { id: reserva.id, mesaId: mesa.id, codigo, email, estado };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, ReservasModule],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(ReservasService);

    const zona = await prisma.zona.findUnique({
      where: { nombre: 'STANDARD' },
    });
    if (!zona) {
      throw new Error(
        'Falta la Zona STANDARD: corré `npm run db:seed -w backend` antes de los tests de integración.',
      );
    }

    const turno = await prisma.turno.create({
      data: {
        diaSemana: DiaSemana.LUNES,
        horaInicio: horaInicioTurno,
        horaFin: horaFinTurno,
        activo: true,
      },
    });
    turnoId = turno.id;

    // El punto del email es a propósito: en un `ILIKE`, un `_` en la consulta lo reemplazaría.
    confirmada = await crearReserva(
      zona.id,
      `CONSULTAR-A-${sufijo}`,
      EstadoReserva.CONFIRMADA,
      `ana.perez.${sufijo}@example.com`,
    );
    // Email con mayúsculas mezcladas, para el escenario "otras mayúsculas".
    pendiente = await crearReserva(
      zona.id,
      `CONSULTAR-B-${sufijo}`,
      EstadoReserva.PENDIENTE,
      `Bruno.Gomez.${sufijo}@Example.COM`,
    );
    cancelada = await crearReserva(
      zona.id,
      `CONSULTAR-C-${sufijo}`,
      EstadoReserva.CANCELADA,
      `carla.${sufijo}@example.com`,
    );
    noShow = await crearReserva(
      zona.id,
      `CONSULTAR-D-${sufijo}`,
      EstadoReserva.NO_SHOW,
      `dario.${sufijo}@example.com`,
    );
  });

  afterAll(async () => {
    // Los `catch` evitan que una limpieza fallida tape el error real del test, pero el
    // Turno y las Mesas llevan valores únicos por corrida, así que un resto no rompe la
    // siguiente.
    await prisma.reserva
      .deleteMany({ where: { id: { in: reservaIds } } })
      .catch(() => undefined);
    await prisma.mesa
      .deleteMany({ where: { id: { in: mesaIds } } })
      .catch(() => undefined);
    if (turnoId) {
      await prisma.turno
        .deleteMany({ where: { id: turnoId } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  describe('buscarPorCodigoYEmail', () => {
    it('encuentra la Reserva con el código y el email exactos, con su turno y la zona de su mesa', async () => {
      const encontrada = await service.buscarPorCodigoYEmail(
        confirmada.codigo,
        confirmada.email,
      );

      expect(encontrada).not.toBeNull();
      expect(encontrada?.id).toBe(confirmada.id);
      expect(encontrada?.turno.id).toBe(turnoId);
      expect(encontrada?.mesa.zona.nombre).toBe('STANDARD');
    });

    it('encuentra la Reserva con el código en minúsculas', async () => {
      const encontrada = await service.buscarPorCodigoYEmail(
        confirmada.codigo.toLowerCase(),
        confirmada.email,
      );

      expect(encontrada?.id).toBe(confirmada.id);
    });

    it('encuentra la Reserva aunque el email tenga otras mayúsculas y minúsculas', async () => {
      // Guardada como `Bruno.Gomez.<sufijo>@Example.COM`.
      const enMinusculas = await service.buscarPorCodigoYEmail(
        pendiente.codigo,
        pendiente.email.toLowerCase(),
      );
      const enMayusculas = await service.buscarPorCodigoYEmail(
        pendiente.codigo,
        pendiente.email.toUpperCase(),
      );

      expect(enMinusculas?.id).toBe(pendiente.id);
      expect(enMayusculas?.id).toBe(pendiente.id);
    });

    it('devuelve null con el código de una Reserva y el email de otra', async () => {
      const resultado = await service.buscarPorCodigoYEmail(
        confirmada.codigo,
        pendiente.email,
      );

      expect(resultado).toBeNull();
    });

    it('devuelve null con un email que no coincide', async () => {
      const resultado = await service.buscarPorCodigoYEmail(
        confirmada.codigo,
        `otra.persona.${sufijo}@example.com`,
      );

      expect(resultado).toBeNull();
    });

    it('devuelve null con un código inexistente aunque el email exista', async () => {
      const resultado = await service.buscarPorCodigoYEmail(
        CODIGO_INEXISTENTE,
        confirmada.email,
      );

      expect(resultado).toBeNull();
    });

    it('no trata el guion bajo del email como comodín de un carácter', async () => {
      // La Reserva tiene `ana.perez.<sufijo>@example.com`. Con un `ILIKE` sin escapar, el `_`
      // de la consulta coincidiría con el `.` y encontraría la Reserva sin el email real.
      const resultado = await service.buscarPorCodigoYEmail(
        confirmada.codigo,
        `ana_perez.${sufijo}@example.com`,
      );

      expect(resultado).toBeNull();
    });

    it('no trata el signo % del email como comodín de cualquier cantidad de caracteres', async () => {
      // Con un `ILIKE` sin escapar, `%@example.com` coincidiría con el email de la Reserva.
      const resultado = await service.buscarPorCodigoYEmail(
        confirmada.codigo,
        '%@example.com',
      );

      expect(resultado).toBeNull();
    });

    it.each([
      ['CANCELADA', () => cancelada],
      ['NO_SHOW', () => noShow],
    ])(
      'encuentra una Reserva %s: el estado no oculta la Reserva',
      async (_estado, reserva) => {
        const { codigo, email, id } = reserva();

        const encontrada = await service.buscarPorCodigoYEmail(codigo, email);

        expect(encontrada?.id).toBe(id);
      },
    );

    it('funciona dentro de una transacción ajena', async () => {
      const encontrada = await prisma.$transaction((tx) =>
        service.buscarPorCodigoYEmail(confirmada.codigo, confirmada.email, tx),
      );

      expect(encontrada?.id).toBe(confirmada.id);
    });
  });

  describe('consultar', () => {
    it('devuelve la vista mínima con la fecha y las horas locales tal como se guardaron', async () => {
      const respuesta = await service.consultar(
        confirmada.codigo,
        confirmada.email,
      );

      expect(respuesta).toEqual({
        codigoReserva: confirmada.codigo,
        estado: 'CONFIRMADA',
        fecha: '2026-09-19',
        comensales: 4,
        turno: {
          id: turnoId,
          horaInicio: `20:${String(minutoDelTurno).padStart(2, '0')}`,
          horaFin: '23:30',
        },
        zona: { id: expect.any(String) as string, nombre: 'STANDARD' },
      });
      expect(Object.keys(respuesta).sort()).toEqual([
        'codigoReserva',
        'comensales',
        'estado',
        'fecha',
        'turno',
        'zona',
      ]);
    });

    it.each([
      ['PENDIENTE', () => pendiente],
      ['CANCELADA', () => cancelada],
      ['NO_SHOW', () => noShow],
    ])('devuelve la Reserva %s con ese estado', async (estado, reserva) => {
      const { codigo, email } = reserva();

      const respuesta = await service.consultar(codigo, email);

      expect(respuesta.estado).toBe(estado);
    });

    it('lanza el mismo 404 para un email incorrecto y para un código inexistente', async () => {
      const emailIncorrecto = await service
        .consultar(confirmada.codigo, `otra.persona.${sufijo}@example.com`)
        .catch((error: NotFoundException) => error);
      const codigoInexistente = await service
        .consultar(CODIGO_INEXISTENTE, confirmada.email)
        .catch((error: NotFoundException) => error);

      expect(emailIncorrecto).toBeInstanceOf(NotFoundException);
      expect(codigoInexistente).toBeInstanceOf(NotFoundException);
      expect((emailIncorrecto as NotFoundException).getResponse()).toEqual(
        (codigoInexistente as NotFoundException).getResponse(),
      );
      expect((emailIncorrecto as NotFoundException).getResponse()).toEqual({
        statusCode: 404,
        message: RESERVA_NO_ENCONTRADA_MENSAJE,
        error: 'Not Found',
      });
    });

    it('es de solo lectura: consultar dos veces devuelve lo mismo y no modifica la Reserva', async () => {
      const antes = await prisma.reserva.findUniqueOrThrow({
        where: { id: pendiente.id },
      });

      const primera = await service.consultar(
        pendiente.codigo,
        pendiente.email,
      );
      const segunda = await service.consultar(
        pendiente.codigo,
        pendiente.email,
      );

      const despues = await prisma.reserva.findUniqueOrThrow({
        where: { id: pendiente.id },
      });
      expect(segunda).toEqual(primera);
      expect(despues.estado).toBe(antes.estado);
      expect(despues.mesaId).toBe(antes.mesaId);
      expect(despues.updatedAt.getTime()).toBe(antes.updatedAt.getTime());
    });
  });
});
