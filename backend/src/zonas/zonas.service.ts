import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ActualizarZonaDto } from './dto/actualizar-zona.dto';

/** Reintentos ante conflicto de serialización (mismo patrón que `ReservasService`). */
const SERIALIZACION_MAX_INTENTOS = 3;

/**
 * Solo lectura y actualización de configuración: `Zona.nombre` es un enum de Prisma con
 * exactamente dos valores (`STANDARD`, `VIP`, definidos en `modelo-dominio`), así que no
 * hay alta ni baja — ver design.md → "Zona: solo lectura y actualización, sin alta ni baja".
 */
@Injectable()
export class ZonasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar() {
    return this.prisma.zona.findMany();
  }

  /**
   * Actualiza los valores de configuración de una Zona existente. Rechaza con
   * `BadRequestException` si, combinando los campos del `dto` con los que ya están
   * persistidos (para los que no vienen en el `dto`), el mínimo de comensales resultante
   * queda por encima del máximo (spec: "Actualización de configuración de Zona").
   *
   * La lectura de los valores persistidos y la escritura corren dentro de una única
   * transacción `Serializable`: sin esto, dos `PATCH` concurrentes que tocan campos
   * opuestos (uno baja `maxComensales`, el otro sube `minComensales`) pueden validar cada
   * uno contra una foto ya vieja del otro y terminar persistiendo un rango inválido. Bajo
   * `Serializable` Postgres aborta una de las dos transacciones con un conflicto de
   * serialización; se traduce a `409 Conflict` en vez de dejarlo escapar como `500`
   * (mismo mecanismo que ya usa `ReservasService.crearReserva`).
   */
  async actualizar(id: string, dto: ActualizarZonaDto) {
    for (let intento = 0; intento < SERIALIZACION_MAX_INTENTOS; intento++) {
      try {
        return await this.ejecutarActualizacion(id, dto);
      } catch (error) {
        const esConflictoDeSerializacion =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';
        if (!esConflictoDeSerializacion) {
          throw error;
        }
        if (intento < SERIALIZACION_MAX_INTENTOS - 1) {
          continue;
        }
        throw new ConflictException(
          'No se pudo actualizar la zona por una edición concurrente. Volvé a intentarlo.',
        );
      }
    }
    // Inalcanzable en la práctica (el loop siempre retorna o lanza), pero TypeScript
    // exige un camino de retorno explícito al final.
    throw new ConflictException(
      'No se pudo actualizar la zona tras varios reintentos por edición concurrente.',
    );
  }

  private async ejecutarActualizacion(id: string, dto: ActualizarZonaDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const zona = await tx.zona.findUnique({ where: { id } });
        if (!zona) {
          throw new NotFoundException('La zona indicada no existe.');
        }

        const minComensalesEfectivo = dto.minComensales ?? zona.minComensales;
        const maxComensalesEfectivo = dto.maxComensales ?? zona.maxComensales;
        if (minComensalesEfectivo > maxComensalesEfectivo) {
          throw new BadRequestException(
            'El mínimo de comensales no puede ser mayor que el máximo.',
          );
        }

        return tx.zona.update({ where: { id }, data: dto });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
