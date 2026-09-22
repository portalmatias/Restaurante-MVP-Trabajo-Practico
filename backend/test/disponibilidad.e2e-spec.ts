import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DiaSemana, EstadoReserva } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { ARGENTINA_OFFSET_MS } from '../src/common/timezone';
import { DisponibilidadRespuesta } from '../src/disponibilidad/dto/disponibilidad-respuesta.dto';
import { ErrorRespuesta } from '../src/disponibilidad/dto/error-respuesta.dto';
import { CodigoMotivo, DIAS } from '../src/disponibilidad/reglas/tipos';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Tareas 7.1–7.4 del change `disponibilidad`: `GET /disponibilidad` por HTTP con Supertest,
 * contra la base de TEST real (`reservas_test`, ver jest-e2e.setup.ts).
 *
 * Alcance: lo que agrega el endpoint sobre las piezas ya probadas. La validación de la query
 * (400), los 404 de `cargarContexto`, los códigos HTTP, la forma exacta del cuerpo y que el
 * service esté bien cableado. Los bordes exactos de cada regla (2 h, 1 h 59 min, 30 días,
 * aforo justo) ya están en `reglas/evaluar-reglas.spec.ts`, y qué se lee de la base en
 * `disponibilidad-contexto.e2e-spec.ts`: acá no se repiten.
 *
 * App de test (7.1): se levanta `AppModule` con el **mismo** `ValidationPipe({ transform: true })`
 * que registra `main.ts`. Sin `transform`, `@Type(() => Number)` no convierte la query (que
 * siempre llega como string) y los 400 de `comensales` no se reproducen (design.md D8).
 *
 * Fechas (D9): se calculan desde el reloj real y lejos de todo borde. La fecha base cae 10
 * días después de hoy, así que el margen de anticipación queda entre ~9 y ~10 días: muy por
 * encima de las mínimas (2 h en STANDARD, 24 h en VIP) y muy por debajo de las máximas
 * (30 y 60 días). Todo se arma con `Date.UTC` y getters `getUTC*` para que el resultado no
 * dependa de la zona horaria del proceso (la suite se corre con `TZ=UTC` y con
 * `TZ=America/Argentina/Buenos_Aires`).
 *
 * Datos: cada test crea sus Turnos, Mesas y Reservas y los borra en `afterEach`. Los Turnos
 * viven en la banda horaria 06:00–06:59 y las Mesas llevan el prefijo `DISP-`, bandas que no
 * usa nadie más (el seed usa 12:00 y 20:00, `disponibilidad-contexto` 05:xx y
 * `reservas-invariantes` 01:xx), así que las suites pueden correr en paralelo sin pisarse.
 * Por eso mismo la limpieza de `Reserva` es por los Turnos de este archivo y no un
 * `deleteMany` sin filtro: vaciar la tabla rompería a las otras suites en paralelo, y es
 * equivalente porque toda la consulta filtra por `turnoId` y `fecha`.
 *
 * Las reservas de ejemplo del seed no se usan: tienen fechas relativas al día en que se
 * sembró y ninguna cae en los Turnos nuevos que crea este archivo.
 */
