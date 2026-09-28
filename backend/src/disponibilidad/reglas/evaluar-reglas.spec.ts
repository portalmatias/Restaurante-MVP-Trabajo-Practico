import { DiaSemana, NombreZona } from '@prisma/client';

import { calcularLugaresRestantes, evaluarReglas } from './evaluar-reglas';
import {
  CodigoMotivo,
  ContextoReserva,
  MotivoNoDisponible,
  SolicitudDisponibilidad,
} from './tipos';

// Valores del seed de `modelo-dominio` (spec.md → Purpose). Los contextos se arman a mano:
// las reglas son puras y no necesitan base (design.md D1).
const ZONAS = {
  STANDARD: {
    nombre: NombreZona.STANDARD,
    minComensales: 1,
    maxComensales: 8,
    anticipacionMinHoras: 2,
    anticipacionMaxDias: 30,
    aforoMaximo: 40,
    requiereConfirmacionAdmin: false,
  },
  VIP: {
    nombre: NombreZona.VIP,
    minComensales: 2,
    maxComensales: 12,
    anticipacionMinHoras: 24,
    anticipacionMaxDias: 60,
    aforoMaximo: 20,
    requiereConfirmacionAdmin: true,
  },
};
// Mesas del seed, con las etiquetas que usa `seed.ts`.
const mesa = (etiqueta: string, capacidad: number) => ({
  id: `mesa-${etiqueta}`,
  etiqueta,
  capacidad,
});
const MESAS = {
  STANDARD: [
    mesa('S1', 2),
    mesa('S2', 2),
    mesa('S3', 4),
    mesa('S4', 6),
    mesa('S5', 8),
  ],
  VIP: [mesa('V1', 2), mesa('V2', 4), mesa('V3', 6), mesa('V4', 12)],
};
const AFORO_GLOBAL_SEED = 60;

interface Escenario {
  zona: NombreZona;
  diaSemana: DiaSemana;
  /** Hora local de inicio del turno, `HH:MM`. Por defecto la cena (20:00). */
  horaInicio?: string;
  activo?: boolean;
  aforoMaximo?: number;
  aforoGlobal?: number;
  ocupadosZona?: number;
  ocupadosGlobal?: number;
  /** Etiquetas de las mesas de la zona con reserva activa. Por defecto, ninguna. */
  mesasOcupadas?: string[];
}

function contexto(e: Escenario): ContextoReserva {
  return {
    turno: {
      activo: e.activo ?? true,
      diaSemana: e.diaSemana,
      // `@db.Time` llega como hora UTC del 1970-01-01 que representa la hora local.
      horaInicio: new Date(`1970-01-01T${e.horaInicio ?? '20:00'}:00Z`),
    },
    zona: {
      ...ZONAS[e.zona],
      aforoMaximo: e.aforoMaximo ?? ZONAS[e.zona].aforoMaximo,
    },
    aforoGlobal: e.aforoGlobal ?? AFORO_GLOBAL_SEED,
    ocupadosZona: e.ocupadosZona ?? 0,
    ocupadosGlobal: e.ocupadosGlobal ?? 0,
    mesasLibres: MESAS[e.zona].filter(
      (m) => !(e.mesasOcupadas ?? []).includes(m.etiqueta),
    ),
  };
}

function solicitud(fecha: string, comensales: number): SolicitudDisponibilidad {
  return {
    // Igual que `@db.Date` y que la conversión de la query (D4).
    fecha: new Date(`${fecha}T00:00:00Z`),
    turnoId: '00000000-0000-4000-8000-000000000001',
    zonaId: '00000000-0000-4000-8000-000000000002',
    comensales,
  };
}

/** Instante a partir de una hora local de Argentina (`YYYY-MM-DDTHH:MM`, UTC-3 fijo). */
const local = (fechaHora: string) => new Date(`${fechaHora}:00-03:00`);

const codigos = (motivos: MotivoNoDisponible[]) => motivos.map((m) => m.codigo);

// Instante "actual" de la mayoría de los escenarios de la spec.
const AHORA = local('2026-09-15T10:00');

