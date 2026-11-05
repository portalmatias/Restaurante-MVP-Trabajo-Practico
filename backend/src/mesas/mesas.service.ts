import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Mesa, Prisma } from '@prisma/client';

import { estaUbicada, problemasDeUbicacion } from '../plano-mesas/layout-plano';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarMesaDto } from './dto/actualizar-mesa.dto';
import { CrearMesaDto } from './dto/crear-mesa.dto';

/** Estados de Reserva que cuentan como "activa" (config.yaml §6, invariante 1). */
const ESTADOS_RESERVA_ACTIVA = ['PENDIENTE', 'CONFIRMADA'] as const;

/** Reintentos ante conflicto de serialización (mismo patrón que `ReservasService`). */
const SERIALIZACION_MAX_INTENTOS = 3;

/**
 * Campos que devuelven las rutas de admin de mesas (`MesaRespuestaDto`). Lista de campos
 * permitidos: una columna nueva de `Mesa` (por ejemplo, la posición en el plano de
 * `plano-mesas`) no sale por estas rutas hasta sumarla acá y al contrato.
 */
const SELECT_MESA_ADMIN = {
  id: true,
  zonaId: true,
  capacidad: true,
  etiqueta: true,
} satisfies Prisma.MesaSelect;

function esCapacidadInvalida(capacidad: number): boolean {
  return !Number.isInteger(capacidad) || capacidad <= 0;
}

const MENSAJE_COORDENADAS_JUNTAS =
  'posX y posY van juntos: los dos con valor o los dos en null.';

/**
 * `posX` y `posY` llegan las dos o ninguna, y las dos con valor o las dos en `null`
 * (design.md D2 de `plano-mesas-admin`, paso 0). Ausente (`undefined`) no es lo mismo que
 * `null`: el DTO deja pasar los dos.
 */
function coordenadasVanJuntas(dto: ActualizarMesaDto): boolean {
  if ((dto.posX === undefined) !== (dto.posY === undefined)) {
    return false;
  }
  return (dto.posX === null) === (dto.posY === null);
}

/** Lo que ocupa una mesa en el plano: zona, posición (nula si no está ubicada) y tamaño. */
interface LugarDeMesa {
  zonaId: string;
  posX: number | null;
  posY: number | null;
  ancho: number;
  alto: number;
}

/**
 * Un cambio de zona sin `posX` ni `posY` deja la mesa sin ubicar: sus coordenadas eran de la
 * grilla de la zona vieja. Un `zonaId` igual al guardado no es un cambio de zona. Supone que
 * ya se validó que las coordenadas van juntas.
 */
function cambiaDeZonaSinUbicacion(mesa: Mesa, dto: ActualizarMesaDto): boolean {
  return (
    dto.zonaId !== undefined &&
    dto.zonaId !== mesa.zonaId &&
    dto.posX === undefined
  );
}

/** Paso 1 de D2: el lugar que resulta de aplicar el pedido a la mesa guardada. */
function lugarFinal(mesa: Mesa, dto: ActualizarMesaDto): LugarDeMesa {
  const sinUbicar = cambiaDeZonaSinUbicacion(mesa, dto);
  return {
    zonaId: dto.zonaId ?? mesa.zonaId,
    posX: sinUbicar ? null : dto.posX !== undefined ? dto.posX : mesa.posX,
    posY: sinUbicar ? null : dto.posY !== undefined ? dto.posY : mesa.posY,
    ancho: dto.ancho ?? mesa.ancho,
    alto: dto.alto ?? mesa.alto,
  };
}

function cambiaElLugar(mesa: Mesa, lugar: LugarDeMesa): boolean {
  return (
    lugar.zonaId !== mesa.zonaId ||
    lugar.posX !== mesa.posX ||
    lugar.posY !== mesa.posY ||
    lugar.ancho !== mesa.ancho ||
    lugar.alto !== mesa.alto
  );
}

/** "S2", "S2 y S3", "S2, S3 y S4". */
function enumerar(etiquetas: string[]): string {
  if (etiquetas.length <= 1) {
    return etiquetas.join('');
  }
  return `${etiquetas.slice(0, -1).join(', ')} y ${etiquetas[etiquetas.length - 1]}`;
}

/**
 * CRUD completo de Mesa. Las validaciones que necesitan consultar `Reserva` lo hacen
 * directo contra Prisma, sin depender de un `ReservasService` que todavía no existe
 * (nace en `reservas-crear`) — ver design.md → "Verificación de Reservas: consulta
 * directa a la tabla Reserva, no a un service".
 */
@Injectable()
export class MesasService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(dto: CrearMesaDto) {
    if (esCapacidadInvalida(dto.capacidad)) {
      throw new BadRequestException(
        'La capacidad de la mesa debe ser un entero positivo.',
      );
    }

    const zona = await this.prisma.zona.findUnique({
      where: { id: dto.zonaId },
    });
    if (!zona) {
      throw new NotFoundException('La zona indicada no existe.');
    }

