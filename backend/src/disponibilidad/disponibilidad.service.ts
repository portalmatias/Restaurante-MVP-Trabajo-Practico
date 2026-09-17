import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { cargarContexto } from './contexto/cargar-contexto';
import { ConsultarDisponibilidadDto } from './dto/consultar-disponibilidad.dto';
import { DisponibilidadRespuesta } from './dto/disponibilidad-respuesta.dto';
import {
  calcularLugaresRestantes,
  evaluarReglas,
} from './reglas/evaluar-reglas';
import { SolicitudDisponibilidad } from './reglas/tipos';

/**
 * `GET /disponibilidad` (design.md D1): la única pieza que junta las tres capas del
 * validador. Lee la base con `cargarContexto`, evalúa las reglas puras con el reloj del
 * sistema y arma la respuesta.
 *
 * La consulta **no** toma `bloquearTurnoFecha`: es una foto del momento y no reserva nada
 * (D6). El lock lo toma `reservas-crear`, que reusa `cargarContexto` y `evaluarReglas`
 * dentro de su transacción.
 */
@Injectable()
export class DisponibilidadService {
  constructor(private readonly prisma: PrismaService) {}

  async consultar(
    query: ConsultarDisponibilidadDto,
  ): Promise<DisponibilidadRespuesta> {
    const solicitud: SolicitudDisponibilidad = {
      // `fecha` ya pasó el DTO: es `YYYY-MM-DD` y existe como día del calendario. Se arma
      // con `Date.UTC` para que coincida con lo que Prisma devuelve para `@db.Date` (D4).
      fecha: fechaDeCalendario(query.fecha),
      turnoId: query.turnoId,
      zonaId: query.zonaId,
      comensales: query.comensales,
    };

    const contexto = await cargarContexto(this.prisma, solicitud);

    // El reloj se inyecta acá y en ningún otro lado: las reglas son puras (D1, D9).
    const motivos = evaluarReglas(contexto, solicitud, new Date());

    return {
      disponible: motivos.length === 0,
      lugaresRestantes: calcularLugaresRestantes(contexto),
      motivos,
    };
  }
}

/** `YYYY-MM-DD` → medianoche UTC de ese día, la forma en que viaja una `@db.Date` (D4). */
function fechaDeCalendario(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
}