describe('evaluarReglas', () => {
  describe('turno', () => {
    it('turno inactivo informa solo TURNO_INACTIVO', () => {
      const motivos = evaluarReglas(
        contexto({
          zona: 'STANDARD',
          diaSemana: 'LUNES',
          horaInicio: '12:00',
          activo: false,
        }),
        solicitud('2026-09-21', 2),
        AHORA,
      );
      expect(codigos(motivos)).toEqual([CodigoMotivo.TURNO_INACTIVO]);
    });

    it('turno de otro día de la semana informa solo TURNO_NO_CORRESPONDE_A_FECHA', () => {
      // Cena del martes con fecha miércoles.
      const motivos = evaluarReglas(
        contexto({ zona: 'STANDARD', diaSemana: 'MARTES' }),
        solicitud('2026-09-16', 2),
        AHORA,
      );
      expect(codigos(motivos)).toEqual([
        CodigoMotivo.TURNO_NO_CORRESPONDE_A_FECHA,
      ]);
    });

    it('turno del mismo día de la semana no informa TURNO_NO_CORRESPONDE_A_FECHA', () => {
      const motivos = evaluarReglas(
        contexto({ zona: 'STANDARD', diaSemana: 'MIERCOLES' }),
        solicitud('2026-09-16', 2),
        AHORA,
      );
      expect(codigos(motivos)).not.toContain(
        CodigoMotivo.TURNO_NO_CORRESPONDE_A_FECHA,
      );
    });

    it('la fecha UTC del fin de la cena del sábado (domingo) no corresponde al turno', () => {
      const motivos = evaluarReglas(
        contexto({ zona: 'STANDARD', diaSemana: 'SABADO' }),
        solicitud('2026-09-20', 2),
        AHORA,
      );
      expect(codigos(motivos)).toEqual([
        CodigoMotivo.TURNO_NO_CORRESPONDE_A_FECHA,
      ]);
    });
  });

  describe('anticipación', () => {
    const almuerzoMartes = contexto({
      zona: 'STANDARD',
      diaSemana: 'MARTES',
      horaInicio: '12:00',
    });

    it('exactamente 2 h antes está permitido', () => {
      const motivos = evaluarReglas(
        almuerzoMartes,
        solicitud('2026-09-15', 2),
        local('2026-09-15T10:00'),
      );
      expect(motivos).toEqual([]);
    });

    it('1 h 59 min antes informa solo ANTICIPACION_MINIMA', () => {
      const motivos = evaluarReglas(
        almuerzoMartes,
        solicitud('2026-09-15', 2),
        local('2026-09-15T10:01'),
      );
      expect(codigos(motivos)).toEqual([CodigoMotivo.ANTICIPACION_MINIMA]);
    });

    it('VIP con 23 h 59 min informa solo ANTICIPACION_MINIMA', () => {
      const motivos = evaluarReglas(
        contexto({ zona: 'VIP', diaSemana: 'MIERCOLES' }),
        solicitud('2026-09-16', 2),
        local('2026-09-15T20:01'),
      );
      expect(codigos(motivos)).toEqual([CodigoMotivo.ANTICIPACION_MINIMA]);
    });

    it('fecha pasada informa ANTICIPACION_MINIMA y no ANTICIPACION_MAXIMA', () => {
      const motivos = evaluarReglas(
        almuerzoMartes,
        solicitud('2026-09-08', 2),
        AHORA,
      );
      expect(codigos(motivos)).toEqual([CodigoMotivo.ANTICIPACION_MINIMA]);
    });

    it('exactamente 30 días en STANDARD está permitido', () => {
      const motivos = evaluarReglas(
        contexto({
          zona: 'STANDARD',
          diaSemana: 'JUEVES',
          horaInicio: '12:00',
        }),
        solicitud('2026-10-15', 2),
        local('2026-09-15T12:00'),
      );
      expect(motivos).toEqual([]);
    });

    it('30 días y 1 min en STANDARD informa solo ANTICIPACION_MAXIMA', () => {
      const motivos = evaluarReglas(
        contexto({
          zona: 'STANDARD',
          diaSemana: 'JUEVES',
          horaInicio: '12:00',
        }),
        solicitud('2026-10-15', 2),
        local('2026-09-15T11:59'),
      );
      expect(codigos(motivos)).toEqual([CodigoMotivo.ANTICIPACION_MAXIMA]);
    });

    it('exactamente 60 días en VIP está permitido', () => {
      const motivos = evaluarReglas(
        contexto({ zona: 'VIP', diaSemana: 'SABADO' }),
        solicitud('2026-11-14', 2),
        local('2026-09-15T20:00'),
      );
      expect(motivos).toEqual([]);
    });
  });

  describe('comensales', () => {
    const cenaSabado = (zona: NombreZona) =>
      contexto({ zona, diaSemana: 'SABADO' });

    it.each([1, 8])(
      '%i comensales en STANDARD está permitido',
      (comensales) => {
        expect(
          evaluarReglas(
            cenaSabado('STANDARD'),
            solicitud('2026-09-19', comensales),
            AHORA,
          ),
        ).toEqual([]);
      },
    );

    it.each([2, 12])('%i comensales en VIP está permitido', (comensales) => {
      expect(
        evaluarReglas(
          cenaSabado('VIP'),
          solicitud('2026-09-19', comensales),
          AHORA,
        ),
      ).toEqual([]);
    });

    it('1 comensal en VIP informa solo COMENSALES_FUERA_DE_RANGO', () => {
      const motivos = evaluarReglas(
        cenaSabado('VIP'),
        solicitud('2026-09-19', 1),
        AHORA,
      );
      expect(codigos(motivos)).toEqual([
        CodigoMotivo.COMENSALES_FUERA_DE_RANGO,
      ]);
    });

    it('9 en STANDARD informa COMENSALES_FUERA_DE_RANGO y SIN_MESA_DISPONIBLE, en ese orden', () => {
      // Ninguna mesa STANDARD tiene capacidad para 9.
      const motivos = evaluarReglas(
        cenaSabado('STANDARD'),
        solicitud('2026-09-19', 9),
        AHORA,
      );
      expect(codigos(motivos)).toEqual([
        CodigoMotivo.COMENSALES_FUERA_DE_RANGO,
        CodigoMotivo.SIN_MESA_DISPONIBLE,
      ]);
    });
  });

  describe('aforo de zona', () => {
    // VIP con una reserva de 12 en la mesa de 12 y una de 6 en la mesa de 6: quedan libres
    // la de 2 y la de 4.
    const vipCon18 = contexto({
      zona: 'VIP',
      diaSemana: 'SABADO',
      ocupadosZona: 18,
      ocupadosGlobal: 18,
      mesasOcupadas: ['V4', 'V3'],
    });

    it('llenar exacto el aforo VIP (18 + 2) está permitido', () => {
      expect(
        evaluarReglas(vipCon18, solicitud('2026-09-19', 2), AHORA),
      ).toEqual([]);
    });

    it('18 + 4 informa solo AFORO_ZONA aunque la mesa de 4 está libre', () => {
      const motivos = evaluarReglas(
        vipCon18,
        solicitud('2026-09-19', 4),
        AHORA,
      );
      expect(codigos(motivos)).toEqual([CodigoMotivo.AFORO_ZONA]);
    });
  });

  describe('aforo global', () => {
    // Aforo global 30; activas 12 y 6 en VIP y 8 en la mesa STANDARD de 8.
    const standardConGlobal26 = contexto({
      zona: 'STANDARD',
      diaSemana: 'SABADO',
      aforoGlobal: 30,
      ocupadosZona: 8,
      ocupadosGlobal: 26,
      mesasOcupadas: ['S5'],
    });

    it('26 + 4 con aforo global 30 está permitido', () => {
      expect(
        evaluarReglas(standardConGlobal26, solicitud('2026-09-19', 4), AHORA),
      ).toEqual([]);
    });

    it('26 + 6 informa solo AFORO_GLOBAL aunque la zona tiene lugar y la mesa de 6 está libre', () => {
      const motivos = evaluarReglas(
        standardConGlobal26,
        solicitud('2026-09-19', 6),
        AHORA,
      );
      expect(codigos(motivos)).toEqual([CodigoMotivo.AFORO_GLOBAL]);
    });
  });

  describe('mesa disponible', () => {
    it('con lugar en el aforo pero sin mesa que alcance informa solo SIN_MESA_DISPONIBLE', () => {
      // Reserva de 3 en la mesa STANDARD de 8: quedan 37 lugares, pero ninguna mesa libre
      // tiene capacidad para 7 (no se combinan mesas).
      const motivos = evaluarReglas(
        contexto({
          zona: 'STANDARD',
          diaSemana: 'SABADO',
          ocupadosZona: 3,
          ocupadosGlobal: 3,
          mesasOcupadas: ['S5'],
        }),
        solicitud('2026-09-19', 7),
        AHORA,
      );
      expect(codigos(motivos)).toEqual([CodigoMotivo.SIN_MESA_DISPONIBLE]);
    });

    it('una mesa con capacidad exacta alcanza', () => {
      const motivos = evaluarReglas(
        contexto({ zona: 'VIP', diaSemana: 'SABADO' }),
        solicitud('2026-09-19', 12),
        AHORA,
      );
      expect(motivos).toEqual([]);
    });
  });

  describe('orden fijo', () => {
    it('evalúa todas las reglas e informa los cuatro motivos en el orden de CodigoMotivo', () => {
      // Cena del lunes (inactiva), fecha martes, VIP, 1 comensal, una hora antes.
      const motivos = evaluarReglas(
        contexto({ zona: 'VIP', diaSemana: 'LUNES', activo: false }),
        solicitud('2026-09-22', 1),
        local('2026-09-22T19:00'),
      );
      expect(codigos(motivos)).toEqual([
        CodigoMotivo.TURNO_INACTIVO,
        CodigoMotivo.TURNO_NO_CORRESPONDE_A_FECHA,
        CodigoMotivo.ANTICIPACION_MINIMA,
        CodigoMotivo.COMENSALES_FUERA_DE_RANGO,
      ]);
    });

    it('no se detiene en la primera regla y cada motivo trae un mensaje no vacío', () => {
      const motivos = evaluarReglas(
        contexto({
          zona: 'VIP',
          diaSemana: 'LUNES',
          activo: false,
          aforoGlobal: 0,
          aforoMaximo: 0,
          mesasOcupadas: ['V1', 'V2', 'V3', 'V4'],
        }),
        solicitud('2026-09-22', 13),
        local('2026-06-01T10:00'),
      );
      // Siete motivos a la vez, para cubrir el mensaje de cada regla: la mínima y la máxima se
      // excluyen entre sí, así que acá va la máxima y la mínima se cubre en el test anterior.
      expect(codigos(motivos)).toEqual([
        CodigoMotivo.TURNO_INACTIVO,
        CodigoMotivo.TURNO_NO_CORRESPONDE_A_FECHA,
        CodigoMotivo.ANTICIPACION_MAXIMA,
        CodigoMotivo.COMENSALES_FUERA_DE_RANGO,
        CodigoMotivo.AFORO_ZONA,
        CodigoMotivo.AFORO_GLOBAL,
        CodigoMotivo.SIN_MESA_DISPONIBLE,
      ]);
      for (const motivo of motivos) {
        expect(motivo.mensaje.trim()).not.toBe('');
      }
    });
  });

  describe('medianoche UTC y zona horaria', () => {
    const cenaSabado = contexto({ zona: 'STANDARD', diaSemana: 'SABADO' });

    it('cena del sábado con ahora a las 18:00 local está permitida (2 h exactas contra 23:00Z)', () => {
      const motivos = evaluarReglas(
        cenaSabado,
        solicitud('2026-09-19', 2),
        new Date('2026-09-19T21:00:00Z'),
      );
      expect(motivos).toEqual([]);
    });

    it('cena del sábado con ahora a las 22:00 local (01:00Z del domingo) informa solo ANTICIPACION_MINIMA', () => {
      const motivos = evaluarReglas(
        cenaSabado,
        solicitud('2026-09-19', 2),
        new Date('2026-09-20T01:00:00Z'),
      );
      expect(codigos(motivos)).toEqual([CodigoMotivo.ANTICIPACION_MINIMA]);
    });

    it('turno a las 22:00 local con ahora a las 20:00 local está permitido (inicio 01:00Z del domingo)', () => {
      const motivos = evaluarReglas(
        contexto({
          zona: 'STANDARD',
          diaSemana: 'SABADO',
          horaInicio: '22:00',
        }),
        solicitud('2026-09-19', 2),
        new Date('2026-09-19T23:00:00Z'),
      );
      expect(motivos).toEqual([]);
    });
  });
});

