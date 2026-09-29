import { ConflictException, NotFoundException } from '@nestjs/common';
import { EstadoReserva } from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';
import type { ReservaParaConsulta } from './reserva-consultada.mapper';
import { RESERVA_NO_ENCONTRADA_MENSAJE } from './reserva-no-encontrada';
import { ReservasService } from './reservas.service';

/**
 * Tests de `ReservasService.cancelar` (capability `cancelacion-turnos`, tareas 2.2, 4.1,
 * 4.2 y 4.3). La búsqueda por código + email (`buscarPorCodigoYEmail`) ya está probada
 * contra Postgres real en `test/reserva-consultar.integration-spec.ts`; acá se la
 * reemplaza para poder fijar el borde exacto de la ventana de cancelación sin depender del
 * reloj real ni de la base — mismo patrón que `evaluarReglas.spec.ts` de `disponibilidad`
 * y que `reservas-consultar.service.spec.ts` (mockea `buscarPorCodigoYEmail`).
 *
 * No depende de la zona horaria del proceso: usa siempre `Date.UTC`/`inicioTurnoUtc`, nunca
 * el reloj o el calendario local. Correr, por ejemplo:
 *   TZ=UTC npm test -- reservas-cancelar
 *   TZ=America/Argentina/Buenos_Aires npm test -- reservas-cancelar
 * y confirmar que ambas corridas dan exactamente los mismos resultados.
 */
