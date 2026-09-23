import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DiaSemana, EstadoReserva } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { CodigoMotivo } from '../src/disponibilidad/reglas/tipos';
import { PrismaService } from '../src/prisma/prisma.service';
import { diaDe, FECHA, FECHA_LUNES, fechaISO } from './support/fechas-e2e';
import {
  configurarZonasYConfiguracionDeSeed,
  TURNO_UUID_INEXISTENTE,
  ZONA_UUID_INEXISTENTE,
} from './support/zonas-seed-e2e';

/**
 * Tareas 7.1–7.5 de `reservas-crear`: `POST /reservas` por HTTP con Supertest, contra la base
 * de TEST real (`reservas_test`, ver jest-e2e.setup.ts).
 *
 * Alcance: lo que agrega el endpoint sobre las piezas ya probadas en `elegir-mesa-best-fit.spec.ts`,
 * `reservas-invariantes.integration-spec.ts` y `reservas-concurrencia.integration-spec.ts` (D10):
 * los códigos HTTP, la forma exacta del cuerpo, la validación del body (400) incluido
 * `forbidNonWhitelisted`, los 404 de turno/zona, el 409 con `motivos` y que el service esté bien
 * cableado detrás del controller. Los bordes exactos de cada regla y los invariantes de
 * concurrencia ya están cubiertos ahí: acá no se repiten.
 *
 * App de test (7.1): se levanta `AppModule` con el **mismo** `ValidationPipe` que registra
 * `main.ts` (mismo patrón que `disponibilidad.e2e-spec.ts`). Sin `whitelist` +
 * `forbidNonWhitelisted`, los 400 de `mesaId`/`estado` de más en el body no se reproducirían
 * (D6).
 *
 * Fechas (D9 de `disponibilidad`): se calculan desde el reloj real y lejos de todo borde. Cada
 * turno se crea con el `diaSemana` que corresponde a `FECHA`, así que nunca cae en
 * `TURNO_NO_CORRESPONDE_A_FECHA` sin querer.
 *
 * Datos: cada test crea sus propios Turnos y Mesas (banda horaria 10:00–10:59 y prefijo
 * `RCR-`, que no usa ninguna otra suite) y los borra en `afterEach`, junto con cualquier
 * Reserva que los referencie (las que crea el test directamente por Prisma y las que crea el
 * propio `POST /reservas`, que no vuelven con un id conocido de antemano). No se usan las
 * reservas de ejemplo del seed.
 */