    try {
      return await this.prisma.mesa.create({
        data: dto,
        select: SELECT_MESA_ADMIN,
      });
    } catch (error) {
      throw this.traducirErrorDePrisma(error, 'crear');
    }
  }

  async listar(zonaId?: string) {
    return this.prisma.mesa.findMany({
      where: zonaId ? { zonaId } : undefined,
      select: SELECT_MESA_ADMIN,
    });
  }

  /**
   * Edita etiqueta, capacidad y/o zona. Rechaza con `ConflictException` (`409`) si el
   * cambio dejaría inválida una Reserva activa (`PENDIENTE`/`CONFIRMADA`) existente sobre
   * esta Mesa: capacidad insuficiente (invariante 2) o Mesa fuera de la Zona de la Reserva
   * (invariante 3) — spec: "Edición de Mesa preserva las Reservas activas".
   *
   * Toda la validación y la escritura corren dentro de una única transacción
   * `Serializable`: sin esto, una Reserva podría crearse (por `reservas-crear`, una vez
   * exista) entre el `count` de Reservas activas y el `update` de la Mesa, dejando una
   * Reserva activa con más comensales que la nueva capacidad o en una Zona distinta a la
   * de la Mesa — violando los invariantes 2/3. `ReservasService.crearReserva` ya corre en
   * `Serializable`, así que Postgres detecta el conflicto real entre ambas transacciones
   * (mismo mecanismo que documenta `ZonasService.actualizar`).
   *
   * También edita la ubicación en el plano (`posX`, `posY`, `ancho`, `alto`, `forma`, change
   * `plano-mesas-admin`, design.md D2): después de las validaciones de arriba, rechaza una
   * coordenada a medias, un tamaño mayor que la grilla de la zona final, una mesa fuera de la
   * grilla y una superposición con otra mesa ubicada de la zona, en ese orden, solo si el
   * pedido cambia el lugar que ocupa la mesa.
   */
  async actualizar(id: string, dto: ActualizarMesaDto) {
    if (dto.capacidad !== undefined && esCapacidadInvalida(dto.capacidad)) {
      throw new BadRequestException(
        'La capacidad de la mesa debe ser un entero positivo.',
      );
    }

    for (let intento = 0; intento < SERIALIZACION_MAX_INTENTOS; intento++) {
      try {
        return await this.ejecutarActualizacion(id, dto);
      } catch (error) {
        const esConflictoDeSerializacion =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';
        if (!esConflictoDeSerializacion) {
          throw this.traducirErrorDePrisma(error, 'actualizar');
        }
        if (intento < SERIALIZACION_MAX_INTENTOS - 1) {
          continue;
        }
        throw new ConflictException(
          'No se pudo actualizar la mesa por una edición concurrente. Volvé a intentarlo.',
        );
      }
    }
    // Inalcanzable en la práctica (el loop siempre retorna o lanza), pero TypeScript
    // exige un camino de retorno explícito al final.
    throw new ConflictException(
      'No se pudo actualizar la mesa tras varios reintentos por edición concurrente.',
    );
  }

  private async ejecutarActualizacion(id: string, dto: ActualizarMesaDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const mesa = await tx.mesa.findUnique({ where: { id } });
        if (!mesa) {
          throw new NotFoundException('La mesa indicada no existe.');
        }

        if (dto.capacidad !== undefined) {
          const reservaQueNoAlcanza = await tx.reserva.count({
            where: {
              mesaId: id,
              estado: { in: [...ESTADOS_RESERVA_ACTIVA] },
              comensales: { gt: dto.capacidad },
            },
          });
          if (reservaQueNoAlcanza > 0) {
            throw new ConflictException(
              'La mesa tiene una reserva activa con más comensales que la nueva capacidad.',
            );
          }
        }

        if (dto.zonaId !== undefined && dto.zonaId !== mesa.zonaId) {
          const zonaDestino = await tx.zona.findUnique({
            where: { id: dto.zonaId },
          });
          if (!zonaDestino) {
            throw new NotFoundException('La zona indicada no existe.');
          }

          const reservasActivas = await tx.reserva.count({
            where: { mesaId: id, estado: { in: [...ESTADOS_RESERVA_ACTIVA] } },
          });
          if (reservasActivas > 0) {
            throw new ConflictException(
              'La mesa tiene reservas activas; no se puede cambiar de zona.',
            );
          }
        }

        // Paso 0 de D2 (`plano-mesas-admin`): va después de las validaciones existentes y
        // antes de comparar con el lugar guardado. Si no, un `posX` igual al guardado sin
        // `posY` se completaría con la coordenada guardada y pasaría como "sin cambios".
        if (!coordenadasVanJuntas(dto)) {
          throw new BadRequestException(MENSAJE_COORDENADAS_JUNTAS);
        }

        // Pasos 1 y 2: la comparación es contra la mesa leída en esta transacción, no contra
        // qué campos trae el pedido. Reenviar los mismos valores o cambiar solo la forma no
        // valida nada más, así un problema previo no bloquea la edición.
        const lugar = lugarFinal(mesa, dto);
        if (cambiaElLugar(mesa, lugar)) {
          await this.validarLugar(tx, mesa, lugar);
        }

        return tx.mesa.update({
          where: { id },
          data: cambiaDeZonaSinUbicacion(mesa, dto)
            ? { ...dto, posX: null, posY: null }
            : dto,
          select: SELECT_MESA_ADMIN,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Pasos 3 y 4 de D2 (`plano-mesas-admin`): el tamaño contra la grilla de la zona final
   * (también si la mesa queda sin ubicar, así un tamaño enorme no llega a la base), y si la
   * mesa queda ubicada, la grilla y las demás mesas ubicadas de esa zona. Lee dentro de la
   * transacción `Serializable`: dos ediciones que mueven mesas distintas a la misma celda leen
   * cada una la fila que escribe la otra, y Postgres aborta una de las dos (D3).
   */
  private async validarLugar(
    tx: Prisma.TransactionClient,
    mesa: Mesa,
    lugar: LugarDeMesa,
  ): Promise<void> {
    const zona = await tx.zona.findUnique({
      where: { id: lugar.zonaId },
      select: { planoColumnas: true, planoFilas: true },
    });
    if (!zona) {
      throw new NotFoundException('La zona indicada no existe.');
    }
    const grilla = `${zona.planoColumnas} por ${zona.planoFilas}`;

    if (lugar.ancho > zona.planoColumnas || lugar.alto > zona.planoFilas) {
      throw new BadRequestException(
        `La mesa no entra en la grilla de ${grilla}.`,
      );
    }

    const ubicada = { ...lugar, etiqueta: mesa.etiqueta };
    if (!estaUbicada(ubicada)) {
      return;
    }

    const otras = await tx.mesa.findMany({
      where: {
        zonaId: lugar.zonaId,
        id: { not: mesa.id },
        posX: { not: null },
        posY: { not: null },
      },
      select: {
        etiqueta: true,
        posX: true,
        posY: true,
        ancho: true,
        alto: true,
      },
    });
    const { fueraDeGrilla, superpuestaCon } = problemasDeUbicacion(
      zona,
      ubicada,
      otras,
    );
    if (fueraDeGrilla) {
      throw new BadRequestException(
        `La mesa queda fuera de la grilla de ${grilla}.`,
      );
    }
    if (superpuestaCon.length > 0) {
      throw new ConflictException(
        `La mesa se superpone con ${enumerar(superpuestaCon)}.`,
      );
    }
  }

  /**
   * Elimina físicamente una Mesa solo si no tiene ninguna Reserva asociada, de ningún
   * estado (`PENDIENTE`, `CONFIRMADA`, `CANCELADA` o `NO_SHOW`) — preserva el historial,
   * spec: "Baja de Mesa preserva las Reservas activas e históricas". La consulta previa
   * mejora el mensaje de error; la FK restrictiva de `Reserva.mesaId` es la garantía real
   * contra una Reserva insertada entre la consulta y el DELETE (design.md).
   */
  async eliminar(id: string) {
    const mesa = await this.prisma.mesa.findUnique({ where: { id } });
    if (!mesa) {
      throw new NotFoundException('La mesa indicada no existe.');
    }

    const reservasAsociadas = await this.prisma.reserva.count({
      where: { mesaId: id },
    });
    if (reservasAsociadas > 0) {
      throw new ConflictException(
        'No se puede eliminar una mesa con reservas asociadas.',
      );
    }

    try {
      await this.prisma.mesa.delete({ where: { id } });
    } catch (error) {
      throw this.traducirErrorDePrisma(error, 'eliminar');
    }
  }

  /**
   * Traduce los errores de Prisma que puede dejar escapar cualquier escritura de este
   * service a excepciones HTTP legibles, en vez de un `500` crudo: `P2002` (colisión de
   * `Mesa.etiqueta`, único) a `409`, `P2025` (la fila ya no existe — se borró o dejó de
   * cumplir el `where` concurrentemente) a `404`, `P2003` a `404` si la zona no existe al
   * crear/actualizar, o a `409` si reservas asociadas impiden eliminar la mesa.
   * Cualquier otro error se propaga sin tocar.
   */
  private traducirErrorDePrisma(
    error: unknown,
    operacion: 'crear' | 'actualizar' | 'eliminar',
  ): unknown {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return error;
    }
    if (error.code === 'P2002') {
      return new ConflictException('Ya existe una mesa con esa etiqueta.');
    }
    if (error.code === 'P2025') {
      return new NotFoundException('La mesa indicada no existe.');
    }
    if (error.code === 'P2003') {
      if (operacion !== 'eliminar') {
        return new NotFoundException('La zona indicada no existe.');
      }
      return new ConflictException(
        'No se puede eliminar una mesa con reservas asociadas.',
      );
    }
    return error;
  }
}
