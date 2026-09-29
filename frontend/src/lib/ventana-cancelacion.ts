import { ARGENTINA_OFFSET_MS } from "./fecha-hora";

const MS_POR_HORA = 60 * 60 * 1000;

/**
 * Ayuda de navegación (design.md D9): estima si a `ahora` le faltan al menos
 * `ventanaCancelacionHoras` para el inicio del turno, solo para decidir si se ofrece el botón
 * "Cancelar mi reserva". El servidor vuelve a validar y es la única fuente de verdad.
 *
 * El inicio se arma como `inicioTurnoUtc` del backend: fecha + hora local de inicio + offset
 * fijo de Argentina, leído con `getUTC*`. El borde es inclusivo (exactamente la ventana antes
 * del inicio todavía se puede cancelar), igual que `cancelacion-turnos`.
 */
export function puedeCancelarSegunVentana(
  fecha: string,
  horaInicioTurno: string,
  ventanaCancelacionHoras: number,
  ahora: Date,
): boolean {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const hora = new Date(horaInicioTurno);
  const inicioNaiveMs = Date.UTC(
    anio,
    mes - 1,
    dia,
    hora.getUTCHours(),
    hora.getUTCMinutes(),
    hora.getUTCSeconds(),
    hora.getUTCMilliseconds(),
  );
  // La combinación fecha + hora está en hora local de Argentina: restar el (negativo) offset
  // da el instante UTC real.
  const inicioUtcMs = inicioNaiveMs - ARGENTINA_OFFSET_MS;

  return inicioUtcMs - ahora.getTime() >= ventanaCancelacionHoras * MS_POR_HORA;
}
