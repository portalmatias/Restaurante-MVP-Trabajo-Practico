import { ConflictException } from '@nestjs/common';

import type { PrismaService } from '../prisma/prisma.service';
import { ReservasService } from './reservas.service';

/**
 * Tests de `ReservasService.confirmar` y `.rechazar` (capability `reserva-vip`, tareas 2.1,
 * 2.2, 3.1-3.4). Las dos delegan en `transicionarEstado`, ya probado en detalle (incluida la
 * concurrencia, invariante 5) en `test/reservas-invariantes.integration-spec.ts`; acá se
 * espía para verificar cómo cada método lo llama, sin volver a probar `transicionarEstado`
 * en sí.
 */
describe('ReservasService.confirmar / .rechazar', () => {
  let service: ReservasService;
  let transicionar: jest.SpyInstance;

  const RESERVA_ID = '9c4e1d70-3a2b-4c58-b1f6-7e0a5d2c8b34';

  beforeEach(() => {
    service = new ReservasService({} as PrismaService);
    transicionar = jest
      .spyOn(service, 'transicionarEstado')
      .mockResolvedValue({} as never);
  });

  describe('confirmar', () => {
    it('transiciona a CONFIRMADA sin restringir el estado de origen (PENDIENTE es el único válido)', async () => {
      await service.confirmar(RESERVA_ID);

      expect(transicionar).toHaveBeenCalledWith(RESERVA_ID, 'CONFIRMADA');
    });

    it('propaga el 409 de transicionarEstado cuando la Reserva no está PENDIENTE', async () => {
      transicionar.mockRejectedValue(
        new ConflictException(
          'No se puede transicionar una reserva de CONFIRMADA a CONFIRMADA.',
        ),
      );

      await expect(service.confirmar(RESERVA_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('rechazar', () => {
    it('transiciona a CANCELADA exigiendo que el origen sea PENDIENTE', async () => {
      // A diferencia de `cancelar` (cliente), pasa un tercer argumento a `transicionarEstado`:
      // sin él, la tabla genérica de `TRANSICIONES_VALIDAS` permitiría también
      // `CONFIRMADA -> CANCELADA` (la misma transición que usa `cancelar`). El rechazo real de
      // una Reserva `CONFIRMADA` contra Postgres real se prueba en
      // `test/reserva-vip.e2e-spec.ts`, no acá: `transicionarEstado` está mockeado.
      await service.rechazar(RESERVA_ID);

      expect(transicionar).toHaveBeenCalledWith(
        RESERVA_ID,
        'CANCELADA',
        'PENDIENTE',
      );
    });

    it('propaga el 409 de transicionarEstado cuando la Reserva no está PENDIENTE', async () => {
      transicionar.mockRejectedValue(
        new ConflictException(
          'No se puede transicionar una reserva de CONFIRMADA a CANCELADA.',
        ),
      );

      await expect(service.rechazar(RESERVA_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
