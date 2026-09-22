import { EstadoReserva } from '@prisma/client';

import {
  aReservaConsultadaRespuesta,
  formatearFechaCalendario,
  formatearHoraLocal,
  type ReservaParaConsulta,
} from './reserva-consultada.mapper';

/**
 * Reserva tal como la devuelve `buscarPorCodigoYEmail`: con **todos** los campos internos y
 * de contacto que la vista pública no puede mostrar. Las fechas se construyen con
 * `Date.UTC` porque así las devuelve Prisma para `@db.Date` y `@db.Time`; la suite se corre
 * con `TZ=UTC` y con `TZ=America/Argentina/Buenos_Aires` (config.yaml §7 y §9).
 */
function reservaDePrueba(
  cambios: Partial<ReservaParaConsulta> = {},
): ReservaParaConsulta {
  return {
    id: '9c4e1d70-3a2b-4c58-b1f6-7e0a5d2c8b34',
    mesaId: 'e1a7c3f5-2d94-4b60-8a1e-9f3c6b0d7a52',
    turnoId: '3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73',
    fecha: new Date(Date.UTC(2026, 8, 19)),
    comensales: 4,
    estado: EstadoReserva.CONFIRMADA,
    nombreCliente: 'Ana Pérez',
    emailCliente: 'ana.perez@example.com',
    telefonoCliente: '+54 9 11 5555-1234',
    codigoReserva: 'K7PM3QXA',
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
      zonaId: 'b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19',
      capacidad: 4,
      etiqueta: 'S4',
      zona: {
        id: 'b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19',
        nombre: 'STANDARD',
        minComensales: 1,
        maxComensales: 8,
        anticipacionMinHoras: 2,
        anticipacionMaxDias: 30,
        ventanaCancelacionHoras: 2,
        requiereConfirmacionAdmin: false,
        aforoMaximo: 40,
      },
    },
    ...cambios,
  };
}

describe('formatearFechaCalendario', () => {
  it('devuelve YYYY-MM-DD con ceros a la izquierda', () => {
    expect(formatearFechaCalendario(new Date(Date.UTC(2026, 0, 5)))).toBe(
      '2026-01-05',
    );
  });

  it('lee el día en UTC: una fecha a medianoche UTC no retrocede un día', () => {
    // `getDate()` en un proceso con zona horaria al oeste de UTC (Buenos Aires) daría el
    // 18. Se corre la suite con TZ=America/Argentina/Buenos_Aires para que ese bug falle.
    expect(formatearFechaCalendario(new Date(Date.UTC(2026, 8, 19)))).toBe(
      '2026-09-19',
    );
  });
});

describe('formatearHoraLocal', () => {
  it('devuelve HH:mm con ceros a la izquierda y sin convertir la zona horaria', () => {
    expect(formatearHoraLocal(new Date(Date.UTC(1970, 0, 1, 9, 5, 0)))).toBe(
      '09:05',
    );
    expect(formatearHoraLocal(new Date(Date.UTC(1970, 0, 1, 20, 0, 0)))).toBe(
      '20:00',
    );
  });

  it('descarta los segundos', () => {
    expect(formatearHoraLocal(new Date(Date.UTC(1970, 0, 1, 23, 30, 45)))).toBe(
      '23:30',
    );
  });
});

describe('aReservaConsultadaRespuesta', () => {
  it('devuelve exactamente la vista mínima, sin ningún dato interno ni de contacto', () => {
    const respuesta = aReservaConsultadaRespuesta(reservaDePrueba());

    expect(respuesta).toEqual({
      codigoReserva: 'K7PM3QXA',
      estado: 'CONFIRMADA',
      fecha: '2026-09-19',
      comensales: 4,
      turno: {
        id: '3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73',
        horaInicio: '20:00',
        horaFin: '23:30',
      },
      zona: {
        id: 'b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19',
        nombre: 'STANDARD',
      },
    });
    // `toEqual` ignora propiedades `undefined`, así que además se compara la lista exacta
    // de claves: ninguna otra puede colarse.
    expect(Object.keys(respuesta).sort()).toEqual([
      'codigoReserva',
      'comensales',
      'estado',
      'fecha',
      'turno',
      'zona',
    ]);
    expect(Object.keys(respuesta.turno).sort()).toEqual([
      'horaFin',
      'horaInicio',
      'id',
    ]);
    expect(Object.keys(respuesta.zona).sort()).toEqual(['id', 'nombre']);
  });

  it('no filtra el id interno, la mesa, el contacto ni las marcas de tiempo', () => {
    const cuerpo = JSON.stringify(
      aReservaConsultadaRespuesta(reservaDePrueba()),
    );

    // El id de la Reserva, el de la mesa y su etiqueta, y los tres datos de contacto.
    for (const excluido of [
      '9c4e1d70-3a2b-4c58-b1f6-7e0a5d2c8b34',
      'e1a7c3f5-2d94-4b60-8a1e-9f3c6b0d7a52',
      'S4',
      'Ana Pérez',
      'ana.perez@example.com',
      '+54 9 11 5555-1234',
      '2026-09-17',
    ]) {
      expect(cuerpo).not.toContain(excluido);
    }
  });

  it.each([
    EstadoReserva.PENDIENTE,
    EstadoReserva.CONFIRMADA,
    EstadoReserva.CANCELADA,
    EstadoReserva.NO_SHOW,
  ])('devuelve la Reserva en estado %s con ese estado', (estado) => {
    expect(
      aReservaConsultadaRespuesta(reservaDePrueba({ estado })).estado,
    ).toBe(estado);
  });

  it('informa el nombre de la zona VIP', () => {
    const base = reservaDePrueba();
    const respuesta = aReservaConsultadaRespuesta({
      ...base,
      mesa: { ...base.mesa, zona: { ...base.mesa.zona, nombre: 'VIP' } },
    });

    expect(respuesta.zona.nombre).toBe('VIP');
  });

  it('devuelve las horas de un turno que cruza la medianoche tal cual, sin sumar un día', () => {
    const base = reservaDePrueba();
    const respuesta = aReservaConsultadaRespuesta({
      ...base,
      turno: {
        ...base.turno,
        horaInicio: new Date(Date.UTC(1970, 0, 1, 23, 0, 0)),
        horaFin: new Date(Date.UTC(1970, 0, 1, 1, 0, 0)),
      },
    });

    expect(respuesta.turno.horaInicio).toBe('23:00');
    expect(respuesta.turno.horaFin).toBe('01:00');
  });
});
