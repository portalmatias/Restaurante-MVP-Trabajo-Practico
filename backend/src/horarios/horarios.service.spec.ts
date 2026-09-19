import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { HorariosService } from './horarios.service';

function errorPrisma(code: string) {
  return new Prisma.PrismaClientKnownRequestError('mock', {
    code,
    clientVersion: '6.19.0',
  });
}

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

    it('traduce P2002 (mismo día y hora de inicio) a ConflictException', async () => {
      prisma.turno.create.mockRejectedValue(errorPrisma('P2002'));

      await expect(
        service.crear({
          diaSemana: 'MARTES' as const,
          horaInicio: turnoAlmuerzo.horaInicio,
          horaFin: turnoAlmuerzo.horaFin,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('listar', () => {
    it('devuelve todos los turnos, activos e inactivos, sin filtro', async () => {
      const turnos = [
        turnoAlmuerzo,
        { ...turnoAlmuerzo, id: 'turno-lunes', activo: false },
      ];
      prisma.turno.findMany.mockResolvedValue(turnos);

      const resultado = await service.listar();
      // Sin argumentos: `findMany()` no filtra por `activo`, así que una implementación
      // que sí filtrara (y dejara afuera los inactivos) no se detectaría solo con
      // `toHaveLength` sobre un mock que ya devuelve los dos.
      expect(prisma.turno.findMany).toHaveBeenCalledWith();
      expect(resultado).toEqual(turnos);
    });
  });

  describe('actualizar', () => {
    it('devuelve 404 si el turno desaparece antes de actualizar', async () => {
      prisma.turno.findUnique.mockResolvedValue(turnoAlmuerzo);
      prisma.turno.update.mockRejectedValue(errorPrisma('P2025'));

      await expect(
        service.actualizar(turnoAlmuerzo.id, { activo: false }),
      ).rejects.toEqual(new NotFoundException('El turno indicado no existe.'));
    });
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
          activo: undefined,
        },
      });
    });

    it.each([true, false])(
      'persiste activo=%s recibido en el mismo PATCH de edición',
      async (activo) => {
        prisma.turno.findUnique.mockResolvedValue(turnoAlmuerzo);
        prisma.turno.update.mockResolvedValue({ ...turnoAlmuerzo, activo });

        await service.actualizar(turnoAlmuerzo.id, { activo });
        expect(prisma.turno.update).toHaveBeenCalledWith({
          where: { id: turnoAlmuerzo.id },
          data: {
            diaSemana: undefined,
            horaInicio: undefined,
            horaFin: undefined,
            activo,
          },
        });
      },
    );

    it('traduce P2002 (mismo día y hora de inicio) a ConflictException', async () => {
      prisma.turno.findUnique.mockResolvedValue(turnoAlmuerzo);
      prisma.turno.update.mockRejectedValue(errorPrisma('P2002'));

      await expect(
        service.actualizar(turnoAlmuerzo.id, { diaSemana: 'LUNES' as const }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('cambiarActivo', () => {
    it('devuelve 404 si el turno desaparece antes de cambiar activo', async () => {
      prisma.turno.findUnique.mockResolvedValue(turnoAlmuerzo);
      prisma.turno.update.mockRejectedValue(errorPrisma('P2025'));

      await expect(
        service.cambiarActivo(turnoAlmuerzo.id, false),
      ).rejects.toEqual(new NotFoundException('El turno indicado no existe.'));
    });
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
        data: {
          diaSemana: undefined,
          horaInicio: undefined,
          horaFin: undefined,
          activo: false,
        },
      });
      expect(resultado.activo).toBe(false);
    });
  });
});
