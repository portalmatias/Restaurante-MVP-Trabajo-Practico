import { ConflictException, NotFoundException } from '@nestjs/common';
import { EstadoReserva } from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';
import { ReservasService } from './reservas.service';

/**
 * Tests de `ReservasService.marcarNoShow` (capability `cancelacion-turnos`, tareas 3.1,
 * 4.5, 4.6, 4.7 y 4.9). Mockea `prisma.reserva.findUnique` y espía `transicionarEstado`
 * (ya cubierto en detalle, incluida la concurrencia, por
 * `test/reservas-invariantes.integration-spec.ts` — invariante 5): acá se prueba solo lo
 * que agrega `marcarNoShow`, el cálculo del fin real del turno y sus bordes exactos, sin
 * depender del reloj real ni de la base.
 *
 * No depende de la zona horaria del proceso: usa siempre `Date.UTC`/`finTurnoUtc`, nunca el
 * reloj o el calendario local. Correr, por ejemplo:
 *   TZ=UTC npm test -- reservas-no-show
 *   TZ=America/Argentina/Buenos_Aires npm test -- reservas-no-show
 * y confirmar que ambas corridas dan exactamente los mismos resultados.
 */
describe('ReservasService.marcarNoShow', () => {
  let service: ReservasService;
  let findUnique: jest.Mock;
  let transicionar: jest.SpyInstance;

  const RESERVA_ID = '9c4e1d70-3a2b-4c58-b1f6-7e0a5d2c8b34';

  function reservaConTurno(overrides: {
    estado?: EstadoReserva;
    fecha: Date;
    horaInicio: Date;
    horaFin: Date;
  }) {
    return {
      id: RESERVA_ID,
      mesaId: 'mesa-1',
      turnoId: 'turno-1',
      fecha: overrides.fecha,
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
        horaInicio: overrides.horaInicio,
        horaFin: overrides.horaFin,
        activo: true,
      },
    };
  }

  const hora = (h: number, m = 0) => new Date(Date.UTC(1970, 0, 1, h, m, 0));

  beforeEach(() => {
    findUnique = jest.fn();
    const prisma = { reserva: { findUnique } } as unknown as PrismaService;
    service = new ReservasService(prisma);
    transicionar = jest
      .spyOn(service, 'transicionarEstado')
      .mockResolvedValue({} as never);
  });

  it('404 cuando la Reserva no existe', async () => {
    findUnique.mockResolvedValue(null);

    await expect(service.marcarNoShow(RESERVA_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(transicionar).not.toHaveBeenCalled();
  });

  it('incluye el turno en la lectura por id', async () => {
    findUnique.mockResolvedValue(
      reservaConTurno({
        fecha: new Date(Date.UTC(2026, 8, 19)),
        horaInicio: hora(20, 0),
        horaFin: hora(23, 30),
      }),
    );
    // Turno ya terminado, así se llega a transicionarEstado sin ruido de la ventana.
    const ahora = new Date('2026-09-20T03:00:00.000Z');

    await service.marcarNoShow(RESERVA_ID, ahora);

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: RESERVA_ID },
      include: { turno: true },
    });
  });

  describe('turno de cena 20:00–23:30 local (cruza medianoche en UTC)', () => {
    // fecha calendario 2026-09-19: fin real = 2026-09-20T02:30:00.000Z (23:30 local -3h... en
    // realidad -3 respecto UTC: 23:30 local = 02:30 UTC del día siguiente).
    const fecha = new Date(Date.UTC(2026, 8, 19));
    const horaInicio = hora(20, 0);
    const horaFin = hora(23, 30);
    const finUtc = new Date('2026-09-20T02:30:00.000Z');

    it('rechaza con 409 un minuto antes del cierre, aunque el fin ya cae después de medianoche en UTC', async () => {
      findUnique.mockResolvedValue(
        reservaConTurno({ fecha, horaInicio, horaFin }),
      );
      const unMinutoAntes = new Date(finUtc.getTime() - 60 * 1000);

      await expect(
        service.marcarNoShow(RESERVA_ID, unMinutoAntes),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(transicionar).not.toHaveBeenCalled();
    });

    it('rechaza con 409 en el instante exacto del fin', async () => {
      findUnique.mockResolvedValue(
        reservaConTurno({ fecha, horaInicio, horaFin }),
      );

      await expect(
        service.marcarNoShow(RESERVA_ID, new Date(finUtc)),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(transicionar).not.toHaveBeenCalled();
    });

    it('permite marcar NO_SHOW un minuto después del cierre', async () => {
      findUnique.mockResolvedValue(
        reservaConTurno({ fecha, horaInicio, horaFin }),
      );
      const unMinutoDespues = new Date(finUtc.getTime() + 60 * 1000);

      await service.marcarNoShow(RESERVA_ID, unMinutoDespues);

      expect(transicionar).toHaveBeenCalledWith(RESERVA_ID, 'NO_SHOW');
    });

    it('rechaza con 409 antes de que termine el turno (bien adentro)', async () => {
      findUnique.mockResolvedValue(
        reservaConTurno({ fecha, horaInicio, horaFin }),
      );
      const mitadDelTurno = new Date('2026-09-19T23:00:00.000Z'); // 20:00 local

      await expect(
        service.marcarNoShow(RESERVA_ID, mitadDelTurno),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('turno nocturno 23:00–01:00 local que cruza el año nuevo', () => {
    // fecha calendario 2026-12-31, horaInicio 23:00, horaFin 01:00 (cruza medianoche local):
    // el fin cae el 2027-01-01 a la 01:00 local = 2027-01-01T04:00:00.000Z.
    const fecha = new Date(Date.UTC(2026, 11, 31));
    const horaInicio = hora(23, 0);
    const horaFin = hora(1, 0);
    const finUtc = new Date('2027-01-01T04:00:00.000Z');

    it('rechaza a las 23:30 local del 31 de diciembre', async () => {
      findUnique.mockResolvedValue(
        reservaConTurno({ fecha, horaInicio, horaFin }),
      );
      // 23:30 local (UTC-3) del 31/12 = 02:30 UTC del 1/1 — 1h30 antes de finUtc (04:00 UTC).
      const veintitresTreinta = new Date('2027-01-01T02:30:00.000Z');

      expect(veintitresTreinta.getTime()).toBeLessThan(finUtc.getTime());
      await expect(
        service.marcarNoShow(RESERVA_ID, veintitresTreinta),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rechaza a las 00:59 local del 1 de enero', async () => {
      findUnique.mockResolvedValue(
        reservaConTurno({ fecha, horaInicio, horaFin }),
      );
      const ceroCincuentaYNueve = new Date(finUtc.getTime() - 60 * 1000);

      await expect(
        service.marcarNoShow(RESERVA_ID, ceroCincuentaYNueve),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rechaza exactamente a la 01:00 local del 1 de enero', async () => {
      findUnique.mockResolvedValue(
        reservaConTurno({ fecha, horaInicio, horaFin }),
      );

      await expect(
        service.marcarNoShow(RESERVA_ID, new Date(finUtc)),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('permite a la 01:01 local del 1 de enero, transicionando a NO_SHOW', async () => {
      findUnique.mockResolvedValue(
        reservaConTurno({ fecha, horaInicio, horaFin }),
      );
      const unaOhUno = new Date(finUtc.getTime() + 60 * 1000);

      await service.marcarNoShow(RESERVA_ID, unaOhUno);

      expect(transicionar).toHaveBeenCalledWith(RESERVA_ID, 'NO_SHOW');
    });
  });

  it('una Reserva que no está CONFIRMADA responde 409, aunque el turno ya haya terminado (vía transicionarEstado)', async () => {
    findUnique.mockResolvedValue(
      reservaConTurno({
        estado: EstadoReserva.PENDIENTE,
        fecha: new Date(Date.UTC(2026, 8, 19)),
        horaInicio: hora(12, 0),
        horaFin: hora(15, 0),
      }),
    );
    transicionar.mockReset();
    transicionar.mockRejectedValue(
      new ConflictException(
        'No se puede transicionar una reserva de PENDIENTE a NO_SHOW.',
      ),
    );
    const muchoDespues = new Date('2026-09-20T12:00:00.000Z');

    await expect(
      service.marcarNoShow(RESERVA_ID, muchoDespues),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transicionar).toHaveBeenCalledWith(RESERVA_ID, 'NO_SHOW');
  });

  it('turno normal (12:00–15:00, no cruza medianoche): éxito después del fin', async () => {
    findUnique.mockResolvedValue(
      reservaConTurno({
        fecha: new Date(Date.UTC(2026, 8, 19)),
        horaInicio: hora(12, 0),
        horaFin: hora(15, 0),
      }),
    );
    // 15:00 local = 18:00 UTC del mismo día; un minuto después.
    const despues = new Date('2026-09-19T18:01:00.000Z');

    await service.marcarNoShow(RESERVA_ID, despues);

    expect(transicionar).toHaveBeenCalledWith(RESERVA_ID, 'NO_SHOW');
  });
});
