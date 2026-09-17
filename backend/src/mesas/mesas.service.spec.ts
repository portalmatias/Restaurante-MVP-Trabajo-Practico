import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { MesasService } from './mesas.service';

function errorPrisma(code: string) {
  return new Prisma.PrismaClientKnownRequestError('mock', {
    code,
    clientVersion: '6.19.0',
  });
}

describe('MesasService', () => {
  let service: MesasService;
  let prisma: {
    zona: { findUnique: jest.Mock };
    mesa: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    reserva: { count: jest.Mock };
  };

  const zonaStandard = { id: 'zona-standard', nombre: 'STANDARD' };
  const zonaVip = { id: 'zona-vip', nombre: 'VIP' };
  const mesa = {
    id: 'mesa-1',
    zonaId: zonaStandard.id,
    capacidad: 6,
    etiqueta: 'M1',
  };

  beforeEach(async () => {
    prisma = {
      zona: { findUnique: jest.fn() },
      mesa: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      reserva: { count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [MesasService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(MesasService);
  });

  describe('crear', () => {
    it('crea la mesa cuando la zona existe y la capacidad es positiva', async () => {
      prisma.zona.findUnique.mockResolvedValue(zonaStandard);
      prisma.mesa.create.mockResolvedValue(mesa);

      const dto = { zonaId: zonaStandard.id, capacidad: 6, etiqueta: 'M1' };
      await expect(service.crear(dto)).resolves.toEqual(mesa);
      expect(prisma.mesa.create).toHaveBeenCalledWith({ data: dto });
    });

    it('rechaza si la zona no existe', async () => {
      prisma.zona.findUnique.mockResolvedValue(null);

      await expect(
        service.crear({ zonaId: 'no-existe', capacidad: 4, etiqueta: 'M2' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.mesa.create).not.toHaveBeenCalled();
    });

    it.each([0, -1, 1.5])(
      'rechaza capacidad no positiva (%s)',
      async (capacidad) => {
        await expect(
          service.crear({ zonaId: zonaStandard.id, capacidad, etiqueta: 'M3' }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.mesa.create).not.toHaveBeenCalled();
      },
    );
  });

  describe('listar', () => {
    it('sin filtro devuelve todas las mesas', async () => {
      prisma.mesa.findMany.mockResolvedValue([mesa]);

      await expect(service.listar()).resolves.toEqual([mesa]);
      expect(prisma.mesa.findMany).toHaveBeenCalledWith({ where: undefined });
    });

    it('filtra por zona cuando se especifica', async () => {
      prisma.mesa.findMany.mockResolvedValue([mesa]);

      await service.listar(zonaStandard.id);
      expect(prisma.mesa.findMany).toHaveBeenCalledWith({
        where: { zonaId: zonaStandard.id },
      });
    });
  });

  describe('actualizar', () => {
    it('rechaza si la mesa no existe', async () => {
      prisma.mesa.findUnique.mockResolvedValue(null);

      await expect(
        service.actualizar('no-existe', { etiqueta: 'M1b' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('edita etiqueta libremente sin más validación', async () => {
      prisma.mesa.findUnique.mockResolvedValue(mesa);
      prisma.mesa.update.mockResolvedValue({ ...mesa, etiqueta: 'M1-nueva' });

      await service.actualizar(mesa.id, { etiqueta: 'M1-nueva' });
      expect(prisma.reserva.count).not.toHaveBeenCalled();
      expect(prisma.mesa.update).toHaveBeenCalledWith({
        where: { id: mesa.id },
        data: { etiqueta: 'M1-nueva' },
      });
    });

    it('permite aumentar la capacidad sin chequear reservas', async () => {
      prisma.mesa.findUnique.mockResolvedValue(mesa);
      prisma.reserva.count.mockResolvedValue(0);
      prisma.mesa.update.mockResolvedValue({ ...mesa, capacidad: 10 });

      await service.actualizar(mesa.id, { capacidad: 10 });
      expect(prisma.reserva.count).toHaveBeenCalledWith({
        where: {
          mesaId: mesa.id,
          estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
          comensales: { gt: 10 },
        },
      });
      expect(prisma.mesa.update).toHaveBeenCalled();
    });

    it('rechaza reducir la capacidad por debajo de una reserva activa', async () => {
      prisma.mesa.findUnique.mockResolvedValue(mesa);
      prisma.reserva.count.mockResolvedValue(1);

      await expect(
        service.actualizar(mesa.id, { capacidad: 2 }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.mesa.update).not.toHaveBeenCalled();
    });

    it('rechaza el cambio de zona si la mesa tiene reservas activas', async () => {
      prisma.mesa.findUnique.mockResolvedValue(mesa);
      prisma.zona.findUnique.mockResolvedValue(zonaVip);
      prisma.reserva.count.mockResolvedValue(1);

      await expect(
        service.actualizar(mesa.id, { zonaId: zonaVip.id }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.mesa.update).not.toHaveBeenCalled();
    });

    it('permite el cambio de zona sin reservas activas', async () => {
      prisma.mesa.findUnique.mockResolvedValue(mesa);
      prisma.zona.findUnique.mockResolvedValue(zonaVip);
      prisma.reserva.count.mockResolvedValue(0);
      prisma.mesa.update.mockResolvedValue({ ...mesa, zonaId: zonaVip.id });

      await expect(
        service.actualizar(mesa.id, { zonaId: zonaVip.id }),
      ).resolves.toBeDefined();
      expect(prisma.mesa.update).toHaveBeenCalledWith({
        where: { id: mesa.id },
        data: { zonaId: zonaVip.id },
      });
    });

    it('rechaza el cambio de zona si la zona destino no existe', async () => {
      prisma.mesa.findUnique.mockResolvedValue(mesa);
      prisma.zona.findUnique.mockResolvedValue(null);

      await expect(
        service.actualizar(mesa.id, { zonaId: 'no-existe' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.mesa.update).not.toHaveBeenCalled();
    });
  });

  describe('eliminar', () => {
    it('rechaza si la mesa no existe', async () => {
      prisma.mesa.findUnique.mockResolvedValue(null);

      await expect(service.eliminar('no-existe')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.mesa.delete).not.toHaveBeenCalled();
    });

    it.each(['PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'NO_SHOW'])(
      'rechaza si tiene una Reserva %s asociada',
      async () => {
        prisma.mesa.findUnique.mockResolvedValue(mesa);
        prisma.reserva.count.mockResolvedValue(1);

        await expect(service.eliminar(mesa.id)).rejects.toBeInstanceOf(
          ConflictException,
        );
        expect(prisma.mesa.delete).not.toHaveBeenCalled();
      },
    );

    it('elimina físicamente sin reservas asociadas', async () => {
      prisma.mesa.findUnique.mockResolvedValue(mesa);
      prisma.reserva.count.mockResolvedValue(0);
      prisma.mesa.delete.mockResolvedValue(mesa);

      await service.eliminar(mesa.id);
      expect(prisma.mesa.delete).toHaveBeenCalledWith({
        where: { id: mesa.id },
      });
    });

    it('traduce P2003 (FK, reserva concurrente) a ConflictException', async () => {
      prisma.mesa.findUnique.mockResolvedValue(mesa);
      prisma.reserva.count.mockResolvedValue(0);
      prisma.mesa.delete.mockRejectedValue(errorPrisma('P2003'));

      await expect(service.eliminar(mesa.id)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('traduce P2025 (mesa ya eliminada concurrentemente) a NotFoundException', async () => {
      prisma.mesa.findUnique.mockResolvedValue(mesa);
      prisma.reserva.count.mockResolvedValue(0);
      prisma.mesa.delete.mockRejectedValue(errorPrisma('P2025'));

      await expect(service.eliminar(mesa.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propaga cualquier otro error sin traducirlo', async () => {
      prisma.mesa.findUnique.mockResolvedValue(mesa);
      prisma.reserva.count.mockResolvedValue(0);
      const otroError = new Error('falla inesperada');
      prisma.mesa.delete.mockRejectedValue(otroError);

      await expect(service.eliminar(mesa.id)).rejects.toBe(otroError);
    });
  });
});
