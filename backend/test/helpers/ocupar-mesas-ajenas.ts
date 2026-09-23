import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Ocupa, con una Reserva `CONFIRMADA` propia (1 comensal), todas las mesas que YA existan en
 * `zonaId` para ese turno/fecha y no estén en `propias` — en la práctica, las mesas del seed
 * (`S1..S5`, `V1..V4`), que son filas compartidas y por lo tanto siempre "libres" para un
 * turno nuevo creado por un test.
 *
 * Compartido entre `reservas-concurrencia.integration-spec.ts` y
 * `reservas-invariantes.integration-spec.ts` (mismo problema, mismo fix; cubic, PR #40,
 * hallazgo P3). Cada archivo llamante tiene su propia política de limpieza (uno limpia por
 * `turnoId` en un `limpiarFixtures` global, el otro acumula cada id en un array `reservaIds`
 * propio), así que la función no impone ninguna: devuelve los ids de las reservas que creó y
 * deja que quien llama decida qué hacer con ellos.
 *
 * `datosCliente` queda a cargo de quien llama porque cada archivo usa su propio prefijo de
 * nombre/email/teléfono para distinguir estas filas "ajenas" del resto de sus fixtures.
 */
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
}

let contadorOcupacion = 0;

export async function ocuparMesasAjenas({
  prisma,
  zonaId,
  turnoId,
  fecha,
  propias,
  datosCliente,
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
        codigoReserva: `OCP${String(contadorOcupacion).padStart(5, '0')}`,
        ...datosCliente(`ocupacion-${contadorOcupacion}`),
      },
    });
    idsCreados.push(creada.id);
  }
  return idsCreados;
}
