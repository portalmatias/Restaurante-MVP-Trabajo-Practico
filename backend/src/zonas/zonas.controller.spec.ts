import { Test, TestingModule } from '@nestjs/testing';

import { ZonasController } from './zonas.controller';
import { ZonasService } from './zonas.service';

describe('ZonasController', () => {
  let controller: ZonasController;
  let service: { listar: jest.Mock; actualizar: jest.Mock };

  beforeEach(async () => {
    service = { listar: jest.fn(), actualizar: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ZonasController],
      providers: [{ provide: ZonasService, useValue: service }],
    }).compile();

    controller = module.get(ZonasController);
  });

  it('listar delega en el service', async () => {
    const zonas = [{ id: 'zona-1' }];
    service.listar.mockResolvedValue(zonas);

    await expect(controller.listar()).resolves.toBe(zonas);
    expect(service.listar).toHaveBeenCalledWith();
  });

  it('actualizar delega en el service con el id y el dto', async () => {
    const dto = { aforoMaximo: 25 };
    const actualizada = { id: 'zona-1', ...dto };
    service.actualizar.mockResolvedValue(actualizada);

    await expect(controller.actualizar('zona-1', dto)).resolves.toBe(
      actualizada,
    );
    expect(service.actualizar).toHaveBeenCalledWith('zona-1', dto);
  });
});
