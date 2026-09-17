import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { HorariosService } from './horarios.service';

describe('HorariosService', () => {
  let service: HorariosService;
  let prisma: {
    turno: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  const turnoAlmuerzo = {
    id: 'turno-almuerzo',
    diaSemana: 'MARTES',
    horaInicio: new Date('1970-01-01T12:00:00Z'),
    horaFin: new Date('1970-01-01T15:00:00Z'),
    activo: true,
  };

  beforeEach(async () => {
    prisma = {
      turno: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HorariosService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(HorariosService);
  });

  describe('crear', () => {
    it('queda activo por defecto si el dto no lo especifica', async () => {
      const dto = {
        diaSemana: 'MARTES' as const,
        horaInicio: turnoAlmuerzo.horaInicio,
        horaFin: turnoAlmuerzo.horaFin,
      };
      prisma.turno.create.mockResolvedValue({ ...turnoAlmuerzo });

      await service.crear(dto);
      expect(prisma.turno.create).toHaveBeenCalledWith({
        data: { ...dto, activo: true },
      });
    });

    it('respeta activo explícito en false', async () => {
      const dto = {
        diaSemana: 'LUNES' as const,
        horaInicio: turnoAlmuerzo.horaInicio,
        horaFin: turnoAlmuerzo.horaFin,
        activo: false,
      };
      prisma.turno.create.mockResolvedValue({ ...turnoAlmuerzo, ...dto });

      await service.crear(dto);
      expect(prisma.turno.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  describe('listar', () => {
    it('devuelve todos los turnos, activos e inactivos', async () => {
      prisma.turno.findMany.mockResolvedValue([
        turnoAlmuerzo,
        { ...turnoAlmuerzo, id: 'turno-lunes', activo: false },
      ]);

      const resultado = await service.listar();
      expect(resultado).toHaveLength(2);
    });
  });

  describe('actualizar', () => {
    it('rechaza si el turno no existe', async () => {
      prisma.turno.findUnique.mockResolvedValue(null);

      await expect(
        service.actualizar('no-existe', { diaSemana: 'MIERCOLES' as const }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('persiste el nuevo horario', async () => {
      prisma.turno.findUnique.mockResolvedValue(turnoAlmuerzo);
      const nuevoHorario = {
        horaInicio: new Date('1970-01-01T13:00:00Z'),
        horaFin: new Date('1970-01-01T16:00:00Z'),
      };
      prisma.turno.update.mockResolvedValue({
        ...turnoAlmuerzo,
        ...nuevoHorario,
      });

      await service.actualizar(turnoAlmuerzo.id, nuevoHorario);
      expect(prisma.turno.update).toHaveBeenCalledWith({
        where: { id: turnoAlmuerzo.id },
        data: {
          diaSemana: undefined,
          horaInicio: nuevoHorario.horaInicio,
          horaFin: nuevoHorario.horaFin,
        },
      });
    });
  });

  describe('cambiarActivo', () => {
    it('rechaza si el turno no existe', async () => {
      prisma.turno.findUnique.mockResolvedValue(null);

      await expect(
        service.cambiarActivo('no-existe', false),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('desactiva el turno sin eliminarlo', async () => {
      prisma.turno.findUnique.mockResolvedValue(turnoAlmuerzo);
      prisma.turno.update.mockResolvedValue({
        ...turnoAlmuerzo,
        activo: false,
      });

      const resultado = await service.cambiarActivo(turnoAlmuerzo.id, false);
      expect(prisma.turno.update).toHaveBeenCalledWith({
        where: { id: turnoAlmuerzo.id },
        data: { activo: false },
      });
      expect(resultado.activo).toBe(false);
    });
  });
});
