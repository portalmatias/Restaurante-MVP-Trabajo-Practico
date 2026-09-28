import { randomInt } from 'node:crypto';

import { PrismaService } from '../../src/prisma/prisma.service';

export interface OcuparMesasAjenasParams {
  prisma: PrismaService;
  zonaId: string;
  turnoId: string;
  fecha: Date;
  propias: string[];
  datosCliente: (sufijo: string) => {
    nombreCliente: string;
    emailCliente: string;
    telefonoCliente: string;
  };
  /**
   * Se llama con el id de cada reserva apenas se crea, antes de crear la siguiente. Así, si
   * un `create` falla a mitad del loop, quien llama ya registró las filas creadas hasta ese
   * momento y su limpieza por id las borra igual.
   */
  registrarId?: (id: string) => void;
}

const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

let contadorOcupacion = 0;

/**
 * `OCP` + 5 caracteres al azar: 8 alfanuméricos como cualquier `codigoReserva`. El azar evita
 * que dos archivos (cada uno con su propio registro de módulos de Jest y, por lo tanto, su
 * propio contador) o una corrida anterior interrumpida generen el mismo código.
 */
function codigoOcupacion(): string {
  let sufijo = '';
  for (let i = 0; i < 5; i++) {
    sufijo += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)];
  }
  return `OCP${sufijo}`;
}

/**
 * Ocupa, con una Reserva `CONFIRMADA` propia (1 comensal) para `turnoId` y `fecha`, todas las
 * mesas de `zonaId` que no estén en `propias` — en la práctica, las mesas del seed
 * (`S1..S5`, `V1..V4`), que son filas compartidas y por lo tanto siempre "libres" para un
 * turno nuevo creado por un test.
 *
 * Compartido entre `reservas-concurrencia.integration-spec.ts` y
 * `reservas-invariantes.integration-spec.ts`. Cada archivo tiene su propia política de
 * limpieza (uno limpia por `turnoId`, el otro por id individual), así que la función no impone
 * ninguna: devuelve los ids creados y, si se pasa `registrarId`, los informa uno por uno.
 *
 * `datosCliente` queda a cargo de quien llama porque cada archivo usa su propio prefijo de
 * nombre, email y teléfono para distinguir estas filas del resto de sus fixtures.
 */
export async function ocuparMesasAjenas({
  prisma,
  zonaId,
  turnoId,
  fecha,
  propias,
  datosCliente,
  registrarId,
}: OcuparMesasAjenasParams): Promise<string[]> {
  const ajenas = await prisma.mesa.findMany({
    where: { zonaId, id: { notIn: propias } },
    select: { id: true },
  });
  const idsCreados: string[] = [];
  for (const ajena of ajenas) {
    contadorOcupacion += 1;
    const creada = await prisma.reserva.create({
      data: {
        mesaId: ajena.id,
        turnoId,
        fecha,
        comensales: 1,
        estado: 'CONFIRMADA',
        codigoReserva: codigoOcupacion(),
        ...datosCliente(`ocupacion-${contadorOcupacion}`),
      },
    });
    idsCreados.push(creada.id);
    registrarId?.(creada.id);
  }
  return idsCreados;
}
