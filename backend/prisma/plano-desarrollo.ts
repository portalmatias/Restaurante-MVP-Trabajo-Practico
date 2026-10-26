/**
 * Layout inicial del plano de mesas para el seed de desarrollo (change `plano-mesas`,
 * design.md D1 y spec `modelo-dominio`, requisito "Layout inicial del seed").
 *
 * Vive aparte de `catalogo.ts` a propósito: el catálogo también lo usa el seed de producción,
 * que se compila con `tsconfig.seed.json` (solo admite archivos de `prisma/`) y no modifica
 * mesas que ya existen. Cargar el plano en producción queda para un change propio; mientras
 * tanto, allí las mesas siguen "sin ubicar" y el plano muestra solo la lista textual.
 *
 * Idempotente: se escribe con `update` por clave natural (nombre de zona y etiqueta de mesa)
 * después de que el catálogo creó las filas. Una segunda corrida restaura el layout aunque
 * alguien haya movido una mesa (decisión consciente mientras no exista el editor de D6).
 */
import { FormaMesa, NombreZona, PrismaClient } from '@prisma/client';

import { MesaEnPlano, validarLayout } from '../src/plano-mesas/layout-plano';

interface MesaDelLayout extends MesaEnPlano {
  posX: number;
  posY: number;
  forma: FormaMesa;
}

interface PlanoDeZona {
  planoColumnas: number;
  planoFilas: number;
  mesas: MesaDelLayout[];
}

/** Mesas chicas arriba (junto a la entrada) y grandes abajo, con pasillo entre filas. */
export const LAYOUT_DESARROLLO: Record<NombreZona, PlanoDeZona> = {
  STANDARD: {
    planoColumnas: 12,
    planoFilas: 8,
    mesas: [
      { etiqueta: 'S1', forma: 'REDONDA', posX: 0, posY: 0, ancho: 1, alto: 1 },
      { etiqueta: 'S2', forma: 'REDONDA', posX: 2, posY: 0, ancho: 1, alto: 1 },
      {
        etiqueta: 'S3',
        forma: 'CUADRADA',
        posX: 5,
        posY: 0,
        ancho: 2,
        alto: 2,
      },
      {
        etiqueta: 'S4',
        forma: 'RECTANGULAR',
        posX: 0,
        posY: 3,
        ancho: 3,
        alto: 2,
      },
      {
        etiqueta: 'S5',
        forma: 'RECTANGULAR',
        posX: 5,
        posY: 3,
        ancho: 4,
        alto: 2,
      },
    ],
  },
  VIP: {
    planoColumnas: 10,
    planoFilas: 6,
    mesas: [
      { etiqueta: 'V1', forma: 'REDONDA', posX: 0, posY: 0, ancho: 1, alto: 1 },
      {
        etiqueta: 'V2',
        forma: 'CUADRADA',
        posX: 3,
        posY: 0,
        ancho: 2,
        alto: 2,
      },
      {
        etiqueta: 'V3',
        forma: 'RECTANGULAR',
        posX: 0,
        posY: 3,
        ancho: 3,
        alto: 2,
      },
      {
        etiqueta: 'V4',
        forma: 'RECTANGULAR',
        posX: 4,
        posY: 3,
        ancho: 6,
        alto: 2,
      },
    ],
  },
};

/**
 * Escribe las dimensiones de cada zona y la posición, el tamaño y la forma de cada mesa del
 * layout. Valida el layout completo antes de escribir nada: si una mesa se sale de la grilla o
 * se superpone con otra, falla sin tocar la base.
 */
export async function seedPlano(
  prisma: PrismaClient,
  log: (mensaje: string) => void = console.log,
): Promise<void> {
  for (const [zona, plano] of Object.entries(LAYOUT_DESARROLLO)) {
    const problemas = validarLayout(plano, plano.mesas);
    if (problemas.length > 0) {
      throw new Error(`Layout inválido para ${zona}: ${problemas.join(' ')}`);
    }
  }

  log('Seed: plano de mesas...');
  await prisma.$transaction(async (tx) => {
    for (const [zona, plano] of Object.entries(LAYOUT_DESARROLLO)) {
      await tx.zona.update({
        where: { nombre: zona as NombreZona },
        data: {
          planoColumnas: plano.planoColumnas,
          planoFilas: plano.planoFilas,
        },
      });
      for (const { etiqueta, forma, posX, posY, ancho, alto } of plano.mesas) {
        await tx.mesa.update({
          where: { etiqueta },
          data: { forma, posX, posY, ancho, alto },
        });
      }
    }
  });
}
