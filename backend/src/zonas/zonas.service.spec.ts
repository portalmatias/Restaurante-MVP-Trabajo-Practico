import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ZonasService } from './zonas.service';

describe('ZonasService', () => {
  let service: ZonasService;
  let prisma: {
    zona: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  const zonaVip = {
    id: 'zona-vip',
    nombre: 'VIP',
    minComensales: 2,
    maxComensales: 12,
    anticipacionMinHoras: 24,
    anticipacionMaxDias: 60,
    ventanaCancelacionHoras: 24,
    requiereConfirmacionAdmin: true,
    aforoMaximo: 20,
  };

  beforeEach(async () => {
    prisma = {
      zona: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ZonasService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ZonasService);
  });

  describe('listar', () => {
    it('devuelve las Zonas persistidas', async () => {
      prisma.zona.findMany.mockResolvedValue([zonaVip]);

      await expect(service.listar()).resolves.toEqual([zonaVip]);
    });
  });

  describe('actualizar', () => {
    it('rechaza si la Zona no existe', async () => {
      prisma.zona.findUnique.mockResolvedValue(null);

      await expect(
        service.actualizar('inexistente', { minComensales: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.zona.update).not.toHaveBeenCalled();
    });

    it('persiste una actualización válida', async () => {
      prisma.zona.findUnique.mockResolvedValue(zonaVip);
      const dto = { aforoMaximo: 25 };
      prisma.zona.update.mockResolvedValue({ ...zonaVip, ...dto });

      const resultado = await service.actualizar(zonaVip.id, dto);

      expect(prisma.zona.update).toHaveBeenCalledWith({
        where: { id: zonaVip.id },
        data: dto,
      });
      expect(resultado.aforoMaximo).toBe(25);
    });

    it('rechaza si el dto deja minComensales > maxComensales explícitamente', async () => {
      prisma.zona.findUnique.mockResolvedValue(zonaVip);

      await expect(
        service.actualizar(zonaVip.id, {
          minComensales: 13,
          maxComensales: 12,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.zona.update).not.toHaveBeenCalled();
    });

    it('rechaza si solo se cambia minComensales y queda por encima del maxComensales persistido', async () => {
      prisma.zona.findUnique.mockResolvedValue(zonaVip);

      await expect(
        service.actualizar(zonaVip.id, { minComensales: 13 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.zona.update).not.toHaveBeenCalled();
    });

    it('rechaza si solo se cambia maxComensales y queda por debajo del minComensales persistido', async () => {
      prisma.zona.findUnique.mockResolvedValue(zonaVip);

      await expect(
        service.actualizar(zonaVip.id, { maxComensales: 1 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.zona.update).not.toHaveBeenCalled();
    });

    it('permite un rango exacto igual (min === max)', async () => {
      prisma.zona.findUnique.mockResolvedValue(zonaVip);
      const dto = { minComensales: 5, maxComensales: 5 };
      prisma.zona.update.mockResolvedValue({ ...zonaVip, ...dto });

      await expect(service.actualizar(zonaVip.id, dto)).resolves.toBeDefined();
      expect(prisma.zona.update).toHaveBeenCalled();
    });
  });
});
