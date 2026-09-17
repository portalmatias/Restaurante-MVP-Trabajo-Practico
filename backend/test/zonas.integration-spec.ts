import { Test } from '@nestjs/testing';

import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ZonasModule } from '../src/zonas/zonas.module';
import { ZonasService } from '../src/zonas/zonas.service';
import { upsertSeguro } from './helpers/upsert-seguro';

/**
 * Tests de integración de `ZonasService.actualizar` contra Postgres real: confirman que
 * la llamada a `prisma.$transaction(..., { isolationLevel: Serializable })` es válida
 * (los tests unitarios de `zonas.service.spec.ts` mockean `$transaction`, no prueban la
 * API real de Prisma) y que dos `actualizar` concurrentes sobre la misma Zona no pueden
 * dejar `minComensales > maxComensales` persistido — el hallazgo P1 de cubic sobre PR #24.
 */
describe('ZonasService.actualizar — integración con Postgres real', () => {
  let prisma: PrismaService;
  let service: ZonasService;
  let zonaVipId: string;

  const valoresVip = {
    minComensales: 2,
    maxComensales: 12,
    anticipacionMinHoras: 24,
    anticipacionMaxDias: 60,
    ventanaCancelacionHoras: 24,
    requiereConfirmacionAdmin: true,
    aforoMaximo: 20,
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, ZonasModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(ZonasService);
    await prisma.$connect();

    const vip = await upsertSeguro(
      () =>
        prisma.zona.upsert({
          where: { nombre: 'VIP' },
          update: valoresVip,
          create: { nombre: 'VIP', ...valoresVip },
        }),
      () => prisma.zona.update({ where: { nombre: 'VIP' }, data: valoresVip }),
    );
    zonaVipId = vip.id;
  });

  afterEach(async () => {
    // Deja la Zona en un estado conocido para el próximo test y para otros archivos que
    // también la usan (es efectivamente singleton).
    await prisma.zona.update({ where: { id: zonaVipId }, data: valoresVip });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('persiste una actualización válida', async () => {
    const resultado = await service.actualizar(zonaVipId, { aforoMaximo: 25 });
    expect(resultado.aforoMaximo).toBe(25);

    const persistida = await prisma.zona.findUniqueOrThrow({
      where: { id: zonaVipId },
    });
    expect(persistida.aforoMaximo).toBe(25);
  });

  it(
    'dos actualizaciones concurrentes con bordes opuestos no dejan min > max: ' +
      'una persiste, la otra se rechaza',
    async () => {
      // Estado inicial: min=2, max=12. Una request sube el mínimo a 11, la otra baja el
      // máximo a 3 — ninguna es individualmente inválida contra el estado con el que
      // arranca, pero combinadas (11 > 3) sí lo son. Si la transacción no fuera
      // Serializable, ambas podrían validar contra la foto vieja del otro y las dos
      // persistir, dejando min=11 > max=3.
      const resultados = await Promise.allSettled([
        service.actualizar(zonaVipId, { minComensales: 11 }),
        service.actualizar(zonaVipId, { maxComensales: 3 }),
      ]);

      const cumplidas = resultados.filter((r) => r.status === 'fulfilled');
      const rechazadas = resultados.filter((r) => r.status === 'rejected');

      // Bajo Serializable, Postgres puede resolver esto de dos formas válidas: aborta una
      // de las dos transacciones con conflicto de serialización (409, ya traducido por el
      // service), o las serializa una detrás de la otra y la segunda ve el nuevo valor de
      // la primera y se rechaza por BadRequestException (min > max). Lo que nunca puede
      // pasar es que las dos persistan.
      expect(cumplidas.length).toBeLessThanOrEqual(1);
      expect(rechazadas.length).toBeGreaterThanOrEqual(1);

      const final = await prisma.zona.findUniqueOrThrow({
        where: { id: zonaVipId },
      });
      expect(final.minComensales).toBeLessThanOrEqual(final.maxComensales);
    },
  );
});