describe('GET /disponibilidad (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let zonaStandardId: string;
  let zonaVipId: string;

  let mesaIds: string[] = [];
  let turnoIds: string[] = [];
  let reservaIds: string[] = [];

  /** UUIDs bien formados que no existen en la base: sirven para el 400 y para el 404. */
  const TURNO_UUID_INEXISTENTE = '3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73';
  const ZONA_UUID_INEXISTENTE = 'b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19';

  const MENSAJE_COMENSALES =
    'comensales debe ser un número entero mayor o igual a 1';
  const MENSAJE_FECHA_FORMATO =
    'fecha debe ser una fecha de calendario con formato YYYY-MM-DD, sin hora';

  // --- Fechas ---------------------------------------------------------------------------

  /** Fecha de calendario (medianoche UTC), la forma en que viaja una `@db.Date` (D4). */
  function fechaCalendario(anio: number, mes: number, dia: number): Date {
    return new Date(Date.UTC(anio, mes - 1, dia));
  }

  /** Hoy según el calendario local del restaurante (UTC-3), no según el del proceso. */
  function hoyLocal(): Date {
    const ahoraLocal = new Date(Date.now() + ARGENTINA_OFFSET_MS);
    return fechaCalendario(
      ahoraLocal.getUTCFullYear(),
      ahoraLocal.getUTCMonth() + 1,
      ahoraLocal.getUTCDate(),
    );
  }

  function sumarDias(fecha: Date, dias: number): Date {
    return new Date(
      Date.UTC(
        fecha.getUTCFullYear(),
        fecha.getUTCMonth(),
        fecha.getUTCDate() + dias,
      ),
    );
  }

  /** `YYYY-MM-DD`, que es como viaja `fecha` en la query. */
  function fechaISO(fecha: Date): string {
    const anio = String(fecha.getUTCFullYear()).padStart(4, '0');
    const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getUTCDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  /** El `DiaSemana` que le corresponde a una fecha de calendario. */
  function diaDe(fecha: Date): DiaSemana {
    return DIAS[fecha.getUTCDay()];
  }

  /** Primer lunes que cae a `minimoDias` días o más de hoy (entre 8 y 14 días). */
  function proximoLunes(minimoDias: number): Date {
    let candidata = sumarDias(hoyLocal(), minimoDias);
    while (diaDe(candidata) !== DiaSemana.LUNES) {
      candidata = sumarDias(candidata, 1);
    }
    return candidata;
  }

  /** Fecha de trabajo: 10 días adelante, lejos de toda anticipación mínima y máxima. */
  const FECHA = sumarDias(hoyLocal(), 10);
  const FECHA_LUNES = proximoLunes(8);

  // --- Fixtures --------------------------------------------------------------------------

  // Banda 06:00–06:59: no la usan ni el seed ni las otras suites, y una hora distinta por
  // Turno respeta la clave natural `@@unique([diaSemana, horaInicio])`.
  let horaContador = 0;
  function horaDeTestUnica(): Date {
    horaContador += 1;
    return new Date(Date.UTC(1970, 0, 1, 6, horaContador, 0));
  }

  let codigoContador = 0;
  function codigoUnico(): string {
    codigoContador += 1;
    return `DSP${String(codigoContador).padStart(5, '0')}`;
  }

  async function crearTurno(diaSemana: DiaSemana, activo = true) {
    const turno = await prisma.turno.create({
      data: {
        diaSemana,
        horaInicio: horaDeTestUnica(),
        horaFin: new Date(Date.UTC(1970, 0, 1, 9, 0, 0)),
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
      data: { zonaId, capacidad, etiqueta: `DISP-${etiqueta}` },
    });
    mesaIds.push(mesa.id);
    return mesa;
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
        nombreCliente: 'Cliente Disponibilidad',
        emailCliente: 'disponibilidad@example.com',
        telefonoCliente: '+54 9 11 5555-1234',
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
          gte: new Date(Date.UTC(1970, 0, 1, 6, 0, 0)),
          lt: new Date(Date.UTC(1970, 0, 1, 7, 0, 0)),
        },
      },
      select: { id: true },
    });
    const mesasResiduales = await prisma.mesa.findMany({
      where: { etiqueta: { startsWith: 'DISP-' } },
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

  // --- Consulta HTTP ---------------------------------------------------------------------

  /**
   * `GET /disponibilidad` **sin** header `Authorization`: la ruta es pública (7.4). El
   * `unset` lo deja explícito, para que un header por defecto no se cuele nunca.
   */
  function consultar(query: Record<string, string>) {
    return request(app.getHttpServer())
      .get('/disponibilidad')
      .unset('Authorization')
      .query(query);
  }

  /** Query bien formada; cada test cambia solo el parámetro que quiere probar. */
  function queryValida(
    extra: Record<string, string> = {},
  ): Record<string, string> {
    return {
      fecha: fechaISO(FECHA),
      turnoId: TURNO_UUID_INEXISTENTE,
      zonaId: ZONA_UUID_INEXISTENTE,
      comensales: '2',
      ...extra,
    };
  }

  /**
   * Comprueba el 400 documentado (`{ statusCode, message: string[], error: 'Bad Request' }`,
   * schema `ErrorRespuesta` del YAML) y devuelve los mensajes para que cada test los mire.
   */
  async function mensajesDel400(
    query: Record<string, string>,
  ): Promise<string[]> {
    const respuesta = await consultar(query);

    expect(respuesta.status).toBe(400);
    const cuerpo = respuesta.body as ErrorRespuesta;
    expect(Object.keys(cuerpo).sort()).toEqual([
      'error',
      'message',
      'statusCode',
    ]);
    expect(cuerpo.statusCode).toBe(400);
    expect(cuerpo.error).toBe('Bad Request');
    expect(Array.isArray(cuerpo.message)).toBe(true);

    return cuerpo.message as string[];
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<INestApplication<App>>();
    // 7.1: el mismo pipe global que main.ts, o el 400 de `comensales` no se reproduce (D8).
    // Las tres opciones tienen que coincidir con las de main.ts: `transform` es la que
    // convierte la query (siempre strings) a los tipos del DTO, y `whitelist` +
    // `forbidNonWhitelisted` llegaron con auth-admin. Si acá quedaran menos opciones, la
    // suite dejaría de reproducir la validación real de producción.
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    // Valores del seed (backend/prisma/seed.ts): la suite deja la base como la encontró.
    // `NombreZona` es un enum de dos valores, así que no se pueden crear zonas propias.
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
    // Cierra también el PrismaService: su onModuleDestroy hace el $disconnect.
    await app.close();
  });

  // --- 400: query mal formada (tarea 7.2) -------------------------------------------------
  describe('400 cuando la query está mal formada', () => {
    it('falta zonaId', async () => {
      const sinZona = queryValida();
      delete sinZona.zonaId;

      const mensajes = await mensajesDel400(sinZona);

      expect(mensajes).toEqual([expect.stringContaining('zonaId')]);
    });

    it('fecha con hora (2026-09-19T20:00:00Z)', async () => {
      const mensajes = await mensajesDel400(
        queryValida({ fecha: '2026-09-19T20:00:00Z' }),
      );

      expect(mensajes).toEqual([MENSAJE_FECHA_FORMATO]);
    });

    it('fecha con formato válido pero inexistente (2026-02-30)', async () => {
      const mensajes = await mensajesDel400(
        queryValida({ fecha: '2026-02-30' }),
      );

      expect(mensajes).toEqual([
        'fecha debe ser una fecha de calendario que exista',
      ]);
    });

    // Decisión documentada en design.md ("Trampas de fechas"): `Date.UTC(99, 0, 1)` devuelve
    // 1999, así que la comparación de ida y vuelta del validador rechaza los años de dos
    // dígitos. Para un sistema de reservas de restaurante el año 99 es entrada basura y 400
    // es la respuesta correcta; el test fija el comportamiento para que no se "arregle" por
    // error al leer el código sin el design.
    it('fecha con año de dos dígitos (0099-01-01), que Date.UTC reinterpretaría como 1999', async () => {
      const mensajes = await mensajesDel400(
        queryValida({ fecha: '0099-01-01' }),
      );

      expect(mensajes).toEqual([
        'fecha debe ser una fecha de calendario que exista',
      ]);
    });

    it('turnoId que no es UUID', async () => {
      const mensajes = await mensajesDel400(queryValida({ turnoId: 'abc' }));

      expect(mensajes).toEqual([expect.stringContaining('turnoId')]);
    });

    it('comensales igual a 0', async () => {
      const mensajes = await mensajesDel400(queryValida({ comensales: '0' }));

      expect(mensajes).toContain(MENSAJE_COMENSALES);
    });

    it('comensales con decimales (2.5)', async () => {
      const mensajes = await mensajesDel400(queryValida({ comensales: '2.5' }));

      expect(mensajes).toContain(MENSAJE_COMENSALES);
    });

    it('comensales que no es un número ("dos")', async () => {
      const mensajes = await mensajesDel400(queryValida({ comensales: 'dos' }));

      expect(mensajes).toContain(MENSAJE_COMENSALES);
    });

    it('acumula los errores de varios parámetros, como el ejemplo del contrato', async () => {
      // Es el ejemplo `parametrosInvalidos` del 400 en openapi/openapi.yaml.
      const mensajes = await mensajesDel400(
        queryValida({ fecha: '2026-09-19T20:00:00Z', comensales: '0' }),
      );

      expect(mensajes).toEqual([MENSAJE_FECHA_FORMATO, MENSAJE_COMENSALES]);
    });
  });

  // --- 404: turno o zona inexistentes (tarea 7.3) -----------------------------------------
  describe('404 cuando el turno o la zona no existen', () => {
    it('turnoId es un UUID que no existe', async () => {
      const respuesta = await consultar(
        queryValida({
          turnoId: TURNO_UUID_INEXISTENTE,
          zonaId: zonaStandardId,
        }),
      );

      expect(respuesta.status).toBe(404);
      expect(respuesta.body).toEqual({
        statusCode: 404,
        message: `No existe un turno con id ${TURNO_UUID_INEXISTENTE}`,
        error: 'Not Found',
      });
    });

    it('zonaId es un UUID que no existe', async () => {
      const turno = await crearTurno(diaDe(FECHA));

      const respuesta = await consultar(
        queryValida({ turnoId: turno.id, zonaId: ZONA_UUID_INEXISTENTE }),
      );

      expect(respuesta.status).toBe(404);
      expect(respuesta.body).toEqual({
        statusCode: 404,
        message: `No existe una zona con id ${ZONA_UUID_INEXISTENTE}`,
        error: 'Not Found',
      });
    });
  });

  // --- 200: hay lugar y no hay lugar (tarea 7.4) ------------------------------------------
  describe('200 con el resultado de la consulta', () => {
    it('sin header Authorization y con lugar: disponible true, motivos vacío y el aforo de la zona', async () => {
      const turno = await crearTurno(diaDe(FECHA));
      await crearMesa(zonaStandardId, 4, 'OK-M1');

      const respuesta = await consultar(
        queryValida({
          turnoId: turno.id,
          zonaId: zonaStandardId,
          comensales: '2',
        }),
      );

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({
        disponible: true,
        // Sin reservas en ese turno y esa fecha: min(aforo STANDARD 40, aforo global 60).
        lugaresRestantes: 40,
        motivos: [],
      });
    });

    it('un turno inactivo del lunes da 200 con un solo motivo, nunca 409', async () => {
      const turno = await crearTurno(DiaSemana.LUNES, false);
      await crearMesa(zonaStandardId, 4, 'LUNES-M1');

      const respuesta = await consultar(
        queryValida({
          fecha: fechaISO(FECHA_LUNES),
          turnoId: turno.id,
          zonaId: zonaStandardId,
          comensales: '2',
        }),
      );

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({
        disponible: false,
        lugaresRestantes: 40,
        motivos: [
          {
            codigo: CodigoMotivo.TURNO_INACTIVO,
            mensaje: 'El turno elegido no está habilitado para reservas.',
          },
        ],
      });
    });

    it('devuelve todos los motivos que fallan en el orden fijo de CodigoMotivo', async () => {
      // Turno inactivo y de otro día de la semana, y 1 comensal en VIP (que admite de 2 a
      // 12): fallan tres reglas, que se informan en el orden en que las declara el enum.
      const otroDia = DIAS[(FECHA.getUTCDay() + 1) % 7];
      const turno = await crearTurno(otroDia, false);
      await crearMesa(zonaVipId, 12, 'ORDEN-M1');

      const respuesta = await consultar(
        queryValida({
          turnoId: turno.id,
          zonaId: zonaVipId,
          comensales: '1',
        }),
      );

      expect(respuesta.status).toBe(200);
      const cuerpo = respuesta.body as DisponibilidadRespuesta;
      expect(cuerpo.disponible).toBe(false);
      expect(cuerpo.lugaresRestantes).toBe(20);
      expect(cuerpo.motivos.map((motivo) => motivo.codigo)).toEqual([
        CodigoMotivo.TURNO_INACTIVO,
        CodigoMotivo.TURNO_NO_CORRESPONDE_A_FECHA,
        CodigoMotivo.COMENSALES_FUERA_DE_RANGO,
      ]);
      for (const motivo of cuerpo.motivos) {
        expect(typeof motivo.mensaje).toBe('string');
        expect(motivo.mensaje.length).toBeGreaterThan(0);
      }
    });

    it('consultar no crea ni borra reservas', async () => {
      const turno = await crearTurno(diaDe(FECHA));
      const mesa = await crearMesa(zonaStandardId, 4, 'LECTURA-M1');
      await crearReserva({
        mesaId: mesa.id,
        turnoId: turno.id,
        fecha: FECHA,
        comensales: 2,
        estado: EstadoReserva.CONFIRMADA,
      });

      // Se cuenta solo el turno de este test: otras suites e2e corren en paralelo y mueven
      // el total de la tabla, pero la consulta solo podría escribir en este turno y fecha.
      const donde = { turnoId: turno.id };
      const antes = await prisma.reserva.count({ where: donde });
      expect(antes).toBe(1);

      const respuesta = await consultar(
        queryValida({
          turnoId: turno.id,
          zonaId: zonaStandardId,
          comensales: '2',
        }),
      );
      expect(respuesta.status).toBe(200);

      expect(await prisma.reserva.count({ where: donde })).toBe(antes);
    });

    it('con el aforo de la zona al límite pasa de disponible a AFORO_ZONA', async () => {
      const turno = await crearTurno(diaDe(FECHA));
      const mesaDoce = await crearMesa(zonaVipId, 12, 'AFORO-M12');
      const mesaSeis = await crearMesa(zonaVipId, 6, 'AFORO-M6');
      const mesaDos = await crearMesa(zonaVipId, 2, 'AFORO-M2A');
      // Queda siempre una mesa libre con capacidad suficiente, así que la única regla que
      // puede fallar en este test es la del aforo de la zona.
      await crearMesa(zonaVipId, 2, 'AFORO-M2B');

      // 12 + 6 = 18 de los 20 del aforo VIP.
      await crearReserva({
        mesaId: mesaDoce.id,
        turnoId: turno.id,
        fecha: FECHA,
        comensales: 12,
        estado: EstadoReserva.CONFIRMADA,
      });
      await crearReserva({
        mesaId: mesaSeis.id,
        turnoId: turno.id,
        fecha: FECHA,
        comensales: 6,
        estado: EstadoReserva.PENDIENTE,
      });

      const query = queryValida({
        turnoId: turno.id,
        zonaId: zonaVipId,
        comensales: '2',
      });

      const conLugar = await consultar(query);
      expect(conLugar.status).toBe(200);
      expect(conLugar.body).toEqual({
        disponible: true,
        // min(20 - 18 de la zona, 60 - 18 del global), sin descontar los 2 pedidos.
        lugaresRestantes: 2,
        motivos: [],
      });

      // Con 2 comensales más la zona queda llena y la misma consulta ya no entra.
      await crearReserva({
        mesaId: mesaDos.id,
        turnoId: turno.id,
        fecha: FECHA,
        comensales: 2,
        estado: EstadoReserva.CONFIRMADA,
      });

      const sinLugar = await consultar(query);
      expect(sinLugar.status).toBe(200);
      expect(sinLugar.body).toEqual({
        disponible: false,
        lugaresRestantes: 0,
        motivos: [
          {
            codigo: CodigoMotivo.AFORO_ZONA,
            mensaje:
              'La zona VIP no tiene lugar para 2 comensales en ese turno y esa fecha.',
          },
        ],
      });
    });
  });
});
