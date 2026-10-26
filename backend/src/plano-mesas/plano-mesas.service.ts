import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { fechaCalendarioDesdeIso } from '../common/timezone';
import { cargarContexto } from '../disponibilidad/contexto/cargar-contexto';
import { ConsultarDisponibilidadDto } from '../disponibilidad/dto/consultar-disponibilidad.dto';
import {
  calcularLugaresRestantes,
  evaluarReglas,
} from '../disponibilidad/reglas/evaluar-reglas';
import { SolicitudDisponibilidad } from '../disponibilidad/reglas/tipos';
import { PrismaService } from '../prisma/prisma.service';
import { PlanoMesasRespuesta } from './dto/plano-mesas-respuesta.dto';
import { calcularEstadoMesa } from './estado-mesa';
import { ordenarMesasPorEtiqueta } from './orden-mesas';
import { RELOJ } from './reloj';
import type { Reloj } from './reloj';

/**
 * `GET /plano-mesas` (change `plano-mesas`, design.md D2): el plano de una zona con el estado
 * de cada mesa y el mismo veredicto que `GET /disponibilidad`.
 *
 * Reutiliza exactamente las piezas de la consulta y de la creación (`cargarContexto`,
 * `evaluarReglas`, `calcularLugaresRestantes`): no hay una segunda definición de "libre". El
 * estado de cada mesa sale solo de `contexto.mesasLibres`.
 *
 * Solo lee: no toma `bloquearTurnoFecha` ni escribe (D4), así que no puede degradar la defensa
 * contra la doble reserva. Las mesas libres y la lista de mesas de la zona se leen en una misma
 * transacción `RepeatableRead`, para que las dos vean la misma foto de la base aunque el admin
 * borre o mueva una mesa entre medio.
 */
@Injectable()
export class PlanoMesasService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {}

  async consultar(
    query: ConsultarDisponibilidadDto,
  ): Promise<PlanoMesasRespuesta> {
    const solicitud: SolicitudDisponibilidad = {
      fecha: fechaCalendarioDesdeIso(query.fecha),
      turnoId: query.turnoId,
      zonaId: query.zonaId,
      comensales: query.comensales,
    };

    const { contexto, zona, mesas } = await this.prisma.$transaction(
      async (tx) => {
        // Prisma no tiene una opción de solo lectura: se declara como primera sentencia, así
        // Postgres rechaza cualquier escritura que llegara a colarse por esta ruta.
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        // `cargarContexto` responde 404 si el turno o la zona no existen, con los mismos
        // textos que `GET /disponibilidad`.
        const contexto = await cargarContexto(tx, solicitud);
        const zona = await tx.zona.findUniqueOrThrow({
          where: { id: solicitud.zonaId },
          select: { nombre: true, planoColumnas: true, planoFilas: true },
        });
        const mesas = await tx.mesa.findMany({
          where: { zonaId: solicitud.zonaId },
          select: {
            id: true,
            etiqueta: true,
            capacidad: true,
            forma: true,
            posX: true,
            posY: true,
            ancho: true,
            alto: true,
          },
        });
        return { contexto, zona, mesas };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

    const motivos = evaluarReglas(contexto, solicitud, this.reloj());
    const libres = new Set(contexto.mesasLibres.map((mesa) => mesa.id));

    return {
      zona: zona.nombre,
      columnas: zona.planoColumnas,
      filas: zona.planoFilas,
      disponible: motivos.length === 0,
      lugaresRestantes: calcularLugaresRestantes(contexto),
      motivos,
      // El `id` solo sirve para cruzar con `mesasLibres`: no sale en la respuesta (D3).
      mesas: ordenarMesasPorEtiqueta(mesas).map(({ id, ...mesa }) => ({
        ...mesa,
        estado: calcularEstadoMesa(
          { id, capacidad: mesa.capacidad },
          libres,
          solicitud.comensales,
        ),
      })),
    };
  }
}
