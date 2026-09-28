import { Test, TestingModule } from '@nestjs/testing';

import { HorariosController } from './horarios.controller';
import { HorariosService } from './horarios.service';

describe('HorariosController', () => {
  let controller: HorariosController;
  let service: { crear: jest.Mock; listar: jest.Mock; actualizar: jest.Mock };

  beforeEach(async () => {
    service = { crear: jest.fn(), listar: jest.fn(), actualizar: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HorariosController],
      providers: [{ provide: HorariosService, useValue: service }],
    }).compile();

    controller = module.get(HorariosController);
  });

  it('crear delega en el service', async () => {
    const dto = {
      diaSemana: 'MARTES' as const,
      horaInicio: new Date('1970-01-01T12:00:00Z'),
      horaFin: new Date('1970-01-01T15:00:00Z'),
    };
    const creado = { id: 'turno-1', ...dto, activo: true };
    service.crear.mockResolvedValue(creado);

    await expect(controller.crear(dto)).resolves.toBe(creado);
    expect(service.crear).toHaveBeenCalledWith(dto);
  });

  it('listar delega en el service', async () => {
    const turnos = [{ id: 'turno-1' }];
    service.listar.mockResolvedValue(turnos);

    await expect(controller.listar()).resolves.toBe(turnos);
    expect(service.listar).toHaveBeenCalledWith();
  });

  it('actualizar delega en el service con el id y el dto, incluido activo', async () => {
    const dto = { activo: false };
    const actualizado = { id: 'turno-1', activo: false };
    service.actualizar.mockResolvedValue(actualizado);

    await expect(controller.actualizar('turno-1', dto)).resolves.toBe(
      actualizado,
    );
    expect(service.actualizar).toHaveBeenCalledWith('turno-1', dto);
  });
});