describe('POST /reservas (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let zonaStandardId: string;
  let zonaVipId: string;

  let mesaIds: string[] = [];
  let turnoIds: string[] = [];
  let reservaIds: string[] = [];

  // --- Fixtures --------------------------------------------------------------------------

  // Banda 10:00–10:59: no la usa ninguna otra suite e2e (`disponibilidad-contexto` usa 05:xx,
  // `disponibilidad` 06:xx y `disponibilidad-lock` 07:xx). El contador cuenta segundos, no
  // minutos: con solo minutos, el turno 60 desbordaba a 11:00:00 y quedaba fuera de la banda
  // `[10:00, 11:00)` que filtra `limpiarResiduos()` (cubic, PR #40, hallazgo P3). Contando
  // segundos hay 3600 valores únicos posibles antes de desbordar, y si igual se agotan, se
  // lanza un error explícito en vez de generar silenciosamente una hora fuera de la banda.
  let horaContador = 0;
  function horaDeTestUnica(): Date {
    horaContador += 1;
    const minuto = Math.floor(horaContador / 60);
    const segundo = horaContador % 60;
    if (minuto >= 60) {
      throw new Error(
        'horaDeTestUnica() agotó la banda horaria 10:00–10:59 de esta suite (más de 3600 turnos en una misma corrida)',
      );
    }
    return new Date(Date.UTC(1970, 0, 1, 10, minuto, segundo));
  }

  function datosContacto(sufijo = 'cliente') {
    return {
      nombreCliente: 'Cliente Reservas Crear',
      emailCliente: `reservas-crear-${sufijo}@example.com`,
      telefonoCliente: '+54 9 11 5555-1234',
    };
  }

  async function crearTurno(diaSemana: DiaSemana, activo = true) {
    const turno = await prisma.turno.create({
      data: {
        diaSemana,
        horaInicio: horaDeTestUnica(),
        horaFin: new Date(Date.UTC(1970, 0, 1, 13, 0, 0)),
        activo,
      },
    });
    turnoIds.push(turno.id);
    return turno;
  }

  async function crearMesa(
    zonaId: string,
    capacidad: number,
    etiqueta: string,
  ) {
    const mesa = await prisma.mesa.create({
      data: { zonaId, capacidad, etiqueta: `RCR-${etiqueta}` },
    });
    mesaIds.push(mesa.id);
    return mesa;
  }

  let codigoContador = 0;
  function codigoUnico(): string {
    codigoContador += 1;
    return `RCR${String(codigoContador).padStart(5, '0')}`;
  }

  /** Inserta directamente por Prisma una reserva activa, para controlar la ocupación previa. */
  async function crearReservaExistente(entrada: {
    mesaId: string;
    turnoId: string;
    fecha: Date;
    comensales: number;
    estado: EstadoReserva;
  }) {
    const reserva = await prisma.reserva.create({
      data: {
        ...entrada,
        codigoReserva: codigoUnico(),
        ...datosContacto('previa'),
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
          gte: new Date(Date.UTC(1970, 0, 1, 10, 0, 0)),
          lt: new Date(Date.UTC(1970, 0, 1, 11, 0, 0)),
        },
      },
      select: { id: true },
    });
    const mesasResiduales = await prisma.mesa.findMany({
      where: { etiqueta: { startsWith: 'RCR-' } },
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

  // --- Peticiones HTTP ---------------------------------------------------------------------

  /** `POST /reservas` **sin** header `Authorization`: la ruta es pública. */
  function crear(body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post('/reservas')
      .unset('Authorization')
      .send(body);
  }

  function disponibilidad(query: Record<string, string>) {
    return request(app.getHttpServer())
      .get('/disponibilidad')
      .unset('Authorization')
      .query(query);
  }

  /** Body bien formado; cada test cambia solo lo que quiere probar. */
  function bodyValido(
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      fecha: fechaISO(FECHA),
      turnoId: TURNO_UUID_INEXISTENTE,
      zonaId: zonaStandardId,
      comensales: 2,
      ...datosContacto(),
      ...extra,
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<INestApplication<App>>();
    // 7.1: el mismo pipe global que main.ts, o los 400 de comensales/campos de más no se
    // reproducen (D6, D8 de disponibilidad).
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    // Valores del seed (backend/prisma/seed.ts), igual que disponibilidad.e2e-spec.ts: la
    // suite deja la base como la encontró. `NombreZona` es un enum de dos valores, así que no
    // se pueden crear zonas propias.
    const zonas = await configurarZonasYConfiguracionDeSeed(prisma);
    zonaStandardId = zonas.zonaStandardId;
    zonaVipId = zonas.zonaVipId;

    await limpiarResiduos();
  });

  afterEach(async () => {
    // Cubre tanto las reservas insertadas a mano (`reservaIds`) como las que creó el propio
    // `POST /reservas` durante el test (sin id conocido de antemano, pero siempre referencian
    // un Turno o una Mesa de este archivo).
    if (turnoIds.length || mesaIds.length || reservaIds.length) {
      await prisma.reserva.deleteMany({
        where: {
          OR: [
            { turnoId: { in: turnoIds } },
            { mesaId: { in: mesaIds } },
            { id: { in: reservaIds } },
          ],
        },
      });
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
    await app.close();
  });

  it('arranca y (con el resto del archivo) termina sin quedar colgada', () => {
    expect(app).toBeDefined();
  });

  // --- 201: creación exitosa (tarea 7.2) ---------------------------------------------------
  describe('201 al crear', () => {
    it('sin header Authorization, STANDARD queda CONFIRMADA y el cuerpo tiene la forma exacta de la spec', async () => {
      const turno = await crearTurno(diaDe(FECHA));

      const respuesta = await crear(
        bodyValido({
          turnoId: turno.id,
          zonaId: zonaStandardId,
          comensales: 4,
        }),
      );

      expect(respuesta.status).toBe(201);
      const cuerpo = respuesta.body as Record<string, unknown>;
      expect(Object.keys(cuerpo).sort()).toEqual([
        'codigoReserva',
        'comensales',
        'estado',
        'fecha',
        'turnoId',
        'zonaId',
      ]);
      expect(cuerpo.codigoReserva).toMatch(/^[A-Za-z0-9]{8}$/);
      expect(cuerpo.estado).toBe('CONFIRMADA');
      expect(cuerpo.fecha).toBe(fechaISO(FECHA));
      expect(cuerpo.turnoId).toBe(turno.id);
      expect(cuerpo.zonaId).toBe(zonaStandardId);
      expect(cuerpo.comensales).toBe(4);
      // Ni `id` ni `mesaId`/`mesa` ni datos de contacto (spec.md → "La respuesta no expone
      // datos internos"). El `Object.keys` de arriba ya lo cubre, pero se deja explícito.
      expect(cuerpo).not.toHaveProperty('id');
      expect(cuerpo).not.toHaveProperty('mesaId');
      expect(cuerpo).not.toHaveProperty('mesa');
      expect(cuerpo).not.toHaveProperty('nombreCliente');
      expect(cuerpo).not.toHaveProperty('emailCliente');
      expect(cuerpo).not.toHaveProperty('telefonoCliente');

      // La reserva persistida coincide con lo enviado (spec.md → "Visitante sin token crea
      // una reserva").
      const persistida = await prisma.reserva.findUnique({
        where: { codigoReserva: cuerpo.codigoReserva as string },
        include: { mesa: { select: { zonaId: true } } },
      });
      expect(persistida).not.toBeNull();
      expect(persistida?.fecha).toEqual(FECHA);
      expect(persistida?.comensales).toBe(4);
      expect(persistida?.estado).toBe(EstadoReserva.CONFIRMADA);
      // El `zonaId` de la respuesta sale del pedido: se comprueba que la mesa asignada es
      // de esa zona, que es lo que hace válido devolverlo así.
      expect(persistida?.mesa.zonaId).toBe(zonaStandardId);
    });

    it('VIP queda PENDIENTE', async () => {
      const turno = await crearTurno(diaDe(FECHA));

      const respuesta = await crear(
        bodyValido({ turnoId: turno.id, zonaId: zonaVipId, comensales: 6 }),
      );

      expect(respuesta.status).toBe(201);
      expect((respuesta.body as { estado: string }).estado).toBe('PENDIENTE');

      const persistida = await prisma.reserva.findUnique({
        where: {
          codigoReserva: (respuesta.body as { codigoReserva: string })
            .codigoReserva,
        },
      });
      expect(persistida?.estado).toBe(EstadoReserva.PENDIENTE);
    });
  });

  // --- 400: body mal formado (tarea 7.3) ---------------------------------------------------
  describe('400 cuando el body está mal formado', () => {
    /** Comprueba la forma del 400 y que no se haya persistido ninguna reserva de más. */
    async function esperar400SinPersistir(body: Record<string, unknown>) {
      const antes = await prisma.reserva.count();

      const respuesta = await crear(body);

      expect(respuesta.status).toBe(400);
      const cuerpo = respuesta.body as Record<string, unknown>;
      expect(Object.keys(cuerpo).sort()).toEqual([
        'error',
        'message',
        'statusCode',
      ]);
      expect(cuerpo.statusCode).toBe(400);
      expect(cuerpo.error).toBe('Bad Request');
      expect(Array.isArray(cuerpo.message)).toBe(true);

      expect(await prisma.reserva.count()).toBe(antes);

      return cuerpo.message as string[];
    }

    it('falta telefonoCliente', async () => {
      const turno = await crearTurno(diaDe(FECHA));
      const body = bodyValido({ turnoId: turno.id });
      delete body.telefonoCliente;

      const mensajes = await esperar400SinPersistir(body);

      expect(mensajes.length).toBeGreaterThan(0);
      expect(
        mensajes.every((mensaje) => mensaje.includes('telefonoCliente')),
      ).toBe(true);
    });

    it('emailCliente inválido ("ana.perez")', async () => {
      const turno = await crearTurno(diaDe(FECHA));

      const mensajes = await esperar400SinPersistir(
        bodyValido({ turnoId: turno.id, emailCliente: 'ana.perez' }),
      );
      // El mismo texto que el ejemplo de `400` publicado en openapi.yaml.
      expect(mensajes).toContain('emailCliente debe ser un email válido');
    });

    it('nombreCliente en blanco ("   ")', async () => {
      const turno = await crearTurno(diaDe(FECHA));

      await esperar400SinPersistir(
        bodyValido({ turnoId: turno.id, nombreCliente: '   ' }),
      );
    });

    it('fecha con hora', async () => {
      const turno = await crearTurno(diaDe(FECHA));

      await esperar400SinPersistir(
        bodyValido({ turnoId: turno.id, fecha: '2026-09-19T20:00:00Z' }),
      );
    });

    it('fecha con formato válido pero inexistente (2026-02-30)', async () => {
      const turno = await crearTurno(diaDe(FECHA));

      await esperar400SinPersistir(
        bodyValido({ turnoId: turno.id, fecha: '2026-02-30' }),
      );
    });

    it('zonaId que no es UUID ("vip")', async () => {
      const turno = await crearTurno(diaDe(FECHA));

      await esperar400SinPersistir(
        bodyValido({ turnoId: turno.id, zonaId: 'vip' }),
      );
    });

    it('comensales igual a 0', async () => {
      const turno = await crearTurno(diaDe(FECHA));

      await esperar400SinPersistir(
        bodyValido({ turnoId: turno.id, comensales: 0 }),
      );
    });

    it('comensales con decimales (2.5)', async () => {
      const turno = await crearTurno(diaDe(FECHA));

      await esperar400SinPersistir(
        bodyValido({ turnoId: turno.id, comensales: 2.5 }),
      );
    });

    it('comensales como string ("4")', async () => {
      const turno = await crearTurno(diaDe(FECHA));

      await esperar400SinPersistir(
        bodyValido({ turnoId: turno.id, comensales: '4' }),
      );
    });

    it('body con estado ("CONFIRMADA"): rechazado por forbidNonWhitelisted (D6)', async () => {
      const turno = await crearTurno(diaDe(FECHA));

      const mensajes = await esperar400SinPersistir(
        bodyValido({
          turnoId: turno.id,
          zonaId: zonaVipId,
          comensales: 6,
          estado: 'CONFIRMADA',
        }),
      );

      expect(mensajes).toEqual([expect.stringContaining('estado')]);
    });

    it('body con mesaId: rechazado por forbidNonWhitelisted (D6)', async () => {
      const turno = await crearTurno(diaDe(FECHA));
      const mesa = await crearMesa(zonaStandardId, 8, 'M400');

      const mensajes = await esperar400SinPersistir(
        bodyValido({ turnoId: turno.id, comensales: 2, mesaId: mesa.id }),
      );

      expect(mensajes).toEqual([expect.stringContaining('mesaId')]);
    });
  });

  // --- 404: turno o zona inexistentes (tarea 7.3) -----------------------------------------
  describe('404 cuando el turno o la zona no existen', () => {
    async function esperar404SinPersistir(body: Record<string, unknown>) {
      const antes = await prisma.reserva.count();

      const respuesta = await crear(body);

      expect(respuesta.status).toBe(404);
      const cuerpo = respuesta.body as Record<string, unknown>;
      expect(Object.keys(cuerpo).sort()).toEqual([
        'error',
        'message',
        'statusCode',
      ]);
      expect(cuerpo.statusCode).toBe(404);
      expect(cuerpo.error).toBe('Not Found');
      expect(typeof cuerpo.message).toBe('string');

      expect(await prisma.reserva.count()).toBe(antes);
    }

    it('turnoId es un UUID que no existe', async () => {
      await esperar404SinPersistir(
        bodyValido({ turnoId: TURNO_UUID_INEXISTENTE, zonaId: zonaStandardId }),
      );
    });

    it('zonaId es un UUID que no existe', async () => {
      const turno = await crearTurno(diaDe(FECHA));

      await esperar404SinPersistir(
        bodyValido({ turnoId: turno.id, zonaId: ZONA_UUID_INEXISTENTE }),
      );
    });
  });

  // --- 409: reglas de negocio y aforo (tarea 7.4) -----------------------------------------
  describe('409 por reglas de negocio', () => {
    it('turno del lunes: motivos exactamente TURNO_INACTIVO, con la forma { statusCode, message, error: Conflict, motivos }', async () => {
      const turno = await crearTurno(DiaSemana.LUNES, false);
      const antes = await prisma.reserva.count();

      const respuesta = await crear(
        bodyValido({
          fecha: fechaISO(FECHA_LUNES),
          turnoId: turno.id,
          zonaId: zonaStandardId,
          comensales: 2,
        }),
      );

      expect(respuesta.status).toBe(409);
      const cuerpo = respuesta.body as {
        statusCode: number;
        message: string;
        error: string;
        motivos: { codigo: string; mensaje: string }[];
      };
      expect(Object.keys(cuerpo).sort()).toEqual([
        'error',
        'message',
        'motivos',
        'statusCode',
      ]);
      expect(cuerpo.statusCode).toBe(409);
      expect(typeof cuerpo.message).toBe('string');
      expect(cuerpo.error).toBe('Conflict');
      expect(cuerpo.motivos.map((motivo) => motivo.codigo)).toEqual([
        CodigoMotivo.TURNO_INACTIVO,
      ]);

      expect(await prisma.reserva.count()).toBe(antes);
    });

    it('con reservas VIP de 12 y 6, crear 4 da AFORO_ZONA y crear 2 da 201', async () => {
      const turno = await crearTurno(diaDe(FECHA));
      const mesaDoce = await crearMesa(zonaVipId, 12, 'AFORO-M12');
      const mesaSeis = await crearMesa(zonaVipId, 6, 'AFORO-M6');
      // Mesa libre de sobra para que el rechazo de 4 sea SOLO por aforo, nunca también por
      // SIN_MESA_DISPONIBLE (evaluarReglas informa todos los motivos que fallan).
      await crearMesa(zonaVipId, 4, 'AFORO-M4');
      await crearMesa(zonaVipId, 2, 'AFORO-M2');

      await crearReservaExistente({
        mesaId: mesaDoce.id,
        turnoId: turno.id,
        fecha: FECHA,
        comensales: 12,
        estado: EstadoReserva.CONFIRMADA,
      });
      await crearReservaExistente({
        mesaId: mesaSeis.id,
        turnoId: turno.id,
        fecha: FECHA,
        comensales: 6,
        estado: EstadoReserva.PENDIENTE,
      });

      const rechazo = await crear(
        bodyValido({ turnoId: turno.id, zonaId: zonaVipId, comensales: 4 }),
      );
      expect(rechazo.status).toBe(409);
      expect(
        (rechazo.body as { motivos: { codigo: string }[] }).motivos.map(
          (motivo) => motivo.codigo,
        ),
      ).toEqual([CodigoMotivo.AFORO_ZONA]);

      const exito = await crear(
        bodyValido({ turnoId: turno.id, zonaId: zonaVipId, comensales: 2 }),
      );
      expect(exito.status).toBe(201);
    });

    it('la misma solicitud rechazada: GET /disponibilidad da los mismos motivos en el mismo orden que el 409', async () => {
      const turno = await crearTurno(DiaSemana.LUNES, false);

      // Turno inactivo y 9 comensales en STANDARD (1 a 8): varios motivos a la vez, para que
      // la comparación pruebe también el orden y no solo un único código.
      const query = {
        fecha: fechaISO(FECHA_LUNES),
        turnoId: turno.id,
        zonaId: zonaStandardId,
        comensales: '9',
      };

      const rechazo409 = await crear(
        bodyValido({
          fecha: query.fecha,
          turnoId: query.turnoId,
          zonaId: query.zonaId,
          comensales: 9,
        }),
      );
      expect(rechazo409.status).toBe(409);

      const consulta = await disponibilidad(query);
      expect(consulta.status).toBe(200);
      expect((consulta.body as { disponible: boolean }).disponible).toBe(false);

      const motivos409 = (
        rechazo409.body as { motivos: { codigo: string }[] }
      ).motivos.map((motivo) => motivo.codigo);
      const motivosConsulta = (
        consulta.body as { motivos: { codigo: string }[] }
      ).motivos.map((motivo) => motivo.codigo);
      expect(motivos409.length).toBeGreaterThanOrEqual(2);
      expect(motivos409).toEqual(motivosConsulta);
    });
  });

  // --- Concurrencia por HTTP (tarea 7.5) ---------------------------------------------------
  describe('concurrencia por HTTP', () => {
    it('8 POST simultáneos de 4 comensales en VIP: ninguno es 500 y el aforo de zona no se supera', async () => {
      const turno = await crearTurno(diaDe(FECHA));
      // Aforo VIP = 20 (beforeAll). Con mesas de sobra (6 mesas de capacidad 4, contra un
      // máximo teórico de 5 reservas exitosas de 4 comensales, 20/4), la única razón para que
      // una de las 8 se rechace es el aforo, nunca SIN_MESA_DISPONIBLE.
      for (let i = 0; i < 6; i++) {
        await crearMesa(zonaVipId, 4, `CONC-M${i}`);
      }

      const body = bodyValido({
        turnoId: turno.id,
        zonaId: zonaVipId,
        comensales: 4,
      });

      const respuestas = await Promise.all(
        Array.from({ length: 8 }, () => crear(body)),
      );

      for (const respuesta of respuestas) {
        expect([201, 409]).toContain(respuesta.status);
      }
      expect(respuestas.every((respuesta) => respuesta.status !== 500)).toBe(
        true,
      );

      const ocupacion = await prisma.reserva.aggregate({
        where: {
          turnoId: turno.id,
          fecha: FECHA,
          estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
        },
        _sum: { comensales: true },
      });
      const suma = ocupacion._sum.comensales ?? 0;
      expect(suma).toBeLessThanOrEqual(20);

      // Que el endpoint acepte pedidos bajo concurrencia (no alcanza con que todos den 409) y
      // que cada 201 corresponda a una reserva guardada y cada 409 a ninguna.
      const exitosas = respuestas.filter((r) => r.status === 201).length;
      expect(exitosas).toBeGreaterThanOrEqual(1);
      expect(exitosas).toBeLessThanOrEqual(5);
      expect(suma).toBe(exitosas * 4);
    });
  });
});