describe('ReservasService.cancelar', () => {
  let service: ReservasService;
  let buscar: jest.SpyInstance;
  let transicionar: jest.SpyInstance;

  /** Turno 20:00–23:30 local de un día fijo, con ventana STANDARD (2h) por defecto. */
  function reservaBase(
    overrides: Partial<{
      estado: EstadoReserva;
      ventanaCancelacionHoras: number;
      fecha: Date;
    }> = {},
  ): ReservaParaConsulta {
    return {
      id: '9c4e1d70-3a2b-4c58-b1f6-7e0a5d2c8b34',
      mesaId: 'mesa-1',
      turnoId: 'turno-1',
      fecha: overrides.fecha ?? new Date(Date.UTC(2026, 8, 19)),
      comensales: 4,
      estado: overrides.estado ?? EstadoReserva.CONFIRMADA,
      nombreCliente: 'Ana Pérez',
      emailCliente: 'ana.perez@example.com',
      telefonoCliente: '+54 9 11 5555-1234',
      codigoReserva: 'K7PM3QXA',
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
        zonaId: 'zona-standard',
        capacidad: 4,
        etiqueta: 'S2',
        zona: {
          id: 'zona-standard',
          nombre: 'STANDARD',
          minComensales: 1,
          maxComensales: 8,
          anticipacionMinHoras: 2,
          anticipacionMaxDias: 30,
          ventanaCancelacionHoras: overrides.ventanaCancelacionHoras ?? 2,
          requiereConfirmacionAdmin: false,
          aforoMaximo: 40,
        },
      },
    };
  }

  // Inicio real del turno de la reserva base: 2026-09-19 20:00 local = 23:00 UTC.
  const inicioTurnoUtc = new Date('2026-09-19T23:00:00.000Z');

  beforeEach(() => {
    service = new ReservasService({} as PrismaService);
    buscar = jest.spyOn(service, 'buscarPorCodigoYEmail');
    transicionar = jest
      .spyOn(service, 'transicionarEstado')
      .mockResolvedValue({} as never);
  });

  it('lanza el 404 genérico cuando no hay una Reserva con ese código y email', async () => {
    buscar.mockResolvedValue(null);

    await expect(
      service.cancelar('ZZZZZZZZ', 'nadie@example.com'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transicionar).not.toHaveBeenCalled();
  });

  it('el 404 es exactamente el mismo que el de la consulta', async () => {
    buscar.mockResolvedValue(null);

    const error = await service
      .cancelar('ZZZZZZZZ', 'nadie@example.com')
      .catch((e: NotFoundException) => e);

    expect((error as NotFoundException).getResponse()).toEqual({
      statusCode: 404,
      message: RESERVA_NO_ENCONTRADA_MENSAJE,
      error: 'Not Found',
    });
  });

  describe('ventana mínima de cancelación (borde exacto)', () => {
    it('permite cancelar exactamente en el límite de la ventana (2h antes del inicio)', async () => {
      const reserva = reservaBase({ ventanaCancelacionHoras: 2 });
      buscar.mockResolvedValue(reserva);
      const ahora = new Date(inicioTurnoUtc.getTime() - 2 * 60 * 60 * 1000);

      await service.cancelar(
        reserva.codigoReserva,
        reserva.emailCliente,
        ahora,
      );

      expect(transicionar).toHaveBeenCalledWith(reserva.id, 'CANCELADA');
    });

    it('rechaza con 409 un instante después del límite (1 ms menos de anticipación)', async () => {
      const reserva = reservaBase({ ventanaCancelacionHoras: 2 });
      buscar.mockResolvedValue(reserva);
      const ahora = new Date(inicioTurnoUtc.getTime() - 2 * 60 * 60 * 1000 + 1);

      await expect(
        service.cancelar(reserva.codigoReserva, reserva.emailCliente, ahora),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(transicionar).not.toHaveBeenCalled();
    });

    it('zona VIP (24h): permite en el límite exacto y rechaza un instante después', async () => {
      const reserva = reservaBase({ ventanaCancelacionHoras: 24 });
      buscar.mockResolvedValue(reserva);

      const enElLimite = new Date(
        inicioTurnoUtc.getTime() - 24 * 60 * 60 * 1000,
      );
      await service.cancelar(
        reserva.codigoReserva,
        reserva.emailCliente,
        enElLimite,
      );
      expect(transicionar).toHaveBeenCalledWith(reserva.id, 'CANCELADA');

      transicionar.mockClear();
      const fueraDeLimite = new Date(
        inicioTurnoUtc.getTime() - 24 * 60 * 60 * 1000 + 1,
      );
      await expect(
        service.cancelar(
          reserva.codigoReserva,
          reserva.emailCliente,
          fueraDeLimite,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(transicionar).not.toHaveBeenCalled();
    });

    it('permite cancelar con mucha anticipación (dentro de la ventana con margen)', async () => {
      const reserva = reservaBase({ ventanaCancelacionHoras: 2 });
      buscar.mockResolvedValue(reserva);
      const ahora = new Date(inicioTurnoUtc.getTime() - 5 * 60 * 60 * 1000);

      await service.cancelar(
        reserva.codigoReserva,
        reserva.emailCliente,
        ahora,
      );

      expect(transicionar).toHaveBeenCalledWith(reserva.id, 'CANCELADA');
    });
  });

  describe('solo Reservas activas pueden cancelarse', () => {
    it('una Reserva ya CANCELADA responde 409 (vía transicionarEstado)', async () => {
      const reserva = reservaBase({ estado: EstadoReserva.CANCELADA });
      buscar.mockResolvedValue(reserva);
      transicionar.mockReset();
      transicionar.mockRejectedValue(
        new ConflictException(
          'No se puede transicionar una reserva de CANCELADA a CANCELADA.',
        ),
      );
      // Ventana amplia: la única causa de rechazo que se está probando es el estado.
      const ahora = new Date(inicioTurnoUtc.getTime() - 5 * 60 * 60 * 1000);

      await expect(
        service.cancelar(reserva.codigoReserva, reserva.emailCliente, ahora),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(transicionar).toHaveBeenCalledWith(reserva.id, 'CANCELADA');
    });

    it('una Reserva ya NO_SHOW responde 409 (vía transicionarEstado)', async () => {
      const reserva = reservaBase({ estado: EstadoReserva.NO_SHOW });
      buscar.mockResolvedValue(reserva);
      transicionar.mockReset();
      transicionar.mockRejectedValue(
        new ConflictException(
          'No se puede transicionar una reserva de NO_SHOW a CANCELADA.',
        ),
      );
      const ahora = new Date(inicioTurnoUtc.getTime() - 5 * 60 * 60 * 1000);

      await expect(
        service.cancelar(reserva.codigoReserva, reserva.emailCliente, ahora),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  it('caso exitoso: transiciona una Reserva PENDIENTE a CANCELADA dentro de la ventana', async () => {
    const reserva = reservaBase({ estado: EstadoReserva.PENDIENTE });
    buscar.mockResolvedValue(reserva);
    const ahora = new Date(inicioTurnoUtc.getTime() - 5 * 60 * 60 * 1000);

    await service.cancelar(reserva.codigoReserva, reserva.emailCliente, ahora);

    expect(transicionar).toHaveBeenCalledWith(reserva.id, 'CANCELADA');
  });

  it('busca con el código y el email tal cual los recibe (la normalización es de buscarPorCodigoYEmail)', async () => {
    const reserva = reservaBase();
    buscar.mockResolvedValue(reserva);
    const ahora = new Date(inicioTurnoUtc.getTime() - 5 * 60 * 60 * 1000);

    await service.cancelar('k7pm3qxa', 'Ana.Perez@Example.com', ahora);

    expect(buscar).toHaveBeenCalledWith('k7pm3qxa', 'Ana.Perez@Example.com');
  });
});
