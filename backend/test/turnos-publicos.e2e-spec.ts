import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DiaSemana } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Tarea 5.2 del change `catalogo-publico`: `GET /turnos` por HTTP con Supertest contra la
 * base de TEST real, con el mismo `ValidationPipe` que `main.ts`.
 *
 * Datos: los Turnos propios viven en la banda 03:xx, libre (el seed usa 12:00 y 20:00,
 * `disponibilidad` 06:xx, `disponibilidad-contexto` 05:xx y `reservas-invariantes` 01:xx),
 * y se borran al terminar. El seed no se pisa.
 */
describe('GET /turnos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let turnoIds: string[] = [];

  function hora(h: number, m: number): Date {
    return new Date(Date.UTC(1970, 0, 1, h, m, 0));
  }

  async function crearTurno(
    diaSemana: DiaSemana,
    h: number,
    m: number,
    activo = true,
  ) {
    const turno = await prisma.turno.create({
      data: {
        diaSemana,
        horaInicio: hora(h, m),
        horaFin: hora(h, m + 15),
        activo,
      },
    });
    turnoIds.push(turno.id);
    return turno;
  }

  async function limpiar() {
    await prisma.turno.deleteMany({ where: { id: { in: turnoIds } } });
    turnoIds = [];
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<INestApplication<App>>();
    // Mismas opciones que main.ts.
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(limpiar);

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  type TurnoPublico = {
    id: string;
    diaSemana: string;
    horaInicio: string;
    horaFin: string;
  };

  it('responde 200 sin header Authorization', async () => {
    const res = await request(app.getHttpServer()).get('/turnos').expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('no incluye Turnos inactivos', async () => {
    const inactivo = await crearTurno(DiaSemana.MARTES, 3, 0, false);
    const activo = await crearTurno(DiaSemana.MARTES, 3, 30, true);

    const res = await request(app.getHttpServer()).get('/turnos').expect(200);

    const ids = (res.body as TurnoPublico[]).map((t) => t.id);
    expect(ids).toContain(activo.id);
    expect(ids).not.toContain(inactivo.id);
  });

  it('cada elemento trae exactamente diaSemana, horaFin, horaInicio e id', async () => {
    await crearTurno(DiaSemana.MARTES, 3, 0);

    const res = await request(app.getHttpServer()).get('/turnos').expect(200);

    expect((res.body as TurnoPublico[]).length).toBeGreaterThan(0);
    for (const turno of res.body as TurnoPublico[]) {
      expect(Object.keys(turno).sort()).toEqual([
        'diaSemana',
        'horaFin',
        'horaInicio',
        'id',
      ]);
    }
  });

  it('ordena por día de la semana y, dentro del día, por hora de inicio', async () => {
    // Se crean desordenados a propósito.
    const domingo = await crearTurno(DiaSemana.DOMINGO, 3, 0);
    const miercoles = await crearTurno(DiaSemana.MIERCOLES, 3, 0);
    const sabado = await crearTurno(DiaSemana.SABADO, 3, 0);
    const martes0330 = await crearTurno(DiaSemana.MARTES, 3, 30);
    const martes0300 = await crearTurno(DiaSemana.MARTES, 3, 0);

    const res = await request(app.getHttpServer()).get('/turnos').expect(200);

    const propios = new Set([
      domingo.id,
      miercoles.id,
      sabado.id,
      martes0330.id,
      martes0300.id,
    ]);
    const idsEnOrden = (res.body as TurnoPublico[])
      .map((t) => t.id)
      .filter((id) => propios.has(id));
    expect(idsEnOrden).toEqual([
      martes0300.id,
      martes0330.id,
      miercoles.id,
      sabado.id,
      domingo.id,
    ]);
  });

  it('serializa horaInicio y horaFin como ISO con fecha fija 1970-01-01', async () => {
    const turno = await prisma.turno.create({
      data: {
        diaSemana: DiaSemana.MARTES,
        horaInicio: hora(3, 0),
        horaFin: hora(3, 30),
      },
    });
    turnoIds.push(turno.id);

    const res = await request(app.getHttpServer()).get('/turnos').expect(200);

    const propio = (res.body as TurnoPublico[]).find((t) => t.id === turno.id);
    expect(propio?.horaInicio).toBe('1970-01-01T03:00:00.000Z');
    expect(propio?.horaFin).toBe('1970-01-01T03:30:00.000Z');
  });

  it('?diaSemana=MARTES devuelve solo los Turnos de MARTES', async () => {
    const martes = await crearTurno(DiaSemana.MARTES, 3, 0);
    const miercoles = await crearTurno(DiaSemana.MIERCOLES, 3, 0);

    const res = await request(app.getHttpServer())
      .get('/turnos')
      .query({ diaSemana: 'MARTES' })
      .expect(200);

    const turnos = res.body as TurnoPublico[];
    expect(turnos.every((t) => t.diaSemana === 'MARTES')).toBe(true);
    const ids = turnos.map((t) => t.id);
    expect(ids).toContain(martes.id);
    expect(ids).not.toContain(miercoles.id);
  });

  it.each(['FERIADO', ''])(
    '?diaSemana=%p (valor inválido) responde 400',
    async (valor) => {
      await request(app.getHttpServer())
        .get('/turnos')
        .query({ diaSemana: valor })
        .expect(400);
    },
  );

  it('?diaSemana=LUNES sin Turnos activos ese día responde 200 con []', async () => {
    // El seed deja los Turnos de LUNES inactivos y `jest-e2e.json` fija `maxWorkers: 1`,
    // así que ninguna otra suite corre a la vez. Si aparece un Turno LUNES activo, se falla
    // acá con la causa en vez de dar un falso rojo en la aserción.
    const lunesActivos = await prisma.turno.count({
      where: { diaSemana: DiaSemana.LUNES, activo: true },
    });
    if (lunesActivos > 0) {
      throw new Error(
        `Precondición incumplida: hay ${lunesActivos} Turno(s) LUNES activo(s) en la base de test. ` +
          'Este caso necesita que LUNES no tenga Turnos activos (el seed los deja inactivos).',
      );
    }

    const res = await request(app.getHttpServer())
      .get('/turnos')
      .query({ diaSemana: 'LUNES' })
      .expect(200);

    expect(res.body).toEqual([]);
  });
});
