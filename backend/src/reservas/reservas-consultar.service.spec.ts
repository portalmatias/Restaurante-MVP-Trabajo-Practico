import { NotFoundException } from '@nestjs/common';
import { EstadoReserva } from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';
import type { ReservaParaConsulta } from './reserva-consultada.mapper';
import { RESERVA_NO_ENCONTRADA_MENSAJE } from './reserva-no-encontrada';
import { ReservasService } from './reservas.service';

/**
 * Tests de `ReservasService.consultar`. La búsqueda en sí (`buscarPorCodigoYEmail`) toca la
 * base y se prueba contra PostgreSQL real en `test/reserva-consultar.integration-spec.ts`;
 * acá se la reemplaza para probar la decisión que toma `consultar` con su resultado.
 */
describe('ReservasService.consultar', () => {
  let service: ReservasService;
  let buscar: jest.SpyInstance;

  const reserva = {
    id: '9c4e1d70-3a2b-4c58-b1f6-7e0a5d2c8b34',
    mesaId: 'mesa-1',
    turnoId: 'turno-1',
    fecha: new Date(Date.UTC(2026, 8, 19)),
    comensales: 6,
    estado: EstadoReserva.PENDIENTE,
    nombreCliente: 'Ana Pérez',
    emailCliente: 'ana.perez@example.com',
    telefonoCliente: '+54 9 11 5555-1234',
    codigoReserva: 'R2WN8HDE',
    createdAt: new Date('2026-09-17T14:32:10.000Z'),
    updatedAt: new Date('2026-09-17T14:32:10.000Z'),
    turno: {
      id: 'turno-1',
      diaSemana: 'SABADO',
      horaInicio: new Date(Date.UTC(1970, 0, 1, 20, 0, 0)),
      horaFin: new Date(Date.UTC(1970, 0, 1, 23, 30, 0)),
      activo: true,
    },
    mesa: {
      id: 'mesa-1',
      zonaId: 'zona-vip',
      capacidad: 6,
      etiqueta: 'V2',
      zona: {
        id: 'zona-vip',
        nombre: 'VIP',
        minComensales: 2,
        maxComensales: 12,
        anticipacionMinHoras: 24,
        anticipacionMaxDias: 60,
        ventanaCancelacionHoras: 24,
        requiereConfirmacionAdmin: true,
        aforoMaximo: 20,
      },
    },
  } as ReservaParaConsulta;

  beforeEach(() => {
    service = new ReservasService({} as PrismaService);
    buscar = jest.spyOn(service, 'buscarPorCodigoYEmail');
  });

  it('devuelve la vista mínima de la Reserva cuando código y email coinciden', async () => {
    buscar.mockResolvedValue(reserva);

    await expect(
      service.consultar('R2WN8HDE', 'ana.perez@example.com'),
    ).resolves.toEqual({
      codigoReserva: 'R2WN8HDE',
      estado: 'PENDIENTE',
      fecha: '2026-09-19',
      comensales: 6,
      turno: { id: 'turno-1', horaInicio: '20:00', horaFin: '23:30' },
      zona: { id: 'zona-vip', nombre: 'VIP' },
    });
  });

  it('busca con el código y el email tal cual los recibe', async () => {
    buscar.mockResolvedValue(reserva);

    await service.consultar('r2wn8hde', 'Ana.Perez@Example.com');

    // La normalización (mayúsculas) es de `buscarPorCodigoYEmail`, no de `consultar`.
    expect(buscar).toHaveBeenCalledWith('r2wn8hde', 'Ana.Perez@Example.com');
  });

  it('lanza el 404 genérico cuando no hay una Reserva con ese código y email', async () => {
    buscar.mockResolvedValue(null);

    await expect(
      service.consultar('ZZZZZZZZ', 'nadie@example.com'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('responde exactamente el mismo 404 para un código inexistente y para un email incorrecto', async () => {
    // Desde `consultar` las dos situaciones son la misma: la búsqueda devuelve `null`.
    // Lo que se comprueba es que el cuerpo del error es idéntico y no repite ningún dato.
    buscar.mockResolvedValue(null);

    const codigoInexistente = await service
      .consultar('ZZZZZZZZ', 'ana.perez@example.com')
      .catch((error: NotFoundException) => error);
    const emailIncorrecto = await service
      .consultar('R2WN8HDE', 'otra.persona@example.com')
      .catch((error: NotFoundException) => error);

    expect(codigoInexistente).toBeInstanceOf(NotFoundException);
    expect((codigoInexistente as NotFoundException).getStatus()).toBe(404);
    expect((codigoInexistente as NotFoundException).getResponse()).toEqual(
      (emailIncorrecto as NotFoundException).getResponse(),
    );
    expect((codigoInexistente as NotFoundException).getResponse()).toEqual({
      statusCode: 404,
      message: RESERVA_NO_ENCONTRADA_MENSAJE,
      error: 'Not Found',
    });
    expect(JSON.stringify(emailIncorrecto)).not.toContain(
      'otra.persona@example.com',
    );
  });
});
