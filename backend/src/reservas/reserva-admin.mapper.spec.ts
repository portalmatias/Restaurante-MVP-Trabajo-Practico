import { EstadoReserva } from '@prisma/client';

import type { ReservaParaConsulta } from './reserva-consultada.mapper';
import { aReservaAdminRespuesta } from './reserva-admin.mapper';

/**
 * Misma fixture que `reserva-consultada.mapper.spec.ts`, pero acá el mapeo SÍ debe incluir
 * todo lo que aquel excluye: `id`, contacto, mesa y `createdAt` (design.md D6).
 */
function reservaDePrueba(
  cambios: Partial<ReservaParaConsulta> = {},
): ReservaParaConsulta {
  return {
    id: '9c4e1d70-3a2b-4c58-b1f6-7e0a5d2c8b34',
    mesaId: 'e1a7c3f5-2d94-4b60-8a1e-9f3c6b0d7a52',
    turnoId: '3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73',
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
      id: '3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73',
      diaSemana: 'SABADO',
      horaInicio: new Date(Date.UTC(1970, 0, 1, 20, 0, 0)),
      horaFin: new Date(Date.UTC(1970, 0, 1, 23, 30, 0)),
      activo: true,
    },
    mesa: {
      id: 'e1a7c3f5-2d94-4b60-8a1e-9f3c6b0d7a52',
      zonaId: '5d2a9c41-7e3b-4f6a-a1d8-0c9b2e7f4a63',
      capacidad: 6,
      etiqueta: 'V2',
      zona: {
        id: '5d2a9c41-7e3b-4f6a-a1d8-0c9b2e7f4a63',
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
    ...cambios,
  };
}

describe('aReservaAdminRespuesta', () => {
  it('devuelve todos los campos de la vista de admin, incluido lo que la vista pública excluye', () => {
    const respuesta = aReservaAdminRespuesta(reservaDePrueba());

    expect(respuesta).toEqual({
      id: '9c4e1d70-3a2b-4c58-b1f6-7e0a5d2c8b34',
      codigoReserva: 'R2WN8HDE',
      estado: 'PENDIENTE',
      fecha: '2026-09-19',
      comensales: 6,
      nombreCliente: 'Ana Pérez',
      emailCliente: 'ana.perez@example.com',
      telefonoCliente: '+54 9 11 5555-1234',
      turno: {
        id: '3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73',
        horaInicio: '20:00',
        horaFin: '23:30',
      },
      zona: {
        id: '5d2a9c41-7e3b-4f6a-a1d8-0c9b2e7f4a63',
        nombre: 'VIP',
      },
      mesa: {
        id: 'e1a7c3f5-2d94-4b60-8a1e-9f3c6b0d7a52',
        etiqueta: 'V2',
      },
      createdAt: '2026-09-17T14:32:10.000Z',
    });
  });

  it('lee la fecha y las horas en UTC, sin depender de la zona horaria del proceso', () => {
    // Se corre la suite con TZ=UTC y TZ=America/Argentina/Buenos_Aires: con un cálculo que
    // usara el reloj/zona del proceso, este test daría un resultado distinto en cada una.
    const respuesta = aReservaAdminRespuesta(reservaDePrueba());

    expect(respuesta.fecha).toBe('2026-09-19');
    expect(respuesta.turno.horaInicio).toBe('20:00');
    expect(respuesta.turno.horaFin).toBe('23:30');
  });

  it('createdAt viaja como instante UTC en formato ISO', () => {
    const respuesta = aReservaAdminRespuesta(reservaDePrueba());

    expect(respuesta.createdAt).toBe('2026-09-17T14:32:10.000Z');
  });
});
