import type { components } from "../../src/lib/api/schema";

type ZonaPublica = components["schemas"]["ZonaPublicaRespuestaDto"];
type TurnoPublico = components["schemas"]["TurnoPublicoRespuestaDto"];

// Datos del seed (spec de frontend-cliente, Purpose): zonas STANDARD y VIP; turnos almuerzo
// 12:00-15:00 y cena 20:00-23:30 de martes a domingo (el lunes no tiene turnos activos).
// `GET /turnos` entrega la hora como `1970-01-01THH:mm:00.000Z` (hora local, no un instante).

export const ZONA_STANDARD: ZonaPublica = {
  id: "b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19",
  nombre: "STANDARD",
  minComensales: 1,
  maxComensales: 8,
  anticipacionMinHoras: 2,
  anticipacionMaxDias: 30,
  ventanaCancelacionHoras: 2,
  requiereConfirmacionAdmin: false,
};

export const ZONA_VIP: ZonaPublica = {
  id: "0c7d9e41-52b8-4f36-a1d0-93e6b7c8f245",
  nombre: "VIP",
  minComensales: 2,
  maxComensales: 12,
  anticipacionMinHoras: 24,
  anticipacionMaxDias: 60,
  ventanaCancelacionHoras: 24,
  requiereConfirmacionAdmin: true,
};

export const ZONAS: ZonaPublica[] = [ZONA_STANDARD, ZONA_VIP];

const DIAS_CON_TURNOS = ["MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"] as const;

export const TURNO_ALMUERZO_SABADO: TurnoPublico = {
  id: "3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73",
  diaSemana: "SABADO",
  horaInicio: "1970-01-01T12:00:00.000Z",
  horaFin: "1970-01-01T15:00:00.000Z",
};

export const TURNO_CENA_SABADO: TurnoPublico = {
  id: "9a2b6c1d-7e34-4f58-b0a9-1c5d8e3f7a64",
  diaSemana: "SABADO",
  horaInicio: "1970-01-01T20:00:00.000Z",
  horaFin: "1970-01-01T23:30:00.000Z",
};

export const TURNO_CENA_MARTES: TurnoPublico = {
  id: "5d8e1f30-6a92-4b7c-8c14-e2f9a0b3d651",
  diaSemana: "MARTES",
  horaInicio: "1970-01-01T20:00:00.000Z",
  horaFin: "1970-01-01T23:30:00.000Z",
};

// Un almuerzo y una cena por cada día con turnos, más los dos del sábado y el del martes que
// los tests referencian por id.
export const TURNOS: TurnoPublico[] = DIAS_CON_TURNOS.flatMap((diaSemana, indice) => {
  if (diaSemana === "SABADO") return [TURNO_ALMUERZO_SABADO, TURNO_CENA_SABADO];
  if (diaSemana === "MARTES") {
    return [
      {
        id: `6e0a4b7f-2c18-4d95-a3b6-8f1e5c9d0a2${indice}`,
        diaSemana,
        horaInicio: "1970-01-01T12:00:00.000Z",
        horaFin: "1970-01-01T15:00:00.000Z",
      },
      TURNO_CENA_MARTES,
    ];
  }
  return [
    {
      id: `7f1b5c80-3d29-4ea6-b4c7-9a2f6d0e1b3${indice}`,
      diaSemana,
      horaInicio: "1970-01-01T12:00:00.000Z",
      horaFin: "1970-01-01T15:00:00.000Z",
    },
    {
      id: `8a2c6d91-4e3a-4fb7-85d8-0b3a7e1f2c4${indice}`,
      diaSemana,
      horaInicio: "1970-01-01T20:00:00.000Z",
      horaFin: "1970-01-01T23:30:00.000Z",
    },
  ];
});
