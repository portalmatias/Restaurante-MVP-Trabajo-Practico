import { randomInt } from 'node:crypto';

import { Test } from '@nestjs/testing';
import { DiaSemana, EstadoReserva } from '@prisma/client';

import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ReservasModule } from '../src/reservas/reservas.module';
import { ReservasService } from '../src/reservas/reservas.service';

/**
 * Tests de integración de `ReservasService.listar` (capability `reserva-consultar`,
 * design.md D6): filtros, combinación de filtros, listas vacías y paginación. Corre contra
 * la base de TEST real porque lo que hay que comprobar es el `where`/`orderBy` de Prisma
 * (relación `mesa.zonaId`, `orderBy` sobre `turno.horaInicio`) y el `$transaction` de
 * `findMany` + `count`, no algo que un mock pueda representar fielmente.
 *
 * Datos: un Turno propio (banda horaria única, ver `horaDeTestUnica`) y varias Mesas/Reservas
 * con un prefijo/sufijo por corrida, para no chocar con el seed ni con otras suites que
 * corren en paralelo contra la misma base.
 */
describe('ReservasService.listar (integración)', () => {
  let prisma: PrismaService;
  let service: ReservasService;

  const sufijo = randomInt(0, 0xffffff).toString(16).padStart(6, '0');
  const FECHA_A = new Date(Date.UTC(2026, 8, 19));
  const FECHA_B = new Date(Date.UTC(2026, 8, 26));

  let zonaStandardId: string;
  let zonaVipId: string;
  let turnoAId: string;
  let turnoBId: string;
  const mesaIds: string[] = [];
  const reservaIds: string[] = [];

  interface ReservaId {
    id: string;
  }
  let rPendienteStandardA: ReservaId;
  let rConfirmadaStandardA: ReservaId;
  let rConfirmadaVipB: ReservaId;
  let rCanceladaStandardA: ReservaId;

  async function crearMesa(zonaId: string, etiqueta: string) {
    const mesa = await prisma.mesa.create({
      data: { zonaId, capacidad: 4, etiqueta: `${etiqueta}-${sufijo}` },
    });
    mesaIds.push(mesa.id);
    return mesa;
  }

  async function crearReserva(entrada: {
    mesaId: string;
    turnoId: string;
    fecha: Date;
    estado: EstadoReserva;
    codigo: string;
  }) {
    const reserva = await prisma.reserva.create({
      data: {
        mesaId: entrada.mesaId,
        turnoId: entrada.turnoId,
        fecha: entrada.fecha,
        comensales: 2,
        estado: entrada.estado,
        nombreCliente: 'Listado E2E',
        emailCliente: `listado-${sufijo}@example.com`,
        telefonoCliente: '+54 9 11 5555-0000',
        codigoReserva: entrada.codigo,
      },
    });
    reservaIds.push(reserva.id);
    return { id: reserva.id };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, ReservasModule],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(ReservasService);

    const standard = await prisma.zona.findUniqueOrThrow({
      where: { nombre: 'STANDARD' },
    });
    const vip = await prisma.zona.findUniqueOrThrow({
      where: { nombre: 'VIP' },
    });
    zonaStandardId = standard.id;
    zonaVipId = vip.id;

    const turnoA = await prisma.turno.create({
      data: {
        diaSemana: DiaSemana.MARTES,
        horaInicio: new Date(Date.UTC(1970, 0, 1, 13, randomInt(1, 60), 0)),
        horaFin: new Date(Date.UTC(1970, 0, 1, 15, 0, 0)),
        activo: true,
      },
    });
    turnoAId = turnoA.id;
    const turnoB = await prisma.turno.create({
      data: {
        diaSemana: DiaSemana.MARTES,
        horaInicio: new Date(Date.UTC(1970, 0, 1, 21, randomInt(1, 60), 0)),
        horaFin: new Date(Date.UTC(1970, 0, 1, 23, 0, 0)),
        activo: true,
      },
    });
    turnoBId = turnoB.id;

    const mesaStandard1 = await crearMesa(zonaStandardId, 'LST-A');
    const mesaStandard2 = await crearMesa(zonaStandardId, 'LST-B');
    const mesaVip = await crearMesa(zonaVipId, 'LST-C');

    // Cuatro Reservas: distintos estado, fecha, zona y turno, para poder filtrar por cada
    // dimensión por separado y combinada.
    rPendienteStandardA = await crearReserva({
      mesaId: mesaStandard1.id,
      turnoId: turnoAId,
      fecha: FECHA_A,
      estado: EstadoReserva.PENDIENTE,
      codigo: `LS${sufijo.slice(0, 2).toUpperCase()}0001`,
    });
    rConfirmadaStandardA = await crearReserva({
      mesaId: mesaStandard2.id,
      turnoId: turnoAId,
      fecha: FECHA_A,
      estado: EstadoReserva.CONFIRMADA,
      codigo: `LS${sufijo.slice(0, 2).toUpperCase()}0002`,
    });
    rConfirmadaVipB = await crearReserva({
      mesaId: mesaVip.id,
      turnoId: turnoBId,
      fecha: FECHA_B,
      estado: EstadoReserva.CONFIRMADA,
      codigo: `LS${sufijo.slice(0, 2).toUpperCase()}0003`,
    });
    rCanceladaStandardA = await crearReserva({
      mesaId: mesaStandard1.id,
      turnoId: turnoBId,
      fecha: FECHA_A,
      estado: EstadoReserva.CANCELADA,
      codigo: `LS${sufijo.slice(0, 2).toUpperCase()}0004`,
    });
  });

  afterAll(async () => {
    await prisma.reserva
      .deleteMany({ where: { id: { in: reservaIds } } })
      .catch(() => undefined);
    await prisma.mesa
      .deleteMany({ where: { id: { in: mesaIds } } })
      .catch(() => undefined);
    await prisma.turno
      .deleteMany({ where: { id: { in: [turnoAId, turnoBId] } } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  function idsDe(resultado: { items: { id: string }[] }): string[] {
    return resultado.items.map((item) => item.id).sort();
  }

  it('sin filtros incluye las cuatro Reservas de esta suite (entre otras del seed/otras suites)', async () => {
    const resultado = await service.listar({ limit: 100 });

    const ids = idsDe(resultado);
    for (const r of [
      rPendienteStandardA,
      rConfirmadaStandardA,
      rConfirmadaVipB,
      rCanceladaStandardA,
    ]) {
      expect(ids).toContain(r.id);
    }
  });

  it('filtra por estado', async () => {
    const resultado = await service.listar({
      estado: EstadoReserva.CONFIRMADA,
      zonaId: zonaStandardId,
      limit: 100,
    });

    const ids = idsDe(resultado);
    expect(ids).toContain(rConfirmadaStandardA.id);
    expect(ids).not.toContain(rPendienteStandardA.id);
    expect(ids).not.toContain(rCanceladaStandardA.id);
  });

  it('filtra por fecha', async () => {
    const resultado = await service.listar({
      fecha: '2026-09-26',
      zonaId: zonaVipId,
      limit: 100,
    });

    const ids = idsDe(resultado);
    expect(ids).toContain(rConfirmadaVipB.id);
    expect(ids).not.toContain(rPendienteStandardA.id);
  });

  it('filtra por zona (a través de mesa.zonaId)', async () => {
    const resultado = await service.listar({ zonaId: zonaVipId, limit: 100 });

    const ids = idsDe(resultado);
    expect(ids).toContain(rConfirmadaVipB.id);
    expect(ids).not.toContain(rPendienteStandardA.id);
    expect(ids).not.toContain(rConfirmadaStandardA.id);
    expect(ids).not.toContain(rCanceladaStandardA.id);
  });

  it('filtra por turno', async () => {
    const resultado = await service.listar({ turnoId: turnoBId, limit: 100 });

    const ids = idsDe(resultado);
    expect(ids).toContain(rConfirmadaVipB.id);
    expect(ids).toContain(rCanceladaStandardA.id);
    expect(ids).not.toContain(rPendienteStandardA.id);
    expect(ids).not.toContain(rConfirmadaStandardA.id);
  });

  it('combina los cuatro filtros a la vez', async () => {
    const resultado = await service.listar({
      fecha: '2026-09-19',
      estado: EstadoReserva.PENDIENTE,
      zonaId: zonaStandardId,
      turnoId: turnoAId,
      limit: 100,
    });

    expect(idsDe(resultado)).toEqual([rPendienteStandardA.id]);
    expect(resultado.total).toBe(1);
  });

  it('una zona con formato válido pero inexistente da lista vacía, no error', async () => {
    const resultado = await service.listar({
      zonaId: '00000000-0000-4000-8000-000000000000',
    });

    expect(resultado.items).toEqual([]);
    expect(resultado.total).toBe(0);
  });

  it('total cuenta todo lo que cumple el filtro, sin paginar', async () => {
    const resultado = await service.listar({ turnoId: turnoAId, limit: 1 });

    expect(resultado.items).toHaveLength(1);
    expect(resultado.total).toBeGreaterThanOrEqual(2);
  });

  it('páginas consecutivas con limit=2 no repiten ni omiten filas', async () => {
    // La Zona STANDARD es el singleton del seed: otras suites que corren en paralelo
    // también pueden tener Reservas ahí, así que el `total` real no es un número fijo que
    // el test pueda hardcodear. En cambio, se recorren TODAS las páginas de a 2 y se
    // compara el conjunto reconstruido contra un único pedido con `limit` grande: si
    // paginar repitiera o salteara filas, los dos conjuntos no coincidirían.
    const completo = await service.listar({
      zonaId: zonaStandardId,
      limit: 1000,
    });
    expect(completo.items).toHaveLength(completo.total);
    // Con 4 Reservas propias en STANDARD (pendiente, confirmada y cancelada de esta suite,
    // más lo que dejen otras) alcanza para al menos dos páginas de a 2.
    expect(completo.total).toBeGreaterThanOrEqual(3);

    const idsReconstruidos: string[] = [];
    for (let offset = 0; offset < completo.total; offset += 2) {
      const pagina = await service.listar({
        zonaId: zonaStandardId,
        limit: 2,
        offset,
      });
      idsReconstruidos.push(...pagina.items.map((item) => item.id));
    }

    expect(idsReconstruidos).toHaveLength(completo.total);
    expect(new Set(idsReconstruidos).size).toBe(completo.total); // sin repetidos
    expect(idsReconstruidos.sort()).toEqual(idsDe(completo)); // el mismo conjunto

    for (const id of [
      rPendienteStandardA.id,
      rConfirmadaStandardA.id,
      rCanceladaStandardA.id,
    ]) {
      expect(idsReconstruidos).toContain(id);
    }
  });

  it('usa los defaults limit=20 y offset=0 cuando no se pasan', async () => {
    const resultado = await service.listar({ zonaId: zonaStandardId });

    expect(resultado.limit).toBe(20);
    expect(resultado.offset).toBe(0);
  });
});
