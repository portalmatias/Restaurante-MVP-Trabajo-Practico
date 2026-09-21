import { Test, TestingModule } from '@nestjs/testing';

import { MesasController } from './mesas.controller';
import { MesasService } from './mesas.service';

describe('MesasController', () => {
  let controller: MesasController;
  let service: {
    crear: jest.Mock;
    listar: jest.Mock;
    actualizar: jest.Mock;
    eliminar: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      crear: jest.fn(),
      listar: jest.fn(),
      actualizar: jest.fn(),
      eliminar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MesasController],
      providers: [{ provide: MesasService, useValue: service }],
    }).compile();

    controller = module.get(MesasController);
  });

  it('crear delega en el service', async () => {
    const dto = { zonaId: 'zona-1', capacidad: 4, etiqueta: 'M1' };
    const creada = { id: 'mesa-1', ...dto };
    service.crear.mockResolvedValue(creada);

    await expect(controller.crear(dto)).resolves.toBe(creada);
    expect(service.crear).toHaveBeenCalledWith(dto);
  });

  it('listar sin query no filtra por zona', async () => {
    service.listar.mockResolvedValue([]);

    await controller.listar({});
    expect(service.listar).toHaveBeenCalledWith(undefined);
  });

  it('listar con zonaId lo pasa al service', async () => {
    service.listar.mockResolvedValue([]);

    await controller.listar({ zonaId: 'zona-1' });
    expect(service.listar).toHaveBeenCalledWith('zona-1');
  });

  it('actualizar delega en el service con el id y el dto', async () => {
    const dto = { capacidad: 8 };
    const actualizada = { id: 'mesa-1', ...dto };
    service.actualizar.mockResolvedValue(actualizada);

    await expect(controller.actualizar('mesa-1', dto)).resolves.toBe(
      actualizada,
    );
    expect(service.actualizar).toHaveBeenCalledWith('mesa-1', dto);
  });

  it('eliminar delega en el service y no devuelve cuerpo', async () => {
    service.eliminar.mockResolvedValue(undefined);

    await expect(controller.eliminar('mesa-1')).resolves.toBeUndefined();
    expect(service.eliminar).toHaveBeenCalledWith('mesa-1');
  });
});