describe('calcularLugaresRestantes', () => {
  it('es el aforo de la zona sin descontar lo solicitado (20, no 8)', () => {
    const ctx = contexto({ zona: 'VIP', diaSemana: 'SABADO' });
    expect(calcularLugaresRestantes(ctx)).toBe(20);
    // Pedir 12 no cambia los lugares restantes ni genera motivos.
    expect(evaluarReglas(ctx, solicitud('2026-09-19', 12), AHORA)).toEqual([]);
  });

  it('descuenta los ocupados de la zona', () => {
    expect(
      calcularLugaresRestantes(
        contexto({
          zona: 'STANDARD',
          diaSemana: 'SABADO',
          ocupadosZona: 4,
          ocupadosGlobal: 4,
        }),
      ),
    ).toBe(36);
  });

  it('es el mínimo entre la zona y el global', () => {
    // Zona STANDARD: 40 - 8 = 32; global: 30 - 26 = 4.
    expect(
      calcularLugaresRestantes(
        contexto({
          zona: 'STANDARD',
          diaSemana: 'SABADO',
          aforoGlobal: 30,
          ocupadosZona: 8,
          ocupadosGlobal: 26,
        }),
      ),
    ).toBe(4);
    // Zona VIP: 20 - 18 = 2; global: 60 - 18 = 42.
    expect(
      calcularLugaresRestantes(
        contexto({
          zona: 'VIP',
          diaSemana: 'SABADO',
          ocupadosZona: 18,
          ocupadosGlobal: 18,
        }),
      ),
    ).toBe(2);
  });

  it('da 0 y no negativo cuando el aforo quedó por debajo de lo ocupado', () => {
    // Aforo VIP bajado a 10 con 18 ocupados.
    const ctx = contexto({
      zona: 'VIP',
      diaSemana: 'SABADO',
      aforoMaximo: 10,
      ocupadosZona: 18,
      ocupadosGlobal: 18,
      mesasOcupadas: ['V4', 'V3'],
    });
    expect(calcularLugaresRestantes(ctx)).toBe(0);
    expect(
      codigos(evaluarReglas(ctx, solicitud('2026-09-19', 2), AHORA)),
    ).toEqual([CodigoMotivo.AFORO_ZONA]);
  });
});
